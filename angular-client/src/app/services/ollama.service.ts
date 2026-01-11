import { Injectable } from '@angular/core';
import { SettingsService, Settings, ThinkLevel } from './settings.service';
import { RulesService } from './rules.service';
import { LogService } from './log.service';

export interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ReviewIssue {
    line: number;
    object: string;           // The specific variable/code snippet causing the issue
    type: 'Critical' | 'Warning';  // Type of issue
    violated_rule: string;    // Rule title/description
    suggested_change: string; // Suggestion to fix
}

export interface ReviewResult {
    issues: ReviewIssue[];
    error?: string;
}

export interface StreamingCallbacks {
    onThinking?: (thinking: string) => void;
    onContent?: (content: string) => void;
    onDone?: () => void;
}

@Injectable({
    providedIn: 'root'
})
export class OllamaService {
    private abortController: AbortController | null = null;

    constructor(private rulesService: RulesService, private logService: LogService) { }

    /**
     * Get available models from Ollama server
     */
    async getModels(host: string, apiKey: string): Promise<string[]> {
        const url = `${host}/api/tags`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data = await response.json();
        return data.models?.map((m: any) => m.name) || [];
    }

    /**
     * Auto-detect programming language of source code
     */
    async detectLanguage(code: string, settings: Settings): Promise<string | null> {
        const systemPrompt = `Analyze the provided source code to determine its programming language.
        
INPUT FORMAT:
- The source code.

OUTPUT FORMAT:
- You must return ONLY a valid JSON object.
- If the detected language is not in the enum, return null

JSON SCHEMA RESULT:
{ "language": "enum (${this.rulesService.getLanguages()}, null)" }`;

        const userPrompt = `### SOURCE CODE:
${code.substring(0, 2000)}`;

        const messages: OllamaMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        try {
            const response = await this.chat(messages, settings);
            const json = JSON.parse(response);
            return json.language;
        } catch (error) {
            console.error('Failed to detect language:', error);
            return null;
        }
    }

    /**
     * Simple chat without streaming (for quick queries like language detection)
     */
    private async chat(messages: OllamaMessage[], settings: Settings): Promise<string> {
        const url = `${settings.host}/api/chat`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (settings.apiKey) {
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: settings.model,
                messages,
                stream: false,
                format: 'json'
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.message?.content || '';
    }

    /**
     * Review code with streaming
     */
    async reviewCodeStream(
        code: { num: number; content: string }[],
        language: string,
        settings: Settings,
        callbacks: StreamingCallbacks
    ): Promise<ReviewResult> {
        this.abortController = new AbortController();

        const systemPrompt = this.getSystemPrompt(language);
        const userPrompt = this.getUserPrompt(code, language);

        const messages: OllamaMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        try {
            const response = await this.chatStream(messages, settings, callbacks);
            const result = this.parseReviewResponse(response);
            console.log(result)
            return result;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request cancelled');
            }
            throw error;
        }
    }

    /**
     * Cancel ongoing request
     */
    cancelRequest(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Chat with streaming support
     */
    private async chatStream(
        messages: OllamaMessage[],
        settings: Settings,
        callbacks: StreamingCallbacks
    ): Promise<string> {
        const url = `${settings.host}/api/chat`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (settings.apiKey) {
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
        }

        const body: any = {
            model: settings.model,
            messages,
            stream: true,
        };

        // Add think parameter based on model
        const isGptOss = settings.model.toLowerCase().includes('gpt-oss');
        if (isGptOss && typeof settings.thinkLevel === 'string') {
            body.think = settings.thinkLevel;
        } else if (!isGptOss && typeof settings.thinkLevel === 'boolean') {
            body.think = settings.thinkLevel;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: this.abortController?.signal,
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';
        let fullThinking = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const json = JSON.parse(line);

                    // Handle thinking content
                    if (json.message?.thinking) {
                        fullThinking += json.message.thinking;
                        callbacks.onThinking?.(fullThinking);
                    }

                    // Handle regular content
                    if (json.message?.content) {
                        fullContent += json.message.content;
                        callbacks.onContent?.(fullContent);
                    }

                    // Check if done
                    if (json.done) {
                        callbacks.onDone?.();
                    }
                } catch {
                    // Ignore parse errors for incomplete JSON
                }
            }
        }

        this.logService.log({ request: body, response: { thinking: fullThinking, content: fullContent } });

        return fullContent;
    }

    /**
     * Parse AI response to ReviewResult
     */
    private parseReviewResponse(response: string): ReviewResult {
        try {
            let jsonStr = response.trim();

            // Find JSON object or array in response
            const jsonMatch = jsonStr.match(/[\{\[][\s\S]*[\}\]]/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            let issueArray: any[] = [];
            const parsed = JSON.parse(jsonStr);

            // Handle both array format and object with violations/issues property
            if (Array.isArray(parsed)) {
                issueArray = parsed;
            } else {
                issueArray = parsed.violations || parsed.issues || [];
            }

            const issues: ReviewIssue[] = [];

            if (Array.isArray(issueArray)) {
                for (const issue of issueArray) {
                    if (typeof issue.line === 'number') {
                        issues.push({
                            line: issue.line,
                            object: issue.object || issue.position || '',
                            type: issue.type === 'Critical' ? 'Critical' : 'Warning',
                            violated_rule: issue.violated_rule || issue.rule || 'Unknown',
                            suggested_change: issue.suggested_change || issue.suggestion || '',
                        });
                    }
                }
            }

            return { issues };
        } catch (parseError) {
            console.error('Failed to parse review response:', parseError);
            return {
                issues: [],
                error: 'Failed to parse AI response. Please try again.',
            };
        }
    }

    /**
     * Get system prompt for code review
     */
    private getSystemPrompt(language: string): string {
        return `### ROLE:
You are an expert code reviewer specializing in ${language}. Your mission is to audit source code against a specific set of rules provided in JSON format.

### INPUT SPECIFICATION:
You will receive two inputs:
1. **RULES TO ENFORCE:**
- The rules are provided in the following JSON format:
\`\`\`json
{
  "language": "string (The target programming language)",
  "critical_rules": [
    {
      "no": "string/number (Rule ID)",
      "description": "string (Logic and reasoning to identify the violation)",
      "target": "string (The specific code element, pattern, or scope to inspect)"
    }
  ],
  "warning_rules": [
    {
      "no": "string/number (Rule ID)",
      "description": "string (Logic and reasoning to identify the violation)",
      "target": "string (The specific code element, pattern, or scope to inspect)"
    }
  ]
}
\`\`\`
- Critical Severity: If a violation matches a rule inside the critical_rules array, set "type": "Critical".
- Warning Severity: If a violation matches a rule inside the warning_rules array, set "type": "Warning".
- Contextual Analysis: Use the description to understand the "Why" and the target to understand the "Where" for each rule.

2. **SOURCE CODE:** 
- Provided with line identifiers in the format \`L[number] | \`.
- You must use the exact number from the label for reporting. Do not recalculate or offset line numbers.

### OUTPUT SPECIFICATION:
- Return ONLY a valid JSON object. No preamble, no markdown code blocks, no postscript.
\`\`\`json
{
  "violations": [
    {
      "line": number (use the exact number following the 'L' prefix),
      "object": "string (the specific variable name or code snippet causing the issue; MUST be extracted verbatim from the source, do not infer or add external information)",
      "type": "Critical" | "Warning",
      "violated_rule": "string (description of the rule being broken)",
      "suggested_change": "string (clear instructions or a code snippet to fix the issue)"
    }
  ]
}
\`\`\`
- If no violations are found, return: {"violations": []}.`;
    }

    /**
     * Get user prompt with code
     */
    private getUserPrompt(code: { num: number; content: string }[], language: string): string {

        const rules = this.rulesService.getRules(language);
        return `### RULES TO ENFORCE:
${JSON.stringify(rules)}

### SOURCE CODE:
${formatCodeForLlm(code)}
`;
    }
}

function formatCodeForLlm(code: { num: number; content: string }[]) {
    if (!code) return "No specific rules provided. Apply general best practices.";

    return code
        .map(x => `L${x.num}| ${x.content}`)
        .join("\n");
}
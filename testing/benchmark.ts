/**
 * Benchmark Runner for Code Review AI Models
 * 
 * Usage: npx tsx src/testing/benchmark.ts
 * 
 * Evaluates gpt-oss (low/medium/high) and qwen3:8b (no-think/think)
 * on VB.NET and SQL Server test datasets.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
    RuleSet,
    Dataset,
    ExpectedViolation,
    ReviewIssue,
    ModelConfig,
    RunResult,
    ModelResult,
    BenchmarkResult
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const RUNS_PER_MODEL = 1;

// Model configurations to test
const MODEL_CONFIGS: ModelConfig[] = [
    { name: 'gpt-oss:20b', model: 'gpt-oss:20b', think: 'low' },
    { name: 'gpt-oss:20b', model: 'gpt-oss:20b', think: 'medium' },
    { name: 'gpt-oss:20b', model: 'gpt-oss:20b', think: 'high' },
    { name: 'qwen3:8b', model: 'qwen3:8b', think: false },
    { name: 'qwen3:8b', model: 'qwen3:8b', think: true },
];

// Load JSON files
function loadJson<T>(filePath: string): T {
    const fullPath = path.resolve(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as T;
}

// Format code with line numbers for LLM
function formatCodeForLlm(code: string): string {
    return code
        .split('\n')
        .map((line, idx) => `L${idx + 1}| ${line}`)
        .join('\n');
}

// Build system prompt
function getSystemPrompt(language: string): string {
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

// Build user prompt
function getUserPrompt(code: string, rules: RuleSet): string {
    return `### RULES TO ENFORCE:
${JSON.stringify(rules)}

### SOURCE CODE:
${formatCodeForLlm(code)}
`;
}

// Call Ollama API
async function callOllama(
    model: string,
    think: 'low' | 'medium' | 'high' | boolean,
    systemPrompt: string,
    userPrompt: string
): Promise<{ content: string; outputTokens: number; responseTimeMs: number }> {
    const url = `${OLLAMA_HOST}/api/chat`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (OLLAMA_API_KEY) {
        headers['Authorization'] = `${OLLAMA_API_KEY}`;
    }

    console.log(OLLAMA_HOST)
    console.log(OLLAMA_API_KEY)

    const body: any = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        stream: false,
        think,
    };

    const startTime = Date.now();
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const responseTimeMs = Date.now() - startTime;
    const content = data.message?.content || '';
    const outputTokens = data.eval_count || content.length / 4; // Estimate if not provided

    return { content, outputTokens, responseTimeMs };
}

// Parse AI response to violations
function parseResponse(response: string): ReviewIssue[] {
    try {
        let jsonStr = response.trim();
        const jsonMatch = jsonStr.match(/[\{\[][\s\S]*[\}\]]/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);
        let issueArray: any[] = [];

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
        return issues;
    } catch {
        return [];
    }
}

// Compare detected issues with expected violations
function calculateMetrics(
    detected: ReviewIssue[],
    expected: ExpectedViolation[]
): { tp: number; fp: number; fn: number } {
    let tp = 0;
    let fp = 0;
    const matchedExpected = new Set<number>();

    for (const det of detected) {
        let found = false;
        for (let i = 0; i < expected.length; i++) {
            if (matchedExpected.has(i)) continue;
            const exp = expected[i];
            // Match by line and type
            if (det.line === exp.line && det.type === exp.type) {
                tp++;
                matchedExpected.add(i);
                found = true;
                break;
            }
        }
        if (!found) {
            fp++;
        }
    }

    const fn = expected.length - matchedExpected.size;
    return { tp, fp, fn };
}

// Run benchmark for a single model configuration
async function runBenchmarkForModel(
    config: ModelConfig,
    datasets: { rules: RuleSet; dataset: Dataset }[]
): Promise<ModelResult> {
    const modeName = typeof config.think === 'boolean'
        ? (config.think ? 'Think' : 'No-think')
        : config.think;

    console.error(`Testing ${config.name} (${modeName})...`);

    const runs: RunResult[] = [];

    for (let runIdx = 0; runIdx < RUNS_PER_MODEL; runIdx++) {
        console.error(`  Run ${runIdx + 1}/${RUNS_PER_MODEL}`);
        let totalTp = 0, totalFp = 0, totalFn = 0;
        let totalResponseTime = 0;
        let totalOutputTokens = 0;

        for (const { rules, dataset } of datasets) {
            const systemPrompt = getSystemPrompt(dataset.language);

            for (const testCase of dataset.testCases) {
                try {
                    const userPrompt = getUserPrompt(testCase.sourceCode, rules);
                    const result = await callOllama(
                        config.model,
                        config.think,
                        systemPrompt,
                        userPrompt
                    );

                    totalResponseTime += result.responseTimeMs;
                    totalOutputTokens += result.outputTokens;

                    const detected = parseResponse(result.content);
                    const metrics = calculateMetrics(detected, testCase.expectedViolations);

                    totalTp += metrics.tp;
                    totalFp += metrics.fp;
                    totalFn += metrics.fn;

                    // Log completed test case
                    console.error(`    ✓ ${testCase.id} | TP:${metrics.tp} FP:${metrics.fp} FN:${metrics.fn} | ${result.responseTimeMs}ms`);
                } catch (error) {
                    console.error(`    ✗ ${testCase.id}: ${error}`);
                    totalFn += testCase.expectedViolations.length;
                }
            }
        }

        const totalCases = datasets.reduce((sum, d) => sum + d.dataset.testCases.length, 0);
        const avgResponseTime = totalResponseTime / totalCases;
        const outputSpeedTps = totalOutputTokens / (totalResponseTime / 1000);

        runs.push({
            responseTimeMs: avgResponseTime,
            outputTokens: totalOutputTokens,
            outputSpeedTps,
            truePositives: totalTp,
            falsePositives: totalFp,
            falseNegatives: totalFn,
        });
    }

    // Select best run by F1 score
    const bestRun = runs.reduce((best, run) => {
        const precision = run.truePositives / (run.truePositives + run.falsePositives) || 0;
        const recall = run.truePositives / (run.truePositives + run.falseNegatives) || 0;
        const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

        const bestPrecision = best.truePositives / (best.truePositives + best.falsePositives) || 0;
        const bestRecall = best.truePositives / (best.truePositives + best.falseNegatives) || 0;
        const bestF1 = bestPrecision + bestRecall > 0 ? 2 * bestPrecision * bestRecall / (bestPrecision + bestRecall) : 0;

        return f1 > bestF1 ? run : best;
    });

    const precision = bestRun.truePositives / (bestRun.truePositives + bestRun.falsePositives) || 0;
    const recall = bestRun.truePositives / (bestRun.truePositives + bestRun.falseNegatives) || 0;
    const f1Score = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    const accPerToken = bestRun.truePositives / bestRun.outputTokens || 0;

    return {
        modelName: config.name,
        mode: modeName,
        runs,
        bestRun,
        precision: Math.round(precision * 10000) / 100,
        recall: Math.round(recall * 10000) / 100,
        f1Score: Math.round(f1Score * 10000) / 100,
        accPerToken: Math.round(accPerToken * 10000) / 100,
    };
}

// Main benchmark function
async function runBenchmark(): Promise<BenchmarkResult> {
    console.error('Loading datasets and rules...');

    // Load rules
    const vbRules = loadJson<RuleSet>('./rules/vb-rules.json');
    const sqlRules = loadJson<RuleSet>('./rules/sql-rules.json');

    // Load datasets
    const vbDataset = loadJson<Dataset>('./datasets/vb-dataset.json');
    const sqlDataset = loadJson<Dataset>('./datasets/sql-dataset.json');

    const datasets = [
        { rules: vbRules, dataset: vbDataset },
        { rules: sqlRules, dataset: sqlDataset },
    ];

    const totalExpectedViolations = datasets.reduce((sum, d) =>
        sum + d.dataset.testCases.reduce((s, tc) => s + tc.expectedViolations.length, 0), 0);

    console.error(`Total test cases: ${vbDataset.testCases.length + sqlDataset.testCases.length}`);
    console.error(`Total expected violations: ${totalExpectedViolations}`);
    console.error('');

    const modelResults: ModelResult[] = [];

    for (const config of MODEL_CONFIGS) {
        try {
            const result = await runBenchmarkForModel(config, datasets);
            modelResults.push(result);
        } catch (error) {
            console.error(`Failed to test ${config.name}: ${error}`);
        }
    }

    const benchmarkResult: BenchmarkResult = {
        timestamp: new Date().toISOString(),
        datasets: [
            { name: 'VB.NET', totalCases: vbDataset.testCases.length, totalExpectedViolations: vbDataset.testCases.reduce((s, tc) => s + tc.expectedViolations.length, 0) },
            { name: 'SQL Server', totalCases: sqlDataset.testCases.length, totalExpectedViolations: sqlDataset.testCases.reduce((s, tc) => s + tc.expectedViolations.length, 0) },
        ],
        models: modelResults,
    };

    return benchmarkResult;
}

// Run and output results
runBenchmark()
    .then(result => {
        console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.error('Benchmark failed:', error);
        process.exit(1);
    });
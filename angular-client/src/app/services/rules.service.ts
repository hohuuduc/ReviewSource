import { Injectable } from '@angular/core';
import { NeutralinoService } from './neutralino.service';

interface DirectoryEntry {
    entry: string;
    type: 'FILE' | 'DIRECTORY';
}

export interface RuleItem {
    no: number;
    description: string;
    target: string;
}

export interface LanguageRules {
    language: string;
    critical_rules: RuleItem[];
    warning_rules: RuleItem[];
}

@Injectable({
    providedIn: 'root'
})
export class RulesService {
    private rulesDir = '.rules';
    private cachedRules: Map<string, LanguageRules> = new Map();

    constructor(private neutralinoService: NeutralinoService) { }

    /**
     * Load all rules from .rules directory
     */
    async loadAllRules(): Promise<string[]> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.warn('Rules loading not available in browser mode');
            return [];
        }

        try {
            const entries = await Neutralino.filesystem.readDirectory(this.rulesDir);

            for (const entry of entries) {
                if (entry.type === 'FILE' && entry.entry.endsWith('.md')) {
                    const filePath = `${this.rulesDir}/${entry.entry}`;
                    const content = await Neutralino.filesystem.readFile(filePath);
                    const language = entry.entry.replace('.md', '');

                    const languageRules = this.parseRulesFile(language, content);
                    this.cachedRules.set(languageRules.language, languageRules);
                }
            }

            return Array.from(this.cachedRules.keys());
        } catch (error) {
            console.warn(`Rules directory not found or error reading: ${this.rulesDir}`, error);
            return [];
        }
    }

    getLanguages(): string[] {
        return Array.from(this.cachedRules.keys());
    }

    getRules(language: string): LanguageRules | undefined {
        return this.cachedRules.get(language);
    }

    /**
     * Parse rules file content
     */
    private parseRulesFile(language: string, content: string): LanguageRules {
        const result: LanguageRules = {
            language,
            critical_rules: [],
            warning_rules: []
        };

        const sections = content.split(/^## /gm);

        for (const section of sections) {
            if (!section.trim()) continue;

            const lines = section.split('\n');
            const sectionTitle = lines[0].trim().toLowerCase();
            const sectionContent = lines.slice(1).join('\n');

            if (sectionTitle === 'critical') {
                result.critical_rules = this.parseRulesSection(sectionContent);
            } else if (sectionTitle === 'warning') {
                result.warning_rules = this.parseRulesSection(sectionContent);
            }
        }

        return result;
    }

    /**
     * Parse a rules section
     */
    private parseRulesSection(sectionContent: string): RuleItem[] {
        const rules: RuleItem[] = [];
        const rulePattern = /(\d+)\.\s*(.+?)(?:\r?\n|$)([\s\S]*?)(?=(?:\d+\.\s)|$)/g;

        let match;
        while ((match = rulePattern.exec(sectionContent)) !== null) {
            const no = parseInt(match[1], 10);
            const ruleName = match[2].trim();
            const ruleBody = match[3] || '';

            const descMatch = ruleBody.match(/Description:\s*(.+?)(?:\r?\n|$)/i);
            const description = descMatch ? descMatch[1].trim() : ruleName;

            const targetMatch = ruleBody.match(/Target(?:\s*Object)?:\s*(.+?)(?:\r?\n|$)/i);
            const target = targetMatch ? targetMatch[1].trim() : '';

            rules.push({ no, description, target });
        }

        return rules;
    }

    /**
     * Format rules for AI prompt
     */
    formatRulesForPrompt(rules: LanguageRules): string {
        let output = `Rules for ${rules.language}:\n\n`;

        if (rules.critical_rules.length > 0) {
            output += '## Critical Rules:\n';
            for (const rule of rules.critical_rules) {
                output += `${rule.no}. ${rule.description}`;
                if (rule.target) {
                    output += ` (Target: ${rule.target})`;
                }
                output += '\n';
            }
            output += '\n';
        }

        if (rules.warning_rules.length > 0) {
            output += '## Warning Rules:\n';
            for (const rule of rules.warning_rules) {
                output += `${rule.no}. ${rule.description}`;
                if (rule.target) {
                    output += ` (Target: ${rule.target})`;
                }
                output += '\n';
            }
        }

        return output;
    }
}

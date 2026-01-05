import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ReviewIssue } from '../../services/ollama.service';

export interface CodeLine {
    num: number;
    content: string;
    isError: boolean;
    issues?: ReviewIssue[];
}

@Component({
    selector: 'app-code-editor',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './code-editor.component.html',
    styleUrl: './code-editor.component.scss'
})
export class CodeEditorComponent {
    @Input() codeLines: CodeLine[] = [];
    @Input() currentLanguage = 'detect';
    @Input() availableLanguages: { label: string, value: string }[] = [];
    @Input() languageDisabled = false;
    @Input() title: string = "";
    @Input() singleMode: boolean = false;
    @Input() pasteEnabled: boolean = true;

    isCollapsed = false;

    constructor(private sanitizer: DomSanitizer) { }

    @Output() languageChange = new EventEmitter<string>();

    @Output() issueClicked = new EventEmitter<{ event: MouseEvent, issues: ReviewIssue[] }>();
    @Output() codePasted = new EventEmitter<string>();

    @HostListener('window:keydown', ['$event'])
    async handleKeyboardEvent(event: KeyboardEvent) {
        if (event.ctrlKey && event.key === 'v' && this.pasteEnabled) {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    this.codePasted.emit(text);
                }
            } catch (err) {
                console.error('Failed to read clipboard:', err);
            }
        }
    }

    onLanguageChange(language: string) {
        this.languageChange.emit(language);
    }

    toggleCollapse() {
        if (this.singleMode) return;
        this.isCollapsed = !this.isCollapsed;
    }



    onContentClick(event: MouseEvent, line: CodeLine) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('critical-text') || target.classList.contains('warning-text')) {
            const issueIndices = target.dataset['issueIndices'];
            if (issueIndices && line.issues) {
                const indices = issueIndices.split(',').map(i => parseInt(i, 10));
                const issues = indices.map(i => line.issues![i]).filter(Boolean);
                if (issues.length > 0) {
                    this.issueClicked.emit({ event, issues });
                }
            }
        }
    }

    highlightObject(line: CodeLine): SafeHtml {
        const content = line.content || ' ';

        if (!line.issues || line.issues.length === 0) {
            return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(content));
        }

        // Group issues by object
        const objectGroups = new Map<string, { indices: number[], hasCritical: boolean, position: number }>();

        line.issues.forEach((issue, index) => {
            const position = content.indexOf(issue.object);
            if (position === -1) return;

            const existing = objectGroups.get(issue.object);
            if (existing) {
                existing.indices.push(index);
                if (issue.type === 'Critical') {
                    existing.hasCritical = true;
                }
            } else {
                objectGroups.set(issue.object, {
                    indices: [index],
                    hasCritical: issue.type === 'Critical',
                    position
                });
            }
        });

        // Sort by position descending (process from end to start)
        const sortedGroups = Array.from(objectGroups.entries())
            .sort((a, b) => b[1].position - a[1].position);

        let escapedContent = this.escapeHtml(content);

        // Apply highlights from end to start to preserve positions
        for (const [object, { indices, hasCritical, position }] of sortedGroups) {
            const escapedObject = this.escapeHtml(object);
            const highlightClass = hasCritical ? 'critical-text' : 'warning-text';

            // Recalculate position in escaped content
            const escapedPosition = this.escapeHtml(content.substring(0, position)).length;

            const before = escapedContent.substring(0, escapedPosition);
            const after = escapedContent.substring(escapedPosition + escapedObject.length);

            escapedContent = `${before}<span class="${highlightClass}" data-issue-indices="${indices.join(',')}">${escapedObject}</span>${after}`;
        }

        return this.sanitizer.bypassSecurityTrustHtml(escapedContent);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

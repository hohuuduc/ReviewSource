import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewIssue } from '../../services/ollama.service';

@Component({
    selector: 'app-issue-tooltip',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './issue-tooltip.component.html',
    styleUrl: './issue-tooltip.component.scss'
})
export class IssueTooltipComponent {
    @Input() active = false;
    @Input() issues: ReviewIssue[] = [];
    @Input() style: { top: string; left: string } = { top: '0px', left: '0px' };
}

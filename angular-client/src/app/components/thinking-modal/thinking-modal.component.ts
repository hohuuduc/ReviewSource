import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-thinking-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './thinking-modal.component.html',
    styleUrl: './thinking-modal.component.scss'
})
export class ThinkingModalComponent {
    @Input() active = false;
    @Input() status = 'Analyzing code...';
    @Input() content = '';

    @Output() cancelled = new EventEmitter<void>();

    cancel() {
        this.cancelled.emit();
    }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-paste-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './paste-modal.component.html',
    styleUrl: './paste-modal.component.scss'
})
export class PasteModalComponent {
    @Input() active = false;
    @Input() initialCode = '';

    @Output() closed = new EventEmitter<void>();
    @Output() confirmed = new EventEmitter<string>();

    pasteInput = '';

    ngOnChanges() {
        if (this.active) {
            this.pasteInput = this.initialCode;
        }
    }

    close() {
        this.closed.emit();
    }

    confirm() {
        this.confirmed.emit(this.pasteInput);
    }
}

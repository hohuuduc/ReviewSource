import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-addin-dialog',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './addin-dialog.component.html',
    styleUrl: './addin-dialog.component.scss'
})
export class AddinDialogComponent implements AfterViewChecked {
    @Input() active = false;
    @Input() title = 'Addin';
    @Input() content: HTMLElement | null = null;

    @Output() closed = new EventEmitter<void>();

    @ViewChild('contentContainer') contentContainer!: ElementRef<HTMLDivElement>;

    private lastContent: HTMLElement | null = null;

    ngAfterViewChecked() {
        // Inject HTMLElement into container when content changes
        if (this.content && this.content !== this.lastContent && this.contentContainer) {
            this.contentContainer.nativeElement.innerHTML = '';
            this.contentContainer.nativeElement.appendChild(this.content);
            this.lastContent = this.content;
        }
    }

    close() {
        this.closed.emit();
    }

    onOverlayClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
            this.close();
        }
    }
}

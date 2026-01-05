import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, afterEveryRender } from '@angular/core';
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

    @ViewChild("thinkingContent") thinkingContent!: ElementRef;

    ngAfterViewInit() {
        let oldScrollHeight = 0;
        const el = this.thinkingContent.nativeElement as HTMLDivElement;
        const mutationObserver = new MutationObserver(() => {
            if (el.scrollHeight > oldScrollHeight) {
                el.scrollTo(0, el.scrollHeight);
                oldScrollHeight = el.scrollHeight;
            }
        });

        mutationObserver.observe(el, {
            characterData: true,
            subtree: true
        });
    }

    cancel() {
        this.cancelled.emit();
    }
}

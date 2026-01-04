import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Settings } from '../../services/settings.service';

@Component({
    selector: 'app-settings-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-modal.component.html',
    styleUrl: './settings-modal.component.scss'
})
export class SettingsModalComponent {
    @Input() active = false;
    @Input() settings: Settings = { host: '', apiKey: '', model: '', thinkLevel: 'medium' };
    @Input() models: string[] = [];
    @Input() connectionStatus = '';
    @Input() connectionStatusType: 'loading' | 'success' | 'error' | '' = '';
    @Input() showModelSection = false;
    @Input() isGptOssModel = false;

    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<Settings>();
    @Output() fetchModelsRequested = new EventEmitter<void>();
    @Output() modelChanged = new EventEmitter<void>();

    close() {
        this.closed.emit();
    }

    save() {
        this.saved.emit(this.settings);
    }

    fetchModels() {
        this.fetchModelsRequested.emit();
    }

    onModelChange() {
        this.modelChanged.emit();
    }
}

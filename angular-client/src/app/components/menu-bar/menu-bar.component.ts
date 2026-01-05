import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-menu-bar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './menu-bar.component.html',
    styleUrl: './menu-bar.component.scss'
})
export class MenuBarComponent {
    @Output() newEmpty = new EventEmitter<void>();
    @Output() openFile = new EventEmitter<void>();
    @Output() exit = new EventEmitter<void>();
    @Output() openSettings = new EventEmitter<void>();
    @Output() openFolder = new EventEmitter<void>();
    @Output() checkForUpdates = new EventEmitter<void>();
    @Output() openLatestLog = new EventEmitter<void>();

    handleNewEmpty() {
        this.newEmpty.emit();
    }

    handleOpenFile() {
        this.openFile.emit();
    }

    handleOpenFolder() {
        this.openFolder.emit();
    }

    handleExit() {
        this.exit.emit();
    }

    handleOpenSettings() {
        this.openSettings.emit();
    }

    handleCheckForUpdates() {
        this.checkForUpdates.emit();
    }

    handleOpenLatestLog() {
        this.openLatestLog.emit();
    }
}

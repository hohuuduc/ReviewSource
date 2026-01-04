import { Injectable } from '@angular/core';
import { NeutralinoService } from './neutralino.service';

export type ThinkLevel = 'low' | 'medium' | 'high' | boolean;

export interface Settings {
    host: string;
    apiKey: string;
    model: string;
    thinkLevel: ThinkLevel;
}

const DEFAULT_SETTINGS: Settings = {
    host: 'http://localhost:11434',
    apiKey: '',
    model: '',
    thinkLevel: 'medium',
};

const STORAGE_KEY = 'review_source_settings';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {

    constructor(private neutralinoService: NeutralinoService) { }

    async getSettings(): Promise<Settings> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            // Use localStorage as fallback in browser mode
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                try {
                    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
                } catch {
                    return { ...DEFAULT_SETTINGS };
                }
            }
            return { ...DEFAULT_SETTINGS };
        }

        try {
            const data = await Neutralino.storage.getData(STORAGE_KEY);
            const settings = JSON.parse(data) as Settings;
            return {
                host: settings.host || DEFAULT_SETTINGS.host,
                apiKey: settings.apiKey || DEFAULT_SETTINGS.apiKey,
                model: settings.model || DEFAULT_SETTINGS.model,
                thinkLevel: settings.thinkLevel || DEFAULT_SETTINGS.thinkLevel,
            };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    async saveSettings(settings: Settings): Promise<void> {
        const data = JSON.stringify(settings);

        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            localStorage.setItem(STORAGE_KEY, data);
            return;
        }

        await Neutralino.storage.setData(STORAGE_KEY, data);
    }
}

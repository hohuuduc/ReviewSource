import { Injectable, EventEmitter } from '@angular/core';
import { NeutralinoService } from './neutralino.service';
import { Settings } from './settings.service';

// Data structures cho API send
export interface SetFileData {
    content: string;
    language?: string;
    filePath?: string;
}

export interface SetFilesData {
    files: Array<{
        content: string;
        language?: string;
        filePath: string;
    }>;
}

export type AddinPayload =
    | { action: 'setFile'; data: SetFileData }
    | { action: 'setFiles'; data: SetFilesData };

export interface AddinMetadata {
    name: string;
}

export interface AddinApi {
    send: (payload: AddinPayload) => void;
    config: Settings;
}

export interface Addin {
    metadata: AddinMetadata;
    action?: (api: AddinApi) => void;
    createDialog?: (api: AddinApi) => HTMLElement;
}

const ADDINS_DIR = '.addins';

@Injectable({
    providedIn: 'root'
})
export class AddinService {
    // Event emitter for addin payloads
    readonly onSend = new EventEmitter<AddinPayload>();

    constructor(private neutralinoService: NeutralinoService) { }

    /**
     * Load all addins from .addins directory
     */
    async loadAddins(): Promise<Addin[]> {
        const addins: Addin[] = [];

        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.warn('Addins can only be loaded in Neutralino environment');
            return addins;
        }

        try {
            // Read directory entries
            const entries = await Neutralino.filesystem.readDirectory(ADDINS_DIR);

            for (const entry of entries) {
                if (entry.type === 'FILE' && entry.entry.endsWith('.js')) {
                    try {
                        const filePath = `${ADDINS_DIR}/${entry.entry}`;
                        const content = await Neutralino.filesystem.readFile(filePath);

                        // Evaluate the JS file to get the addin
                        const addin = this.evaluateAddin(content, entry.entry);
                        if (addin && addin.metadata?.name) {
                            addins.push(addin);
                        }
                    } catch (error) {
                        console.error(`Failed to load addin ${entry.entry}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to read addins directory:', error);
        }

        return addins;
    }

    /**
     * Evaluate addin JS content
     */
    private evaluateAddin(content: string, fileName: string): Addin | null {
        try {
            // Create a mock CommonJS environment for the addin
            const exports: any = {};
            const module = { exports };

            // Execute the addin code with CommonJS-like environment
            const fn = new Function('exports', 'module', content);
            fn(exports, module);

            // Handle CommonJS exports (exports.default or module.exports)
            const result = module.exports.default || module.exports;

            if (result && typeof result === 'object' && result.metadata?.name) {
                return result as Addin;
            }
        } catch (error) {
            console.error(`Failed to evaluate addin ${fileName}:`, error);
        }
        return null;
    }

    /**
     * Create API object for addin
     */
    createApi(settings: Settings): AddinApi {
        return {
            send: (payload: AddinPayload) => {
                this.onSend.emit(payload);
            },
            config: { ...settings }
        };
    }

    /**
     * Execute addin action or createDialog
     */
    executeAddin(addin: Addin, api: AddinApi): { type: 'dialog'; element: HTMLElement } | { type: 'action' } | { type: 'error'; message: string } {
        if (addin.createDialog) {
            try {
                const element = addin.createDialog(api);
                return { type: 'dialog', element };
            } catch (error) {
                return { type: 'error', message: `createDialog failed: ${error}` };
            }
        }

        if (addin.action) {
            try {
                addin.action(api);
                return { type: 'action' };
            } catch (error) {
                return { type: 'error', message: `action failed: ${error}` };
            }
        }

        return { type: 'error', message: 'Addin has no action or createDialog method' };
    }
}

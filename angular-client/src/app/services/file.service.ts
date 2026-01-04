import { Injectable } from '@angular/core';
import { NeutralinoService } from './neutralino.service';
import { RulesService } from './rules.service';

export interface FileResult {
    filePath: string;
    content: string;
    extension: string;
}

@Injectable({
    providedIn: 'root'
})
export class FileService {

    constructor(private neutralinoService: NeutralinoService, private rulesService: RulesService) { }

    /**
     * Open file dialog and read file content
     */
    async openFile(): Promise<FileResult | null> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.warn('Open file not available in browser mode');
            alert('Open File function only works in Neutralino app.\n\nPlease use Paste button to input code.');
            return null;
        }

        try {
            const entries = await Neutralino.os.showOpenDialog('Open Source File', {
                filters: [
                    { name: 'Available files', extensions: this.rulesService.getLanguages() },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (entries && entries.length > 0) {
                const filePath = entries[0];
                const content = await Neutralino.filesystem.readFile(filePath);
                const extension = filePath.split('.').pop()?.toLowerCase() || '';
                return { filePath, content, extension };
            }
            return null;
        } catch (error) {
            console.error('Failed to open file:', error);
            return null;
        }
    }

    /**
     * Open folder dialog and read all files
     */
    async openFolder(): Promise<FileResult[]> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.warn('Open folder not available in browser mode');
            alert('Open Folder function only works in Neutralino app.');
            return [];
        }

        try {
            const folderPath = await Neutralino.os.showFolderDialog('Select Source Folder');

            if (!folderPath) {
                return [];
            }

            const entries = await Neutralino.filesystem.readDirectory(folderPath);
            const files: FileResult[] = [];

            for (const entry of entries) {
                if (entry.type === 'FILE') {
                    try {
                        const filePath = `${folderPath}/${entry.entry}`;
                        const content = await Neutralino.filesystem.readFile(filePath);
                        const extension = entry.entry.split('.').pop()?.toLowerCase() || '';
                        files.push({ filePath, content, extension });
                    } catch (readError) {
                        console.warn(`Failed to read file ${entry.entry}:`, readError);
                    }
                }
            }

            return files;
        } catch (error) {
            console.error('Failed to open folder:', error);
            return [];
        }
    }
}

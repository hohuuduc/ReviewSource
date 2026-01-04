import { Injectable } from '@angular/core';
import { NeutralinoService } from './neutralino.service';

@Injectable({
    providedIn: 'root'
})
export class LogService {
    private logDir = 'logs';

    constructor(private neutralinoService: NeutralinoService) { }

    /**
     * Generate filename based on current timestamp
     * Format: YYYY-MM-DD_HH-mm-ss.json
     */
    private generateFilename(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
    }

    /**
     * Ensure log directory exists
     */
    private async ensureLogDir(): Promise<void> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.warn('LogService: Not in Neutralino environment');
            return;
        }

        try {
            await Neutralino.filesystem.getStats(this.logDir);
        } catch {
            // Directory doesn't exist, create it
            await Neutralino.filesystem.createDirectory(this.logDir);
        }
    }

    /**
     * Log an object to a file with timestamp filename
     * @param data - Object to be logged (will be parsed to JSON)
     * @returns The filename that was created, or null if logging failed
     */
    async log(data: object): Promise<string | null> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.log('LogService (browser mode):', JSON.stringify(data, null, 2));
            return null;
        }

        try {
            await this.ensureLogDir();

            const filename = this.generateFilename();
            const filePath = `${this.logDir}/${filename}`;
            const jsonContent = JSON.stringify(data, null, 2);

            await Neutralino.filesystem.writeFile(filePath, jsonContent);
            console.log(`Log written to: ${filePath}`);

            return filename;
        } catch (error) {
            console.error('Failed to write log:', error);
            return null;
        }
    }

    /**
     * Log an object with a custom filename prefix
     * @param prefix - Prefix for the filename
     * @param data - Object to be logged
     */
    async logWithPrefix(prefix: string, data: object): Promise<string | null> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.log(`LogService [${prefix}] (browser mode):`, JSON.stringify(data, null, 2));
            return null;
        }

        try {
            await this.ensureLogDir();

            const timestamp = this.generateFilename().replace('.json', '');
            const filename = `${prefix}_${timestamp}.json`;
            const filePath = `${this.logDir}/${filename}`;
            const jsonContent = JSON.stringify(data, null, 2);

            await Neutralino.filesystem.writeFile(filePath, jsonContent);
            console.log(`Log written to: ${filePath}`);

            return filename;
        } catch (error) {
            console.error('Failed to write log:', error);
            return null;
        }
    }
}

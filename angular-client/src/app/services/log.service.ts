import { Injectable } from '@angular/core';
import { NeutralinoService } from './neutralino.service';

@Injectable({
    providedIn: 'root'
})
export class LogService {
    private logDir = '.logs';

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
     * Remove old log files if count exceeds max limit
     */
    private async cleanupOldLogs(maxFiles: number = 10): Promise<void> {
        try {
            const entries = await Neutralino.filesystem.readDirectory(this.logDir);
            const jsonFiles = entries
                .filter((e: { type: string; entry: string; }) => e.type === 'FILE' && e.entry.endsWith('.json'))
                .map((e: { entry: string; }) => e.entry)
                .sort(); // Sort ascending (oldest first)

            // If we have more than maxFiles, delete the oldest ones
            const filesToDelete = jsonFiles.length - maxFiles + 1; // +1 to make room for new file
            if (filesToDelete > 0) {
                for (let i = 0; i < filesToDelete; i++) {
                    const filePath = `${this.logDir}/${jsonFiles[i]}`;
                    await Neutralino.filesystem.removeFile(filePath);
                    console.log(`Removed old log: ${filePath}`);
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
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
            await this.cleanupOldLogs(10);

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
            await this.cleanupOldLogs(10);
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

    /**
     * Get the latest log file path
     */
    async getLatestLogPath(): Promise<string | null> {
        if (!this.neutralinoService.isNeutralinoEnvironment()) {
            console.warn('LogService: Not in Neutralino environment');
            return null;
        }

        try {
            const entries = await Neutralino.filesystem.readDirectory(this.logDir);
            console.log(entries)
            const jsonFiles = entries
                .filter((e: { type: string; entry: string; }) => e.type === 'FILE' && e.entry.endsWith('.json'))
                .map((e: { entry: any; }) => e.entry)
                .sort()
                .reverse();

            if (jsonFiles.length === 0) {
                return null;
            }

            // Get absolute path using Neutralino's current working directory
            const cwd = (window as any).NL_CWD || '.';
            return `${cwd}/${this.logDir}/${jsonFiles[0]}`;
        } catch (error) {
            console.error('Failed to get latest log:', error);
            return null;
        }
    }

    /**
     * Open the latest log file with default system app
     */
    async openLatestLog(): Promise<boolean> {
        const latestLogPath = await this.getLatestLogPath();

        if (!latestLogPath) {
            console.warn('No log files found');
            return false;
        }

        try {
            await Neutralino.os.open(latestLogPath);
            return true;
        } catch (error) {
            console.error('Failed to open log file:', error);
            return false;
        }
    }
}

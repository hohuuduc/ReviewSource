import { Injectable } from '@angular/core';

declare const Neutralino: any;

export interface UpdateInfo {
    latestVersion: string;
    updateAvailable: boolean;
    downloadUrl: string;
}

@Injectable({
    providedIn: 'root'
})
export class UpdateService {
    private getManifestUrl(): string {
        const manifestUrl = (window as any).NL_MANIFEST_URL;
        if (!manifestUrl) {
            throw new Error('MANIFEST_URL not configured in neutralino.config.json globalVariables');
        }
        return manifestUrl;
    }

    async getCurrentVersion(): Promise<string> {
        try {
            if (typeof Neutralino !== 'undefined') {
                const config = await Neutralino.app.getConfig();
                return config.version || '1.0.0';
            }
        } catch (error) {
            console.warn('Could not get version from Neutralino:', error);
        }
        return '';
    }

    async checkForUpdates(): Promise<UpdateInfo> {
        const currentVersion = await this.getCurrentVersion();
        const manifestUrl = this.getManifestUrl();

        try {
            // Fetch manifest from GitHub
            const response = await fetch(`${manifestUrl}/manifest.json`);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.status}`);
            }

            const manifest = await response.json();
            const latestVersion = manifest.version;
            const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;
            const downloadUrl = `${manifestUrl}/review-agent/resources.neu`
            return {
                latestVersion,
                updateAvailable,
                downloadUrl
            };
        } catch (error) {
            console.error('Failed to check for updates:', error);
            throw error;
        }
    }


    async downloadAndApplyUpdate(downloadUrl: string): Promise<void> {
        if (typeof Neutralino === 'undefined') {
            throw new Error('Neutralino is not available');
        }

        try {
            console.log('Downloading update from:', downloadUrl);

            // Download the .neu file as binary
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`Failed to download update: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            console.log(`Downloaded ${arrayBuffer.byteLength} bytes`);

            // Validate download
            if (arrayBuffer.byteLength === 0) {
                throw new Error('Downloaded file is empty');
            }

            const basePath = (window as any).NL_CWD || (window as any).NL_PATH;
            const resourcesPath = `${basePath}/resources.neu`;

            console.log('Writing update to:', resourcesPath);

            // Write ArrayBuffer directly to resources.neu
            // Neutralino.filesystem.writeBinaryFile expects ArrayBuffer, not base64
            await Neutralino.filesystem.writeBinaryFile(resourcesPath, arrayBuffer);
            console.log('Update written successfully. Restarting...');

            // Restart the application
            await Neutralino.app.restartProcess();
        } catch (error) {
            console.error('Failed to download update:', error);
            throw error;
        }
    }

    /**
     * Compare two version strings
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    private compareVersions(v1: string, v2: string): number {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        const maxLength = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < maxLength; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }

        return 0;
    }
}

import { Injectable } from '@angular/core';

declare const Neutralino: any;

export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    downloadUrl?: string;
    changelog?: string;
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
            const response = await fetch(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.status}`);
            }

            const manifest = await response.json();
            const latestVersion = manifest.version;
            const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;

            return {
                currentVersion,
                latestVersion,
                updateAvailable,
                downloadUrl: manifest.resourcesURL,
                changelog: manifest.changelog
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
            const uint8Array = new Uint8Array(arrayBuffer);

            // Convert to base64 for Neutralino filesystem API
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64Data = btoa(binary);

            // Get the path to resources.neu (same directory as the executable)
            const appPath = await Neutralino.app.getPath();
            const resourcesNeuPath = `${appPath}/resources.neu`;

            console.log('Writing update to:', resourcesNeuPath);

            // Write the new resources.neu file
            await Neutralino.filesystem.writeBinaryFile(resourcesNeuPath, base64Data);

            console.log('Update applied successfully. Restarting...');

            // Restart the application to apply updates
            await Neutralino.app.restartProcess();
        } catch (error) {
            console.error('Failed to apply update:', error);
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

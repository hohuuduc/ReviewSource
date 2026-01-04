import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class NeutralinoService {
    private initialized = false;

    /**
     * Check if running in Neutralino environment
     */
    isNeutralinoEnvironment(): boolean {
        return typeof window !== 'undefined' &&
            typeof (window as any).NL_PORT !== 'undefined' &&
            typeof (window as any).NL_TOKEN !== 'undefined';
    }

    /**
     * Initialize Neutralino
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        if (this.isNeutralinoEnvironment()) {
            try {
                await Neutralino.init();
                this.initialized = true;
                console.log('Neutralino initialized');

                // Handle window close
                Neutralino.events.on('windowClose', () => {
                    Neutralino.app.exit();
                });
            } catch (error) {
                console.error('Failed to initialize Neutralino:', error);
            }
        } else {
            console.warn('Not running in Neutralino environment - some features may not work');
        }
    }

    /**
     * Exit the application
     */
    exit(): void {
        if (this.isNeutralinoEnvironment()) {
            Neutralino.app.exit();
        } else {
            window.close();
        }
    }
}

declare namespace Neutralino {
    namespace filesystem {
        function readFile(path: string): Promise<string>;
        function writeFile(path: string, data: string): Promise<void>;
        function readDirectory(path: string): Promise<Array<{ entry: string; type: 'FILE' | 'DIRECTORY' }>>;
        function createDirectory(path: string): Promise<void>;
        function removeFile(path: string): Promise<void>;
        function removeDirectory(path: string): Promise<void>;
        function copyFile(source: string, destination: string): Promise<void>;
        function moveFile(source: string, destination: string): Promise<void>;
        function getStats(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean; createdAt: number; modifiedAt: number }>;
    }

    namespace storage {
        function getData(key: string): Promise<string>;
        function setData(key: string, data: string): Promise<void>;
        function getKeys(): Promise<string[]>;
    }

    namespace os {
        function showOpenDialog(title: string, options?: { filters?: Array<{ name: string; extensions: string[] }>; multiSelections?: boolean }): Promise<string[]>;
        function showSaveDialog(title: string, options?: { filters?: Array<{ name: string; extensions: string[] }>; forceOverwrite?: boolean }): Promise<string>;
        function showFolderDialog(title: string): Promise<string>;
        function showMessageBox(title: string, content: string, choice?: 'OK' | 'OK_CANCEL' | 'YES_NO' | 'YES_NO_CANCEL' | 'RETRY_CANCEL' | 'ABORT_RETRY_IGNORE', icon?: 'INFO' | 'WARNING' | 'ERROR' | 'QUESTION'): Promise<string>;
        function showNotification(title: string, content: string, icon?: 'INFO' | 'WARNING' | 'ERROR' | 'QUESTION'): Promise<void>;
        function getEnv(key: string): Promise<string>;
        function execCommand(command: string, options?: { background?: boolean }): Promise<{ pid: number; stdOut: string; stdErr: string; exitCode: number }>;
    }

    namespace app {
        function exit(code?: number): void;
        function getConfig(): Promise<any>;
        function killProcess(): Promise<void>;
        function restartProcess(options?: { args?: string }): Promise<void>;
    }

    namespace events {
        function on(event: string, handler: (...args: any[]) => void): Promise<{ success: boolean }>;
        function off(event: string, handler: (...args: any[]) => void): Promise<{ success: boolean }>;
        function dispatch(event: string, data?: any): Promise<{ success: boolean }>;
    }

    namespace window {
        function setTitle(title: string): Promise<void>;
        function getTitle(): Promise<string>;
        function minimize(): Promise<void>;
        function maximize(): Promise<void>;
        function unmaximize(): Promise<void>;
        function isMaximized(): Promise<boolean>;
        function setFullScreen(): Promise<void>;
        function exitFullScreen(): Promise<void>;
        function isFullScreen(): Promise<boolean>;
        function show(): Promise<void>;
        function hide(): Promise<void>;
        function isVisible(): Promise<boolean>;
        function focus(): Promise<void>;
        function setSize(options: { width?: number; height?: number; minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number; resizable?: boolean }): Promise<void>;
        function getSize(): Promise<{ width: number; height: number; minWidth: number; minHeight: number; maxWidth: number; maxHeight: number; resizable: boolean }>;
        function setPosition(options: { x: number; y: number }): Promise<void>;
        function getPosition(): Promise<{ x: number; y: number }>;
        function center(): Promise<void>;
        function setIcon(icon: string): Promise<void>;
        function setDraggableRegion(domId: string): Promise<void>;
    }

    namespace clipboard {
        function writeText(text: string): Promise<void>;
        function readText(): Promise<string>;
    }

    function init(): Promise<void>;
}

declare global {
    interface Window {
        NL_PORT: number;
        NL_TOKEN: string;
        NL_CWD: string;
        NL_PATH: string;
        NL_VERSION: string;
        NL_CVERSION: string;
        NL_APPID: string;
    }
    const Neutralino: typeof Neutralino;
}

export { Neutralino };

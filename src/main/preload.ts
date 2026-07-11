// Preload script - Expose IPC to renderer
const { contextBridge, ipcRenderer, shell, webUtils } = require('electron');

// Map to store listener references to prevent memory leaks
// Key: original callback, Value: wrapped callback
const listeners = new Map<Function, Function>();

contextBridge.exposeInMainWorld('electron', {
  shell: {
    openExternal: (url: string) => shell.openExternal(url),
  },
  // Resolve the absolute path of a File dropped from the OS. File.path was
  // removed in Electron 32+, so getPathForFile is the only way to get it.
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      // Create wrapped subscription
      const subscription = (_event: any, ...args: any[]) => func(...args);
      // Store reference for later removal
      listeners.set(func, subscription);
      ipcRenderer.on(channel, subscription);
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      // Get the wrapped subscription
      const subscription = listeners.get(func);
      if (subscription) {
        ipcRenderer.removeListener(channel, subscription as any);
        listeners.delete(func);
      }
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
});

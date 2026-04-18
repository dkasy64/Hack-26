import { contextBridge } from 'electron';

// Expose a minimal API to the renderer.
// Add window controls here if needed (minimize, close, etc.)
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});

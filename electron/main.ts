import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_URL = 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false,          // Custom titlebar (Discord-style)
    backgroundColor: '#313338',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
  });

  // Allow Jitsi IFrame to load external URLs
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://meet.jit.si')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(VITE_DEV_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

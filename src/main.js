import { app, BrowserWindow, dialog, desktopCapturer, ipcMain } from 'electron';
const path = require('path');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('getSources', async () => {
  return await desktopCapturer.getSources({ types: ['window', 'screen'] })
})

ipcMain.handle('showSaveDialog', async () => {
  return await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `vid-${Date.now()}.mkv`
  });
})

ipcMain.handle('getOperatingSystem', () => {
  return process.platform
})

ipcMain.handle('getHhandbrakePath', () => {
  const handbrakePath = path.join(app.getAppPath(), 'src/bin', 'HandBrakeCLI.exe');
  console.log(handbrakePath);
  return handbrakePath;
});

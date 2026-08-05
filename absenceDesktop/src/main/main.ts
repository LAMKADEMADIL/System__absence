/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import puppeteer from 'puppeteer-core';
// Firebase Admin Service Account Initialization - Updated
import path from 'path';
import { mkdir } from 'fs/promises';
import { existsSync, writeFile, readFileSync } from 'fs';
import { promisify } from 'util';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import nodemailer from 'nodemailer';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as admin from 'firebase-admin';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;




let isAdminInitialized = false;
try {
  const serviceAccountPath = app.isPackaged
    ? path.join(process.resourcesPath, 'serviceAccountKey.json')
    : path.resolve(__dirname, '../../serviceAccountKey.json');

  console.log('Attempting to initialize Firebase Admin from:', serviceAccountPath);

  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isAdminInitialized = true;
    console.log('Firebase Admin initialized successfully');
  } else {
    // Try alternative path (for some dev environments)
    const altPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    console.log('Checking alternative path:', altPath);
    if (existsSync(altPath)) {
      const serviceAccount = JSON.parse(readFileSync(altPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      isAdminInitialized = true;
      console.log('Firebase Admin initialized successfully from CWD');
    } else {
      console.error('CRITICAL: serviceAccountKey.json not found in any path');
    }
  }
} catch (error: any) {
  console.error('Firebase Admin init failed:', error.message);
}

ipcMain.handle('change-password', async (_, { uid, newPassword }) => {
  if (admin.apps.length === 0) return { success: false, error: 'Firebase Admin NOT initialized. Please check serviceAccountKey.json.' };
  try {
    await admin.auth().updateUser(uid, { password: newPassword });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-admin-status', async () => {
  return isAdminInitialized;
});

ipcMain.handle('create-user', async (_, { email, password, displayName }) => {
  if (admin.apps.length === 0) {
    console.error('IPC create-user called but Admin SDK not initialized.');
    return { success: false, error: 'Firebase Admin NOT initialized' };
  }
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });
    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      try {
        const existingUser = await admin.auth().getUserByEmail(email);
        return { success: true, uid: existingUser.uid, alreadyExists: true };
      } catch (fetchError: any) {
        return { success: false, error: fetchError.message };
      }
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-user', async (_, { uid }) => {
  if (admin.apps.length === 0) return { success: false, error: 'Firebase Admin NOT initialized' };
  try {
    await admin.auth().deleteUser(uid);
    console.log(`Successfully deleted user ${uid} from Auth`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting user ${uid}:`, error.message);
    return { success: false, error: error.message };
  }
});
 
ipcMain.handle('send-email', async (_, { to, subject, body, auth }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: auth.user, // بريد المرسل (المدير)
        pass: auth.pass, // App Password من جوجل
      },
    });
 
    const mailOptions = {
      from: auth.user,
      to,
      subject,
      text: body,
    };
 
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.on('open-external-link', (_, url) => {
  shell.openExternal(url);
});

ipcMain.handle(
  'print',
  async (_, pdfs: { content: string; name: string }[], folder: string) => {
    const desktopPath = app.getPath('desktop');
    if (!existsSync(`${desktopPath}/Absence`))
      await mkdir(`${desktopPath}/Absence`);
    if (!existsSync(`${desktopPath}/Absence/${folder}`))
      await mkdir(`${desktopPath}/Absence/${folder}`);
    const browser = await puppeteer.launch({
      executablePath:
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      // headless: false,
    });
    const page = await browser.newPage();
    for (let i = 0; i < pdfs.length; i += 1) {
      const pdf = pdfs[i];
      await page.setContent(pdf.content); // eslint-disable-line
      // eslint-disable-next-line
      await page.pdf({
        path: `${desktopPath}/Absence/${folder}/${pdf.name}.pdf`,
        scale: 1,
      });
    }
    browser.close();
    return 1;
  },
);

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// if (isDebug) {
//   require('electron-debug').default();
// }

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const { nativeImage } = require('electron');
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../../src/renderer/assets/Logo_ofppt.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.resolve(__dirname, 'preload.bundle.dev.js');

  console.log('Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    title: "Système de suivi d'absence",
    icon: appIcon,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setIcon(appIcon);
  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  mainWindow.setMenu(null);
  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

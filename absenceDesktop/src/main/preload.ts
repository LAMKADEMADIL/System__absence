// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  print: (pdfs: { content: string; name: string }[], folder: string) =>
    ipcRenderer.invoke('print', pdfs, folder),
  changePassword: (data: { uid: string; newPassword: string }) =>
    ipcRenderer.invoke('change-password', data),
  createUser: (data: { email: string; password?: string; displayName: string }) =>
    ipcRenderer.invoke('create-user', data),
  deleteUser: (uid: string) =>
    ipcRenderer.invoke('delete-user', { uid }),
  sendEmail: (data: { to: string; subject: string; body: string; auth: { user: string; pass: string } }) =>
    ipcRenderer.invoke('send-email', data),
  checkAdminStatus: () => ipcRenderer.invoke('check-admin-status'),
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;

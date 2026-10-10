import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  DEFAULT_APP_NAME,
  getAppSettings,
  updateAppSettings,
  subscribeAppSettings,
} from '../firebase/firestoreService';

interface AppSettingsContextType {
  appName: string;
  setAppName: (name: string) => void;
  saveAppName: (nameToSave?: string) => Promise<void>;
  resetAppName: () => Promise<void>;
  loading: boolean;
  saving: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType>({
  appName: DEFAULT_APP_NAME,
  setAppName: () => {},
  saveAppName: async () => {},
  resetAppName: async () => {},
  loading: false,
  saving: false,
});

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appName, setAppName] = useState<string>(() => {
    return localStorage.getItem('app_name') || DEFAULT_APP_NAME;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    // Sync initial document.title
    document.title = appName;

    // Listen to firestore updates in real-time
    const unsubscribe = subscribeAppSettings((settings) => {
      if (settings.appName) {
        setAppName(settings.appName);
        document.title = settings.appName;
      }
      setLoading(false);
    });

    // Also listen to local window events
    const handleLocalUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.appName) {
        setAppName(customEvent.detail.appName);
        document.title = customEvent.detail.appName;
      }
    };

    window.addEventListener('app_name_updated', handleLocalUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('app_name_updated', handleLocalUpdate);
    };
  }, []);

  const saveAppName = async (nameToSave?: string) => {
    const targetName = (nameToSave !== undefined ? nameToSave : appName).trim() || DEFAULT_APP_NAME;
    setSaving(true);
    try {
      await updateAppSettings({ appName: targetName });
      setAppName(targetName);
    } finally {
      setSaving(false);
    }
  };

  const resetAppName = async () => {
    await saveAppName(DEFAULT_APP_NAME);
  };

  return (
    <AppSettingsContext.Provider
      value={{
        appName,
        setAppName,
        saveAppName,
        resetAppName,
        loading,
        saving,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);

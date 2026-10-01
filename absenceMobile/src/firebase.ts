import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAfrdngdBpRzlSC9cXxs3aCGe3gZMrYRts',
  authDomain: 'ista-absence.firebaseapp.com',
  projectId: 'ista-absence',
  storageBucket: 'ista-absence.firebasestorage.app',
  messagingSenderId: '289643777341',
  appId: '1:289643777341:web:580f2844dec84132094954',
};

let app;
let authInstance;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  if (Platform.OS === 'web') {
    // For Web, use the default persistence
    authInstance = getAuth(app);
  } else {
    // For Mobile (React Native), use AsyncStorage
    const authModule = require('firebase/auth');
    authInstance = initializeAuth(app, {
      persistence: authModule.getReactNativePersistence(AsyncStorage)
    });
  }
} else {
  app = getApps()[0];
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export default app;

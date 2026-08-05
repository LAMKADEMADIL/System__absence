import { initializeApp, getApps } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebase = {
  apiKey: 'AIzaSyAfrdngdBpRzlSC9cXxs3aCGe3gZMrYRts',
  authDomain: 'ista-absence.firebaseapp.com',
  projectId: 'ista-absence',
  storageBucket: 'ista-absence.firebasestorage.app',
  messagingSenderId: '289643777341',
  appId: '1:289643777341:web:580f2844dec84132094954',
};

const app = getApps().length === 0 ? initializeApp(firebase) : getApps()[0];

let authInstance;
try {
  authInstance = getAuth(app);
} catch (e) {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export const auth = authInstance;
export const db = getFirestore(app);
export default app;

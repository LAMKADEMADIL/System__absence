// import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function registerForPushNotificationsAsync() {
  console.log('Push notifications registration is temporarily disabled');
  return null;
}

export async function saveTokenToFirestore(token: string) {
  console.log('Save token to Firestore is temporarily disabled');
  return;
}

export async function sendPushNotification(targetUid: string, title: string, body: string, data = {}) {
  console.log('Push notifications sending is temporarily disabled', { targetUid, title, body, data });
  return;
}

// Function to notify all managers (Gestionnaires)
export async function notifyManagers(title: string, body: string, data = {}) {
  console.log('Notify managers is temporarily disabled', { title, body, data });
  return;
}

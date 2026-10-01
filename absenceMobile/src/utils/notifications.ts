// import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function registerForPushNotificationsAsync(uid: string) {
  return null; // Temporarily disabled
}

export async function sendPushNotification(targetUid: string, title: string, body: string, data = {}) {
  console.log('Notifications are temporarily disabled. Would have sent to:', targetUid);
  return;
}

export async function notifyManagers(title: string, body: string, data = {}) {
  console.log('Notifications are temporarily disabled. Would have notified managers.');
  return;
}

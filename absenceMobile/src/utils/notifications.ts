// import * as Notifications from 'expo-notifications';
const Notifications = { getPermissionsAsync: async () => ({ status: 'denied' }), requestPermissionsAsync: async () => ({ status: 'denied' }), getExpoPushTokenAsync: async () => ({ data: '' }) } as any;
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function registerForPushNotificationsAsync(uid: string) {
  if (!uid) return null;
  let token = null;

  if (Platform.OS === 'web') {
    return null;
  }

  try {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
        
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);
      
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        expoPushToken: token
      });
    } else {
      console.log('Must use physical device for Push Notifications');
    }
  } catch (e) {
    console.error('Error in registerForPushNotificationsAsync:', e);
  }

  return token;
}

export async function sendPushNotification(targetUid: string, title: string, body: string, data = {}) {
  if (!targetUid) return;
  try {
    const userRef = doc(db, 'users', targetUid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    const token = userData.expoPushToken;
    if (!token) {
      console.log(`User ${targetUid} has no expoPushToken registered`);
      return;
    }

    const message = {
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    console.log('Push notification sent to', targetUid);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

export async function notifyManagers(title: string, body: string, data = {}) {
  try {
    const q = query(collection(db, 'users'), where('role', 'in', ['Gestionnaire', 'Directeur']));
    const snap = await getDocs(q);
    const promises = snap.docs.map(docSnap => {
      const userData = docSnap.data();
      const token = userData.expoPushToken;
      if (token) {
        const message = {
          to: token,
          sound: 'default',
          title: title,
          body: body,
          data: data,
        };
        return fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });
      }
      return null;
    });
    await Promise.all(promises.filter(p => p !== null));
    console.log('Push notification sent to all managers');
  } catch (error) {
    console.error('Error notifying managers:', error);
  }
}

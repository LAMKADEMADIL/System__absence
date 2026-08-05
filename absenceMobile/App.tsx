import React from 'react';
import './src/i18n';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import { auth, db } from './src/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Configure notification channel for Android
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('absence_alerts_v1', {
    name: 'Alertes Absence',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import FormateurDashboard from './src/screens/FormateurDashboard';
import GestionnaireDashboard from './src/screens/GestionnaireDashboard';
import DirecteurDashboard from './src/screens/DirecteurDashboard';

import DemandeDeverouillage from './src/screens/DemandeDeverouillage';
import RappelerFormateurs from './src/screens/RappelerFormateurs';
import StagiairesAbsents from './src/screens/StagiairesAbsents';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    // Register for notifications
    const setupNotifications = async (userUid?: string) => {
      try {
        await registerForPushNotificationsAsync(userUid || '');
      } catch (err: any) {
        console.error('Setup Notifications Error:', err);
      }
    };

    setupNotifications(auth.currentUser?.uid);

    // Handle auth state changes to save token when user logs in
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setupNotifications(user.uid);
      }
    });

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received while app is open:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('User clicked notification:', response);
    });

    return () => {
      unsubscribeAuth();
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="FormateurDashboard" component={FormateurDashboard} />
        <Stack.Screen name="GestionnaireDashboard" component={GestionnaireDashboard} />
        <Stack.Screen name="DirecteurDashboard" component={DirecteurDashboard} />
        <Stack.Screen name="DemandeDeverouillage" component={DemandeDeverouillage} />
        <Stack.Screen name="RappelerFormateurs" component={RappelerFormateurs} />
        <Stack.Screen name="StagiairesAbsents" component={StagiairesAbsents} />
        <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

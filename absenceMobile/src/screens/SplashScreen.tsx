import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { registerForPushNotificationsAsync } from '../utils/notifications';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }: any) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Animation logic
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      })
    ]).start();

    let hasNavigated = false;

    const checkAuth = async (user: any) => {
      if (hasNavigated) return;
      
      const minWait = new Promise(resolve => setTimeout(resolve, 2000));

      try {
        if (user) {
          await registerForPushNotificationsAsync(user.uid);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          await minWait;
          
          if (hasNavigated) return;
          hasNavigated = true;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userRole = userData.role;

            if (userRole === 'Formateur') {
              navigation.replace('FormateurDashboard');
            } else if (userRole === 'Gestionnaire' || userRole === 'Gestionnaire du stagiaires') {
              navigation.replace('GestionnaireDashboard');
            } else if (userRole === 'Directeur') {
              navigation.replace('DirecteurDashboard');
            } else {
              navigation.replace('Login');
            }
          } else {
            navigation.replace('Login');
          }
        } else {
          // No user found in this tick
          // Wait a bit more to see if it's just a delay in restoring session
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Re-check current user after 1s
          if (auth.currentUser) {
             // If user appeared, checkAuth will be called again by onAuthStateChanged
             // or we can handle it here.
             return; 
          }

          await minWait;
          if (hasNavigated) return;
          hasNavigated = true;
          navigation.replace('Login');
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (!hasNavigated) {
          hasNavigated = true;
          navigation.replace('Login');
        }
      }
    };

    // Small initial delay before subscribing to give Firebase time to load from storage
    const timer = setTimeout(() => {
      const unsubscribe = auth.onAuthStateChanged(checkAuth);
      return () => unsubscribe();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <Image 
          source={require('../../assets/app_desktop_icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      
      <Animated.View style={[styles.devContainer, { opacity: fadeAnim }]}>
        <Text style={styles.devLabel}>Developed by</Text>
        <Text style={styles.devName}>Adil Lamkadem</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.35,
    height: width * 0.35,
  },
  devContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  devLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  devName: {
    fontSize: 16,
    color: '#1E3A8A',
    fontWeight: '800',
    marginTop: 4,
  }
});

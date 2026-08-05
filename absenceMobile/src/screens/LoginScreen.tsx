import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
// import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { registerForPushNotificationsAsync } from '../utils/notifications';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedCreds, setSavedCreds] = useState<{email:string, pass:string} | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  
  const navigation = useNavigation<any>();

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('@saved_email');
        const savedPass = await AsyncStorage.getItem('@saved_password');
        
        if (savedEmail && savedPass) {
          setSavedCreds({ email: savedEmail, pass: savedPass });
        }
      } catch (e) {
        console.log('Error loading credentials', e);
      }
    };
    loadSavedCredentials();
  }, []);

  const fillSavedCreds = () => {
    if (savedCreds) {
      setEmail(savedCreds.email);
      setPassword(savedCreds.pass);
      setShowSuggestion(false);
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    
    if (!email.trim()) {
      setErrorMessage('Veuillez saisir votre email ou matricule.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      let finalEmail = email.trim();
      
      if (!finalEmail.includes('@')) {
        const q = query(collection(db, 'users'), where('matricule', '==', finalEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('Matricule introuvable. Veuillez vérifier vos معلومات.');
        }
        
        const userDataByMatricule = querySnapshot.docs[0].data();
        if (!userDataByMatricule.email) {
          throw new Error("Aucun email n'est associé à ce matricule.");
        }
        finalEmail = userDataByMatricule.email;
      }

      // 1. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, finalEmail, password);
      const { uid } = userCredential.user;

      // 2. Récupération automatique du rôle depuis Firestore
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        await auth.signOut();
        throw new Error('Utilisateur non trouvé dans le système.');
      }

      const userData = userDoc.data();
      const userRole = userData.role; // Récupération automatique

      // ── Gestion des Notifications ──
      await registerForPushNotificationsAsync(uid);

      // ── Sauvegarder les identifiants ──
      try {
        await AsyncStorage.setItem('@saved_email', email.trim());
        await AsyncStorage.setItem('@saved_password', password);
      } catch (e) {
        console.log('Error saving credentials', e);
      }

      // 3. Navigation automatique selon le rôle
      if (userRole === 'Formateur') {
        navigation.replace('FormateurDashboard');
      } else if (userRole === 'Gestionnaire' || userRole === 'Gestionnaire du stagiaires') {
        navigation.replace('GestionnaireDashboard');
      } else if (userRole === 'Directeur') {
        navigation.replace('DirecteurDashboard'); 
      } else {
        throw new Error("Rôle non reconnu. Contactez l'administrateur.");
      }
      
    } catch (err: any) {
      console.error('Erreur Login:', err);
      let errMsg = 'Identifiants incorrects.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Email/Matricule ou mot de passe incorrect.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/app_desktop_icon.png')} 
                style={{ width: 95, height: 95, resizeMode: 'contain' }} 
              />
          </View>

          <Text style={styles.title}>Système d'Absence</Text>
          <Text style={styles.subtitle}>Accès sécurisé pour le personnel</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email ou Matricule</Text>
            <TextInput
              style={styles.input}
              placeholder="Entrez votre email ou matricule"
              value={email}
              onChangeText={setEmail}
              onFocus={() => savedCreds && setShowSuggestion(true)}
              onBlur={() => setTimeout(() => setShowSuggestion(false), 200)}
              autoCapitalize="none"
              autoComplete="email"
              textContentType="none"
              keyboardType="default"
            />
            
            {showSuggestion && savedCreds && (
              <TouchableOpacity style={styles.suggestionBox} onPress={fillSavedCreds}>
                <Ionicons name="person-circle" size={24} color="#1E3A8A" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.suggestionText}>{savedCreds.email}</Text>
                  <Text style={styles.suggestionSubtext}>Utiliser ce compte</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E0" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Entrez votre mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoComplete="off"
                textContentType="none"
              />
              <TouchableOpacity onPress={() => setPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
                <Ionicons name={isPasswordVisible ? 'eye-off' : 'eye'} size={22} color="#718096" />
              </TouchableOpacity>
            </View>
          </View>

          {errorMessage ? (
             <Text style={styles.errorText}>
               {errorMessage}
             </Text>
          ) : null}

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
               <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 25, padding: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10 },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1E3A8A', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1E3A8A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 15, paddingHorizontal: 15, height: 55, backgroundColor: '#F8FAFC', fontSize: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 15, backgroundColor: '#F8FAFC', height: 55 },
  passwordInput: { flex: 1, paddingHorizontal: 15, height: '100%', fontSize: 16, color: '#1E293B' },
  eyeIcon: { padding: 12 },
  errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 15, fontWeight: 'bold', fontSize: 13 },
  button: { backgroundColor: '#1E3A8A', borderRadius: 15, height: 55, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 4 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  suggestionBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', position: 'absolute', top: 75, left: 0, right: 0, zIndex: 999, elevation: 3 },
  suggestionText: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  suggestionSubtext: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});



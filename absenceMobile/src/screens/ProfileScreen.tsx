import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import { updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function ProfileScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [matricule, setMatricule] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUser(data);
          setName(data.name || '');
          setEmail(currentUser.email || '');
          setMatricule(data.matricule || '');
          setUserRole(data.role || '');
        }
      }
      
      // Get saved password from login
      const savedPass = await AsyncStorage.getItem('@saved_password');
      if (savedPass) setCurrentPassword(savedPass);
      
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleUpdate = () => {
    if (!name.trim()) return Alert.alert("Erreur", "Le nom est requis.");
    setConfirmModalVisible(true);
  };

  const executeUpdate = async () => {
    setConfirmModalVisible(false);
    setUpdating(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Update Auth Profile
        await updateProfile(currentUser, { displayName: name });

          // Update Password if provided
          if (password.length > 0) {
            if (password.length < 6) throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
            if (password !== confirmPassword) throw new Error("Les mots de passe ne correspondent pas.");
            
            const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
            
            await updatePassword(currentUser, password);
            await AsyncStorage.setItem('@saved_password', password);
            setCurrentPassword(password);
          }

          // Update Firestore
          const updateData: any = { 
            name,
            email,
            password: password.length > 0 ? password : currentPassword
          };

          // Only allow instructors to update their matricule if needed, 
          // but we'll include it in the save for everyone
          if (userRole === 'formateur' || userRole === 'instructor') {
            updateData.matricule = matricule;
          }

          await updateDoc(doc(db, 'users', currentUser.uid), updateData);

          await AsyncStorage.setItem('@saved_email', email);

        setSuccessModalVisible(true);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <View style={s.loader}><ActivityIndicator size="large" color="#1E3A8A" /></View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mon Profil</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.roleBadge}>{user?.role?.toUpperCase()}</Text>
          <Text style={s.emailText}>{auth.currentUser?.email}</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>Nom complet</Text>
          <View style={s.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#64748B" style={s.icon} />
            <TextInput 
              style={s.input} 
              value={name} 
              onChangeText={setName} 
              placeholder="Votre nom"
            />
          </View>

          {(userRole === 'formateur' || userRole === 'instructor' || userRole === 'prof' || userRole === 'Prof' || (userRole !== 'directeur' && userRole !== 'gestionnaire' && userRole !== 'admin')) && (
            <>
              <Text style={s.label}>Matricule</Text>
              <View style={s.inputContainer}>
                <Ionicons name="card-outline" size={20} color="#64748B" style={s.icon} />
                <TextInput 
                  style={[s.input, { color: '#64748B' }]} 
                  value={matricule} 
                  editable={false}
                  placeholder="Votre matricule"
                  autoCapitalize="characters"
                />
              </View>
            </>
          )}

          <Text style={s.label}>Email</Text>
          <View style={s.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#64748B" style={s.icon} />
            <TextInput 
              style={[s.input, { color: '#64748B' }]} 
              value={email} 
              editable={false}
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Mot de passe de connexion actuel</Text>
          <View style={s.inputContainer}>
            <Ionicons name="key-outline" size={20} color="#64748B" style={s.icon} />
            <TextInput 
              style={[s.input, { color: '#1E3A8A', fontWeight: 'bold' }]} 
              value={currentPassword} 
              editable={false}
              secureTextEntry={!showCurrentPass}
            />
            <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
              <Ionicons name={showCurrentPass ? "eye-off-outline" : "eye-outline"} size={20} color="#1E3A8A" />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Nouveau mot de passe (optionnel)</Text>
          <View style={s.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={s.icon} />
            <TextInput 
              style={s.input} 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={!showPassword}
              placeholder="Min. 6 caractères"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {password.length > 0 && (
            <>
              <Text style={s.label}>Confirmer le nouveau mot de passe</Text>
              <View style={s.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={s.icon} />
                <TextInput 
                  style={s.input} 
                  value={confirmPassword} 
                  onChangeText={setConfirmPassword} 
                  secureTextEntry={!showConfirmPass}
                  placeholder="Répétez le mot de passe"
                />
                <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                  <Ionicons name={showConfirmPass ? "eye-off-outline" : "eye-outline"} size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity 
            style={[s.saveBtn, updating && s.disabledBtn]} 
            onPress={handleUpdate}
            disabled={updating}
          >
            {updating ? <ActivityIndicator color="white" /> : <Text style={s.saveBtnText}>Enregistrer les modifications</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Confirmation Modal */}
    <Modal transparent visible={confirmModalVisible} animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.confirmIconBox}>
            <Ionicons name="help-circle-outline" size={40} color="#1E3A8A" />
          </View>
          <Text style={s.modalTitle}>Confirmer les modifications</Text>
          <Text style={s.modalMsg}>Êtes-vous sûr de vouloir enregistrer ces modifications dans votre profil ?</Text>
          <View style={s.modalButtons}>
            <TouchableOpacity 
              onPress={() => setConfirmModalVisible(false)} 
              style={[s.modalBtn, { backgroundColor: '#F1F5F9', flex: 1, height: 50 }]}
            >
              <Text style={{ color: '#64748B', fontWeight: 'bold' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={executeUpdate} 
              style={[s.modalBtn, { backgroundColor: '#1E3A8A', flex: 1, height: 50 }]}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Success Modal */}
    <Modal transparent visible={successModalVisible} animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.successIconCircle}>
            <Ionicons name="checkmark-circle" size={50} color="#10B981" />
          </View>
          <Text style={s.modalTitle}>Mise à jour réussie !</Text>
          <Text style={s.modalMsg}>Votre profil et votre mot de passe ont été mis à jour avec succès. Votre compte est désormais sécurisé.</Text>
          <TouchableOpacity 
            onPress={() => setSuccessModalVisible(false)} 
            style={[s.modalBtn, { backgroundColor: '#1E3A8A', width: '100%', height: 55, marginTop: 10 }]}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 50 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E3A8A' },
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center', elevation: 5, marginBottom: 15 },
  avatarText: { fontSize: 40, color: 'white', fontWeight: 'bold' },
  roleBadge: { backgroundColor: '#E2E8F0', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, fontSize: 12, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 5 },
  emailText: { color: '#64748B', fontSize: 14 },
  form: { backgroundColor: 'white', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, marginTop: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 15, height: 50 },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#1E293B', fontSize: 16 },
  saveBtn: { backgroundColor: '#1E3A8A', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30, elevation: 3 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  disabledBtn: { opacity: 0.7 },
  securityNotice: { flexDirection: 'row', backgroundColor: '#F0FDF4', padding: 15, borderRadius: 15, marginBottom: 20, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#DCFCE7' },
  securityIconBox: { width: 45, height: 45, backgroundColor: 'white', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#10B981', shadowOpacity: 0.1, shadowRadius: 5 },
  securityTitle: { fontSize: 15, fontWeight: 'bold', color: '#166534', marginBottom: 2 },
  securityDesc: { fontSize: 12, color: '#15803D', lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', padding: 25, borderRadius: 30, alignItems: 'center', width: '85%', elevation: 25 },
  confirmIconBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  modalMsg: { textAlign: 'center', color: '#64748B', marginBottom: 25, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { paddingVertical: 15, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#DCFCE7' }
});

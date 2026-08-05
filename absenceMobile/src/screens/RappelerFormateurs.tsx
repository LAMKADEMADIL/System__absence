import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendPushNotification } from '../utils/notifications';

export default function RappelerFormateurs({ navigation }: any) {
  const [selectedSession, setSelectedSession] = useState('S1');
  const [formateurs, setFormateurs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Success Modal State
  const [successVisible, setSuccessVisible] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  const fetchFormateurs = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'Formateur'));
      const snap = await getDocs(q);
      setFormateurs(snap.docs.map(d => ({ id: d.id, ...d.data(), selected: false })));
    } catch (err) {
      console.error('Error fetching formateurs', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFormateurs();
  }, []);

  const showSuccess = () => {
    setSuccessVisible(true);
    Animated.parallel([
      Animated.timing(successAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(successScale, { toValue: 1, friction: 8, useNativeDriver: true })
    ]).start();
  };

  const hideSuccess = () => {
    Animated.parallel([
      Animated.timing(successAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(successScale, { toValue: 0.8, duration: 400, useNativeDriver: true })
    ]).start(() => {
      setSuccessVisible(false);
      navigation.goBack();
    });
  };

  const toggleSelect = (id: string) => {
    setFormateurs(formateurs.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  };

  const handleSend = async () => {
    const selectedProfs = formateurs.filter(f => f.selected);
    if (selectedProfs.length === 0) {
      Alert.alert('Attention', 'Veuillez sélectionner au moins un formateur.');
      return;
    }

    try {
      setIsLoading(true);
      
      const reminderPromises = selectedProfs.map(f => 
        addDoc(collection(db, 'reminders'), {
          instructorId: f.id,
          session: selectedSession,
          message: `⚠️ Rappel Urgent: Veuillez saisir les absences pour ${selectedSession} immédiatement.`,
          timestamp: serverTimestamp(),
          status: 'pending',
          fromName: 'Administration'
        })
      );

      const notificationPromises = selectedProfs.map(f => 
        addDoc(collection(db, 'notifications'), {
          targetId: f.id,
          message: `🔔 Rappel: Veuillez saisir les absences pour ${selectedSession}.`,
          timestamp: serverTimestamp(),
          read: false,
          type: 'reminder'
        })
      );

      const pushPromises = selectedProfs.map(f => 
        sendPushNotification(
          f.id,
          "⚠️ Rappel Urgent",
          `Veuillez saisir les absences pour ${selectedSession} immédiatement.`
        )
      );

      await Promise.all([...reminderPromises, ...notificationPromises, ...pushPromises]);
      showSuccess();

    } catch (err) {
       Alert.alert('Erreur', 'Impossible d\'envoyer le rappel.');
    } finally {
       setIsLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={['#fff', '#F8FAFC']} style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rappel des Formateurs</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={s.sessionContainer}>
        <Text style={s.sectionTitle}>Sélectionner la séance</Text>
        <View style={s.sessionRow}>
          {['S1', 'S2', 'S3', 'S4'].map(sess => (
            <TouchableOpacity 
              key={sess} 
              onPress={() => setSelectedSession(sess)}
              style={[s.sessChip, selectedSession === sess && s.sessChipActive]}
            >
              <Text style={[s.sessText, selectedSession === sess && s.sessTextActive]}>{sess}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.listHeader}>
        <Text style={s.sectionTitle}>Liste des Formateurs</Text>
        <Text style={s.countText}>{formateurs.filter(f => f.selected).length} Sélectionnés</Text>
      </View>

      <ScrollView 
        style={s.list} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchFormateurs} colors={["#1E3A8A"]} />}
      >
        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 50 }} />
        ) : (
          formateurs.map((f: any) => (
            <TouchableOpacity key={f.id} style={[s.card, f.selected && s.cardActive]} onPress={() => toggleSelect(f.id)}>
              <View style={s.cardLeft}>
                <View style={[s.avatar, f.selected && s.avatarActive]}>
                  <Text style={[s.avatarText, f.selected && s.avatarTextActive]}>{(f.name || 'F').charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.formateurName}>{f.name}</Text>
                  <Text style={s.formateurEmail}>{f.email || 'Aucun email'}</Text>
                </View>
              </View>
              <View style={[s.checkbox, f.selected && s.checkboxActive]}>
                {f.selected && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity onPress={handleSend} disabled={isLoading}>
          <LinearGradient colors={['#10B981', '#059669']} style={s.sendBtn}>
            {isLoading ? <ActivityIndicator color="white" /> : (
              <>
                <Ionicons name="send" size={18} color="white" />
                <Text style={s.sendText}>Rappeler les Formateurs</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Premium Success Modal */}
      <Modal transparent visible={successVisible} animationType="none">
        <View style={s.successOverlay}>
          <Animated.View style={[s.successCard, { opacity: successAnim, transform: [{ scale: successScale }] }]}>
             <View style={s.successIconCircle}>
                <Ionicons name="checkmark-circle" size={50} color="white" />
             </View>
             <Text style={s.successTitle}>Rappels Envoyés !</Text>
             <Text style={s.successMsg}>Les formateurs sélectionnés recevront un rappel immédiat sur leur téléphone.</Text>
             <TouchableOpacity style={s.successBtn} onPress={hideSuccess}>
                <Text style={s.successBtnText}>D'ACCORD</Text>
             </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1E3A8A' },
  sessionContainer: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  sessionRow: { flexDirection: 'row', gap: 12 },
  sessChip: { flex: 1, height: 45, backgroundColor: 'white', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  sessChipActive: { backgroundColor: '#1E3A8A' },
  sessText: { fontWeight: 'bold', color: '#1E3A8A' },
  sessTextActive: { color: 'white' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  countText: { fontSize: 12, color: '#10B981', fontWeight: 'bold' },
  list: { paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 15, borderRadius: 18, marginBottom: 12, elevation: 1 },
  cardActive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  avatarActive: { backgroundColor: '#1E3A8A' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  avatarTextActive: { color: 'white' },
  formateurName: { fontSize: 16, fontWeight: 'bold', color: '#1E3A8A' },
  formateurEmail: { fontSize: 12, color: '#94A3B8' },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  footer: { padding: 20, paddingBottom: 40, backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  sendBtn: { height: 55, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  sendText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  // Success Modal Styles
  successOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  successCard: { backgroundColor: 'white', width: '80%', padding: 30, borderRadius: 32, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 5 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  successMsg: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 25, fontWeight: '600', lineHeight: 22 },
  successBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 35, paddingVertical: 14, borderRadius: 16, elevation: 3 },
  successBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});

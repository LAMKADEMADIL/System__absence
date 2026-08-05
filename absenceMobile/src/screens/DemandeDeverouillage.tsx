import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { sendPushNotification } from '../utils/notifications';

export default function DemandeDeverouillage({ navigation }: any) {
  const [demandes, setDemandes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successModal, setSuccessModal] = useState(false);
  const successAnim = React.useRef(new Animated.Value(0)).current;
  const successScale = React.useRef(new Animated.Value(0.8)).current;

  const showSuccess = () => {
    setSuccessModal(true);
    Animated.parallel([
      Animated.timing(successAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(successScale, { toValue: 1, friction: 8, useNativeDriver: true })
    ]).start();
  };

  const hideSuccess = () => {
    Animated.parallel([
      Animated.timing(successAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(successScale, { toValue: 0.8, duration: 400, useNativeDriver: true })
    ]).start(() => setSuccessModal(false));
  };

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'unlock_requests'));
    
    const unsub = onSnapshot(q, (snap) => {
      setDemandes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleAction = async (requestId: string, action: 'accept' | 'reject', requestData: any) => {
    try {
      if (action === 'accept') {
        const batch = writeBatch(db);
        
        // 1. Remove from sessionLocks (Desktop)
        const qLock = query(
          collection(db, 'sessionLocks'),
          where('groupId', '==', requestData.groupId),
          where('day', '==', requestData.day),
          where('month', '==', requestData.month),
          where('year', '==', requestData.year),
          where('session', '==', requestData.session)
        );
        const lockSnap = await getDocs(qLock);
        lockSnap.docs.forEach(d => batch.delete(d.ref));

        // 2. Remove from locked_sessions (Mobile)
        const mobileLockId = `${requestData.groupId}_S${requestData.session}_${requestData.day}_${requestData.month}_${requestData.year}`;
        batch.delete(doc(db, 'locked_sessions', mobileLockId));

        // 3. Delete the request
        batch.delete(doc(db, 'unlock_requests', requestId));

        await batch.commit();
        
        // Notify formateur
        await sendPushNotification(
          requestData.formateurId,
          'Demande acceptée',
          `Votre demande pour le groupe ${requestData.groupName} a été acceptée.`
        );
        
        Alert.alert('Succès', 'La session a été déverrouillée.');
      } else {
        await deleteDoc(doc(db, 'unlock_requests', requestId));
        
        // Notify formateur
        await sendPushNotification(
          requestData.formateurId,
          'Demande rejetée',
          `Votre demande pour le groupe ${requestData.groupName} a été rejetée.`
        );
        
        Alert.alert('Info', 'Demande rejetée.');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Action impossible.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.title}>Demande de déverrouillage</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.list}>
        {isLoading ? (
          <ActivityIndicator color="#1E3A8A" style={{ marginTop: 50 }} />
        ) : demandes.length > 0 ? (
          demandes.map(d => (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.formateurText}>{d.formateurName || d.instructorName || 'Formateur'}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.infoText}>
                  {d.day}/{d.month}/{d.year} | Session {d.session} | {d.groupName || 'Inconnu'}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.rejectBtn} 
                  onPress={() => handleAction(d.id, 'reject', d)}
                >
                  <Text style={styles.rejectBtnText}>REJECTER</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.acceptBtn}
                  onPress={() => handleAction(d.id, 'accept', d)}
                >
                  <Text style={styles.acceptBtnText}>ACCEPTER</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={{ marginTop: 100, alignItems: 'center' }}>
            <Ionicons name="mail-open-outline" size={80} color="#888" />
            <Text style={{ marginTop: 20, color: '#888', fontSize: 16 }}>Aucune demande en attente</Text>
          </View>
        )}
      </ScrollView>

      {/* Premium Success Modal for Teacher */}
      <Modal transparent visible={successModal} animationType="none">
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successCard, { opacity: successAnim, transform: [{ scale: successScale }] }]}>
             <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-circle" size={50} color="white" />
             </View>
             <Text style={styles.successTitle}>Envoyé !</Text>
             <Text style={styles.successMsg}>Votre demande de déverrouillage a été transmise avec succès.</Text>
             <TouchableOpacity style={styles.successBtn} onPress={() => { hideSuccess(); navigation.goBack(); }}>
                <Text style={styles.successBtnText}>D'ACCORD</Text>
             </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 20, color: '#1E3A8A', fontWeight: 'bold' },
  list: { paddingHorizontal: 20 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { marginBottom: 10 },
  formateurText: { fontSize: 18, color: '#1E3A8A', fontWeight: 'bold' },
  cardBody: { marginBottom: 15 },
  infoText: { fontSize: 14, color: 'gray' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
  rejectBtn: { padding: 10 },
  rejectBtnText: { color: 'red', fontWeight: 'bold' },
  acceptBtn: { padding: 10 },
  acceptBtnText: { color: '#3B8263', fontWeight: 'bold' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  successCard: { backgroundColor: 'white', width: '80%', padding: 30, borderRadius: 32, alignItems: 'center', elevation: 20 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  successMsg: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 25, fontWeight: '600' },
  successBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 35, paddingVertical: 14, borderRadius: 16 },
  successBtnText: { color: 'white', fontWeight: '900' }
});

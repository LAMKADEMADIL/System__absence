import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Modal, Animated, RefreshControl, Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, deleteDoc, getDocs,
  serverTimestamp, setDoc, writeBatch, addDoc
} from 'firebase/firestore';
import { registerForPushNotificationsAsync } from '../utils/notifications';
// import * as Notifications from 'expo-notifications';

// Set up notification handler (MOCKED)
const Notifications = {
  setNotificationHandler: () => {},
  scheduleNotificationAsync: async () => {},
  AndroidNotificationPriority: { MAX: 2 }
} as any;

export default function DirecteurDashboard({ navigation }: any) {
  const [groups, setGroups] = useState<any[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests'>('requests');
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [successModal, setSuccessModal] = useState<{ visible: boolean; message: string; type: 'success' | 'info' }>({ visible: false, message: '', type: 'success' });
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  // Calculate Monday and Saturday of current week
  const getWeekRange = () => {
    const d = new Date();
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(new Date().setDate(new Date().getDate() + diffToMon));
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    
    return `Semaine: ${mon.getDate()} - ${sat.getDate()}`;
  };
  
  // Custom Notification State
  const [lastRequestCount, setLastRequestCount] = useState(0);
  const [showInAppNotif, setShowInAppNotif] = useState(false);
  const [notifData, setNotifData] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const bellShake = useRef(new Animated.Value(0)).current;

  const triggerBellShake = () => {
    Animated.sequence([
      Animated.timing(bellShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bellShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(bellShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bellShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const day = currentDate.getDate(), month = currentDate.getMonth() + 1, year = currentDate.getFullYear();

  useEffect(() => {
    if (auth.currentUser) {
      registerForPushNotificationsAsync(auth.currentUser.uid);
    }
  }, []);

  const triggerInAppNotif = (data: any) => {
    Notifications.scheduleNotificationAsync({
      content: {
        title: "🚨 Demande de déverrouillage (Directeur)",
        body: `Formateur: ${data.formateurName || data.instructorName} | Groupe: ${data.groupName}`,
        data: { data },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });

    // 2. In-app notification
    Vibration.vibrate(1000);
    setNotifData(data);
    setShowInAppNotif(true);
    Animated.spring(slideAnim, { toValue: 100, useNativeDriver: true, tension: 50, friction: 8 }).start();
    
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -150, duration: 500, useNativeDriver: true }).start(() => {
        setShowInAppNotif(false);
      });
    }, 6000);
  };

  useEffect(() => {
    const qReq = query(collection(db, 'unlock_requests'), where('status', '==', 'pending'));
    let isInitialLoad = true;
    const unsubReq = onSnapshot(qReq, snap => {
      setUnlockRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      if (!isInitialLoad) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            triggerInAppNotif(change.doc.data());
            triggerBellShake();
          }
        });
      }
      isInitialLoad = false;
    });

    return () => { unsubReq(); };
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setCurrentDate(new Date());
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const showSuccess = (msg: string, type: 'success' | 'info' = 'success') => {
    setSuccessModal({ visible: true, message: msg, type });
    Animated.parallel([
      Animated.timing(successAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(successScale, { toValue: 1, friction: 8, useNativeDriver: true })
    ]).start();
  };

  const hideSuccess = () => {
    Animated.parallel([
      Animated.timing(successAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(successScale, { toValue: 0.8, duration: 400, useNativeDriver: true })
    ]).start(() => setSuccessModal({ ...successModal, visible: false }));
  };

  const handleAccept = async (req: any) => {
    try {
      const batch = writeBatch(db);
      const sessList = Array.isArray(req.sessions) ? req.sessions : [req.session];
      
      // 1. Delete lock sessions
      for (const sNum of sessList) {
        const lockId = `${req.groupId}_S${sNum}_${req.day}_${req.month}_${req.year}`;
        batch.delete(doc(db, 'locked_sessions', lockId));
      }
      
      // 2. Reset absences to submitted: false
      const qAbs = query(collection(db, 'absences'), 
        where('groupId', '==', req.groupId),
        where('day', '==', req.day),
        where('month', '==', req.month),
        where('year', '==', req.year)
      );
      const absSnap = await getDocs(qAbs);
      absSnap.docs.forEach(d => {
        if (sessList.includes(d.data().session)) {
          batch.update(d.ref, { submitted: false });
        }
      });

      // 3. Delete group submission
      const subId = `SUB_${req.groupId}_${req.day}_${req.month}_${req.year}`;
      batch.delete(doc(db, 'group_submissions', subId));

      // 4. Update request status
      batch.update(doc(db, 'unlock_requests', req.id), { status: 'accepted', resolvedAt: serverTimestamp() });
      
      await batch.commit();

      // 5. Create Notification for Formateur
      await addDoc(collection(db, 'notifications'), {
        targetId: req.formateurId,
        message: `Votre demande de déverrouillage pour ${req.groupName} (${req.sessions?.join(', ') || req.session}) a été ACCEPTÉE.`,
        timestamp: serverTimestamp(),
        read: false,
        type: 'unlock_accepted'
      });

      showSuccess("Demande acceptée et liste réinitialisée");
    } catch (e) { console.error(e); alert("Erreur lors de l'acceptation"); }
  };

  const handleReject = async (req: any) => {
    try {
      await updateDoc(doc(db, 'unlock_requests', req.id), { status: 'rejected', resolvedAt: serverTimestamp() });
      
      // Create Notification for Formateur
      await addDoc(collection(db, 'notifications'), {
        targetId: req.formateurId,
        message: `❌ Votre demande de déverrouillage pour ${req.groupName} a été REFUSÉE par l'administration.`,
        timestamp: serverTimestamp(),
        read: false,
        type: 'unlock_rejected'
      });

      showSuccess("Demande refusée", 'info');
    } catch (e) { console.error(e); alert("Erreur lors du refus"); }
  };

  return (
    <View style={s.container}>
      {/* Custom In-App Notification Banner */}
      <Animated.View style={[s.notifBanner, { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={s.notifContent} onPress={() => { Animated.timing(slideAnim, { toValue: -150, duration: 300, useNativeDriver: true }).start(); }}>
           <View style={s.notifIcon}><Ionicons name="notifications" size={24} color="#fff" /></View>
           <View style={{ flex: 1 }}>
              <Text style={s.notifTitle}>Demande de Déverrouillage</Text>
              <Text style={s.notifBody} numberOfLines={2}>
                L'enseignant {notifData?.formateurName} demande l'ouverture des séances (S{Array.isArray(notifData?.sessions) ? notifData.sessions.join(', S') : notifData?.session}) pour {notifData?.groupName}
              </Text>
           </View>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 50 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} />
        }
      >
        <View style={s.topRow}>
          <TouchableOpacity onPress={() => setActiveTab('requests')} style={s.headerNotifBtn}>
            <Animated.View style={{ transform: [{ translateX: bellShake }] }}>
              <Ionicons 
                name={unlockRequests.length > 0 ? "notifications" : "notifications-outline"} 
                size={26} 
                color={unlockRequests.length > 0 ? "#EF4444" : "#1E3A8A"} 
              />
            </Animated.View>
            {unlockRequests.length > 0 && (
              <View style={s.notifDot}>
                <Text style={s.notifBadgeText}>{unlockRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={s.headerTitle}>Directeur</Text>

          <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.headerBtn}>
            <Ionicons name="menu-outline" size={28} color="#1E3A8A" />
          </TouchableOpacity>
        </View>

        <View style={s.dateCard}>
          <View style={s.dateInfo}>
            <Text style={[s.dateText, { fontSize: 20, fontWeight: '900', color: '#1E3A8A', textTransform: 'capitalize', marginBottom: 2 }]}>
              {currentDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
            </Text>
            <Text style={[s.dateText, { fontSize: 13, fontWeight: '700', color: '#64748B' }]}>
              {currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Text>
            <View style={s.weekBadge}>
              <Text style={s.weekText}>{getWeekRange()}</Text>
            </View>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Demandes de déverrouillage</Text>
        </View>

        <View style={s.content}>
          {unlockRequests.length === 0 ? (
            <View style={s.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={80} color="#CBD5E1" />
              <Text style={s.empty}>Aucune demande en attente</Text>
            </View>
          ) : (
            unlockRequests.map(req => (
              <View key={req.id} style={s.reqCard}>
                <View style={s.reqAvatar}>
                  <Ionicons name="person" size={20} color="#1E3A8A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.reqFormateur, { color: '#1E3A8A', fontSize: 18, marginBottom: 2 }]}>{req.groupName}</Text>
                  <Text style={[s.reqInfo, { fontSize: 14, color: '#475569', fontWeight: '700' }]}>
                    {req.formateurName?.toUpperCase()}
                  </Text>
                  <Text style={[s.reqInfo, { marginTop: 2 }]}>
                    Sessions: {Array.isArray(req.sessions) ? req.sessions.join(', ') : req.session}
                  </Text>
                </View>
                <View style={s.reqActions}>
                  <TouchableOpacity onPress={() => handleAccept(req)} style={s.btnAcc}>
                    <Ionicons name="checkmark-sharp" size={24} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleReject(req)} style={s.btnRej}>
                    <Ionicons name="close-sharp" size={24} color="white" />
                  </TouchableOpacity>
                </View>

                {/* Professional Bottom Time Badge */}
                <View style={s.timeBadgeCenter}>
                   <Ionicons name="time" size={10} color="#1E3A8A" />
                   <Text style={s.timeTextCenter}>
                     Envoyé à {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                   </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={menuVisible} animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={s.menuCard}>
            <TouchableOpacity style={s.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate('ProfileScreen'); }}>
              <Ionicons name="person-outline" size={20} color="#1E3A8A" />
              <Text style={s.menuItemText}>Mon Profil</Text>
            </TouchableOpacity>
            <View style={s.menuDivider} />
            <TouchableOpacity style={s.menuItem} onPress={async () => { 
              setMenuVisible(false); 
              await auth.signOut();
              navigation.replace('Login'); 
            }}>
              <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
              <Text style={[s.menuItemText, { color: '#E53E3E' }]}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New Premium Success/Feedback Modal with Custom Slow Animation */}
      <Modal transparent visible={successModal.visible} animationType="none">
        <View style={s.successOverlay}>
          <Animated.View style={[s.successCard, { opacity: successAnim, transform: [{ scale: successScale }] }]}>
             <View style={[s.successIconCircle, { backgroundColor: successModal.type === 'success' ? '#10B981' : '#64748B' }]}>
                <Ionicons name={successModal.type === 'success' ? "checkmark-circle" : "information-circle"} size={50} color="white" />
             </View>
             <Text style={s.successTitle}>{successModal.type === 'success' ? "Succès !" : "Info"}</Text>
             <Text style={s.successMsg}>{successModal.message}</Text>
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
  container: { flex: 1, backgroundColor: '#F7FAFC', paddingTop: 50 },
  notifBanner: { position: 'absolute', top: 0, left: 10, right: 10, zIndex: 9999, backgroundColor: '#1E3A8A', borderRadius: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  notifContent: { flexDirection: 'row', padding: 15, alignItems: 'center', gap: 15 },
  notifIcon: { width: 45, height: 45, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  notifTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  notifBody: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15, alignItems: 'center', height: 60 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#1E3A8A', flex: 1, textAlign: 'center' },
  headerBtn: { backgroundColor: '#FFF', padding: 8, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  dateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: '5%', width: '90%', padding: 15, borderRadius: 20, marginBottom: 20, elevation: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, justifyContent: 'space-between' },
  dateInfo: { alignItems: 'center', width: '100%' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  weekBadge: { backgroundColor: '#EDF2F7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 4 },
  weekText: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 100, paddingRight: 20 },
  menuCard: { backgroundColor: 'white', borderRadius: 15, width: 180, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, padding: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  menuItemText: { fontWeight: 'bold', color: '#1E3A8A' },
  menuDivider: { height: 1, backgroundColor: '#EDF2F7', marginHorizontal: 10 },
  content: { paddingHorizontal: 20, paddingTop: 10 },
  reqCard: { flexDirection: 'row', backgroundColor: 'white', padding: 20, paddingBottom: 35, borderRadius: 24, marginBottom: 15, alignItems: 'center', elevation: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: '#EFF6FF', position: 'relative' },
  reqAvatar: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  reqFormateur: { fontWeight: '900', color: '#1E3A8A', fontSize: 16, letterSpacing: 0.5 },
  reqInfo: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4 },
  timeBadgeCenter: { position: 'absolute', bottom: -8, left: '25%', right: '25%', backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E0F2FE', elevation: 3, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  timeTextCenter: { fontSize: 10, color: '#1E3A8A', fontWeight: '900' },
  reqActions: { flexDirection: 'row', gap: 10, marginLeft: 10 },
  btnAcc: { backgroundColor: '#10B981', width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  btnRej: { backgroundColor: '#EF4444', width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 15 },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 15, alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#64748B', textAlign: 'center' },
  headerNotifBtn: { position: 'relative', padding: 5 },
  notifDot: { position: 'absolute', top: 0, left: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: 'white', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  notifBadgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  successCard: { backgroundColor: 'white', width: '70%', padding: 25, borderRadius: 32, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  successMsg: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20, fontWeight: '600' },
  successBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14, elevation: 3 },
  successBtnText: { color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 1 }
});

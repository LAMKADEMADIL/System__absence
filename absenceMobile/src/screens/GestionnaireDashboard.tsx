import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Modal, Animated, RefreshControl, Vibration, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, deleteDoc, getDocs,
  serverTimestamp, setDoc, writeBatch, addDoc
} from 'firebase/firestore';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import * as Notifications from 'expo-notifications';

// Set up notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function GestionnaireDashboard({ navigation }: any) {
  const [groups, setGroups] = useState<any[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'absences' | 'requests'>('absences');
  const [showValidateAllModal, setShowValidateAllModal] = useState(false);
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
        title: "📢 Nouvelle demande de déverrouillage",
        body: `De: ${data.formateurName || data.instructorName} | Groupe: ${data.groupName}`,
        data: { data },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // show immediately
    });

    // 2. In-app custom UI notification
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
    setIsLoading(true);
    const unsubGroups = onSnapshot(collection(db, 'groups'), (groupsSnap) => {
      const groupsList = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const qAbs = query(collection(db, 'absences'),
        where('day', '==', day), where('month', '==', month), where('year', '==', year),
        where('submitted', '==', true));
      
      const qSub = query(collection(db, 'group_submissions'),
        where('day', '==', day), where('month', '==', month), where('year', '==', year));

      const unsubSub = onSnapshot(qSub, (subSnap) => {
        const submissionsAll = subSnap.docs.map(d => d.data());
        
        const unsubAbs = onSnapshot(qAbs, (absSnap) => {
          const absencesAll = absSnap.docs.map(d => d.data());
          
          const submissions = submissionsAll.filter((s: any) => s.status !== 'validated');
          const absences = absencesAll.filter((a: any) => a.status === 'pending' || !a.status);
          
          const submittedGroupIds = new Set([
            ...absences.map((a: any) => a.groupId),
            ...submissions.map((s: any) => s.groupId)
          ]);

          const summary = groupsList.filter(g => submittedGroupIds.has(g.id) || submittedGroupIds.has(g.name)).map(g => {
            const groupAbs = absences.filter((a: any) => a.groupId === g.id || a.groupId === g.name || a.groupName === g.name);
            const subData = submissions.find((s: any) => s.groupId === g.id || s.groupId === g.name);
            const uniqueStudents = new Set(groupAbs.map((a: any) => a.studentId || a.stagiaireId)).size;
            return {
              ...g,
              total_absences: uniqueStudents,
              sessions: subData?.sessions || [],
              formateurName: subData?.formateurName || '---',
              submittedAt: subData?.submittedAt?.toDate ? subData.submittedAt.toDate().getTime() : 0
            };
          });

          summary.sort((a, b) => b.submittedAt - a.submittedAt);
          setGroups(summary);
          setIsLoading(false);
        });
      });

      return () => {
        unsubSub();
      };
    });

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

    return () => { unsubGroups(); unsubReq(); };
  }, [currentDate]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setCurrentDate(new Date());
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const changeDate = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + offset);
    
    if (newDate > today) return;
    
    // Prevent going back before Monday of current week
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    monday.setHours(0,0,0,0);
    
    if (newDate < monday) return;

    setCurrentDate(newDate);
  };

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

  const handleValidateAll = () => {
    setShowValidateAllModal(true);
  };

  const confirmValidateAll = async () => {
    try {
      setShowValidateAllModal(false);
      setIsLoading(true);
      const batch = writeBatch(db);
      const day = currentDate.getDate();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const qAbs = query(collection(db, 'absences'), 
        where('day', '==', day), 
        where('month', '==', month), 
        where('year', '==', year));
      
      const absSnap = await getDocs(qAbs);
      absSnap.docs.forEach(d => {
        const data = d.data();
        const isTargetGroup = groups.some(g => data.groupId === g.id || data.name === g.name);
        if (isTargetGroup && (data.status === 'pending' || !data.status)) {
          batch.update(d.ref, { status: 'validated', validatedAt: serverTimestamp() });
        }
      });

      const qSub = query(collection(db, 'group_submissions'), 
        where('day', '==', day), 
        where('month', '==', month), 
        where('year', '==', year));
      
      const subSnap = await getDocs(qSub);
      subSnap.docs.forEach(d => {
        const data = d.data();
        const isTargetGroup = groups.some(g => data.groupId === g.id || data.groupId === g.name);
        if (isTargetGroup && data.status !== 'validated') {
          batch.update(d.ref, { status: 'validated', validatedAt: serverTimestamp() });
        }
      });

      await batch.commit();
      showSuccess(`${groups.length} groupes validés avec succès !`);
    } catch (err) {
      console.error(err);
      Alert.alert("Erreur", "Une erreur est survenue lors de la validation.");
    } finally {
      setIsLoading(false);
    }
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

      // 3. Delete group submission document
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

      showSuccess("Demande rejetée.", 'info');
    } catch (e) { console.error(e); alert("Erreur lors du refus"); }
  };

  return (
    <View style={s.container}>
      {/* Custom In-App Notification Banner */}
      <Animated.View style={[s.notifBanner, { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={s.notifContent} onPress={() => { setActiveTab('requests'); Animated.timing(slideAnim, { toValue: -150, duration: 300, useNativeDriver: true }).start(); }}>
           <View style={s.notifIcon}><Ionicons name="notifications" size={24} color="#fff" /></View>
           <View style={{ flex: 1 }}>
              <Text style={s.notifTitle}>Demande de Déverrouillage</Text>
              <Text style={s.notifBody} numberOfLines={2}>
                L'enseignant {notifData?.formateurName} demande l'ouverture des séances (S{Array.isArray(notifData?.sessions) ? notifData.sessions.join(', S') : notifData?.session}) pour {notifData?.groupName}
              </Text>
           </View>
        </TouchableOpacity>
      </Animated.View>

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

          <Text style={s.headerTitle}>Gestionnaire</Text>

          <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.headerBtn}>
            <Ionicons name="menu-outline" size={28} color="#1E3A8A" />
          </TouchableOpacity>
        </View>

        <View style={s.dateCard}>
          <TouchableOpacity 
            onPress={() => changeDate(-1)} 
            style={[s.navBtn, (() => {
              const dayOfWeek = today.getDay();
              const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
              const monday = new Date(today);
              monday.setDate(today.getDate() + diffToMon);
              monday.setHours(0,0,0,0);
              return currentDate <= monday;
            })() && { opacity: 0.2 }]}
            disabled={(() => {
              const dayOfWeek = today.getDay();
              const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
              const monday = new Date(today);
              monday.setDate(today.getDate() + diffToMon);
              monday.setHours(0,0,0,0);
              return currentDate <= monday;
            })()}
          >
            <Ionicons name="chevron-back" size={26} color="#1E3A8A" />
          </TouchableOpacity>
          
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

          <TouchableOpacity 
            onPress={() => changeDate(1)} 
            style={[s.navBtn, currentDate.toDateString() === today.toDateString() && { opacity: 0.2 }]}
            disabled={currentDate.toDateString() === today.toDateString()}
          >
            <Ionicons name="chevron-forward" size={26} color="#1E3A8A" />
          </TouchableOpacity>
        </View>

        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, activeTab === 'absences' && s.tabActive]} onPress={() => setActiveTab('absences')}>
            <Text style={[s.tabText, activeTab === 'absences' && s.tabTextActive]}>ABSENCES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, activeTab === 'requests' && s.tabActive]} onPress={() => setActiveTab('requests')}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[s.tabText, activeTab === 'requests' && s.tabTextActive]}>REQUÊTES</Text>
              {unlockRequests.length > 0 && (
                <View style={s.activeBadge}>
                  <Text style={s.activeBadgeText}>{unlockRequests.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} />
          }
        >

        <View style={s.content}>
          {activeTab === 'absences' ? (
            isLoading ? <ActivityIndicator size="large" color="#1E3A8A" /> :
            groups.length === 0 ? <Text style={s.empty}>Aucune absence</Text> :
            groups.map(g => (
              <TouchableOpacity 
                key={g.id} 
                style={s.card} 
                onPress={() => navigation.navigate('StagiairesAbsents', { groupName: g.name, groupId: g.id })}
              >
                <View style={s.cardLeft}>
                  <View style={s.groupIconContainer}>
                    <Ionicons name="people" size={24} color="#1E3A8A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.groupName}>{g.name}</Text>
                    <View style={s.instructorRow}>
                      <Ionicons name="person-circle-outline" size={14} color="#1E3A8A" />
                      <Text style={s.formateurTextSmall}>{g.formateurName?.toUpperCase()}</Text>
                    </View>
                    <View style={s.sessionRowSmall}>
                      <Ionicons name="time-outline" size={12} color="#94A3B8" />
                      <Text style={s.groupSub}>Séances: {g.sessions?.map((s:any) => `S${s}`).join(', ') || '---'}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.cardRight}>
                  <View style={[s.absBadge, g.total_absences === 0 && s.absBadgeGreen]}>
                    <Text style={[s.absText, g.total_absences === 0 && s.absTextGreen]}>
                      {g.total_absences} Absences
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            unlockRequests.length === 0 ? <Text style={s.empty}>Aucune requête</Text> :
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

      <View style={s.fabContainer}>
        {activeTab === 'absences' && groups.length > 0 ? (
          <TouchableOpacity 
            style={[s.notifyFab, s.validateAllFab]} 
            onPress={handleValidateAll}
          >
            <Ionicons name="checkmark-done-circle" size={24} color="white" />
            <Text style={s.notifyFabText}>Tout Valider</Text>
          </TouchableOpacity>
        ) : <View />}
        
        <TouchableOpacity 
          style={s.notifyFab} 
          onPress={() => navigation.navigate('RappelerFormateurs')}
        >
          <Ionicons name="notifications-outline" size={24} color="white" />
          <Text style={s.notifyFabText}>Notifier</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Confirmation Modal for Tout Valider */}
      <Modal transparent visible={showValidateAllModal} animationType="fade">
        <View style={s.confirmModalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.confirmIconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkmark-done-circle" size={40} color="#10B981" />
            </View>
            <Text style={s.modalTitle}>Tout valider</Text>
            <Text style={s.modalMsg}>
              Voulez-vous valider toutes les absences pour les {groups.length} groupes sélectionnés ?
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowValidateAllModal(false)}>
                <Text style={s.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, { backgroundColor: '#10B981' }]} onPress={confirmValidateAll}>
                <Text style={s.modalConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15, alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#1E3A8A', flex: 1, textAlign: 'center' },
  headerBtn: { backgroundColor: '#FFF', padding: 8, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  dateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: '5%', width: '90%', padding: 15, borderRadius: 20, marginBottom: 20, elevation: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, justifyContent: 'space-between' },
  navBtn: { padding: 5 },
  dateInfo: { alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  weekBadge: { backgroundColor: '#EDF2F7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 4 },
  weekText: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 100, paddingRight: 20 },
  menuCard: { backgroundColor: 'white', borderRadius: 15, width: 180, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, padding: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  menuItemText: { fontWeight: 'bold', color: '#1E3A8A' },
  menuDivider: { height: 1, backgroundColor: '#EDF2F7', marginHorizontal: 10 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#EDF2F7', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#1E3A8A' },
  tabText: { fontWeight: '900', color: '#1E3A8A', fontSize: 13, letterSpacing: 1 },
  tabTextActive: { color: 'white' },
  activeBadge: { backgroundColor: '#EF4444', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8, borderWidth: 1.5, borderColor: 'white', elevation: 2 },
  activeBadgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
  content: { paddingHorizontal: 20, paddingTop: 10 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: 'white', padding: 18, borderRadius: 24, marginBottom: 15, elevation: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: '#EDF2F7', overflow: 'hidden' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 },
  groupIconContainer: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: 17, fontWeight: '900', color: '#1E3A8A' },
  instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  formateurTextSmall: { fontSize: 13, fontWeight: '800', color: '#1E3A8A', letterSpacing: 0.3 },
  sessionRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  groupSub: { fontSize: 11, color: '#94A3B8', fontWeight: 'bold' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'flex-start', marginLeft: 10, paddingTop: 2 },
  absBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, minWidth: 75, alignItems: 'center', justifyContent: 'center' },
  absBadgeGreen: { backgroundColor: '#DCFCE7' },
  absText: { color: '#EF4444', fontWeight: '900', fontSize: 12 },
  absTextGreen: { color: '#10B981' },
  reqCard: { flexDirection: 'row', backgroundColor: 'white', padding: 20, paddingBottom: 35, borderRadius: 24, marginBottom: 15, alignItems: 'center', elevation: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: '#EFF6FF', position: 'relative' },
  reqAvatar: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  reqFormateur: { fontWeight: '900', color: '#1E3A8A', fontSize: 16, letterSpacing: 0.5 },
  reqInfo: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4 },
  timeBadgeCenter: { position: 'absolute', bottom: -8, left: '25%', right: '25%', backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E0F2FE', elevation: 3, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  timeTextCenter: { fontSize: 10, color: '#1E3A8A', fontWeight: '900' },
  reqActions: { flexDirection: 'row', gap: 10, marginLeft: 10 },
  btnAcc: { backgroundColor: '#10B981', width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  btnRej: { backgroundColor: '#EF4444', width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  empty: { textAlign: 'center', marginTop: 50, color: 'gray' },
  notifyFab: { backgroundColor: '#1E3A8A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, elevation: 10, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, gap: 8 },
  validateAllFab: { backgroundColor: '#10B981', shadowColor: '#10B981' },
  fabContainer: { position: 'absolute', bottom: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifyFabText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  headerNotifBtn: { position: 'relative', padding: 5 },
  notifDot: { position: 'absolute', top: 0, left: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: 'white', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  notifBadgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
  confirmModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', width: '90%', padding: 25, borderRadius: 32, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  confirmIconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  modalMsg: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  modalCancelText: { color: '#64748B', fontWeight: '900', fontSize: 14 },
  modalConfirm: { flex: 1, backgroundColor: '#1E3A8A', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  modalConfirmText: { color: 'white', fontWeight: '900', fontSize: 14 },
  successOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  successCard: { backgroundColor: 'white', width: '70%', padding: 25, borderRadius: 32, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  successMsg: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20, fontWeight: '600' },
  successBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14, elevation: 3 },
  successBtnText: { color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 1 }
});

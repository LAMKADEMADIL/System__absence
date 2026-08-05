import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Modal, ActivityIndicator, Animated, Platform, StatusBar,
  useWindowDimensions, TextInput, KeyboardAvoidingView, Alert, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { 
  collection, query, where, onSnapshot, getDocs, doc, 
  addDoc, serverTimestamp, writeBatch, setDoc, deleteDoc, updateDoc, getDoc
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignatureScreen from 'react-native-signature-canvas';
import { registerForPushNotificationsAsync, sendPushNotification, notifyManagers } from '../utils/notifications';
import * as Clipboard from 'expo-clipboard';

const signatureStyle = `
  .m-signature-pad--footer { display: none; }
  .m-signature-pad { border: 2px solid #E2E8F0; border-radius: 15px; height: 350px; }
  body,html { height: 100%; width: 100%; margin: 0; padding: 0; }
`;

const groupScheduleItems = (items: any[]) => {
  const grouped: any[] = [];
  items.forEach(item => {
    const match = grouped.find(g => 
      g.groupe.trim().toUpperCase() === item.groupe.trim().toUpperCase() &&
      g.salle.trim().toUpperCase() === item.salle.trim().toUpperCase() &&
      g.type.trim().toUpperCase() === item.type.trim().toUpperCase()
    );
    const slotMatch = item.slot.match(/SE(\d+)/i);
    const sessionNum = slotMatch ? parseInt(slotMatch[1], 10) : 1;
    if (match) {
      if (!match.slots.includes(item.slot)) {
        match.slots.push(item.slot);
      }
      if (!match.sessionNums.includes(sessionNum)) {
        match.sessionNums.push(sessionNum);
      }
      match.sessionNums.sort((a: number, b: number) => a - b);
      match.slots.sort((a: string, b: string) => a.localeCompare(b));
      match.slot = match.slots.join(' + ');
    } else {
      grouped.push({
        ...item,
        slots: [item.slot],
        sessionNums: [sessionNum],
      });
    }
  });
  return grouped;
};

const expandGroupName = (groupName: string): string[] => {
  if (!groupName) return [];
  groupName = groupName.trim();
  if (!groupName.includes(',')) {
    return [groupName];
  }
  
  const parts = groupName.split(',').map(p => p.trim());
  const firstPart = parts[0];
  const results = [firstPart];
  
  const match = firstPart.match(/(\d+)$/);
  if (!match) {
    for (let i = 1; i < parts.length; i++) {
      results.push(parts[i]);
    }
    return results;
  }
  
  const suffixStr = match[1];
  const base = firstPart.slice(0, firstPart.length - suffixStr.length);
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.length < suffixStr.length) {
      const newSuffix = suffixStr.slice(0, suffixStr.length - part.length) + part;
      results.push(base + newSuffix);
    } else {
      if (/^\d+$/.test(part)) {
        results.push(base + part);
      } else {
        results.push(part);
      }
    }
  }
  return results;
};

export default function FormateurDashboard({ navigation }: any) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedFiliere, setSelectedFiliere] = useState<string>('');
  const [selectedAnnee, setSelectedAnnee] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeachingSessions, setSelectedTeachingSessions] = useState<number[]>([]);
  const [isTakingAttendance, setIsTakingAttendance] = useState(false);
  const [lockedSessions, setLockedSessions] = useState<Record<number, boolean>>({});
  const [localAbsences, setLocalAbsences] = useState<Record<string, number[]>>({});
  const [sentGroups, setSentGroups] = useState<Set<string>>(new Set());
  
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [myWeeklySchedule, setMyWeeklySchedule] = useState<any[]>([]);
  const [myTodaySchedule, setMyTodaySchedule] = useState<any[]>([]);
  const [currentWeekRange, setCurrentWeekRange] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState<boolean>(false);
  const [activeScheduleItem, setActiveScheduleItem] = useState<any>(null);
  const [selectedWeekTab, setSelectedWeekTab] = useState<'current' | 'next'>('current');
  const [lockedTodaySessions, setLockedTodaySessions] = useState<Record<string, number[]>>({});
  const [submittedTodayGroups, setSubmittedTodayGroups] = useState<Set<string>>(new Set());
  const [subGroupModalVisible, setSubGroupModalVisible] = useState(false);
  const [pendingScheduleItem, setPendingScheduleItem] = useState<any>(null);
  const [expandedSubGroups, setExpandedSubGroups] = useState<string[]>([]);

  useEffect(() => {
    if (auth.currentUser) {
      registerForPushNotificationsAsync(auth.currentUser.uid).then(t => setToken(t || null));
    }
  }, []);

  const testSelfNotification = async () => {
    if (auth.currentUser && token) {
      await sendPushNotification(
        auth.currentUser.uid,
        "Test Local",
        "Si vous voyez ceci, les notifications fonctionnent !",
        { test: true }
      );
      Alert.alert("Succès", "Demande d'envoi lancée. Attendez quelques secondes...");
    } else {
      Alert.alert("Erreur", "Token non disponible. Vérifiez la connexion.");
    }
  };

  const copyToken = async () => {
    if (token) {
      await Clipboard.setStringAsync(token);
      Alert.alert("Copié", "Le code (Token) a été copié dans le presse-papier.");
    }
  };

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [confirmSendVisible, setConfirmSendVisible] = useState(false);
  const [confirmUnlockVisible, setConfirmUnlockVisible] = useState(false);
  const [requestSentVisible, setRequestSentVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [activeBanner, setActiveBanner] = useState<any>(null);
  const bannerAnim = useRef(new Animated.Value(-200)).current;
  const bellShake = useRef(new Animated.Value(0)).current;
  const lastNotifId = useRef<string | null>(null);
  const isInitializing = useRef(true);

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return '---';
    const now = new Date();
    const then = new Date(timestamp.seconds * 1000);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return then.toLocaleDateString();
  };

  const signatureRef = useRef<any>(null);
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  const getFrenchDate = () => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const now = new Date();
    const first = now.getDate() - now.getDay() + 1;
    const firstDay = new Date(new Date().setDate(first));
    const lastDay = new Date(new Date().setDate(first + 5));
    const weekRange = `${firstDay.getDate()} - ${lastDay.getDate()}`;
    const today = new Date();
    return {
      dayName: days[today.getDay()],
      fullDate: `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`,
      weekRange: weekRange
    };
  };

  const getCurrentWeekRange = () => {
    const today = new Date();
    const day = today.getDay();
    // Monday is day 1. If today is Sunday (0), we go back 6 days.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const format = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };
    return `${format(monday)} au ${format(sunday)}`;
  };

  const getNextWeekRange = () => {
    const today = new Date();
    const day = today.getDay();
    // Monday is day 1. If today is Sunday (0), we go back 6 days + 7 days for next week.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + 7;
    const nextMonday = new Date(today.setDate(diff));
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    
    const format = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };
    return `${format(nextMonday)} au ${format(nextSunday)}`;
  };

  const dateInfo = getFrenchDate();

  useEffect(() => {
    const init = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setCurrentUserData(userSnap.data());
        registerForPushNotificationsAsync(user.uid);
      }

      try {
        const prefix = `@user_${user.uid}_`;
        const [savedFil, savedAnn, savedGid, savedGn, savedIsAtt, savedSess, savedAbs] = await Promise.all([
          AsyncStorage.getItem(prefix + 'selected_filiere'),
          AsyncStorage.getItem(prefix + 'selected_annee'),
          AsyncStorage.getItem(prefix + 'last_group_id'),
          AsyncStorage.getItem(prefix + 'last_group_name'),
          AsyncStorage.getItem(prefix + 'is_taking_attendance'),
          AsyncStorage.getItem(prefix + 'selected_sessions'),
          AsyncStorage.getItem(prefix + 'local_absences')
        ]);

        setSelectedFiliere(savedFil || '');
        setSelectedAnnee(savedAnn || '');
        setSelectedGroupId(savedGid || '');
        setSelectedGroupName(savedGn || '');
        setIsTakingAttendance(savedIsAtt === 'true');
        setSelectedTeachingSessions(savedSess ? JSON.parse(savedSess) : []);
        setLocalAbsences(savedAbs ? JSON.parse(savedAbs) : {});
        
        setTimeout(() => { isInitializing.current = false; }, 500);
      } catch (e) { 
        console.error('Error restoring state:', e); 
        isInitializing.current = false;
      }
    };
    init();

    const unsubGroups = onSnapshot(collection(db, 'groups'), snap => {
      const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setGroups(sorted);
    });

    return () => {
      unsubGroups();
    };
  }, []);

  useEffect(() => {
    if (!currentUserData?.name) return;
    const fetchSchedule = async () => {
      try {
        const q = query(collection(db, 'emplois_du_temps'));
        const snap = await getDocs(q);
        const list: any[] = [];
        
        // Flexible fuzzy matching for formateur names (casing, trailing spaces, middle names)
        const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const cleanFormateur = cleanStr(currentUserData.name);
        
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.formateurName) {
            const cleanTarget = cleanStr(data.formateurName);
            if (cleanTarget.includes(cleanFormateur) || cleanFormateur.includes(cleanTarget)) {
              list.push({ id: d.id, ...data });
            }
          }
        });
        
        setMyWeeklySchedule(list);
        
        // Strictly set the active week to the actual system calendar current week
        const currentWeek = getCurrentWeekRange();
        setCurrentWeekRange(currentWeek);
        
        // Filter today's list strictly matching the actual current week range
        const todayDayName = dateInfo.dayName;
        const todayList = list.filter(item => {
          const itemSemaine = item.semaine ? item.semaine.replace(/\//g, '-') : '';
          return itemSemaine === currentWeek && item.jour.trim().toUpperCase() === todayDayName.trim().toUpperCase();
        });
        
        todayList.sort((a, b) => a.slot.localeCompare(b.slot));
        setMyTodaySchedule(groupScheduleItems(todayList));
      } catch (e) {
        console.error("Error fetching formateur schedule:", e);
      }
    };
    fetchSchedule();
  }, [currentUserData]);

  const triggerBellShake = () => {
    Animated.sequence([
      Animated.timing(bellShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bellShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(bellShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bellShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    let unsubNotifs: any;
    let isInitialLoad = true;
    const user = auth.currentUser;
    if (user) {
      const q = query(collection(db, 'notifications'), where('targetId', '==', user.uid));
      unsubNotifs = onSnapshot(q, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        
        const latest = list[0];
        if (latest && !latest.read && !isInitialLoad && !isInitializing.current && latest.id !== lastNotifId.current) {
          showBanner(latest);
          triggerBellShake();
        }
        
        if (latest) {
          lastNotifId.current = latest.id;
        }

        setNotifications(list);
        isInitialLoad = false;
      });
    }

    return () => {
      if (unsubNotifs) unsubNotifs();
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const now = new Date();
    const d = now.getDate();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();

    // Query locked sessions for today
    const qLocks = query(
      collection(db, 'locked_sessions'),
      where('day', '==', d),
      where('month', '==', m),
      where('year', '==', y)
    );

    const unsubLocksToday = onSnapshot(qLocks, snap => {
      const locks: Record<string, number[]> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.groupId) {
          if (!locks[data.groupId]) {
            locks[data.groupId] = [];
          }
          if (data.session && !locks[data.groupId].includes(data.session)) {
            locks[data.groupId].push(data.session);
          }
        }
      });
      setLockedTodaySessions(locks);
    }, err => {
      console.error("Error loading today's locked sessions:", err);
    });

    // Query group submissions for today
    const qSubs = query(
      collection(db, 'group_submissions'),
      where('day', '==', d),
      where('month', '==', m),
      where('year', '==', y)
    );

    const unsubSubsToday = onSnapshot(qSubs, snap => {
      const subs = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.groupId) {
          subs.add(data.groupId);
        }
      });
      setSubmittedTodayGroups(subs);
    }, err => {
      console.error("Error loading today's submissions:", err);
    });

    return () => {
      unsubLocksToday();
      unsubSubsToday();
    };
  }, []);

  useEffect(() => {
    if (isInitializing.current || !auth.currentUser) return;
    const prefix = `@user_${auth.currentUser.uid}_`;
    if (selectedFiliere) AsyncStorage.setItem(prefix + 'selected_filiere', selectedFiliere);
    else AsyncStorage.removeItem(prefix + 'selected_filiere');
  }, [selectedFiliere]);

  useEffect(() => {
    if (isInitializing.current || !auth.currentUser) return;
    const prefix = `@user_${auth.currentUser.uid}_`;
    if (selectedAnnee) AsyncStorage.setItem(prefix + 'selected_annee', selectedAnnee);
    else AsyncStorage.removeItem(prefix + 'selected_annee');
  }, [selectedAnnee]);

  useEffect(() => {
    if (isInitializing.current || !auth.currentUser) return;
    const prefix = `@user_${auth.currentUser.uid}_`;
    AsyncStorage.setItem(prefix + 'is_taking_attendance', isTakingAttendance.toString());
  }, [isTakingAttendance]);

  useEffect(() => {
    if (isInitializing.current || !auth.currentUser) return;
    const prefix = `@user_${auth.currentUser.uid}_`;
    AsyncStorage.setItem(prefix + 'selected_sessions', JSON.stringify(selectedTeachingSessions));
  }, [selectedTeachingSessions]);

  useEffect(() => {
    if (isInitializing.current || !auth.currentUser) return;
    const prefix = `@user_${auth.currentUser.uid}_`;
    AsyncStorage.setItem(prefix + 'local_absences', JSON.stringify(localAbsences));
  }, [localAbsences]);

  useEffect(() => {
    if (isInitializing.current || !auth.currentUser) return;
    const prefix = `@user_${auth.currentUser.uid}_`;
    if (selectedGroupId) {
      AsyncStorage.setItem(prefix + 'last_group_id', selectedGroupId);
      AsyncStorage.setItem(prefix + 'last_group_name', selectedGroupName);
    }
  }, [selectedGroupId, selectedGroupName]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setSelectedFiliere('');
      setSelectedAnnee('');
      setSelectedGroupId('');
      setSelectedGroupName('');
      setIsTakingAttendance(false);
      setSelectedTeachingSessions([]);
      setStudents([]);
      setLockedSessions({});
      setLocalAbsences({});
      setActiveScheduleItem(null);
      setIsManualMode(false);
      await AsyncStorage.multiRemove([
        '@last_group_id', '@last_group_name', 
        '@selected_filiere', '@selected_annee', 
        '@is_taking_attendance', '@selected_sessions', 
        '@local_absences'
      ]);
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) setCurrentUserData(userSnap.data());
      }
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, []);

  const showBanner = (notif: any) => {
    setActiveBanner(notif);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 50, useNativeDriver: true, bounciness: 12 }),
      Animated.delay(5000),
      Animated.timing(bannerAnim, { toValue: -200, duration: 500, useNativeDriver: true })
    ]).start(() => setActiveBanner(null));
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) { console.error(e); }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) { console.error(e); }
  };

  const deleteAllNotifications = () => {
    setShowDeleteAllModal(true);
  };

  const confirmDeleteAll = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      setShowDeleteAllModal(false);
    } catch (e) { console.error(e); }
  };


  useEffect(() => {
    if (!selectedGroupId) return;
    const now = new Date(), d = now.getDate(), m = now.getMonth()+1, y = now.getFullYear();
    setIsLoading(true);
    
    // Clear old state before fetching new group to prevent bleed-over
    setStudents([]);
    setLockedSessions({});
    setLocalAbsences({});
    
    const fetchStudents = async () => {
      try {
        const collections = ['students', 'stagiaires'];
        let allStudents: any[] = [];
        
        const expandedGroupNames: string[] = [];
        expandGroupName(selectedGroupName).forEach(name => {
          const upper = name.trim().toUpperCase();
          const lower = name.trim().toLowerCase();
          if (!expandedGroupNames.includes(name)) expandedGroupNames.push(name);
          if (!expandedGroupNames.includes(upper)) expandedGroupNames.push(upper);
          if (!expandedGroupNames.includes(lower)) expandedGroupNames.push(lower);
        });

        const expandedGroupIds = expandedGroupNames.map(name => {
          const g = groups.find(x => x.name.trim().toUpperCase() === name.toUpperCase());
          return g ? g.id : null;
        }).filter(Boolean) as string[];

        for (const coll of collections) {
          // 1. Fetch by selectedGroupId
          if (selectedGroupId && selectedGroupId !== 'NO_ID') {
            const qId = query(collection(db, coll), where('groupId', '==', selectedGroupId));
            const snapId = await getDocs(qId);
            snapId.docs.forEach(doc => {
              if (!allStudents.find(s => s.id === doc.id)) allStudents.push({ id: doc.id, ...doc.data() });
            });
          }

          // 2. Fetch by expandedGroupIds
          if (expandedGroupIds.length > 0) {
            const qIds = query(collection(db, coll), where('groupId', 'in', expandedGroupIds));
            const snapIds = await getDocs(qIds);
            snapIds.docs.forEach(doc => {
              if (!allStudents.find(s => s.id === doc.id)) allStudents.push({ id: doc.id, ...doc.data() });
            });
          }

          // 3. Fetch by expandedGroupNames
          if (expandedGroupNames.length > 0) {
            const qNames = query(collection(db, coll), where('group', 'in', expandedGroupNames));
            const snapNames = await getDocs(qNames);
            snapNames.docs.forEach(doc => {
              if (!allStudents.find(s => s.id === doc.id)) allStudents.push({ id: doc.id, ...doc.data() });
            });
          }
        }
        setStudents(allStudents.sort((a,b) => (a.lastName || a.nom || '').localeCompare(b.lastName || b.nom || '')));
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
    const unsubLocks = onSnapshot(query(collection(db, 'locked_sessions'), where('groupId', '==', selectedGroupId), where('day', '==', d), where('month', '==', m), where('year', '==', y)), snap => {
      const l: any = {}; snap.docs.forEach(doc => { l[doc.data().session] = true; }); setLockedSessions(l);
    });
    const unsubAbs = onSnapshot(query(collection(db, 'absences'), where('groupId', '==', selectedGroupId), where('day', '==', d), where('month', '==', m), where('year', '==', y)), snap => {
      const ma: any = {}; snap.docs.forEach(doc => { const data = doc.data(); const sId = data.studentId || data.stagiaireId; if(!ma[sId]) ma[sId] = []; ma[sId].push(data.session); }); setLocalAbsences(ma);
    });
    const unsubSub = onSnapshot(doc(db, 'group_submissions', `SUB_${selectedGroupId}_${d}_${m}_${y}`), snap => {
      if(snap.exists()) setSentGroups(new Set([selectedGroupId])); else setSentGroups(new Set());
    });
    return () => { unsubLocks(); unsubAbs(); unsubSub(); };
  }, [selectedGroupId]);

  const toggleAbsence = async (stId: string, sess: number) => {
    if (lockedSessions[sess] || sentGroups.has(selectedGroupId)) return;
    const now = new Date(), d = now.getDate(), m = now.getMonth()+1, y = now.getFullYear(), id = `${stId}_S${sess}_${d}_${m}_${y}`;
    if (localAbsences[stId]?.includes(sess)) await deleteDoc(doc(db, 'absences', id));
    else await setDoc(doc(db, 'absences', id), { studentId: stId, session: sess, groupId: selectedGroupId, day: d, month: m, year: y, submitted: false });
  };

  const handleSignature = async (sig: string) => {
    setSignatureModalVisible(false);
    const batch = writeBatch(db), now = new Date(), d = now.getDate(), m = now.getMonth()+1, y = now.getFullYear();
    selectedTeachingSessions.forEach(s => { 
      if (!lockedSessions[s]) {
        batch.set(doc(db, 'locked_sessions', `${selectedGroupId}_S${s}_${d}_${m}_${y}`), { 
          groupId: selectedGroupId, session: s, day: d, month: m, year: y, signature: sig, createdAt: serverTimestamp() 
        }); 
      } 
    });
    await batch.commit();
  };

  const handleManualUnlock = async () => {
    const batch = writeBatch(db), now = new Date(), d = now.getDate(), m = now.getMonth()+1, y = now.getFullYear();
    selectedTeachingSessions.forEach(s => {
      batch.delete(doc(db, 'locked_sessions', `${selectedGroupId}_S${s}_${d}_${m}_${y}`));
    });
    await batch.commit();
  };

  const handleFinalSubmit = async () => {
    setConfirmSendVisible(false);
    try {
      const batch = writeBatch(db), now = new Date(), d = now.getDate(), m = now.getMonth()+1, y = now.getFullYear();
      const snap = await getDocs(query(collection(db, 'absences'), where('groupId', '==', selectedGroupId), where('day', '==', d), where('month', '==', m), where('year', '==', y)));
      snap.docs.forEach(doc => batch.update(doc.ref, { submitted: true }));
      batch.set(doc(db, 'group_submissions', `SUB_${selectedGroupId}_${d}_${m}_${y}`), { 
        groupId: selectedGroupId, groupName: selectedGroupName, formateurId: auth.currentUser?.uid, formateurName: currentUserData?.name,
        sessions: selectedTeachingSessions, day: d, month: m, year: y, submittedAt: serverTimestamp() 
      });
      await batch.commit(); 
      showSuccess();
    } catch (error) { Alert.alert("Erreur", "Impossible d'envoyer la liste."); }
  };

  const showSuccess = () => {
    setSuccessModalVisible(true);
    Animated.parallel([Animated.timing(successAnim, { toValue: 1, duration: 400, useNativeDriver: true }), Animated.spring(successScale, { toValue: 1, friction: 8, useNativeDriver: true })]).start();
  };

  const hideSuccessModal = () => Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
    setSuccessModalVisible(false);
    setIsTakingAttendance(false);
    setActiveScheduleItem(null);
  });

  const handleRequestUnlock = async () => {
    setConfirmUnlockVisible(false);
    const now = new Date(), d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
    try {
      await addDoc(collection(db, 'unlock_requests'), {
        groupId: selectedGroupId, groupName: selectedGroupName, formateurId: auth.currentUser?.uid, formateurName: currentUserData?.name,
        sessions: selectedTeachingSessions, day: d, month: m, year: y, requestedAt: serverTimestamp(), status: 'pending'
      });
      
      // Send real push notification to managers
      await notifyManagers(
        'Demande de déverrouillage',
        `${currentUserData?.name} demande le déverrouillage du groupe ${selectedGroupName}`
      );
      
      setRequestSentVisible(true);
    } catch (error) { Alert.alert("Erreur", "Impossible d'envoyer la demande."); }
  };

  const allSelectedLocked = selectedTeachingSessions.length > 0 && selectedTeachingSessions.every(s => lockedSessions[s]);
  const filiereList = ['AA', 'CMOSE', 'CMOSW', 'DEV', 'GE'];
  const groupList = groups.filter(g => (g.name || '').startsWith(selectedFiliere) && (selectedAnnee === '' || (g.name || '').includes(selectedAnnee + '0')));

  const handleCardPress = (item: any) => {
    const expanded = expandGroupName(item.groupe);
    if (expanded.length > 1) {
      setExpandedSubGroups(expanded);
      setPendingScheduleItem(item);
      setSubGroupModalVisible(true);
    } else {
      startScheduledAttendance({ ...item, groupe: expanded[0] });
    }
  };

  const startScheduledAttendance = (item: any) => {
    const matchedGroup = groups.find(g => g.name.trim().toUpperCase() === item.groupe.trim().toUpperCase());
    
    // Set group info
    setSelectedGroupId(matchedGroup ? matchedGroup.id : item.groupe.trim());
    setSelectedGroupName(item.groupe);
    
    // Extract session numbers
    if (item.sessionNums && item.sessionNums.length > 0) {
      setSelectedTeachingSessions(item.sessionNums);
    } else {
      const match = item.slot.match(/SE(\d+)/i);
      const sessionNum = match ? parseInt(match[1], 10) : 1;
      setSelectedTeachingSessions([sessionNum]);
    }
    
    // Save scheduled item details
    setActiveScheduleItem(item);
    
    // Start attendance
    setIsTakingAttendance(true);
  };

  return (
    <View style={[styles.container, { paddingBottom: Platform.OS === 'android' ? insets.bottom + 16 : 0 }]}>
      <StatusBar barStyle="dark-content" />

      {/* Floating Banner */}
      {activeBanner && (
        <Animated.View style={[styles.bannerContainer, { transform: [{ translateY: bannerAnim }] }]}>
          <View style={styles.bannerIconBox}><Ionicons name="notifications" size={24} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>🔔 Message de l'Administration</Text>
            <Text style={styles.bannerMsg} numberOfLines={2}>{activeBanner.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setNotificationsModalVisible(true)}>
          <Animated.View style={{ transform: [{ translateX: bellShake }] }}>
            <Ionicons 
              name={notifications.some(n => !n.read) ? "notifications" : "notifications-outline"} 
              size={28} color={notifications.some(n => !n.read) ? "#EF4444" : "#1E3A8A"} 
            />
          </Animated.View>
          {notifications.filter(n => !n.read).length > 0 && (
            <View style={styles.notifDot}>
              <Text style={styles.notifBadgeText}>{notifications.filter(n => !n.read).length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Formateur</Text>

        <TouchableOpacity onPress={() => setDrawerVisible(true)} style={styles.headerBtn}>
          <Ionicons name="menu-outline" size={28} color="#1E3A8A" />
        </TouchableOpacity>
      </View>

      <View style={styles.dateCardWrapper}>
        <View style={styles.dateCard}>
          <Text style={styles.dayText}>{dateInfo.dayName}</Text>
          <Text style={styles.fullDateText}>{dateInfo.fullDate}</Text>
          <View style={styles.weekBadge}><Text style={styles.weekBadgeText}>Semaine: {dateInfo.weekRange}</Text></View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        stickyHeaderIndices={isTakingAttendance ? [2] : []}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} />}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.welcomeTitle}>Bonjour</Text>
          <Text style={styles.instructorName}>{currentUserData?.name || '---'}</Text>
        </View>

        {/* Section: Today's Scheduled Classes */}
        {!isTakingAttendance && !isManualMode && (
          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>MES COURS D'AUJOURD'HUI</Text>
            
            {myTodaySchedule.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons name="calendar-outline" size={45} color="#CBD5E1" />
                <Text style={{ color: '#94A3B8', fontWeight: '800', marginTop: 10, textAlign: 'center', fontSize: 14 }}>Aucun cours programmé pour aujourd'hui</Text>
                <Text style={{ color: '#CBD5E1', fontWeight: '600', marginTop: 2, textAlign: 'center', fontSize: 11 }}>Semaine du {currentWeekRange}</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {myTodaySchedule.map((item, idx) => {
                  const expanded = expandGroupName(item.groupe);
                  const expandedIds = expanded.map(name => {
                    const mg = groups.find(g => g.name.trim().toUpperCase() === name.trim().toUpperCase());
                    return mg ? mg.id : name.trim();
                  });
                  
                  const isSubmitted = expandedIds.length > 0 && expandedIds.every(id => submittedTodayGroups.has(id));
                  const isPartiallySubmitted = !isSubmitted && expandedIds.some(id => submittedTodayGroups.has(id));
                  
                  const sessionNums = item.sessionNums || [];
                  const isFullyLocked = sessionNums.length > 0 && expandedIds.every(id => {
                    const ls = lockedTodaySessions[id] || [];
                    return sessionNums.every((s: number) => ls.includes(s));
                  });
                  const isPartiallyLocked = !isFullyLocked && sessionNums.length > 0 && expandedIds.some(id => {
                    const ls = lockedTodaySessions[id] || [];
                    return sessionNums.some((s: number) => ls.includes(s));
                  });

                  let cardBg = '#F8FAFC';
                  let cardBorder = '#E2E8F0';
                  let groupTextColor = '#1E3A8A';
                  let statusBadge = null;

                  if (isSubmitted) {
                    cardBg = '#ECFDF5'; // Light green
                    cardBorder = '#10B981'; // Emerald
                    groupTextColor = '#065F46'; // Dark green
                    statusBadge = (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 }}>
                        <Ionicons name="checkmark-circle" size={13} color="#059669" />
                        <Text style={{ fontSize: 10, color: '#059669', fontWeight: '900' }}>ENVOYÉ</Text>
                      </View>
                    );
                  } else if (isPartiallySubmitted) {
                    cardBg = '#F0FDF4'; 
                    cardBorder = '#34D399'; 
                    groupTextColor = '#065F46'; 
                    statusBadge = (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 }}>
                        <Ionicons name="checkmark-circle-outline" size={13} color="#059669" />
                        <Text style={{ fontSize: 10, color: '#059669', fontWeight: '900' }}>ENVOYÉ (PARTIEL)</Text>
                      </View>
                    );
                  } else if (isFullyLocked) {
                    cardBg = '#FFFBEB'; // Light amber
                    cardBorder = '#F59E0B'; // Amber
                    groupTextColor = '#78350F'; // Dark amber
                    statusBadge = (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 }}>
                        <Ionicons name="lock-closed" size={13} color="#D97706" />
                        <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '900' }}>SIGNÉ</Text>
                      </View>
                    );
                  } else if (isPartiallyLocked) {
                    cardBg = '#FFFBEB'; // Light amber
                    cardBorder = '#F59E0B'; // Amber
                    groupTextColor = '#78350F'; // Dark amber
                    statusBadge = (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 }}>
                        <Ionicons name="lock-open" size={13} color="#D97706" />
                        <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '900' }}>SIGNÉ (PARTIEL)</Text>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity 
                      key={idx} 
                      style={{ 
                        backgroundColor: cardBg, 
                        padding: 18, 
                        borderRadius: 20, 
                        borderWidth: 1.5, 
                        borderColor: cardBorder,
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between'
                      }}
                      onPress={() => handleCardPress(item)}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: groupTextColor }}>{item.groupe}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="location-outline" size={13} color="#64748B" />
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>{item.salle}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="bookmark-outline" size={13} color="#64748B" />
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>{item.type}</Text>
                          </View>
                        </View>
                        {statusBadge}
                      </View>
                      <View style={{ backgroundColor: isSubmitted ? '#D1FAE5' : isFullyLocked || isPartiallyLocked ? '#FEF3C7' : '#EEF2FF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, borderWidth: 1, borderColor: isSubmitted ? '#10B981' : isFullyLocked || isPartiallyLocked ? '#F59E0B' : '#C7D2FE' }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: isSubmitted ? '#065F46' : isFullyLocked || isPartiallyLocked ? '#78350F' : '#1E3A8A' }}>{item.slot}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          </View>
        )}

        {isTakingAttendance && (
          <View style={styles.stickyWrapper}>
            <View style={styles.stickyTitleArea}>
               <Text style={styles.groupHeaderTitle}>{selectedGroupName}</Text>
               
               {activeScheduleItem ? (
                 <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                   <View style={styles.scheduleBadge}>
                     <Ionicons name="location-outline" size={13} color="#1E3A8A" />
                     <Text style={styles.scheduleBadgeText}>{activeScheduleItem.salle || 'N/A'}</Text>
                   </View>
                   <View style={styles.scheduleBadge}>
                     <Ionicons name="time-outline" size={13} color="#1E3A8A" />
                     <Text style={styles.scheduleBadgeText}>{activeScheduleItem.slot || 'N/A'}</Text>
                   </View>
                   <View style={[styles.scheduleBadge, { 
                     backgroundColor: 
                       activeScheduleItem.type === 'Teams' ? 'rgba(59, 130, 246, 0.1)' : 
                       activeScheduleItem.type === 'EFM' ? 'rgba(239, 68, 68, 0.1)' : 
                       'rgba(16, 185, 129, 0.1)',
                     borderColor: 
                       activeScheduleItem.type === 'Teams' ? 'rgba(59, 130, 246, 0.2)' : 
                       activeScheduleItem.type === 'EFM' ? 'rgba(239, 68, 68, 0.2)' : 
                       'rgba(16, 185, 129, 0.2)'
                   }]}>
                     <View style={{
                       width: 6, height: 6, borderRadius: 3, 
                       backgroundColor: 
                         activeScheduleItem.type === 'Teams' ? '#3B82F6' : 
                         activeScheduleItem.type === 'EFM' ? '#EF4444' : 
                         '#10B981',
                       marginRight: 4
                     }} />
                     <Text style={[styles.scheduleBadgeText, {
                       color: 
                         activeScheduleItem.type === 'Teams' ? '#3B82F6' : 
                         activeScheduleItem.type === 'EFM' ? '#EF4444' : 
                         '#10B981',
                     }]}>{activeScheduleItem.type || 'Présentielle'}</Text>
                   </View>
                 </View>
               ) : null}

               <Text style={styles.listLabel}>LISTE DES ABSENCES</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={styles.thIdx}>N°</Text><Text style={styles.thName}>NOM & PRÉNOM</Text>
              <View style={styles.thSessContainer}>{selectedTeachingSessions.map(s => <Text key={s} style={styles.thSess}>S{s}</Text>)}</View>
            </View>
          </View>
        )}

        {isTakingAttendance && (
          <View style={[styles.listCard, { marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingTop: 10 }]}>
            {isLoading ? <ActivityIndicator size="large" color="#1E3A8A" /> : (
              <View style={styles.studentsList}>
                {students.map((st, i) => (
                  <View key={st.id} style={styles.studentRow}>
                    <Text style={styles.rowIdx}>{i + 1}</Text>
                    <View style={styles.nameContainer}><Text style={styles.lastName}>{st.lastName?.toUpperCase()}</Text><Text style={styles.firstName}>{st.firstName}</Text></View>
                    <View style={styles.sessBtnContainer}>
                      {selectedTeachingSessions.map(s => {
                        const isA = localAbsences[st.id]?.includes(s), isL = lockedSessions[s];
                        return (
                          <TouchableOpacity key={s} style={styles.sessBtn} onPress={() => toggleAbsence(st.id, s)}>
                            <View style={[styles.sessIndicator, isA && styles.absCircle, isL && styles.lckBg]}>{isA ? <Text style={styles.absText}>A</Text> : isL ? <Ionicons name="lock-closed" size={12} color="#94A3B8" /> : null}</View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionContainer}>
              {!sentGroups.has(selectedGroupId) ? (
                <>
                  {!allSelectedLocked ? (
                    <TouchableOpacity style={styles.signBtn} onPress={() => setSignatureModalVisible(true)}>
                      <Ionicons name="create" size={24} color="#fff" />
                      <Text style={styles.signBtnText}>Signer & Verrouiller</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.lockedInfoBox} onPress={handleManualUnlock}>
                      <Ionicons name="lock-closed" size={22} color="#059669" />
                      <Text style={styles.lockedInfoText}>Toutes les séances sont verrouillées</Text>
                      <Ionicons name="refresh-circle-outline" size={24} color="#059669" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.finalBtn, !allSelectedLocked && { backgroundColor: '#D1D5DB', elevation: 0 }]} 
                    onPress={() => setConfirmSendVisible(true)} disabled={!allSelectedLocked}
                  >
                    <Ionicons name="send" size={22} color={allSelectedLocked ? "#fff" : "#9CA3AF"} style={{ marginRight: 10 }} />
                    <Text style={[styles.finalBtnText, !allSelectedLocked && { color: '#9CA3AF' }]}>Envoyer la liste finale</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.lockedInfoBox, { marginBottom: 8 }]}>
                    <Ionicons name="lock-closed" size={22} color="#059669" />
                    <Text style={styles.lockedInfoText}>Toutes les séances sont verrouillées</Text>
                  </View>
                  <View style={[styles.successInfoBox, { marginBottom: 8 }]}>
                    <Ionicons name="checkmark-circle" size={24} color="#059669" />
                    <Text style={styles.successInfoText}>Liste envoyée avec succès</Text>
                  </View>
                <TouchableOpacity style={[styles.requestUnlockBtn, { marginTop: -5 }]} onPress={() => setConfirmUnlockVisible(true)}>
                  <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
                  <Text style={styles.requestUnlockText}>Erreur après envoi ? Demander l'ouverture</Text>
                </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* MODALS */}
      <Modal transparent visible={subGroupModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="list" size={35} color="#1E3A8A" />
            </View>
            <Text style={styles.modalTitle}>Saisir les Absences</Text>
            <Text style={styles.modalMsg}>Cette séance inclut plusieurs groupes. Sélectionnez un groupe pour effectuer la saisie :</Text>
            
            <View style={{ width: '100%', marginTop: 15, gap: 10 }}>
              {expandedSubGroups.map(gp => {
                const mg = groups.find(g => g.name.trim().toUpperCase() === gp.trim().toUpperCase());
                const gpId = mg ? mg.id : gp.trim();
                const isSub = submittedTodayGroups.has(gpId);
                
                return (
                  <TouchableOpacity 
                    key={gp} 
                    style={{ 
                      backgroundColor: isSub ? '#D1FAE5' : '#F8FAFC', 
                      borderWidth: 1.5, 
                      borderColor: isSub ? '#10B981' : '#E2E8F0', 
                      padding: 15, 
                      borderRadius: 12, 
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8
                    }}
                    onPress={() => {
                      setSubGroupModalVisible(false);
                      startScheduledAttendance({ ...pendingScheduleItem, groupe: gp });
                    }}
                  >
                    {isSub && <Ionicons name="checkmark-circle" size={20} color="#059669" />}
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: isSub ? '#065F46' : '#1E3A8A' }}>Groupe {gp}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              onPress={() => setSubGroupModalVisible(false)} 
              style={[styles.modalCancel, { width: '100%', marginTop: 15 }]}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={confirmSendVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="send" size={35} color="#10B981" /></View>
            <Text style={styles.modalTitle}>Confirmer l'envoi</Text>
            <Text style={styles.modalMsg}>Êtes-vous sûr de vouloir envoyer la liste finale ? Cette action est irréversible.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setConfirmSendVisible(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleFinalSubmit} style={[styles.modalConfirm, { backgroundColor: '#10B981' }]}><Text style={styles.modalConfirmText}>Confirmer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={confirmUnlockVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#FEF2F2' }]}><Ionicons name="alert-circle-outline" size={40} color="#DC2626" /></View>
            <Text style={styles.modalTitle}>Demander l'ouverture</Text>
            <Text style={styles.modalMsg}>Voulez-vous envoyer une demande d'ouverture à l'administration ?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setConfirmUnlockVisible(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleRequestUnlock} style={[styles.modalConfirm, { backgroundColor: '#DC2626' }]}><Text style={styles.modalConfirmText}>Envoyer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={requestSentVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="checkmark-circle" size={45} color="#10B981" /></View>
            <Text style={styles.modalTitle}>Demande envoyée</Text>
            <Text style={styles.modalMsg}>Votre demande a été transmise avec succès.</Text>
            <TouchableOpacity onPress={() => setRequestSentVisible(false)} style={styles.successBtn}><Text style={styles.successBtnText}>OK</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={drawerVisible} animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setDrawerVisible(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setDrawerVisible(false); navigation.navigate('ProfileScreen'); }}><Ionicons name="person-outline" size={22} color="#1E3A8A" /><Text style={styles.menuText}>Mon Profil</Text></TouchableOpacity>
            <View style={styles.menuDivider} />
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setDrawerVisible(false); setScheduleModalVisible(true); }}><Ionicons name="calendar-outline" size={22} color="#1E3A8A" /><Text style={styles.menuText}>Mon Emploi</Text></TouchableOpacity>
            <View style={styles.menuDivider} />
            
            <TouchableOpacity style={styles.menuItem} onPress={async () => { setDrawerVisible(false); await auth.signOut(); navigation.replace('Login'); }}><Ionicons name="log-out-outline" size={22} color="#EF4444" /><Text style={[styles.menuText, { color: '#EF4444' }]}>Déconnexion</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Premium Weekly Schedule Modal */}
      <Modal visible={scheduleModalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={{ paddingHorizontal: 20, paddingTop: 50, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>Mon Emploi du Temps</Text>
                <Text style={{ fontSize: 13, color: '#E0EAFF', fontWeight: '600', marginTop: 4 }}>
                  Semaine du {selectedWeekTab === 'current' ? currentWeekRange : getNextWeekRange()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Segmented Control Tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 15, padding: 4, marginTop: 18 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: selectedWeekTab === 'current' ? '#fff' : 'transparent', alignItems: 'center' }}
                onPress={() => setSelectedWeekTab('current')}
              >
                <Text style={{ fontSize: 13, fontWeight: '900', color: selectedWeekTab === 'current' ? '#1E3A8A' : '#fff' }}>Cette Semaine</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: selectedWeekTab === 'next' ? '#fff' : 'transparent', alignItems: 'center' }}
                onPress={() => setSelectedWeekTab('next')}
              >
                <Text style={{ fontSize: 13, fontWeight: '900', color: selectedWeekTab === 'next' ? '#1E3A8A' : '#fff' }}>Semaine Prochaine</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map(day => {
              const activeWeek = selectedWeekTab === 'current' ? currentWeekRange : getNextWeekRange();
              const daySessions = myWeeklySchedule.filter(item => {
                const itemSemaine = item.semaine ? item.semaine.replace(/\//g, '-') : '';
                return itemSemaine === activeWeek && item.jour.trim().toUpperCase() === day.trim().toUpperCase();
              });
              // Sort by slot
              daySessions.sort((a, b) => a.slot.localeCompare(b.slot));
              const groupedDaySessions = groupScheduleItems(daySessions);

              return (
                <View key={day} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E3A8A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{day}</Text>
                  
                  {groupedDaySessions.length === 0 ? (
                    <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center' }}>
                      <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 13 }}>Aucune séance programmée</Text>
                    </View>
                  ) : (
                    groupedDaySessions.map((sess, sidx) => (
                      <View key={sidx} style={{ backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 5, borderLeftColor: sess.type === 'Teams' ? '#3B82F6' : sess.type === 'EFM' ? '#EF4444' : '#10B981' }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>{sess.groupe}</Text>
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="location-outline" size={13} color="#64748B" />
                              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>{sess.salle}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="bookmark-outline" size={13} color="#64748B" />
                              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>{sess.type}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: '#1E3A8A' }}>{sess.slot}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={signatureModalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <LinearGradient colors={['#fff', '#F8FAFC']} style={styles.sigHeaderAlt}>
            <View />
            <TouchableOpacity onPress={() => setSignatureModalVisible(false)} style={styles.sigCloseBtn}><Ionicons name="close" size={26} color="#64748B" /></TouchableOpacity>
          </LinearGradient>
          <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
            <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#64748B', marginBottom: 10, letterSpacing: 1 }}>SIGNATURE</Text>
            <View style={styles.sigFrameAlt}>
              {signatureModalVisible && (
                <SignatureScreen ref={signatureRef} onOK={handleSignature} webStyle={signatureStyle} descriptionText="" clearText="Effacer" confirmText="Confirmer" style={{ zIndex: 1 }} />
              )}
            </View>
            <View style={{ marginTop: 35, gap: 12 }}>
              <TouchableOpacity style={styles.sigConfirmAlt} onPress={() => signatureRef.current.readSignature()}>
                <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.sigGradientBtn}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Ionicons name="checkmark-done" size={20} color="#fff" />
                     <Text style={styles.sigConfirmTextAlt}>Valider la signature</Text>
                   </View>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sigClearAlt, { flexDirection: 'row', gap: 8 }]} onPress={() => signatureRef.current.clearSignature()}>
                <Ionicons name="refresh-outline" size={18} color="#EF4444" />
                <Text style={styles.sigClearTextAlt}>Effacer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={successModalVisible} animationType="none">
        <View style={styles.modalOverlay}><Animated.View style={[styles.successCard, { opacity: successAnim, transform: [{ scale: successScale }] }]}><Ionicons name="checkmark-circle" size={60} color="#10B981" /><Text style={styles.successTitle}>Succès</Text><TouchableOpacity onPress={hideSuccessModal} style={styles.successBtn}><Text style={styles.successBtnText}>OK</Text></TouchableOpacity></Animated.View></View>
      </Modal>

      <Modal visible={notificationsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#fff', height: '75%', width: '90%', borderRadius: 30, overflow: 'hidden', elevation: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#1E3A8A' }}>Notifications</Text>
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={deleteAllNotifications}>
                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '800', marginTop: 2 }}>Tout supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => setNotificationsModalVisible(false)}><Ionicons name="close" size={28} color="#64748B" /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 15 }}>
              {notifications.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}><Ionicons name="notifications-off-outline" size={60} color="#CBD5E1" /><Text style={{ color: '#94A3B8', marginTop: 10, fontWeight: '700' }}>Aucune notification</Text></View>
              ) : (
                notifications.map(n => {
                  const getIcon = () => {
                    if (n.type === 'unlock_accepted') return { name: 'lock-open-outline', color: '#10B981', bg: '#DCFCE7' };
                    if (n.type === 'unlock_rejected') return { name: 'lock-closed-outline', color: '#EF4444', bg: '#FEE2E2' };
                    return { name: 'alarm-outline', color: '#F59E0B', bg: '#FEF3C7' }; // reminder
                  };
                  const icon = getIcon();

                  return (
                    <View key={n.id} style={{ position: 'relative', marginBottom: 12 }}>
                      <TouchableOpacity 
                        style={[styles.notifItem, !n.read && styles.notifItemUnread, { marginBottom: 0 }]} 
                        onPress={() => markNotificationRead(n.id)}
                      >
                        <View style={[styles.notifIcon, { backgroundColor: icon.bg }]}>
                          <Ionicons name={icon.name as any} size={22} color={icon.color} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 35 }}>
                          <Text style={[styles.notifText, !n.read && styles.notifTextUnread]}>{n.message}</Text>
                          <Text style={styles.notifTime}>{getRelativeTime(n.timestamp)}</Text>
                        </View>
                        {!n.read && <View style={styles.unreadDot} />}
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.notifDeleteBtn}
                        onPress={() => deleteNotification(n.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Premium Delete All Confirmation Modal */}
      <Modal transparent visible={showDeleteAllModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-outline" size={40} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Tout supprimer</Text>
            <Text style={styles.modalMsg}>
              Voulez-vous vraiment supprimer toutes vos notifications ? Cette action est irréversible.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeleteAllModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: '#EF4444' }]} onPress={confirmDeleteAll}>
                <Text style={styles.modalConfirmText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  header: { paddingTop: 60, paddingBottom: 25, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1E3A8A', flex: 1, textAlign: 'center' },
  headerBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  dateCardWrapper: { marginHorizontal: 25, marginTop: -10, zIndex: 10 },
  dateCard: { backgroundColor: '#fff', padding: 22, borderRadius: 40, alignItems: 'center', elevation: 12, shadowColor: '#1E3A8A', shadowOpacity: 0.12, shadowRadius: 20 },
  dayText: { fontSize: 22, fontWeight: '900', color: '#1E3A8A' },
  fullDateText: { fontSize: 14, color: '#64748B', marginVertical: 2, fontWeight: '700' },
  weekBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 20, marginTop: 3 },
  weekBadgeText: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  sectionHeader: { padding: 25, alignItems: 'center' },
  welcomeTitle: { fontSize: 20, color: '#64748B', fontWeight: '700' },
  instructorName: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 5 },
  filterCard: { backgroundColor: '#fff', marginHorizontal: 20, padding: 25, borderRadius: 30, elevation: 5, marginBottom: 20 },
  filterLabel: { fontSize: 12, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 15 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  verticalGrid: { gap: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  filterBtnActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  filterBtnText: { color: '#1E3A8A', fontWeight: '800', fontSize: 14 },
  filterBtnTextActive: { color: '#fff' } ,
  startBtn: { backgroundColor: '#1E3A8A', paddingVertical: 18, borderRadius: 20, marginTop: 25, alignItems: 'center', elevation: 5 },
  startBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  listCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 30, padding: 20, paddingBottom: 20, elevation: 5, marginBottom: 30 },
  stickyWrapper: { marginHorizontal: 20, zIndex: 100, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', elevation: 5 },
  stickyTitleArea: { backgroundColor: '#fff', paddingTop: 20, paddingBottom: 5 },
  groupHeaderTitle: { fontSize: 26, fontWeight: '900', color: '#1E3A8A', textAlign: 'center' },
  listLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginTop: 5, marginBottom: 15 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 15, paddingHorizontal: 10, width: '100%', alignItems: 'center', zIndex: 100, borderRadius: 20 },
  thIdx: { width: 25, textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: 14 },
  thName: { flex: 1, color: '#fff', fontWeight: '900', fontSize: 14, paddingLeft: 5 },
  thSessContainer: { flexDirection: 'row', gap: 3 },
  thSess: { width: 35, textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: 14 },
  studentsList: { marginBottom: 3 },
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowIdx: { width: 25, textAlign: 'center', fontSize: 12, color: '#94A3B8', fontWeight: '900' },
  nameContainer: { flex: 1, paddingLeft: 5 },
  lastName: { fontSize: 16, fontWeight: '900', color: '#1E293B', letterSpacing: 0.3 },
  firstName: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  sessBtnContainer: { flexDirection: 'row', gap: 3 },
  sessBtn: { width: 35, alignItems: 'center' },
  sessIndicator: { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  absCircle: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  lckBg: { backgroundColor: '#F1F5F9', opacity: 0.5 },
  absText: { color: '#fff', fontWeight: '900' },
  actionContainer: { marginTop: 3, gap: 0, paddingBottom: 10 },
  lockedInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#A7F3D0', gap: 10 },
  lockedInfoText: { color: '#065F46', fontWeight: '700', fontSize: 14, flex: 1 },
  successInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#BBF7D0', gap: 10 },
  successInfoText: { color: '#166534', fontWeight: '700', fontSize: 14, flex: 1 },
  requestUnlockBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#FEE2E2', gap: 10, marginBottom: 10 },
  requestUnlockText: { color: '#B91C1C', fontWeight: '700', fontSize: 14, flex: 1 },
  signBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1E3A8A', paddingVertical: 18, borderRadius: 20, elevation: 5, marginBottom: 15 },
  signBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  bannerContainer: { position: 'absolute', top: 0, left: 20, right: 20, backgroundColor: '#1E3A8A', borderRadius: 25, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 15, zIndex: 1000, elevation: 15, shadowColor: '#1E3A8A', shadowOpacity: 0.4, shadowRadius: 10 },
  bannerIconBox: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 15 },
  bannerTitle: { color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 2 },
  bannerMsg: { color: '#E0EAFF', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  notifDot: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: 'white', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  notifItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, backgroundColor: '#F8FAFC', marginBottom: 10, gap: 12 },
  notifItemUnread: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  notifIcon: { backgroundColor: '#fff', padding: 8, borderRadius: 12, elevation: 1 },
  notifText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  notifTextUnread: { color: '#1E3A8A', fontWeight: '800' },
  notifTime: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E3A8A' },
  notifDeleteBtn: { position: 'absolute', right: 10, top: '50%', transform: [{ translateY: -15 }], padding: 10, zIndex: 10 },
  finalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10B981', paddingVertical: 18, borderRadius: 20, elevation: 5 },
  finalBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.05)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 100, paddingRight: 25 },
  menuCard: { backgroundColor: '#fff', width: 190, borderRadius: 20, elevation: 15, padding: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  menuText: { fontSize: 15, fontWeight: '900', color: '#1E3A8A' },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', padding: 30, borderRadius: 35, width: '85%', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  modalActions: { flexDirection: 'row', gap: 15, width: '100%', marginTop: 20 },
  modalCancel: { flex: 1, paddingVertical: 15, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center' },
  modalCancelText: { color: '#64748B', fontWeight: '800' },
  modalConfirm: { flex: 1, paddingVertical: 15, borderRadius: 15, backgroundColor: '#1E3A8A', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
  confirmIconBox: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalMsg: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 10 },
  successCard: { backgroundColor: '#fff', padding: 35, borderRadius: 35, alignItems: 'center', width: '85%' },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  successBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 20, marginTop: 20 },
  successBtnText: { color: '#fff', fontWeight: '900' },
  sigHeaderAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sigTitleAlt: { fontSize: 22, fontWeight: '900', color: '#1E3A8A' },
  sigSubTitle: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  sigCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  sigFrameAlt: { width: '100%', height: 350, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  sigConfirmAlt: { height: 60, borderRadius: 18, overflow: 'hidden' },
  sigGradientBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sigConfirmTextAlt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  sigClearAlt: { height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 18, backgroundColor: '#F1F5F9' },
  sigClearTextAlt: { color: '#EF4444', fontWeight: '700' },
  actionSection: { marginTop: 10, gap: 10 },
  scheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  scheduleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
    marginLeft: 4,
  },
});

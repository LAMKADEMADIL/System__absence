import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';

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

export default function StagiairesAbsents({ navigation, route }: any) {
  const { groupName, groupId } = route?.params || { groupName: '---', groupId: null };
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successModal, setSuccessModal] = useState(false);
  const [groupNameState, setGroupNameState] = useState(groupName || '');
  const [confirmModal, setConfirmModal] = useState<{ 
    visible: boolean; 
    title: string; 
    msg: string; 
    onConfirm: () => void;
    type: 'success' | 'danger' | 'info'
  }>({ 
    visible: false, 
    title: '', 
    msg: '', 
    onConfirm: () => {},
    type: 'info'
  });
  const [stagiairesNames, setStagiairesNames] = useState<Record<string, string>>({});

  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const formattedDate = today.toLocaleDateString('fr-FR', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  useEffect(() => {
    if (!groupId) return;

    setIsLoading(true);
    let unsubAbs: (() => void) | undefined;

    // 1. Fetch all students in this group once
    const fetchStudentsInGroup = async () => {
      // Fetch group details to get the name if not provided
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      const gName = groupDoc.exists() ? groupDoc.data().name : groupName;

      const collections = ['students', 'stagiaires'];
      const allStagiaires: Record<string, string> = {};
      
      for (const coll of collections) {
        try {
          const qStag = query(collection(db, coll), where('groupId', 'in', [groupId, gName]));
          const snap = await getDocs(qStag);
          snap.docs.forEach(d => {
            const data = d.data();
            allStagiaires[d.id] = `${data.firstName || data.nom || ''} ${data.lastName || data.prenom || ''}`.trim() || 'Stagiaire';
          });

          const qGroupField = query(collection(db, coll), where('group', 'in', [groupId, gName]));
          const snapGroupField = await getDocs(qGroupField);
          snapGroupField.docs.forEach(d => {
            const data = d.data();
            allStagiaires[d.id] = `${data.firstName || data.nom || ''} ${data.lastName || data.prenom || ''}`.trim() || 'Stagiaire';
          });
        } catch (e) {
          console.log(`Failed to fetch from collection ${coll}:`, e);
        }
      }
      return { stagNamesMap: allStagiaires, gName };
    };

    const init = async () => {
      const { stagNamesMap, gName } = await fetchStudentsInGroup();
      setStagiairesNames(stagNamesMap);
      setGroupNameState(gName);

      unsubAbs = onSnapshot(query(
        collection(db, 'absences'),
        where('day', '==', day),
        where('month', '==', month),
        where('year', '==', year)
      ), (snap) => {
        // Filter in memory for maximum flexibility (matches ID or Name)
        const relevantAbsences = snap.docs.filter(d => {
          const data = d.data();
          let isGroupMatch = data.groupId === groupId || data.groupId === gName || data.groupName === gName || data.groupName === groupId;
          
          if (!isGroupMatch && data.groupId) {
            const expanded = expandGroupName(data.groupId);
            const upperExpanded = expanded.map(name => name.trim().toUpperCase());
            if (upperExpanded.includes(gName.trim().toUpperCase())) {
              isGroupMatch = true;
            }
          }
          if (!isGroupMatch && data.groupName) {
            const expanded = expandGroupName(data.groupName);
            const upperExpanded = expanded.map(name => name.trim().toUpperCase());
            if (upperExpanded.includes(gName.trim().toUpperCase())) {
              isGroupMatch = true;
            }
          }

          if (!isGroupMatch) return false;

          // Check if student belongs to the currently viewed group
          const sId = data.stagiaireId || data.studentId;
          if (!stagNamesMap[sId]) return false;

          return data.status === 'pending' || !data.status;
        });

        const absData: Record<string, { sessions: number[], status: string }> = {};
        relevantAbsences.forEach(d => {
          const data = d.data();
          const sId = data.stagiaireId || data.studentId;
          if (!absData[sId]) absData[sId] = { sessions: [], status: data.status || 'pending' };
          
          if (data.session) absData[sId].sessions.push(data.session);
          else if (data.sessions) absData[sId].sessions = [...absData[sId].sessions, ...data.sessions];
        });

        const absentDetailsList = Object.entries(absData).map(([sId, details]) => ({
          id: sId,
          name: stagNamesMap[sId] || 'Inconnu',
          isAbsent: true,
          sessions: details.sessions.sort((a, b) => a - b),
          status: details.status
        }));

        // Removed alphabetical sort to maintain consistency with the Excel import order
        setStudents(absentDetailsList);
        setIsLoading(false);
      });
    };

    init();

    return () => {
      if (unsubAbs) unsubAbs();
    };
  }, [groupId]);

  const handleAction = (studentId: string, action: 'validated' | 'rejected') => {
    setConfirmModal({
      visible: true,
      title: "Confirmation",
      msg: `Voulez-vous ${action === 'validated' ? 'valider' : 'rejeter'} l'absence de ce stagiaire ?`,
      type: action === 'validated' ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          setIsLoading(true);
          const qAbs = query(
            collection(db, 'absences'),
            where('day', '==', day),
            where('month', '==', month),
            where('year', '==', year)
          );
          const snap = await getDocs(qAbs);
          const batch = writeBatch(db);
          snap.docs.forEach(d => {
            const data = d.data();
            let matchesGroup = data.groupId === groupId || data.groupName === groupNameState;
            if (!matchesGroup && data.groupId) {
              const expanded = expandGroupName(data.groupId);
              matchesGroup = expanded.map(n => n.trim().toUpperCase()).includes(groupNameState.trim().toUpperCase());
            }
            if (!matchesGroup && data.groupName) {
              const expanded = expandGroupName(data.groupName);
              matchesGroup = expanded.map(n => n.trim().toUpperCase()).includes(groupNameState.trim().toUpperCase());
            }
            const isStudent = (data.stagiaireId || data.studentId) === studentId;
            if (matchesGroup && isStudent) {
              batch.update(d.ref, { status: action, processedAt: serverTimestamp() });
            }
          });
          await batch.commit();
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleValidate = () => {
    setConfirmModal({
      visible: true,
      title: "Validation Totale",
      msg: "Voulez-vous valider toutes les absences pour ce groupe ?",
      type: 'success',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          setIsLoading(true);
          const qAbs = query(
            collection(db, 'absences'),
            where('day', '==', day),
            where('month', '==', month),
            where('year', '==', year)
          );
          const snap = await getDocs(qAbs);
          
          const submissionId = `SUB_${groupId}_${day}_${month}_${year}`;
          await updateDoc(doc(db, 'group_submissions', submissionId), { status: 'validated' }).catch(() => {});
          
          const pendingForGroup = snap.docs.filter(d => {
            const data = d.data();
            let matchesGroup = data.groupId === groupId || data.groupName === groupNameState;
            if (!matchesGroup && data.groupId) {
              const expanded = expandGroupName(data.groupId);
              matchesGroup = expanded.map(n => n.trim().toUpperCase()).includes(groupNameState.trim().toUpperCase());
            }
            if (!matchesGroup && data.groupName) {
              const expanded = expandGroupName(data.groupName);
              matchesGroup = expanded.map(n => n.trim().toUpperCase()).includes(groupNameState.trim().toUpperCase());
            }
            // Only include students that belong to this viewed group
            const sId = data.stagiaireId || data.studentId;
            if (!stagiairesNames[sId]) return false;
            return matchesGroup && (data.status === 'pending' || !data.status);
          });

          if (pendingForGroup.length === 0) { setSuccessModal(true); return; }
          const batch = writeBatch(db);
          pendingForGroup.forEach(d => {
            batch.update(d.ref, { status: 'validated', validatedAt: serverTimestamp() });
          });
          await batch.commit();
          setSuccessModal(true);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#fff', '#F8FAFC']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des Absences</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.infoSection}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{formattedDate.toUpperCase()}</Text>
        </View>
        <Text style={styles.groupTitle}>{groupName}</Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {isLoading && students.length === 0 ? (
          <ActivityIndicator color="#1E3A8A" style={{ marginTop: 40 }} />
        ) : (
          students.length > 0 ? (
            students.map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.avatar, !s.isAbsent && { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[styles.avatarText, !s.isAbsent && { color: '#10B981' }]}>{(s.name || 'S').charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.name}>{s.name}</Text>
                    {s.isAbsent ? (
                      <Text style={styles.subText}>Absent - Session {s.sessions.join(', ')}</Text>
                    ) : (
                      <Text style={[styles.subText, { color: '#10B981' }]}>Présent</Text>
                    )}
                  </View>
                </View>
                
                {s.isAbsent ? (
                  <View style={styles.cardActions}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.validateBtn]} 
                      onPress={() => handleAction(s.id, 'validated')}
                    >
                      <Ionicons name="checkmark" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.rejectBtn]} 
                      onPress={() => handleAction(s.id, 'rejected')}
                    >
                      <Ionicons name="close" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.presentBadge}>
                    <Ionicons name="checkmark-done" size={16} color="#10B981" />
                    <Text style={styles.presentBadgeText}>En règle</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle" size={80} color="#CBD5E1" />
              <Text style={styles.emptyText}>Tous les stagiaires sont en règle !</Text>
            </View>
          )
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.bulkBtn} onPress={handleValidate}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.bulkGrad}>
             <Ionicons name="checkmark-done-circle" size={24} color="white" style={{ marginRight: 10 }} />
             <Text style={styles.bulkText}>Tout Valider</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal transparent visible={confirmModal.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: confirmModal.type === 'danger' ? '#FEF2F2' : '#F0FFF4' }]}>
              <Ionicons 
                name={confirmModal.type === 'danger' ? "close-circle" : "checkmark-circle"} 
                size={56} 
                color={confirmModal.type === 'danger' ? "#EF4444" : "#10B981"} 
              />
            </View>
            <Text style={styles.modalTitle}>{confirmModal.title}</Text>
            <Text style={styles.modalMsg}>{confirmModal.msg}</Text>
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#E2E8F0' }]} 
                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
              >
                <Text style={[styles.modalBtnText, { color: '#64748B' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: confirmModal.type === 'danger' ? '#EF4444' : '#1E3A8A' }]} 
                onPress={confirmModal.onConfirm}
              >
                <Text style={styles.modalBtnText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={successModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#10B981" />
            </View>
            <Text style={styles.modalTitle}>Traitement terminé !</Text>
            <Text style={styles.modalMsg}>Les absences ont été traitées avec succès.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => { setSuccessModal(false); navigation.goBack(); }}>
              <Text style={styles.modalBtnText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1E3A8A' },
  infoSection: { padding: 20, alignItems: 'center' },
  dateBadge: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginBottom: 10 },
  dateText: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  groupTitle: { fontSize: 22, fontWeight: '900', color: '#1E3A8A' },
  list: { paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 15, borderRadius: 20, marginBottom: 12, elevation: 1 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1E3A8A' },
  subText: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  validateBtn: { backgroundColor: '#10B981' },
  rejectBtn: { backgroundColor: '#EF4444' },
  presentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  presentBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#10B981' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8', marginTop: 10, fontWeight: 'bold' },
  footer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10, alignItems: 'center' },
  bulkBtn: { alignSelf: 'center', borderRadius: 30, overflow: 'hidden', elevation: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  bulkGrad: { paddingVertical: 14, paddingHorizontal: 25, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  bulkText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 28, padding: 30, width: '100%', alignItems: 'center', elevation: 20 },
  modalIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0FFF4', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 10 },
  modalMsg: { textAlign: 'center', color: '#64748B', marginBottom: 30, lineHeight: 20 },
  modalBtn: { backgroundColor: '#1E3A8A', borderRadius: 16, paddingHorizontal: 40, paddingVertical: 14 },
  modalBtnText: { color: '#fff', fontWeight: 'bold' },
});

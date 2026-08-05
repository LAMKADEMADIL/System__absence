import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
  orderBy,
  Timestamp,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
export { db, auth };
import {
  createUserWithEmailAndPassword,
  deleteUser as deleteFirebaseUser,
} from 'firebase/auth';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Group {
  id: string;
  name: string;
  academicYear: string;
  year: number;
}

export interface Stagiaire {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  groupId: string;
  password?: string;
}

export interface Absence {
  id?: string;
  stagiaireId: string;
  groupId: string;
  day: number;
  month: number;
  year: number;
  session: number; // 1, 2, 3, 4
  justified: boolean;
  justification?: string;
}

export interface SessionLock {
  id?: string;
  groupId: string;
  day: number;
  month: number;
  year: number;
  session: number;
  status: 'locked';
}

export interface Instructor {
  id: string; // uid Firebase
  matricule: string;
  name: string;
  email: string;
  password?: string; // كلمة المرور المخزنة
  role: 'Formateur';
  groupId?: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUPS - المجموعات
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** جلب جميع المجموعات مع الطلاب والغيابات */
export const getGroupsWithStudentsAndAbsences = async (): Promise<any[]> => {
  // وضع التجربة (Demo Mode)
  if (process.env.FIREBASE_API_KEY?.includes('Dummy')) {
    return [
      {
        id: 'group-1',
        name: 'DEV101',
        academic_year: '2025/2026',
        year: 2,
        interns: [],
      },
    ];
  }

  const groupsSnap = await getDocs(collection(db, 'groups'));
  const stagiairesSnap = await getDocs(collection(db, 'stagiaires'));
  const absencesSnap = await getDocs(collection(db, 'absences'));

  const absences = absencesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const stagiaires = stagiairesSnap.docs.map((d) => ({ id: d.id, ...d.data() as any }));

  return groupsSnap.docs.map((gDoc) => {
    const group = { id: gDoc.id, ...gDoc.data() } as Group;
    const groupStagiaires = stagiaires
      .filter((s: any) => s.groupId === group.id)
      .map((s: any) => {
        const studentAbsences: any[] = [];
        absences
          .filter((a: any) => (a.stagiaireId === s.id || a.studentId === s.id))
          .forEach((a: any) => {
            const sessList = a.sessions || (a.session ? [a.session] : []);
            sessList.forEach((sNum: number) => {
              studentAbsences.push({
                day: a.day,
                month: a.month,
                year: a.year,
                session: sNum,
                justified: a.justified ? 1 : 0,
                justification: a.justification || '',
              });
            });
          });

        const unjustifiedCount = studentAbsences.filter((a: any) => a.justified === 0).length;
        const note20 = Math.max(0, 20 - (unjustifiedCount * 0.25));

        return {
          id: s.id,
          matricule: s.matricule || '',
          password: s.password || '',
          name: { first: s.firstName, last: s.lastName },
          groupId: s.groupId,
          academicYear: group.academicYear,
          absence: studentAbsences,
          unjustified_count: unjustifiedCount,
          note20: note20,
          lateness: [],
        };
      });

    return {
      id: group.id,
      name: group.name,
      academic_year: group.academicYear,
      year: group.year,
      interns: groupStagiaires,
    };
  });
};

/** استيراد المجموعات والطلاب من Excel */
export const importGroups = async (groupsData: any[]): Promise<void> => {
  const batch = writeBatch(db);

  for (const groupData of groupsData) {
    // البحث عن مجموعة بنفس الاسم أولاً
    const groupQuery = query(
      collection(db, 'groups'),
      where('name', '==', groupData.name)
    );
    const existing = await getDocs(groupQuery);

    let groupId: string;
    if (!existing.empty) {
      groupId = existing.docs[0].id;
      batch.update(doc(db, 'groups', groupId), {
        academicYear: groupData.academicYear || 'N/A',
        year: groupData.year || new Date().getFullYear(),
      });
    } else {
      const newGroupRef = doc(collection(db, 'groups'));
      groupId = newGroupRef.id;
      batch.set(newGroupRef, {
        name: groupData.name,
        academicYear: groupData.academicYear || 'N/A',
        year: groupData.year || new Date().getFullYear(),
      });
    }

    // إضافة الطلاب
    for (const internData of groupData.interns || []) {
      if (!internData?.name?.first || !internData?.name?.last) continue;
      const matricule = String(internData.id);

      // البحث عن الطالب بالماتريكول
      const stagQuery = query(
        collection(db, 'stagiaires'),
        where('matricule', '==', matricule)
      );
      const stagExisting = await getDocs(stagQuery);

      if (!stagExisting.empty) {
        batch.update(doc(db, 'stagiaires', stagExisting.docs[0].id), {
          firstName: internData.name.first,
          lastName: internData.name.last,
          groupId,
        });
      } else {
        const newStagRef = doc(collection(db, 'stagiaires'));
        batch.set(newStagRef, {
          matricule,
          firstName: internData.name.first,
          lastName: internData.name.last,
          groupId,
        });
      }
    }
  }

  await batch.commit();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ABSENCES - الغيابات
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** جلب طلاب المجموعة مع غياباتهم ليوم معين */
export const getGroupStudentsForDate = async (
  groupId: string,
  date: Date
): Promise<any[]> => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // جلب الطلاب
  const stagQuery = query(
    collection(db, 'stagiaires'),
    where('groupId', '==', groupId),
    orderBy('lastName')
  );
  const stagSnap = await getDocs(stagQuery);

  // جلب الغيابات ليوم محدد
  const absQuery = query(
    collection(db, 'absences'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year)
  );
  const absSnap = await getDocs(absQuery);
  const absences = absSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return stagSnap.docs.map((sDoc) => {
    const s = { id: sDoc.id, ...sDoc.data() } as any;
    return {
      ...s,
      absences: absences.filter((a: any) => a.stagiaireId === s.id),
    };
  });
};

/** حفظ الغيابات دفعةً واحدة (Bulk Save) */
export const bulkSaveAbsences = async (
  groupId: string,
  date: Date,
  absenceRecords: { stagiaireId: string; sessions: number[] }[]
): Promise<void> => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const batch = writeBatch(db);

  // حذف الغيابات الموجودة لهذا اليوم والمجموعة
  const existingQuery = query(
    collection(db, 'absences'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year)
  );
  const existing = await getDocs(existingQuery);
  existing.docs.forEach((d) => batch.delete(d.ref));

  // إضافة الغيابات الجديدة
  for (const record of absenceRecords) {
    for (const session of record.sessions) {
      const newRef = doc(collection(db, 'absences'));
      batch.set(newRef, {
        stagiaireId: record.stagiaireId,
        groupId,
        day,
        month,
        year,
        session,
        justified: false,
        justification: null,
      });
    }
  }

  await batch.commit();
};

/** قفل/فتح جلسة وحفظ غياباتها */
export const lockSession = async (
  groupId: string,
  date: Date,
  session: number,
  absentStagiaireIds: string[]
): Promise<'locked' | 'unlocked'> => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const batch = writeBatch(db);

  // حذف غيابات هذه الجلسة ثم إعادة حفظها
  const absQuery = query(
    collection(db, 'absences'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year),
    where('session', '==', session)
  );
  const absSnap = await getDocs(absQuery);
  absSnap.docs.forEach((d) => batch.delete(d.ref));

  for (const stagiaireId of absentStagiaireIds) {
    const newRef = doc(collection(db, 'absences'));
    batch.set(newRef, {
      stagiaireId,
      groupId,
      day,
      month,
      year,
      session,
      justified: false,
      justification: null,
    });
  }

  // Toggle القفل
  const lockQuery = query(
    collection(db, 'sessionLocks'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year),
    where('session', '==', session)
  );
  const lockSnap = await getDocs(lockQuery);

  let result: 'locked' | 'unlocked';
  if (!lockSnap.empty) {
    lockSnap.docs.forEach((d) => batch.delete(d.ref));
    result = 'unlocked';
  } else {
    const newLockRef = doc(collection(db, 'sessionLocks'));
    batch.set(newLockRef, { groupId, day, month, year, session, status: 'locked' });
    result = 'locked';
  }

  await batch.commit();
  return result;
};

/** جلب حالة القفل لمجموعة ويوم معين */
export const getGroupLocks = async (
  groupId: string,
  date: Date
): Promise<Record<number, boolean>> => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const locksQuery = query(
    collection(db, 'sessionLocks'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year)
  );
  const snap = await getDocs(locksQuery);
  const result: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
  snap.docs.forEach((d) => {
    const data = d.data();
    result[data.session] = true;
  });
  return result;
};

/** تبرير غيابات طالب */
export const justifyAbsences = async (
  stagiaireId: string,
  startDate: Date,
  endDate: Date,
  justification: string,
  sessionsToJustify: number
): Promise<number> => {
  // Fetch all absences for this student (using both possible field names)
  const q1 = query(collection(db, 'absences'), where('stagiaireId', '==', stagiaireId));
  const q2 = query(collection(db, 'absences'), where('studentId', '==', stagiaireId));
  
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  
  // Combine and filter in memory for robustness
  const eligibleDocs = [...snap1.docs, ...snap2.docs].filter((d) => {
    const data = d.data();
    // Only unjustified
    if (data.justified === true) return false;
    
    // Check date range
    if (data.year && data.month && data.day) {
      const absDate = new Date(data.year, data.month - 1, data.day);
      absDate.setHours(0, 0, 0, 0);
      
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      
      return absDate >= sDate && absDate <= eDate;
    }
    return false;
  });

  // Sort by date to justify oldest first
  eligibleDocs.sort((a, b) => {
    const da = a.data();
    const db = b.data();
    return new Date(da.year, da.month-1, da.day).getTime() - new Date(db.year, db.month-1, db.day).getTime();
  });

  const batch = writeBatch(db);
  let totalJustified = 0;

  for (const d of eligibleDocs) {
    if (totalJustified >= sessionsToJustify) break;

    const data = d.data();
    const currentSessions = data.sessions || (data.session ? [data.session] : []);
    const sessionsInDoc = currentSessions.length;
    const canJustifyFromThisDoc = Math.min(sessionsInDoc, sessionsToJustify - totalJustified);

    if (canJustifyFromThisDoc === sessionsInDoc) {
      // Justify the whole document
      batch.update(d.ref, { 
        justified: true, 
        justification,
        justifiedAt: serverTimestamp() 
      });
    } else {
      // PARTIAL JUSTIFICATION: Split the sessions
      const justifiedPart = currentSessions.slice(0, canJustifyFromThisDoc);
      const remainingPart = currentSessions.slice(canJustifyFromThisDoc);

      // 1. Update existing doc to have only remaining sessions
      batch.update(d.ref, { sessions: remainingPart });

      // 2. Create a new doc for the justified sessions
      const newRef = doc(collection(db, 'absences'));
      batch.set(newRef, {
        ...data,
        sessions: justifiedPart,
        justified: true,
        justification,
        justifiedAt: serverTimestamp()
      });
    }
    totalJustified += canJustifyFromThisDoc;
  }

  await batch.commit();
  return totalJustified;
};

/** ملخص الغيابات اليومي لكل المجموعات (للمسير) */
export const getDailySummary = async (): Promise<any[]> => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const groupsSnap = await getDocs(collection(db, 'groups'));
  const absQuery = query(
    collection(db, 'absences'),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year)
  );
  const absSnap = await getDocs(absQuery);
  const absences = absSnap.docs.map((d) => d.data());

  return groupsSnap.docs.map((gDoc) => {
    const group = { id: gDoc.id, ...gDoc.data() } as Group;
    const uniqueAbsents = new Set(
      absences.filter((a: any) => a.groupId === group.id).map((a: any) => a.stagiaireId)
    );
    return {
      id: group.id,
      name: group.name,
      total_absences: uniqueAbsents.size,
    };
  });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INSTRUCTORS - الأساتذة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// مفتاح التخزين المحلي لوضع التجربة
const MOCK_INSTRUCTORS_KEY = 'mock_instructors';

/** جلب جميع الأساتذة */
export const getInstructors = async (): Promise<Instructor[]> => {
  // وضع التجربة (Demo Mode)
  if (process.env.FIREBASE_API_KEY?.includes('Dummy')) {
    const stored = localStorage.getItem(MOCK_INSTRUCTORS_KEY);
    if (stored) return JSON.parse(stored);

    const initialMock: Instructor[] = [
      {
        id: 'mock-prof-1',
        matricule: 'PROF001',
        name: 'Ahmed El Amrani',
        email: 'ahmed@example.com',
        role: 'Formateur',
      },
    ];
    localStorage.setItem(MOCK_INSTRUCTORS_KEY, JSON.stringify(initialMock));
    return initialMock;
  }

  const q = query(collection(db, 'users'), where('role', '==', 'Formateur'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Instructor));
};

/** إضافة أستاذ جديد */
export const addInstructor = async (
  matricule: string,
  name: string,
  email: string,
  passwordInput: string,
  groupId?: string
): Promise<void> => {
  // Use provided password
  const password = passwordInput || matricule;

  // وضع التجربة (Demo Mode)
  if (process.env.FIREBASE_API_KEY?.includes('Dummy')) {
    console.log('Demo Mode: Adding instructor', { matricule, name, email });
    const stored = localStorage.getItem(MOCK_INSTRUCTORS_KEY);
    const list: Instructor[] = stored ? JSON.parse(stored) : [];

    list.push({
      id: `mock-${Date.now()}`,
      matricule,
      name,
      email,
      password, // حفظ كلمة المرور لوضع التجربة 
      role: 'Formateur',
      groupId: groupId || null,
    });

    localStorage.setItem(MOCK_INSTRUCTORS_KEY, JSON.stringify(list));
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  let uid = '';
  console.log(`Step 1: Attempting to create Auth account for ${email}...`);

  if ((window as any).electron && (window as any).electron.createUser) {
    const res = await (window as any).electron.createUser({ email, password, displayName: name });
    if (!res.success) {
      console.error("IPC Create User Failed:", res.error);
      if (res.error?.includes('Admin not initialized')) {
        throw new Error('CONFIG_ERROR: Firebase Admin failed to initialize. Check your serviceAccountKey.json file.');
      }
      throw new Error(`AUTH_ERROR: ${res.error}`);
    }
    uid = res.uid;
    if (res.alreadyExists) console.log("User already exists in Auth, proceeding to sync Firestore.");
  } else {
    // إنشاء حساب Firebase Auth بالطريقة القديمة (للمتصفح)
    console.warn("Electron API missing - falling back to Firebase Client SDK.");
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      uid = credential.user.uid;
      console.log("Account created via Client SDK.");
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-in-use') {
        console.log("Email already in use, but in Browser mode we cannot fetch existing UID safely. Skipping this user.");
        throw new Error('EMAIL_EXISTS: Email already in use. Try a different email.');
      }
      throw authError;
    }
  }

  // حفظ بياناته في Firestore
  console.log(`Step 2: Saving profile to Firestore for UID: ${uid}`);
  try {
    await setDoc(doc(db, 'users', uid), {
      matricule,
      name,
      email,
      password, // حفظ كلمة المرور للقائمة
      role: 'Formateur',
      groupId: groupId || null,
    });
    console.log("SUCCESS: Instructor saved to Database.");
  } catch (fsError: any) {
    console.error("Firestore Save Failed:", fsError);
    if (fsError.code === 'permission-denied') {
      throw new Error('PERMISSION_ERROR: You do not have permission to write to the database (You might have been logged out).');
    }
    throw new Error(`FIRESTORE_ERROR: ${fsError.message}`);
  }
};

/** حذف أستاذ */
export const deleteInstructor = async (instructorId: string): Promise<void> => {
  // وضع التجربة (Demo Mode)
  if (process.env.FIREBASE_API_KEY?.includes('Dummy')) {
    const stored = localStorage.getItem(MOCK_INSTRUCTORS_KEY);
    if (stored) {
      const list: Instructor[] = JSON.parse(stored);
      const filtered = list.filter((p) => p.id !== instructorId);
      localStorage.setItem(MOCK_INSTRUCTORS_KEY, JSON.stringify(filtered));
    }
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 1. Delete from Firebase Auth via Admin SDK (Electron only)
  if ((window as any).electron && (window as any).electron.deleteUser) {
    console.log(`[AUTH] Requesting sync deletion for UID: ${instructorId}`);
    const res = await (window as any).electron.deleteUser(instructorId);
    if (!res.success) {
      console.error("Auth sync deletion failed:", res.error);
      throw new Error(`AUTH_DELETE_ERROR: ${res.error}`);
    }
    console.log("Successfully deleted user from Firebase Auth.");
  } else {
    // If we are in Electron but admin failed to init, or if we are in Browser
    const isElectron = !!(window as any).electron;
    if (isElectron) {
      throw new Error("ADMIN_NOT_INITIALIZED: Firebase Admin is not initialized. Check serviceAccountKey.json.");
    } else {
      throw new Error("BROWSER_MODE_ERROR: You cannot delete users from the browser. Please use the Desktop App.");
    }
  }

  // 2. Delete from Firestore
  await deleteDoc(doc(db, 'users', instructorId));
};

/** تحديث بيانات أستاذ */
export const updateInstructor = async (
  instructorId: string,
  data: Partial<Omit<Instructor, 'id'>>
): Promise<void> => {
  // وضع التجربة (Demo Mode)
  if (process.env.FIREBASE_API_KEY?.includes('Dummy')) {
    const stored = localStorage.getItem(MOCK_INSTRUCTORS_KEY);
    if (stored) {
      const list: Instructor[] = JSON.parse(stored);
      const index = list.findIndex((p) => p.id === instructorId);
      if (index !== -1) {
        list[index] = { ...list[index], ...data };
        localStorage.setItem(MOCK_INSTRUCTORS_KEY, JSON.stringify(list));
      }
    }
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  await updateDoc(doc(db, 'users', instructorId), data);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STUDENTS - الطلاب
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** نقل طالب من مجموعة إلى أخرى */
export const transferStudent = async (
  stagiaireId: string,
  newGroupId: string
): Promise<void> => {
  await updateDoc(doc(db, 'stagiaires', stagiaireId), { groupId: newGroupId });
};

/** حذف طالب */
export const deleteStudent = async (stagiaireId: string): Promise<void> => {
  // حذف غيابات الطالب أولاً
  const absQuery = query(
    collection(db, 'absences'),
    where('stagiaireId', '==', stagiaireId)
  );
  const absSnap = await getDocs(absQuery);
  const batch = writeBatch(db);
  absSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'stagiaires', stagiaireId));
  await batch.commit();
};

/** حذف مجموعة مع طلابها وغياباتهم */
export const deleteGroup = async (groupId: string): Promise<void> => {
  const batch = writeBatch(db);
  
  // 1. Delete students
  const stagiairesQuery = query(collection(db, 'stagiaires'), where('groupId', '==', groupId));
  const stagiairesSnap = await getDocs(stagiairesQuery);
  stagiairesSnap.docs.forEach(d => batch.delete(d.ref));

  // 2. Delete absences
  const absencesQuery = query(collection(db, 'absences'), where('groupId', '==', groupId));
  const absencesSnap = await getDocs(absencesQuery);
  absencesSnap.docs.forEach(d => batch.delete(d.ref));

  // 3. Delete group
  batch.delete(doc(db, 'groups', groupId));

  await batch.commit();
};

/** مسح شامل لقاعدة البيانات (إعادة ضبط المصنع) */
export const resetDatabase = async (): Promise<void> => {
  const collectionsToDelete = [
    'absences',
    'stagiaires',
    'groups',
    'sessionLocks',
    'unlock_requests',
    'group_submissions',
    'reminders'
  ];

  for (const collectionName of collectionsToDelete) {
    const q = query(collection(db, collectionName));
    const snap = await getDocs(q);
    
    // Firestore batch limit is 500 operations
    let batch = writeBatch(db);
    let count = 0;

    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count++;
      
      if (count === 499) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
  }
};

/** تحديث بيانات مجموعة */
export const updateGroup = async (groupId: string, data: Partial<{ name: string, filiere: string, academicYear: string, annee: string }>): Promise<void> => {
  await updateDoc(doc(db, 'groups', groupId), data);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REAL-TIME LISTENERS - الاستماع الفوري
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** الاستماع لتغييرات الغيابات لمجموعة/يوم معين (Real-time) */
export const listenToGroupAbsences = (
  groupId: string,
  date: Date,
  callback: (absences: Absence[]) => void
): (() => void) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const q = query(
    collection(db, 'absences'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year)
  );

  return onSnapshot(q, (snap) => {
    const absences = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Absence[];
    callback(absences);
  });
};

/** الاستماع لتغييرات أقفال الجلسات (Real-time) */
export const listenToSessionLocks = (
  groupId: string,
  date: Date,
  callback: (locks: Record<number, boolean>) => void
): (() => void) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const q = query(
    collection(db, 'sessionLocks'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year)
  );

  return onSnapshot(q, (snap) => {
    const locks: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
    snap.docs.forEach((d) => {
      locks[d.data().session] = true;
    });
    callback(locks);
  });
};

/** ملخص الغيابات الأسبوعي للمدير */
export const getWeeklySummary = async (weekIdx: number): Promise<{ summary: any[], range: { start: string, end: string } }> => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + 1 - (today.getDay() || 7) - 7 * weekIdx);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // جلب جميع المجموعات
  const groupsSnap = await getDocs(collection(db, 'groups'));
  const groups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // جلب الغيابات لـ 7 أيام
  const absences: any[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    const q = query(
      collection(db, 'absences'),
      where('day', '==', day),
      where('month', '==', month),
      where('year', '==', year)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(doc => absences.push(doc.data()));
  }

  const summary = groups.map((g: any) => {
    const groupAbsences = absences.filter((a: any) => a.groupId === g.id);
    return {
      name: g.name,
      count: groupAbsences.length
    };
  });

  return {
    summary,
    range: {
      start: startOfWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      end: endOfWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  };
};

/** جلب التواقيع لمجموعة معينة خلال أسبوع */
export const getWeeklySignatures = async (groupId: string, startDate: Date, endDate: Date): Promise<any[]> => {
  const q = query(
    collection(db, 'locked_sessions'),
    where('groupId', '==', groupId)
  );
  
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((d: any) => {
      const lockDate = new Date(d.year, d.month - 1, d.day);
      return lockDate >= startDate && lockDate <= endDate;
    });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNLOCK REQUESTS - طلبات فتح القفل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** جلب جميع طلبات فتح القفل المعلقة */
export const getUnlockRequests = async (): Promise<any[]> => {
  const q = query(collection(db, 'unlock_requests'), where('status', '==', 'pending'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/** الموافقة على طلب فتح القفل */
export const approveUnlockRequest = async (requestId: string, groupId: string, session: number, day: number, month: number, year: number): Promise<void> => {
  const batch = writeBatch(db);

  // 1. تحديث حالة الطلب إلى مقبول (أو حذفه)
  batch.delete(doc(db, 'unlock_requests', requestId));

  // 2. حذف القفل من مجموعة 'sessionLocks' (التي يستخدمها الديسكتوب)
  const lockQuery = query(
    collection(db, 'sessionLocks'),
    where('groupId', '==', groupId),
    where('day', '==', day),
    where('month', '==', month),
    where('year', '==', year),
    where('session', '==', session)
  );
  const lockSnap = await getDocs(lockQuery);
  lockSnap.docs.forEach(d => batch.delete(d.ref));

  // 3. حذف القفل من مجموعة 'locked_sessions' (التي يستخدمها الهاتف)
  const lockId = `${groupId}_S${session}_${day}_${month}_${year}`;
  batch.delete(doc(db, 'locked_sessions', lockId));

  await batch.commit();
};

/** رفض طلب فتح القفل */
export const rejectUnlockRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'unlock_requests', requestId), { status: 'rejected' });
};

/** إضافة طالب جديد */
export const addStudent = async (matricule: string, first_name: string, last_name: string, group_id: string): Promise<void> => {
  await addDoc(collection(db, 'stagiaires'), {
    matricule,
    firstName: first_name,
    lastName: last_name,
    groupId: group_id
  });
};

/** تحديث بيانات طالب */
export const updateStudent = async (stagiaireId: string, data: Partial<{ firstName: string, lastName: string, matricule: string, groupId: string, password: string }>): Promise<void> => {
  await updateDoc(doc(db, 'stagiaires', stagiaireId), data);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEEKLY SCHEDULES - جداول الحصص الأسبوعية
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const saveWeeklySchedule = async (weekRange: string, sessions: any[]): Promise<void> => {
  const batch = writeBatch(db);

  // 1. حذف الجدول القديم لنفس الأسبوع لتجنب التكرار
  const q = query(
    collection(db, 'emplois_du_temps'),
    where('semaine', '==', weekRange)
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => batch.delete(d.ref));

  // 2. حفظ الحصص الجديدة
  for (const session of sessions) {
    const newRef = doc(collection(db, 'emplois_du_temps'));
    batch.set(newRef, {
      ...session,
      semaine: weekRange,
      createdAt: serverTimestamp()
    });
  }

  await batch.commit();
};

export const getWeeklySchedule = async (weekRange: string): Promise<any[]> => {
  const q = query(
    collection(db, 'emplois_du_temps'),
    where('semaine', '==', weekRange)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getSavedWeeksList = async (): Promise<string[]> => {
  const snap = await getDocs(collection(db, 'emplois_du_temps'));
  const weeks = new Set<string>();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.semaine) {
      weeks.add(data.semaine);
    }
  });
  
  return Array.from(weeks).sort((a, b) => {
    // Helper to format "DD-MM-YYYY au ..." into "YYYY-MM-DD" for correct string sorting
    const toSortableDate = (str: string) => {
      const match = str.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
      return match ? `${match[3]}-${match[2]}-${match[1]}` : str;
    };
    const dateA = toSortableDate(a);
    const dateB = toSortableDate(b);
    return dateB.localeCompare(dateA);
  });
};

export const deleteWeeklySchedule = async (weekRange: string): Promise<void> => {
  const batch = writeBatch(db);
  const q = query(
    collection(db, 'emplois_du_temps'),
    where('semaine', '==', weekRange)
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

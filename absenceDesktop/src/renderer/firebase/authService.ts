import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  updateProfile,
  User,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// تعريف أنواع المستخدمين
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type UserRole = 'Directeur' | 'Gestionnaire' | 'Formateur';

export interface AppUser {
  uid: string;
  matricule: string;
  name: string;
  email: string;
  role: UserRole;
  groupId?: string | null; // للأساتذة فقط
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// تسجيل الدخول
// يتحقق من الـ role المختار في الواجهة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const loginUser = async (
  emailOrMatricule: string,
  password: string,
  expectedRole: 'admin' | 'manager'
): Promise<AppUser> => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Authentification réelle via Firebase
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const loginPromise = (async () => {
    try {
      let finalEmail = emailOrMatricule;

      // إذا لم يكن المدخل بريداً إلكترونياً (لا يحتوي على @)، نبحث عنه كماتريكول
      if (!emailOrMatricule.includes('@')) {
        const q = query(
          collection(db, 'users'),
          where('matricule', '==', emailOrMatricule)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('Aucun utilisateur trouvé avec ce matricule.');
        }
        
        // نأخذ بريد أول مستخدم تم العثور عليه
        finalEmail = querySnapshot.docs[0].data().email;
      }

      const userCredential = await signInWithEmailAndPassword(auth, finalEmail, password);
      const { uid } = userCredential.user;

      // جلب بيانات المستخدم من Firestore
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('Utilisateur introuvable dans la base de données.');
      }

      const userData = userDoc.data() as Omit<AppUser, 'uid'>;

      // Auto-heal: Si l'email Firebase Auth a changé (après vérification), on met à jour Firestore
      if (userCredential.user.email && userCredential.user.email !== userData.email) {
        userData.email = userCredential.user.email;
        await updateDoc(doc(db, 'users', uid), { email: userCredential.user.email });
      }

      // التحقق من الدور المختار
      const expectedFirestoreRole: UserRole =
        expectedRole === 'admin' ? 'Directeur' : 'Gestionnaire';

      if (userData.role !== expectedFirestoreRole) {
        await signOut(auth);
        throw new Error(
          `Accès refusé. Vous n'avez pas le rôle "${expectedFirestoreRole}".`
        );
      }

      const appUser: AppUser = { uid, ...userData };

      // حفظ بيانات المستخدم في localStorage
      localStorage.setItem('user', JSON.stringify(appUser));

      return appUser;
    } catch (error: any) {
      throw error;
    }
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Délai d\'attente dépassé (Problème de connexion Firebase)')), 15000);
  });

  return Promise.race([loginPromise, timeoutPromise]);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// تسجيل الخروج
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
  localStorage.removeItem('user');
  localStorage.removeItem('access_token');
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// الاستماع لتغييرات حالة المصادقة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onAuthChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// الحصول على المستخدم الحالي من localStorage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getCurrentUser = (): AppUser | null => {
  const stored = localStorage.getItem('user');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AppUser;
  } catch {
    return null;
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// إعادة المصادقة (Re-authentication)
// ضرورية قبل تغيير البريد أو كلمة السر
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const reauthenticateUser = async (currentPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Utilisateur non connecté.');
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// تحديث بيانات الملف الشخصي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const updateUserProfile = async (
  uid: string,
  data: Partial<AppUser>
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);

  // تحديث البيانات في localStorage
  const current = getCurrentUser();
  if (current && current.uid === uid) {
    localStorage.setItem('user', JSON.stringify({ ...current, ...data }));
  }
};

export const updateUserEmail = async (newEmail: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Utilisateur non connecté.');

  // Firebase Auth requires email verification before changing the email.
  await verifyBeforeUpdateEmail(user, newEmail);

  // NOTE: Nous ne mettons pas à jour Firestore ici.
  // Firestore sera mis à jour automatiquement lors de la prochaine connexion
  // une fois que l'utilisateur aura cliqué sur le lien de vérification.
};

export const updateUserPassword = async (newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Utilisateur non connecté.');

  // تحديث كلمة المرور في Firebase Auth
  await updatePassword(user, newPassword);

  // تحديث كلمة المرور في Firestore (قاعدة البيانات) لتبقى متزامنة
  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, { 
    password: newPassword,
    'mot de passe': newPassword 
  });
};

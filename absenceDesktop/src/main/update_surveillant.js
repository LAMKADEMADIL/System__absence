const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function updateSurveillantData() {
  const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: serviceAccountKey.json not found in root.');
    return;
  }

  const serviceAccount = require(serviceAccountPath);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();
  
  const email = 'surveillant@ista.ma';
  const newPassword = 'surveillant2024';

  console.log(`Updating Surveillant data for: ${email}...`);

  try {
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;

    // تحديث كلمة السر في Auth
    await auth.updateUser(uid, {
      password: newPassword,
      displayName: 'Omar_Surveillant'
    });

    // تحديث البيانات في Firestore بنفس تنسيق صورة المدير
    await db.collection('users').doc(uid).set({
      email: email,
      matricule: 'S654321',
      'mot de passe': newPassword, // نفس التنسيق في صورتك
      name: 'Omar_Surveillant',
      role: 'Gestionnaire'
    });

    console.log('SUCCESS: Surveillant profile is now complete and "real".');
  } catch (error) {
    console.error('FAILED:', error.message);
  }
}

updateSurveillantData();

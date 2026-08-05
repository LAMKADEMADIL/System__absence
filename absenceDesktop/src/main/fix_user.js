const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function fixUser() {
  const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: serviceAccountKey.json not found in root.');
    return;
  }

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();
  const emailToFix = 'adillamkadem@gmail.com';

  console.log(`Searching for user: ${emailToFix}...`);

  const usersSnap = await db.collection('users').where('email', '==', emailToFix).get();

  if (usersSnap.empty) {
    console.log('User not found in Firestore.');
    return;
  }

  const userDoc = usersSnap.docs[0];
  const userData = userDoc.data();

  console.log('Current Data:', JSON.stringify(userData, null, 2));

  // Fix: Set role to Directeur (highest access)
  await db.collection('users').doc(userDoc.id).update({
    role: 'Directeur'
  });

  console.log('SUCCESS: Role updated to "Directeur". You can now log in using the "Directeur" space.');
  console.log(`Your password is: ${userData.password || 'Not found in Firestore'}`);
}

fixUser();

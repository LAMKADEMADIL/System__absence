const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function createSurveillant() {
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
  const password = 'password123';
  const name = 'Surveillant Général';

  console.log(`Creating/Syncing Surveillant account: ${email}...`);

  try {
    let uid;
    try {
      const userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
      console.log('User already exists in Auth.');
    } catch (e) {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name
      });
      uid = userRecord.uid;
      console.log('Created new Auth account.');
    }

    await db.collection('users').doc(uid).set({
      name,
      email,
      password,
      role: 'Gestionnaire',
      matricule: 'SURV001'
    });

    console.log('SUCCESS: Surveillant account is ready in Auth and Firestore.');
  } catch (error) {
    console.error('FAILED:', error.message);
  }
}

createSurveillant();

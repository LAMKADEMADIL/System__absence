const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function listUsers() {
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
  console.log("Listing all users from Firestore 'users' collection...");

  const usersSnap = await db.collection('users').get();

  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.name} | Email: ${data.email} | Matricule: ${data.matricule} | Role: ${data.role} | Pwd: ${data.password || data['mot de passe'] || '???'}`);
  });
}

listUsers();

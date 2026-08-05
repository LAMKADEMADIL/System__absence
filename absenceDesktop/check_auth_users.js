const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkAuthAndFirestore() {
  try {
    console.log('--- Firebase Auth Users ---');
    const authResult = await admin.auth().listUsers(100);
    const authUsers = {};
    authResult.users.forEach(user => {
      console.log(`UID: ${user.uid} | Email: ${user.email} | DisplayName: ${user.displayName}`);
      authUsers[user.email.toLowerCase()] = user.uid;
    });

    console.log('\n--- Firestore Users Documents ---');
    const snapshot = await admin.firestore().collection('users').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Doc ID: ${doc.id} | Email: ${data.email} | Matricule: ${data.matricule} | Role: ${data.role}`);
      
      const authUid = authUsers[data.email.toLowerCase()];
      if (authUid) {
        if (authUid === doc.id) {
          console.log('  -> MATCH: Auth UID matches Firestore Doc ID.');
        } else {
          console.log(`  -> WARNING: MISMATCH! Auth UID is ${authUid}, but Firestore Doc ID is ${doc.id}`);
        }
      } else {
        console.log('  -> WARNING: This Firestore user does not exist in Firebase Authentication.');
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuthAndFirestore();

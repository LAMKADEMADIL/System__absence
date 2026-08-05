const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listUsers() {
  try {
    console.log('Querying Firestore users collection via Admin SDK...');
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
      console.log('No users found in Firestore database.');
      return;
    }
    
    console.log(`Found ${snapshot.size} users:`);
    snapshot.forEach(doc => {
      console.log(`ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log('-------------------');
    });
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

listUsers();

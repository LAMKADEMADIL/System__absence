const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfrdngdBpRzlSC9cXxs3aCGe3gZMrYRts',
  authDomain: 'ista-absence.firebaseapp.com',
  projectId: 'ista-absence',
  storageBucket: 'ista-absence.firebasestorage.app',
  messagingSenderId: '289643777341',
  appId: '1:289643777341:web:580f2844dec84132094954',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testLogin() {
  const email = 'adillamkadem@gmail.com';
  const password = '000000';

  console.log(`Attempting to sign in client with ${email}...`);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    console.log(`Successfully authenticated! UID is: ${uid}`);

    console.log(`Attempting to fetch Firestore document users/${uid}...`);
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log('Document data:', docSnap.data());
    } else {
      console.log('No such document!');
    }
  } catch (error) {
    console.error('Error during client operations:');
    console.error(`Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
    console.error(error.stack);
  }
}

testLogin();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const rulesContent = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

async function deployRules() {
  try {
    console.log('Attempting to deploy open Firestore rules (v2)...');
    
    // Create the ruleset with correct signature
    const ruleset = await admin.securityRules().createRuleset({
      name: 'firestore.rules',
      content: rulesContent
    });
    
    // Release the ruleset
    await admin.securityRules().releaseFirestoreRuleset(ruleset.name);
    
    console.log('Firestore rules deployed successfully! Open access enabled.');
  } catch (error) {
    console.error('Error deploying rules:', error);
  }
}

deployRules();

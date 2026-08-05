const https = require('https');

function getUsers() {
  const url = 'https://firestore.googleapis.com/v1/projects/ista-absence/databases/(default)/documents/users?pageSize=100';

  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (!json.documents) {
          console.log('No documents found in users.');
          return;
        }
        
        console.log(`Found ${json.documents.length} users.`);
        json.documents.forEach((doc) => {
          const fields = doc.fields;
          const name = fields.name ? fields.name.stringValue : null;
          const email = fields.email ? fields.email.stringValue : null;
          const role = fields.role ? fields.role.stringValue : null;
          console.log(`- Name: ${name}, Email: ${email}, Role: ${role}`);
        });
      } catch (e) {
        console.error('Error parsing response:', e);
      }
    });
  }).on('error', (err) => {
    console.error('HTTPS request failed:', err);
  });
}

getUsers();

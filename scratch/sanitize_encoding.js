const fs = require('fs');

const filePath = 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop\\src\\renderer\\pages\\manager\\WeeklyScheduleImporter.tsx';

try {
  const buffer = fs.readFileSync(filePath);
  let content = buffer.toString('utf8');

  // Replace common corrupted character sequences
  content = content.replace(/\?/g, 'é');
  content = content.replace(//g, 'e'); // fallback for any single stray invalid characters
  
  // Let's write it back as clean UTF-8
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Sanitization complete. File written as clean UTF-8.');
} catch (err) {
  console.error('Error:', err);
}

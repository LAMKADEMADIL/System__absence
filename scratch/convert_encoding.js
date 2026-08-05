const fs = require('fs');

const filePath = 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop\\src\\renderer\\pages\\manager\\WeeklyScheduleImporter.tsx';

try {
  const buffer = fs.readFileSync(filePath);
  
  // Try decoding as windows-1252/ansi
  // In Windows-1252, accented characters are single bytes.
  // We can convert the buffer to a string using windows-1252 decoding logic.
  // An easy way to convert is using TextDecoder.
  const decoder = new TextDecoder('windows-1252');
  const text = decoder.decode(buffer);
  
  // Write the file back as UTF-8
  fs.writeFileSync(filePath, text, 'utf8');
  console.log('Conversion from Windows-1252 to UTF-8 complete.');
} catch (err) {
  console.error('Error during encoding conversion:', err);
}

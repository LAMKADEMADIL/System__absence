const fs = require('fs');

const filePath = 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop\\src\\renderer\\pages\\manager\\WeeklyScheduleImporter.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Total lines:', lines.length);
console.log('=== Last 40 lines ===');
console.log(lines.slice(-40).join('\n'));

// Count open and close braces
let openBraces = 0;
let closeBraces = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') openBraces++;
  if (content[i] === '}') closeBraces++;
}
console.log(`Braces: open={${openBraces}} close={${closeBraces}} diff=${openBraces - closeBraces}`);

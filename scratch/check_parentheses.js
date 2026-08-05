const fs = require('fs');

const filePath = 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop\\src\\renderer\\pages\\manager\\WeeklyScheduleImporter.tsx';
const content = fs.readFileSync(filePath, 'utf8');

let openParens = 0;
let closeParens = 0;
let openBrackets = 0;
let closeBrackets = 0;

for (let i = 0; i < content.length; i++) {
  if (content[i] === '(') openParens++;
  if (content[i] === ')') closeParens++;
  if (content[i] === '[') openBrackets++;
  if (content[i] === ']') closeBrackets++;
}

console.log(`Parentheses: open=${openParens} close=${closeParens} diff=${openParens - closeParens}`);
console.log(`Brackets: open=${openBrackets} close=${closeBrackets} diff=${openBrackets - closeBrackets}`);

const { execSync } = require('child_process');

try {
  console.log('Running tsc in absenceDesktop...');
  const output = execSync('npx tsc --noEmit src/renderer/pages/manager/WeeklyScheduleImporter.tsx --skipLibCheck --jsx react', { 
    cwd: 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop',
    encoding: 'utf8' 
  });
  console.log('TSC output:', output);
} catch (err) {
  console.log('TSC Failed. Output:');
  console.log(err.stdout);
  console.log(err.stderr);
}

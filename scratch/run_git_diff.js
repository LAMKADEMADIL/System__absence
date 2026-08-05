const { execSync } = require('child_process');
try {
  const diff = execSync('git diff src/renderer/pages/manager/WeeklyScheduleImporter.tsx', {
    cwd: 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop',
    encoding: 'utf8'
  });
  console.log('=== Git Diff ===');
  console.log(diff);
} catch (e) {
  console.error(e);
}

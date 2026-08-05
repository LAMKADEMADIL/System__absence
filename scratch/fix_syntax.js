const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\adill\\Desktop\\system_absence\\absenceDesktop\\src\\renderer\\pages\\manager\\WeeklyScheduleImporter.tsx';

try {
  let content = fs.readFileSync(filePath, 'utf8');
  console.log('File read successfully. Size:', content.length);
  
  const target = `      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };r.readAsArrayBuffer(file);
  };`;

  const replacement = `      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully fixed syntax error in WeeklyScheduleImporter.tsx');
  } else {
    console.log('Target content not found. Let us search for similar text.');
    // Search with regex or simpler strings
    const simpleTarget = `reader.readAsArrayBuffer(file);\r\n  };r.readAsArrayBuffer(file);\r\n  };`;
    const simpleReplacement = `reader.readAsArrayBuffer(file);\r\n  };`;
    if (content.includes(simpleTarget)) {
      content = content.replace(simpleTarget, simpleReplacement);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Successfully fixed syntax error using simple target');
    } else {
      // Try with Unix line endings
      const simpleTargetUnix = `reader.readAsArrayBuffer(file);\n  };r.readAsArrayBuffer(file);\n  };`;
      const simpleReplacementUnix = `reader.readAsArrayBuffer(file);\n  };`;
      if (content.includes(simpleTargetUnix)) {
        content = content.replace(simpleTargetUnix, simpleReplacementUnix);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully fixed syntax error using Unix line endings');
      } else {
        console.log('Failed to find target text.');
      }
    }
  }
} catch (err) {
  console.error('Error:', err);
}

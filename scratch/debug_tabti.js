const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function debugTabti() {
  const pdfPath = 'C:\\Users\\adill\\Desktop\\Emploi de temps  (1).pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF file does not exist at ${pdfPath}`);
    return;
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  console.log(`Loaded PDF with ${pdf.numPages} pages.`);

  // We need to calculate minX and maxX like in WeeklyScheduleImporter.tsx
  let minX = 9999;
  let maxX = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.map((item) => ({
      str: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height
    })).filter((item) => item.str.length > 0);

    if (items.length === 0) continue;

    // Group by Y
    const rowThreshold = 6;
    const linesMap = new Map();
    items.forEach((item) => {
      let foundY = null;
      for (const y of linesMap.keys()) {
        if (Math.abs(y - item.y) < rowThreshold) {
          foundY = y;
          break;
        }
      }
      if (foundY !== null) {
        linesMap.get(foundY).push(item);
      } else {
        linesMap.set(item.y, [item]);
      }
    });

    const sortedYKeys = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const lines = sortedYKeys.map(y => linesMap.get(y).sort((a, b) => a.x - b.x));

    lines.forEach(line => {
      const rowStr = line.map(it => it.str.toUpperCase()).join(' ');
      if (rowStr.includes('LUNDI') || rowStr.includes('SE1') || rowStr.includes('MATIN')) {
        line.forEach(item => {
          const str = item.str.toUpperCase();
          if (str.includes('SE1') || str.includes('SE2') || str.includes('SE3') || str.includes('SE4')) {
            if (item.x < minX) minX = item.x;
            if (item.x + item.width > maxX) maxX = item.x + item.width;
          }
        });
      }
    });
  }

  if (minX === 9999 || maxX === 0) {
    minX = 186;
    maxX = 743;
  }
  console.log(`Calculated grid boundaries: minX=${minX}, maxX=${maxX}`);

  const totalWidth = maxX - minX;
  const scale = totalWidth / 557;
  const columnCenters = [];
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  
  for (let d = 0; d < 6; d++) {
    const relativeDayStart = d * 94 * scale;
    const startX = minX + relativeDayStart;
    for (let s = 0; s < 4; s++) {
      const relativeSlotStart = s * 24 * scale;
      const slotCenter = startX + relativeSlotStart + (12 * scale);
      columnCenters.push(slotCenter);
    }
  }

  // Find TABTI block on each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.map((item) => ({
      str: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height
    })).filter((item) => item.str.length > 0);

    const rowThreshold = 6;
    const linesMap = new Map();
    items.forEach((item) => {
      let foundY = null;
      for (const y of linesMap.keys()) {
        if (Math.abs(y - item.y) < rowThreshold) {
          foundY = y;
          break;
        }
      }
      if (foundY !== null) {
        linesMap.get(foundY).push(item);
      } else {
        linesMap.set(item.y, [item]);
      }
    });

    const sortedYKeys = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const lines = sortedYKeys.map(y => linesMap.get(y).sort((a, b) => a.x - b.x));

    const isTeacherName = (str) => {
      if (!str) return false;
      const s = str.trim().toUpperCase();
      if (s.length < 3) return false;
      if (/\d/.test(s)) return false;
      const headerWords = [
        'COLONNE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI',
        'MATIN', 'A.MIDI', 'AMIDI', 'SE1', 'SE2', 'SE3', 'SE4', 'EMPLOI', 'TEMPS',
        'DU:', 'AU:', 'SESSION', 'GROUPE', 'SALLE', 'TYPE', 'FORMATEUR', 'SÉANCE',
        'GRILLE', 'CLASSE', 'HORAIRE', 'WEEK', 'RAPPORT', 'PAGE', 'TOTAL'
      ];
      if (headerWords.some(word => s.includes(word))) return false;
      return true;
    };

    let teacherBlocks = [];
    let currentBlock = null;

    lines.forEach((line) => {
      if (line.length === 0) return;
      const firstItem = line[0];
      const isAtLeft = firstItem.x < minX - 15;
      const isRealTeacher = isTeacherName(firstItem.str);

      if (isAtLeft && isRealTeacher) {
        currentBlock = {
          name: firstItem.str,
          items: line.slice(1)
        };
        teacherBlocks.push(currentBlock);
      } else if (currentBlock) {
        const gridItems = line.filter(it => it.x >= minX - 10);
        currentBlock.items.push(...gridItems);
      }
    });

    const tabtiBlock = teacherBlocks.find(b => b.name.toUpperCase().includes('TABTI'));
    if (tabtiBlock) {
      console.log(`\n=== Found TABTI block on Page ${pageNum} ===`);
      
      tabtiBlock.items.forEach((item) => {
        const itemCenter = item.x + Math.min(item.width || 0, 15) / 2;
        let closestColIdx = 0;
        let minDistance = 99999;

        for (let c = 0; c < 24; c++) {
          const colCenter = columnCenters[c];
          const dist = Math.abs(itemCenter - colCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestColIdx = c;
          }
        }

        const dayIdx = Math.floor(closestColIdx / 4);
        const slotIdx = closestColIdx % 4;
        console.log(`Item: "${item.str}" | x=${item.x.toFixed(1)} w=${item.width.toFixed(1)} | calculatedCenter=${itemCenter.toFixed(1)} | ClosestCol=${closestColIdx} (${days[dayIdx]} SE${slotIdx + 1}) dist=${minDistance.toFixed(1)}`);
      });
    }
  }
}

debugTabti().catch(console.error);

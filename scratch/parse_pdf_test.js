const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function testParse() {
  const pdfPath = 'C:\\Users\\adill\\Desktop\\Emploi de temps  (1).pdf';
  console.log('Loading PDF from:', pdfPath);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  
  const items = textContent.items.map((item) => ({
    str: item.str.trim(),
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
    height: item.height
  })).filter((item) => item.str.length > 0);
  
  // Find lines by grouping Y
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
  const lines = sortedYKeys.map(y => {
    return linesMap.get(y).sort((a, b) => a.x - b.x);
  });

  console.log('=== ALL LINES ===');
  lines.forEach((line, idx) => {
    const lineStr = line.map(it => `[${it.str} x=${Math.round(it.x)} w=${Math.round(it.width)}]`).join(' ');
    console.log(`Line ${idx} (y=${Math.round(line[0].y)}):`, lineStr);
  });
}

testParse().catch(console.error);

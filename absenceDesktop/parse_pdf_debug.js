const fs = require('fs');
const pdfjsLib = require('pdfjs-dist');

async function run() {
  const pdfPath = 'C:\\Users\\adill\\Desktop\\aaaa.pdf';
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.map(it => ({
      str: it.str.trim(),
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
      height: it.height
    })).filter(it => it.str.length > 0);
    
    const days = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
    const dayItems = items.filter(it => days.includes(it.str.toUpperCase()));
    if (dayItems.length > 0) {
      console.log(`=== Day Header Items on Page ${pageNum} ===`);
      dayItems.forEach(it => {
        console.log(`str: "${it.str}" x: ${it.x.toFixed(2)} w: ${it.width.toFixed(2)} center: ${(it.x + it.width/2).toFixed(2)}`);
      });
    }
  }
  console.log("TABTI not found on any page!");
}

run().catch(console.error);

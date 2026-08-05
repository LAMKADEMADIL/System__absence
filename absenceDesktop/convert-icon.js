const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'assets/icon.png');
const outputPath = path.join(__dirname, 'assets/icon.ico');

const convert = typeof pngToIco === 'function' ? pngToIco : pngToIco.default;

if (typeof convert !== 'function') {
  console.error('Error: png-to-ico is not a function. Content:', pngToIco);
  process.exit(1);
}

convert(inputPath)
  .then(buf => {
    fs.writeFileSync(outputPath, buf);
    console.log('ICO file created successfully at ' + outputPath);
  })
  .catch(err => {
    console.error('Error creating ICO file:', err);
  });

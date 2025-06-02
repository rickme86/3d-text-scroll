// convert-to-webp-avif.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function convertDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const ext = path.extname(file);
    const base = path.basename(file, ext);

    if (fs.lstatSync(filePath).isDirectory()) {
      convertDir(filePath);
    } else if (ext === '.png') {
      const buffer = fs.readFileSync(filePath);

      sharp(buffer)
        .toFile(path.join(dir, `${base}.webp`))
        .then(() => console.log(`Converted ${base}.webp`));

      sharp(buffer)
        .toFile(path.join(dir, `${base}.avif`))
        .then(() => console.log(`Converted ${base}.avif`));
    }
  });
}

convertDir('./media');

import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('./assets/icon.svg');

await sharp(svg).resize(1024, 1024).png().toFile('./assets/icon.png');
console.log('icon.png 생성 완료');

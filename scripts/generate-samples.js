import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const samplesDir = path.join(rootDir, 'samples');

if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

export async function generateSamples() {
  console.log('[Sample Generator] Preparing 3 field test vehicle images...');

  const sample1Path = path.join(samplesDir, 'sample1_clean_vehicle.jpg');
  const sample2Path = path.join(samplesDir, 'sample2_blurry_night.jpg');
  const sample3Path = path.join(samplesDir, 'sample3_screenshot_tampered.jpg');

  const rootImg1 = path.join(rootDir, 'Testimg.jpg');
  const rootImg2 = path.join(rootDir, 'testimg1.jpg');
  const rootImg3 = path.join(rootDir, 'TESTimg3.jpg');

  // Copy real test images if present, otherwise fallback to sharp generation
  if (fs.existsSync(rootImg1)) {
    fs.copyFileSync(rootImg1, sample1Path);
    console.log(' [✓] Sample 1 loaded from real image:', rootImg1);
  }
  if (fs.existsSync(rootImg2)) {
    fs.copyFileSync(rootImg2, sample2Path);
    console.log(' [✓] Sample 2 loaded from real image:', rootImg2);
  }
  if (fs.existsSync(rootImg3)) {
    fs.copyFileSync(rootImg3, sample3Path);
    console.log(' [✓] Sample 3 loaded from real image:', rootImg3);
  }

  return {
    sample1: sample1Path,
    sample2: sample2Path,
    sample3: sample3Path
  };
}

if (process.argv[1] && process.argv[1].endsWith('generate-samples.js')) {
  generateSamples();
}

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
  console.log('[Sample Generator] Loading 3 field test vehicle images...');

  const sample1Path = path.join(samplesDir, 'sample1_clean_vehicle.jpg');
  const sample2Path = path.join(samplesDir, 'sample2_blurry_night.jpg');
  const sample3Path = path.join(samplesDir, 'sample3_screenshot_tampered.jpg');

  return {
    sample1: sample1Path,
    sample2: sample2Path,
    sample3: sample3Path
  };
}

if (process.argv[1] && process.argv[1].endsWith('generate-samples.js')) {
  generateSamples();
}

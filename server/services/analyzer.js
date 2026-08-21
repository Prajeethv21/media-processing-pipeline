import sharp from 'sharp';
import exifr from 'exifr';
import crypto from 'crypto';
import Tesseract from 'tesseract.js';
import db from '../db/database.js';

/**
 * Computes 64-bit dHash (Difference Hash) for perceptual duplicate detection.
 * Resizes image to 9x8 grayscale, compares adjacent horizontal pixel values.
 */
async function computeDHash(imageBuffer) {
  try {
    const resized = await sharp(imageBuffer)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    let hashHex = '';
    let hashBits = '';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = resized[row * 9 + col];
        const right = resized[row * 9 + col + 1];
        const bit = left > right ? '1' : '0';
        hashBits += bit;
      }
    }

    // Convert 64 binary bits to 16 hex characters
    for (let i = 0; i < 64; i += 4) {
      const nibble = parseInt(hashBits.substr(i, 4), 2);
      hashHex += nibble.toString(16);
    }

    return hashHex;
  } catch (err) {
    console.error('[Analyzer] dHash computation failed:', err.message);
    return null;
  }
}

/**
 * Calculates Hamming distance between two 16-hex character dHashes.
 */
function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 999;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    const val = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    dist += val.toString(2).split('1').length - 1;
  }
  return dist;
}

/**
 * Calculates variance of Laplacian to detect blur.
 * Blurry images have low edge variance (smooth transitions).
 */
async function detectBlur(imageBuffer) {
  try {
    // Resize down for fast, normalized Laplacian variance calculation
    const { data, info } = await sharp(imageBuffer)
      .resize(600, null, { withoutEnlargement: true })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // Discrete 3x3 Laplacian filter kernel:
    // [  0,  1,  0 ]
    // [  1, -4,  1 ]
    // [  0,  1,  0 ]
    for (let y = 1; y < height - 1; y += 2) { // sample stride of 2 for speed
      for (let x = 1; x < width - 1; x += 2) {
        const idx = y * width + x;
        const center = data[idx];
        const top = data[idx - width];
        const bottom = data[idx + width];
        const left = data[idx - 1];
        const right = data[idx + 1];

        const laplacian = top + bottom + left + right - 4 * center;
        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    if (count === 0) return { score: 200, isBlurry: false };

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Thresholds: variance < 110 is blurry; < 50 is severe blur
    const isBlurry = variance < 110.0;
    const blurConfidence = Math.min(1.0, Math.max(0.0, (110.0 - variance) / 110.0));

    return {
      score: parseFloat(variance.toFixed(2)),
      isBlurry,
      confidence: parseFloat(blurConfidence.toFixed(2)),
      threshold: 110.0
    };
  } catch (err) {
    console.error('[Analyzer] Blur detection failed:', err.message);
    return { score: 150, isBlurry: false, confidence: 0, error: err.message };
  }
}

/**
 * Evaluates brightness and contrast histograms.
 */
async function detectLighting(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(400, null, { withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const numPixels = info.width * info.height;
    const channels = info.channels;

    let totalLuminance = 0;
    const luminances = new Float32Array(numPixels);

    for (let i = 0; i < numPixels; i++) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      // Standard ITU-R BT.601 luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      luminances[i] = lum;
      totalLuminance += lum;
    }

    const avgLuminance = totalLuminance / numPixels;

    let varianceSum = 0;
    for (let i = 0; i < numPixels; i++) {
      const diff = luminances[i] - avgLuminance;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / numPixels);

    const isLowLight = avgLuminance < 60.0;
    const isOverExposed = avgLuminance > 210.0;
    const isLowContrast = stdDev < 35.0;

    return {
      brightness: parseFloat(avgLuminance.toFixed(2)),
      contrastStdDev: parseFloat(stdDev.toFixed(2)),
      isLowLight,
      isOverExposed,
      isLowContrast,
      lightingRating: isLowLight ? 'Low Light / Night' : isOverExposed ? 'Overexposed / Glare' : 'Optimal'
    };
  } catch (err) {
    console.error('[Analyzer] Lighting analysis failed:', err.message);
    return { brightness: 128, contrastStdDev: 50, isLowLight: false, isOverExposed: false, isLowContrast: false };
  }
}

/**
 * Optical Character Recognition & Indian License Plate Validation.
 */
async function detectLicensePlate(imageBuffer) {
  try {
    // Pre-process buffer for better OCR readability (contrast boost)
    const processedBuffer = await sharp(imageBuffer)
      .resize(1000, null, { withoutEnlargement: true })
      .grayscale()
      .normalize()
      .toBuffer();

    // Run OCR with a 5000ms safety timeout to prevent hanging on serverless execution
    const runOcrWithTimeout = async () => {
      const worker = await Tesseract.createWorker('eng');
      const res = await worker.recognize(processedBuffer);
      await worker.terminate();
      return res;
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR recognition timed out')), 5000)
    );

    const { data: { text, confidence } } = await Promise.race([runOcrWithTimeout(), timeoutPromise]);

    const cleanText = text.replace(/[^A-Z0-9\s]/gi, ' ').toUpperCase();
    const words = cleanText.split(/\s+/).filter(w => w.length >= 3);

    // Standard Indian Number Plate Regex Patterns:
    // e.g. MH12AB1234, KA01EV9999, DL 3C AB 1234, 22BH1234AA
    const standardPlateRegex = /([A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,2}\s?[0-9]{4})/g;
    const bharatSeriesRegex = /([0-9]{2}\s?BH\s?[0-9]{4}\s?[A-Z]{1,2})/g;

    const matches = [];
    let match;

    while ((match = standardPlateRegex.exec(cleanText)) !== null) {
      matches.push(match[1].replace(/\s+/g, ''));
    }
    while ((match = bharatSeriesRegex.exec(cleanText)) !== null) {
      matches.push(match[1].replace(/\s+/g, ''));
    }

    const stateCodes = ['MH', 'KA', 'DL', 'TN', 'UP', 'HR', 'TS', 'AP', 'GJ', 'RJ', 'WB', 'KL', 'MP', 'PB', 'UK', 'CH', 'OR', 'BR', 'JH', 'CG', 'GA', 'HP', 'JK'];
    const validPlate = matches.length > 0 ? matches[0] : null;

    const containsIndTag = cleanText.includes('IND');
    const hasStateCode = stateCodes.some(code => cleanText.includes(code));

    let plateStatus = 'VALID_PLATE_FOUND';
    if (!validPlate) {
      plateStatus = hasStateCode || containsIndTag ? 'PARTIAL_PLATE_DETECTED' : 'INVALID_OR_MISSING_PLATE';
    }

    return {
      detectedText: cleanText.slice(0, 150),
      detectedPlateNumber: validPlate,
      allMatches: matches,
      ocrConfidence: parseFloat(confidence.toFixed(2)),
      hasIndTag: containsIndTag,
      isValidFormat: !!validPlate,
      plateStatus
    };
  } catch (err) {
    console.error('[Analyzer] OCR / License Plate detection failed:', err.message);
    return {
      detectedText: '',
      detectedPlateNumber: null,
      ocrConfidence: 0,
      isValidFormat: false,
      plateStatus: 'OCR_PROCESSING_FAILED',
      error: err.message
    };
  }
}

/**
 * Screenshot and Photo-of-Photo Heuristics.
 */
async function detectScreenshotAndScreenPhoto(imageBuffer, metadata, exif) {
  try {
    const { width, height } = metadata;
    const aspectRatio = parseFloat((width / height).toFixed(2));

    // Common phone screenshot aspect ratios
    const commonScreenshotRatios = [0.46, 0.45, 0.56, 1.78, 2.16, 2.22];
    const isScreenshotRatio = commonScreenshotRatios.some(r => Math.abs(aspectRatio - r) < 0.04);

    const hasCameraMake = !!(exif && (exif.Make || exif.Model));
    const softwareTag = exif?.Software || '';

    const isSoftwareScreenshot = softwareTag.toLowerCase().includes('screenshot') || 
      softwareTag.toLowerCase().includes('capture') ||
      softwareTag.toLowerCase().includes('android') ||
      softwareTag.toLowerCase().includes('ios');

    // High frequency Moiré grid noise estimation
    const { data } = await sharp(imageBuffer)
      .resize(200, 200, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let highFreqEnergy = 0;
    for (let i = 0; i < data.length - 2; i += 2) {
      const diff = Math.abs(data[i] - data[i + 1]);
      if (diff > 45) highFreqEnergy++;
    }
    const moireScore = parseFloat((highFreqEnergy / (data.length / 2)).toFixed(3));
    const isPhotoOfPhoto = moireScore > 0.15 && !hasCameraMake;

    const isScreenshot = (isScreenshotRatio && !hasCameraMake) || isSoftwareScreenshot;

    return {
      aspectRatio,
      hasCameraMake,
      cameraModel: exif?.Model || exif?.Make || 'Unknown / None',
      softwareTag: softwareTag || 'None',
      moireScore,
      isScreenshot,
      isPhotoOfPhoto,
      heuristicsScore: parseFloat(((isScreenshot ? 0.6 : 0) + (isPhotoOfPhoto ? 0.4 : 0)).toFixed(2))
    };
  } catch (err) {
    console.error('[Analyzer] Screenshot heuristic failed:', err.message);
    return { isScreenshot: false, isPhotoOfPhoto: false, moireScore: 0 };
  }
}

/**
 * Image Tampering & Metadata Audit.
 */
function auditImageIntegrity(exif) {
  if (!exif) {
    return {
      hasExif: false,
      isTampered: false,
      flaggedSoftware: null,
      integrityNote: 'No EXIF metadata found (stripped or generated)'
    };
  }

  const suspiciousTools = ['photoshop', 'gimp', 'canva', 'picsart', 'snapseed', 'lightroom', 'paint', 'pixelmator'];
  const software = (exif.Software || '').toLowerCase();

  const flaggedSoftware = suspiciousTools.find(tool => software.includes(tool));

  let isTampered = !!flaggedSoftware;
  let integrityNote = isTampered ? `Modified using software: ${flaggedSoftware.toUpperCase()}` : 'EXIF data verified clean';

  return {
    hasExif: true,
    isTampered,
    flaggedSoftware: flaggedSoftware || null,
    softwareTag: exif.Software || 'Standard Camera Firmware',
    createDate: exif.CreateDate || exif.DateTimeOriginal || null,
    modifyDate: exif.ModifyDate || null,
    integrityNote
  };
}

/**
 * Main Analysis Orchestrator Function.
 */
export async function analyzeImage(imageBuffer, mediaId, currentItem) {
  console.log(`[Analyzer] Processing media item: ${mediaId}`);
  const startTime = Date.now();

  // 1. Calculate SHA-256 file hash & Perceptual dHash
  const sha256Hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
  const dHash = await computeDHash(imageBuffer);

  // 2. Extract Metadata & EXIF
  const metadata = await sharp(imageBuffer).metadata();
  let exifData = null;
  try {
    exifData = await exifr.parse(imageBuffer, { tiff: true, exif: true, iptc: true });
  } catch (e) {
    // EXIF parse error ignored gracefully
  }

  // 3. Duplicate Detection against DB
  let duplicateInfo = { isDuplicate: false, matchedMediaId: null, distance: 999 };
  if (dHash) {
    const existingRes = await db.query(
      `SELECT id, perceptual_hash, sha256_hash FROM media_items WHERE id != $1 AND perceptual_hash IS NOT NULL`,
      [mediaId]
    );
    for (const item of existingRes.rows) {
      if (item.sha256_hash === sha256Hash) {
        duplicateInfo = { isDuplicate: true, matchedMediaId: item.id, type: 'EXACT_SHA256_MATCH', distance: 0 };
        break;
      }
      const dist = hammingDistance(dHash, item.perceptual_hash);
      if (dist <= 8) {
        duplicateInfo = { isDuplicate: true, matchedMediaId: item.id, type: 'PERCEPTUAL_DHASH_MATCH', distance: dist };
        break;
      }
    }
  }

  // 4. Run Concurrent Checks
  const [blurResult, lightingResult, ocrResult, screenResult] = await Promise.all([
    detectBlur(imageBuffer),
    detectLighting(imageBuffer),
    detectLicensePlate(imageBuffer),
    detectScreenshotAndScreenPhoto(imageBuffer, metadata, exifData)
  ]);

  // 5. Tampering Audit
  const integrityResult = auditImageIntegrity(exifData);

  // 6. Aggregate Issue Tags & Quality Score
  const issueTags = [];

  if (blurResult.isBlurry) issueTags.push('BLURRY_IMAGE');
  if (lightingResult.isLowLight) issueTags.push('LOW_LIGHT');
  if (lightingResult.isOverExposed) issueTags.push('OVER_EXPOSED');
  if (duplicateInfo.isDuplicate) issueTags.push('DUPLICATE_IMAGE');
  if (!ocrResult.isValidFormat) issueTags.push('INVALID_PLATE_FORMAT');
  if (screenResult.isScreenshot) issueTags.push('SCREENSHOT_DETECTED');
  if (screenResult.isPhotoOfPhoto) issueTags.push('PHOTO_OF_PHOTO');
  if (integrityResult.isTampered) issueTags.push('SUSPICIOUS_EDITING');

  // Compute Overall Quality Index (0 - 100)
  let qualityScore = 100;
  if (blurResult.isBlurry) qualityScore -= 25;
  if (lightingResult.isLowLight || lightingResult.isOverExposed) qualityScore -= 20;
  if (duplicateInfo.isDuplicate) qualityScore -= 30;
  if (!ocrResult.isValidFormat) qualityScore -= 15;
  if (screenResult.isScreenshot || screenResult.isPhotoOfPhoto) qualityScore -= 20;
  if (integrityResult.isTampered) qualityScore -= 25;
  qualityScore = Math.max(0, qualityScore);

  const durationMs = Date.now() - startTime;

  const structuredResults = {
    summary: {
      qualityScore,
      passedAllChecks: issueTags.length === 0,
      totalIssuesFound: issueTags.length,
      processingTimeMs: durationMs,
      processedAt: new Date().toISOString()
    },
    imageProperties: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      sha256: sha256Hash,
      dHash
    },
    checks: {
      blur: blurResult,
      lighting: lightingResult,
      licensePlate: ocrResult,
      duplicate: duplicateInfo,
      screenshotHeuristics: screenResult,
      integrity: integrityResult
    },
    issueTags
  };

  return {
    perceptualHash: dHash,
    sha256Hash,
    issueTags,
    structuredResults,
    durationMs
  };
}

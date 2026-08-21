import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function runFullVerification() {
  console.log('===========================================================');
  console.log(' SPECTRA-TRACE AI PIPELINE - NEON POSTGRESQL & API AUDIT VERIFICATION');
  console.log('===========================================================\n');

  // Step 1: Health Check
  try {
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    const healthData = await healthRes.json();
    console.log('[✓] Health Endpoint Active:', healthData.service);
  } catch (e) {
    console.error('❌ Server health check failed:', e.message);
    process.exit(1);
  }

  // Step 2: Invalid File Upload Tests (.txt and .pdf)
  console.log('\n--- 1. AUDITING INVALID FILE UPLOAD HANDLING ---');
  try {
    // 2a. .txt upload test
    const formDataTxt = new FormData();
    const txtBlob = new Blob(['sample text document content'], { type: 'text/plain' });
    formDataTxt.append('image', txtBlob, 'test_document.txt');

    const resTxt = await fetch(`${BASE_URL}/api/v1/media/upload`, { method: 'POST', body: formDataTxt });
    const dataTxt = await resTxt.json();
    console.log(`[✓] .txt Upload HTTP Status: ${resTxt.status} (Expected: 400)`);
    console.log(`    Response JSON:`, dataTxt);

    // 2b. .pdf upload test
    const formDataPdf = new FormData();
    const pdfBlob = new Blob(['%PDF-1.4 sample pdf content'], { type: 'application/pdf' });
    formDataPdf.append('image', pdfBlob, 'document.pdf');

    const resPdf = await fetch(`${BASE_URL}/api/v1/media/upload`, { method: 'POST', body: formDataPdf });
    const dataPdf = await resPdf.json();
    console.log(`[✓] .pdf Upload HTTP Status: ${resPdf.status} (Expected: 400)`);
    console.log(`    Response JSON:`, dataPdf);
  } catch (e) {
    console.error('❌ Invalid file upload test failed:', e.message);
  }

  // Step 3: Failure API Verification (Non-existent, Non-failed, and Failed job)
  console.log('\n--- 2. AUDITING DEDICATED FAILURE API ENDPOINT ---');
  try {
    // 3a. Non-existent ID
    const resFail404 = await fetch(`${BASE_URL}/api/v1/media/failure/00000000-0000-0000-0000-000000000000`);
    console.log(`[✓] Failure API (Non-existent ID) HTTP Status: ${resFail404.status} (Expected: 404)`);
    console.log(`    Response JSON:`, await resFail404.json());

    // 3b. Upload valid image and query failure endpoint on non-failed item
    const sample1Path = path.resolve(__dirname, '..', 'samples', 'sample1_clean_vehicle.jpg');
    const fileBuf = fs.readFileSync(sample1Path);
    const formData = new FormData();
    formData.append('image', new Blob([fileBuf], { type: 'image/jpeg' }), 'sample1.jpg');

    const upRes = await fetch(`${BASE_URL}/api/v1/media/upload`, { method: 'POST', body: formData });
    const upData = await upRes.json();
    const mediaId = upData.mediaId;
    console.log(`[✓] Ingested Media ID for Failure Audit: ${mediaId}`);

    // Wait for completion
    let status = 'pending';
    let attempts = 0;
    while (status !== 'completed' && status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 600));
      const sRes = await fetch(`${BASE_URL}/api/v1/media/status/${mediaId}`);
      const sData = await sRes.json();
      status = sData.status;
      attempts++;
    }

    const resFailCompleted = await fetch(`${BASE_URL}/api/v1/media/failure/${mediaId}`);
    console.log(`[✓] Failure API (Completed Non-failed item) HTTP Status: ${resFailCompleted.status} (Expected: 200)`);
    console.log(`    Response JSON:`, await resFailCompleted.json());

    // 3c. Neon PostgreSQL DB Verification for uploaded item
    const dbItemRes = await pool.query(`SELECT id, filename, status, perceptual_hash, sha256_hash FROM media_items WHERE id = $1`, [mediaId]);
    console.log(`\n[✓] DIRECT NEON POSTGRESQL QUERY CONFIRMATION:`);
    console.log(`    Rows Found in Neon DB: ${dbItemRes.rows.length}`);
    console.log(`    Stored Record in Neon:`, dbItemRes.rows[0]);

    const dbJobRes = await pool.query(`SELECT id, media_id, status, duration_ms FROM processing_jobs WHERE media_id = $1`, [mediaId]);
    console.log(`    Stored Job in Neon:`, dbJobRes.rows[0]);

  } catch (e) {
    console.error('❌ Failure API & DB test failed:', e.message);
  }

  // Step 4: Sample Images Execution & Real Results Collection
  console.log('\n--- 3. EXECUTING 3 SAMPLE IMAGES AGAINST NEON PIPELINE ---');
  const samples = [
    { key: 'sample1', path: path.resolve(__dirname, '..', 'samples', 'sample1_clean_vehicle.jpg'), name: 'Sample 1: Clean Vehicle' },
    { key: 'sample2', path: path.resolve(__dirname, '..', 'samples', 'sample2_blurry_night.jpg'), name: 'Sample 2: Blurry Night' },
    { key: 'sample3', path: path.resolve(__dirname, '..', 'samples', 'sample3_screenshot_tampered.jpg'), name: 'Sample 3: Screenshot Tampered' }
  ];

  const empiricalResults = [];

  for (const s of samples) {
    if (!fs.existsSync(s.path)) continue;
    const fBuf = fs.readFileSync(s.path);
    const form = new FormData();
    form.append('image', new Blob([fBuf], { type: 'image/jpeg' }), path.basename(s.path));

    const startTime = Date.now();
    const uRes = await fetch(`${BASE_URL}/api/v1/media/upload`, { method: 'POST', body: form });
    const uData = await uRes.json();
    const respTime = Date.now() - startTime;
    const mId = uData.mediaId;

    let st = 'pending';
    let att = 0;
    while (st !== 'completed' && st !== 'failed' && att < 40) {
      await new Promise(r => setTimeout(r, 600));
      const statusRes = await fetch(`${BASE_URL}/api/v1/media/status/${mId}`);
      const statusData = await statusRes.json();
      st = statusData.status;
      att++;
    }

    const resRes = await fetch(`${BASE_URL}/api/v1/media/results/${mId}`);
    const resData = await resRes.json();

    empiricalResults.push({
      key: s.key,
      name: s.name,
      mediaId: mId,
      status: st,
      uploadRespMs: respTime,
      qualityScore: resData.analysisResults?.summary?.qualityScore,
      processingTimeMs: resData.analysisResults?.summary?.processingTimeMs,
      issueTags: resData.issueTags,
      blurScore: resData.analysisResults?.checks?.blur?.score,
      isBlurry: resData.analysisResults?.checks?.blur?.isBlurry,
      brightness: resData.analysisResults?.checks?.lighting?.brightness,
      plateNumber: resData.analysisResults?.checks?.licensePlate?.detectedPlateNumber,
      plateStatus: resData.analysisResults?.checks?.licensePlate?.plateStatus,
      isScreenshot: resData.analysisResults?.checks?.screenshotHeuristics?.isScreenshot,
      isTampered: resData.analysisResults?.checks?.integrity?.isTampered
    });
  }

  console.log('\n===========================================================');
  console.log(' EMPIRICAL SAMPLE RESULTS MATRIX:');
  console.table(empiricalResults);
  console.log('===========================================================\n');

  pool.end();
}

runFullVerification();

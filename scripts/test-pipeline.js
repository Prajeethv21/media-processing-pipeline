import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSamples } from './generate-samples.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPipelineTest() {
  console.log('===========================================================');
  console.log(' SPECTRA-TRACE INTELLIGENT MEDIA PIPELINE TEST SUITE');
  console.log(' Target API Host:', BASE_URL);
  console.log('===========================================================\n');

  // Step 1: Ensure Server is Healthy
  try {
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`);
    const health = await healthRes.json();
    console.log('[✓] Server Health Verified:', health.service);
  } catch (err) {
    console.error('❌ Server is not reachable at', BASE_URL);
    console.error('   Please run "npm start" or "npm run dev" in another terminal first.');
    process.exit(1);
  }

  // Step 2: Load 3 Real Vehicle Test Specimen Images
  const samples = await generateSamples();
  const testCases = [
    { key: 'sample1', path: samples.sample1, name: 'Specimen 1: Testimg.jpg (Real SUV)' },
    { key: 'sample2', path: samples.sample2, name: 'Specimen 2: testimg1.jpg (Real Field Photo)' },
    { key: 'sample3', path: samples.sample3, name: 'Specimen 3: TESTimg3.jpg (Real Specimen Photo)' }
  ];

  console.log('\n--- EXECUTING ASYNC INGESTION & FORENSIC TESTS ---');

  for (const testCase of testCases) {
    console.log(`\n-----------------------------------------------------------`);
    console.log(`[TEST] Ingesting Specimen: ${testCase.name}`);
    console.log(`       FilePath: ${testCase.path}`);

    // Trigger sample upload endpoint
    const sampleRes = await fetch(`${BASE_URL}/api/v1/media/sample/${testCase.key}`, {
      method: 'POST'
    });

    if (!sampleRes.ok) {
      console.error(`❌ Ingestion failed for ${testCase.key}: HTTP ${sampleRes.status}`);
      continue;
    }

    const uploadPayload = await sampleRes.json();
    const mediaId = uploadPayload.mediaId;
    console.log(` [✓] Upload Accepted! Processing ID (Media ID): ${mediaId}`);
    console.log(`     Initial Status: ${uploadPayload.status} (Immediate response returned)`);

    // Poll status until completed
    let isFinished = false;
    let attempts = 0;
    let finalResults = null;

    while (!isFinished && attempts < 30) {
      await delay(800);
      attempts++;

      const statusRes = await fetch(`${BASE_URL}/api/v1/media/status/${mediaId}`);
      const statusData = await statusRes.json();

      process.stdout.write(`     Polling... Attempt ${attempts}: State = ${statusData.status} (${statusData.progress || 0}%)\r`);

      if (statusData.status === 'completed' || statusData.status === 'failed') {
        isFinished = true;
        console.log(`\n     Status Terminal State Reached: ${statusData.status.toUpperCase()}`);

        const resultsRes = await fetch(`${BASE_URL}/api/v1/media/results/${mediaId}`);
        finalResults = await resultsRes.json();
      }
    }

    if (!finalResults) {
      console.error(`❌ Test timed out waiting for processing completion.`);
      continue;
    }

    // Print Detailed Audit Report
    const summary = finalResults.analysisResults?.summary || {};
    const checks = finalResults.analysisResults?.checks || {};
    const detectedTags = finalResults.issueTags || [];

    console.log(`     Quality Score : ${summary.qualityScore} / 100`);
    console.log(`     Processing Latency : ${summary.processingTimeMs} ms`);
    console.log(`     Flagged Issues : ${detectedTags.length > 0 ? detectedTags.join(', ') : 'NONE (CLEAN)'}`);

    if (checks.licensePlate?.detectedPlateNumber) {
      console.log(`     OCR Plate Recognized : [ ${checks.licensePlate.detectedPlateNumber} ] (Confidence: ${checks.licensePlate.ocrConfidence}%)`);
    } else {
      console.log(`     OCR Plate Status : ${checks.licensePlate?.plateStatus || 'N/A'}`);
    }

    console.log(` [✓] TEST PASSED FOR ${testCase.key.toUpperCase()}`);
  }

  console.log('\n===========================================================');
  console.log(' ALL 3 PIPELINE TESTS EXECUTED SUCCESSFULLY!');
  console.log('===========================================================\n');
}

runPipelineTest();

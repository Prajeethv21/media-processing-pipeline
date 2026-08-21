import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { queueManager } from '../services/queue.js';
import { fileURLToPath } from 'url';
import { generateSamples } from '../../scripts/generate-samples.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}_${uuidv4().substring(0, 8)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and BMP images are supported.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * 1. Upload API: POST /api/v1/media/upload
 * Wraps Multer call to intercept fileFilter errors and return JSON 400 Bad Request instead of Express HTML 500 pages.
 */
router.post('/upload', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid file upload request.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided in request.' });
    }

    try {
      const mediaId = uuidv4();
      const filename = req.file.filename;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const size = req.file.size;
      const filepath = req.file.path;
      const url = `/uploads/${filename}`;

      await db.query(`
        INSERT INTO media_items (id, filename, original_name, mime_type, size, filepath, url, status, progress, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, NOW(), NOW())
      `, [mediaId, filename, originalName, mimeType, size, filepath, url]);

      const jobId = await queueManager.enqueue(mediaId);

      res.status(202).json({
        success: true,
        message: 'Image uploaded successfully and queued for processing.',
        mediaId,
        jobId,
        status: 'pending',
        progress: 0,
        url,
        originalName,
        statusUrl: `/api/v1/media/status/${mediaId}`,
        resultsUrl: `/api/v1/media/results/${mediaId}`
      });

    } catch (dbErr) {
      console.error('[API] Upload DB error:', dbErr.message);
      res.status(500).json({ error: 'Failed to process image upload: ' + dbErr.message });
    }
  });
});

/**
 * Quick Sample Ingestion Endpoint: POST /api/v1/media/sample/:type
 */
router.post('/sample/:type?', async (req, res) => {
  try {
    const sampleType = req.params.type || req.body?.type || 'sample1';
    const sampleFiles = await generateSamples();

    let sourceFile = sampleFiles.sample1;
    let originalName = 'sample1_clean_vehicle.jpg';

    if (sampleType === 'sample2') {
      sourceFile = sampleFiles.sample2;
      originalName = 'sample2_blurry_night.jpg';
    } else if (sampleType === 'sample3') {
      sourceFile = sampleFiles.sample3;
      originalName = 'sample3_screenshot_tampered.jpg';
    }

    if (!fs.existsSync(sourceFile)) {
      return res.status(500).json({ error: 'Failed to find generated sample file.' });
    }

    const mediaId = uuidv4();
    const filename = `${Date.now()}_${sampleType}_${uuidv4().substring(0, 6)}.jpg`;
    const targetPath = path.join(uploadDir, filename);

    fs.copyFileSync(sourceFile, targetPath);
    const stats = fs.statSync(targetPath);
    const url = `/uploads/${filename}`;

    await db.query(`
      INSERT INTO media_items (id, filename, original_name, mime_type, size, filepath, url, status, progress, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, NOW(), NOW())
    `, [mediaId, filename, originalName, 'image/jpeg', stats.size, targetPath, url]);

    const jobId = await queueManager.enqueue(mediaId);

    res.status(202).json({
      success: true,
      message: `Sample image (${sampleType}) enqueued successfully.`,
      mediaId,
      jobId,
      status: 'pending',
      url,
      originalName,
      statusUrl: `/api/v1/media/status/${mediaId}`,
      resultsUrl: `/api/v1/media/results/${mediaId}`
    });

  } catch (err) {
    console.error('[API] Sample load failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Fetch Processing Status API: GET /api/v1/media/status/:id
 */
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const resItem = await db.query(
      `SELECT id, status, progress, error, created_at, updated_at FROM media_items WHERE id = $1`,
      [id]
    );

    if (resItem.rows.length === 0) {
      return res.status(404).json({ error: 'Media item not found with provided ID.' });
    }

    const item = resItem.rows[0];

    const resJob = await db.query(
      `SELECT id as job_id, attempts, max_attempts, duration_ms, started_at, completed_at FROM processing_jobs WHERE media_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    res.json({
      mediaId: item.id,
      status: item.status,
      progress: item.progress,
      error: item.error,
      job: resJob.rows[0] || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. Fetch Structured Analysis Results API: GET /api/v1/media/results/:id
 */
router.get('/results/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const resItem = await db.query(`SELECT * FROM media_items WHERE id = $1`, [id]);

    if (resItem.rows.length === 0) {
      return res.status(404).json({ error: 'Media item not found with provided ID.' });
    }

    const item = resItem.rows[0];

    if (item.status === 'pending' || item.status === 'processing') {
      return res.status(202).json({
        message: 'Media processing is still in progress.',
        mediaId: item.id,
        status: item.status,
        progress: item.progress
      });
    }

    let results = item.analysis_results;
    let issueTags = item.issue_tags;

    if (typeof results === 'string') {
      try { results = JSON.parse(results); } catch (e) {}
    }
    if (typeof issueTags === 'string') {
      try { issueTags = JSON.parse(issueTags); } catch (e) {}
    }

    res.json({
      mediaId: item.id,
      status: item.status,
      filename: item.filename,
      originalName: item.original_name,
      mimeType: item.mime_type,
      size: Number(item.size),
      url: item.url,
      perceptualHash: item.perceptual_hash,
      sha256Hash: item.sha256_hash,
      issueTags: issueTags || [],
      error: item.error,
      analysisResults: results || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. Dedicated Fetch Processing Failure API: GET /api/v1/media/failure/:id & GET /api/v1/media/:id/failure
 */
const getFailureHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const resItem = await db.query(
      `SELECT id, status, progress, error, created_at, updated_at FROM media_items WHERE id = $1`,
      [id]
    );

    if (resItem.rows.length === 0) {
      return res.status(404).json({ error: 'Media item not found with provided ID.' });
    }

    const item = resItem.rows[0];

    if (item.status !== 'failed') {
      return res.status(200).json({
        mediaId: item.id,
        status: item.status,
        hasFailed: false,
        message: `Media item has status '${item.status}' and has not failed.`
      });
    }

    const resJob = await db.query(
      `SELECT id as job_id, attempts, max_attempts, error_log, duration_ms, started_at, completed_at FROM processing_jobs WHERE media_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    res.status(200).json({
      mediaId: item.id,
      status: item.status,
      hasFailed: true,
      failureReason: item.error || 'Unknown processing error',
      error: item.error,
      job: resJob.rows[0] || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get('/failure/:id', getFailureHandler);
router.get('/:id/failure', getFailureHandler);

/**
 * 5. List Media Items: GET /api/v1/media
 */
router.get('/', async (req, res) => {
  try {
    const { status, tag, limit = 50, offset = 0 } = req.query;

    let query = `SELECT * FROM media_items WHERE 1=1`;
    const params = [];
    let paramIdx = 1;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    if (tag) {
      query += ` AND (issue_tags::text LIKE $${paramIdx} OR issue_tags @> $${paramIdx + 1}::jsonb)`;
      params.push(`%"${tag}"%`, JSON.stringify([tag]));
      paramIdx += 2;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const resItems = await db.query(query, params);

    const formatted = resItems.rows.map(item => {
      let issueTags = item.issue_tags;
      let results = item.analysis_results;
      if (typeof issueTags === 'string') { try { issueTags = JSON.parse(issueTags); } catch (e) {} }
      if (typeof results === 'string') { try { results = JSON.parse(results); } catch (e) {} }

      return {
        id: item.id,
        filename: item.filename,
        originalName: item.original_name,
        url: item.url,
        status: item.status,
        progress: item.progress,
        issueTags: issueTags || [],
        results: results || null,
        createdAt: item.created_at
      };
    });

    res.json({
      count: formatted.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      items: formatted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. Reprocess API: POST /api/v1/media/reprocess/:id
 */
router.post('/reprocess/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const resItem = await db.query(`SELECT id, filepath FROM media_items WHERE id = $1`, [id]);
    if (resItem.rows.length === 0) {
      return res.status(404).json({ error: 'Media item not found.' });
    }

    const item = resItem.rows[0];

    if (!fs.existsSync(item.filepath)) {
      return res.status(400).json({ error: 'Original image file missing from disk.' });
    }

    const jobId = await queueManager.enqueue(id);

    res.json({
      success: true,
      message: 'Job re-enqueued for processing.',
      mediaId: id,
      jobId,
      status: 'pending'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. Delete Media API: DELETE /api/v1/media/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const resItem = await db.query(`SELECT id, filepath FROM media_items WHERE id = $1`, [id]);
    if (resItem.rows.length === 0) {
      return res.status(404).json({ error: 'Media item not found.' });
    }

    const item = resItem.rows[0];

    try {
      if (fs.existsSync(item.filepath)) {
        fs.unlinkSync(item.filepath);
      }
    } catch (e) {}

    await db.query(`DELETE FROM media_items WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Media item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. Clear All Media API: POST /api/v1/media/clear
 */
router.post('/clear', async (req, res) => {
  try {
    const resItems = await db.query(`SELECT filepath FROM media_items`);
    resItems.rows.forEach(item => {
      try {
        if (item.filepath && fs.existsSync(item.filepath)) {
          fs.unlinkSync(item.filepath);
        }
      } catch (e) {}
    });

    await db.query(`TRUNCATE media_items, processing_jobs CASCADE`);

    res.json({ success: true, message: 'All media items and jobs cleared successfully from Neon PostgreSQL.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

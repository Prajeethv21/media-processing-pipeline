import db from '../db/database.js';
import { analyzeImage } from './analyzer.js';
import fs from 'fs';

class PersistentQueueManager {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.listeners = new Set();
  }

  /**
   * Enqueue a new media processing job into Neon PostgreSQL and start loop.
   */
  async enqueue(mediaId) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
      await db.query(`
        INSERT INTO processing_jobs (id, media_id, status, attempts, max_attempts, created_at)
        VALUES ($1, $2, 'pending', 0, 3, NOW())
      `, [jobId, mediaId]);

      await db.query(`
        UPDATE media_items 
        SET status = 'pending', progress = 0, updated_at = NOW()
        WHERE id = $1
      `, [mediaId]);

      console.log(`[Queue] Job ${jobId} enqueued for Media ID: ${mediaId}`);
      this.broadcast({ event: 'JOB_ENQUEUED', jobId, mediaId, status: 'pending' });

      setImmediate(() => this.processNext());
      return jobId;
    } catch (err) {
      console.error('[Queue] Enqueue error:', err.message);
      throw err;
    }
  }

  /**
   * Main Queue Worker Loop.
   */
  async processNext() {
    if (this.activeWorkers >= this.concurrency) return;

    let job = null;
    try {
      const res = await db.query(`
        SELECT j.id as job_id, j.media_id, j.attempts, j.max_attempts, m.filepath, m.filename
        FROM processing_jobs j
        JOIN media_items m ON j.media_id = m.id
        WHERE j.status = 'pending' OR (j.status = 'failed' AND j.attempts < j.max_attempts)
        ORDER BY j.created_at ASC
        LIMIT 1
      `);
      
      if (res.rows.length === 0) {
        return;
      }
      job = res.rows[0];
    } catch (err) {
      console.error('[Queue] Error polling pending job:', err.message);
      return;
    }

    this.activeWorkers++;
    const { job_id, media_id, attempts, max_attempts, filepath } = job;
    const currentAttempt = attempts + 1;

    try {
      console.log(`[Queue] Worker starting job ${job_id} for Media ${media_id} (Attempt ${currentAttempt}/${max_attempts})`);

      await db.query(`
        UPDATE processing_jobs 
        SET status = 'processing', attempts = $1, started_at = NOW()
        WHERE id = $2
      `, [currentAttempt, job_id]);

      await db.query(`
        UPDATE media_items 
        SET status = 'processing', progress = 25, updated_at = NOW()
        WHERE id = $1
      `, [media_id]);

      this.broadcast({ event: 'JOB_PROCESSING', jobId: job_id, mediaId: media_id, status: 'processing', progress: 25 });

      let imageBuffer = null;
      if (filepath && fs.existsSync(filepath)) {
        imageBuffer = fs.readFileSync(filepath);
      } else {
        const mediaRes = await db.query('SELECT url FROM media_items WHERE id = $1', [media_id]);
        const mediaUrl = mediaRes.rows[0]?.url;
        if (mediaUrl && mediaUrl.startsWith('data:')) {
          imageBuffer = Buffer.from(mediaUrl.split(',')[1], 'base64');
        } else {
          throw new Error(`Media file not found at path: ${filepath}`);
        }
      }

      await db.query(`UPDATE media_items SET progress = 50 WHERE id = $1`, [media_id]);
      this.broadcast({ event: 'JOB_PROGRESS', jobId: job_id, mediaId: media_id, progress: 50 });

      // Run Image Analysis Engine
      const analysisOutput = await analyzeImage(imageBuffer, media_id, job);

      await db.query(`UPDATE media_items SET progress = 90 WHERE id = $1`, [media_id]);

      // Update media item to completed
      await db.query(`
        UPDATE media_items
        SET status = 'completed',
            progress = 100,
            perceptual_hash = $1,
            sha256_hash = $2,
            issue_tags = $3,
            analysis_results = $4,
            error = NULL,
            updated_at = NOW()
        WHERE id = $5
      `, [
        analysisOutput.perceptualHash,
        analysisOutput.sha256Hash,
        JSON.stringify(analysisOutput.issueTags),
        JSON.stringify(analysisOutput.structuredResults),
        media_id
      ]);

      // Mark processing job as completed
      await db.query(`
        UPDATE processing_jobs
        SET status = 'completed', duration_ms = $1, completed_at = NOW()
        WHERE id = $2
      `, [analysisOutput.durationMs, job_id]);

      console.log(`[Queue] Job ${job_id} successfully completed in ${analysisOutput.durationMs}ms`);
      this.broadcast({ event: 'JOB_COMPLETED', jobId: job_id, mediaId: media_id, status: 'completed', durationMs: analysisOutput.durationMs });

    } catch (err) {
      console.error(`[Queue] Job ${job_id} failed on attempt ${currentAttempt}:`, err.message);

      const isFinalFailure = currentAttempt >= max_attempts;
      const finalStatus = isFinalFailure ? 'failed' : 'pending';

      try {
        await db.query(`
          UPDATE processing_jobs
          SET status = $1, error_log = $2
          WHERE id = $3
        `, [finalStatus, err.message, job_id]);

        await db.query(`
          UPDATE media_items
          SET status = $1, error = $2, updated_at = NOW()
          WHERE id = $3
        `, [finalStatus, err.message, media_id]);
      } catch (e) {
        console.error('[Queue] Failed to record job error state:', e.message);
      }

      this.broadcast({ event: 'JOB_FAILED', jobId: job_id, mediaId: media_id, status: finalStatus, error: err.message, isFinalFailure });

      if (!isFinalFailure) {
        const backoffMs = Math.pow(2, currentAttempt) * 1000;
        console.log(`[Queue] Retrying job ${job_id} in ${backoffMs}ms...`);
        setTimeout(() => this.processNext(), backoffMs);
      }
    } finally {
      this.activeWorkers--;
      setImmediate(() => this.processNext());
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  broadcast(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (e) {}
    }
  }
}

export const queueManager = new PersistentQueueManager(2);

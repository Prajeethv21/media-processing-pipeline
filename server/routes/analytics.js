import express from 'express';
import db from '../db/database.js';

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    const totalRes = await db.query(`SELECT COUNT(*)::int as count FROM media_items`);
    const pendingRes = await db.query(`SELECT COUNT(*)::int as count FROM media_items WHERE status = 'pending'`);
    const processingRes = await db.query(`SELECT COUNT(*)::int as count FROM media_items WHERE status = 'processing'`);
    const completedRes = await db.query(`SELECT COUNT(*)::int as count FROM media_items WHERE status = 'completed'`);
    const failedRes = await db.query(`SELECT COUNT(*)::int as count FROM media_items WHERE status = 'failed'`);

    const avgRes = await db.query(`SELECT AVG(duration_ms)::float as avg_ms FROM processing_jobs WHERE status = 'completed'`);

    const totalMedia = totalRes.rows[0]?.count || 0;
    const pendingCount = pendingRes.rows[0]?.count || 0;
    const processingCount = processingRes.rows[0]?.count || 0;
    const completedCount = completedRes.rows[0]?.count || 0;
    const failedCount = failedRes.rows[0]?.count || 0;
    const avgDuration = avgRes.rows[0]?.avg_ms || 0;

    // Issue tag counts
    const completedItemsRes = await db.query(`SELECT issue_tags FROM media_items WHERE status = 'completed' AND issue_tags IS NOT NULL`);
    
    const tagBreakdown = {
      BLURRY_IMAGE: 0,
      LOW_LIGHT: 0,
      OVER_EXPOSED: 0,
      DUPLICATE_IMAGE: 0,
      INVALID_PLATE_FORMAT: 0,
      SCREENSHOT_DETECTED: 0,
      PHOTO_OF_PHOTO: 0,
      SUSPICIOUS_EDITING: 0
    };

    let totalIssuesFound = 0;
    let cleanImagesCount = 0;

    completedItemsRes.rows.forEach(row => {
      try {
        let tags = row.issue_tags;
        if (typeof tags === 'string') {
          tags = JSON.parse(tags);
        }
        if (Array.isArray(tags)) {
          if (tags.length === 0) {
            cleanImagesCount++;
          } else {
            totalIssuesFound += tags.length;
            tags.forEach(t => {
              if (tagBreakdown[t] !== undefined) {
                tagBreakdown[t]++;
              } else {
                tagBreakdown[t] = 1;
              }
            });
          }
        }
      } catch (e) {}
    });

    const passRatePercentage = completedCount > 0 ? parseFloat(((cleanImagesCount / completedCount) * 100).toFixed(1)) : 100;

    res.json({
      pipelineOverview: {
        totalMedia,
        pendingCount,
        processingCount,
        completedCount,
        failedCount,
        cleanImagesCount,
        passRatePercentage,
        avgProcessingTimeMs: Math.round(avgDuration)
      },
      issueDistribution: tagBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

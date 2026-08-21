import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_HRNZTP7cI4jp@ep-delicate-union-ay0juec6-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle Neon PostgreSQL client:', err);
});

export async function initDb() {
  try {
    const client = await pool.connect();
    try {
      console.log('[Database] Connecting to Neon PostgreSQL persistence engine...');

      await client.query(`
        CREATE TABLE IF NOT EXISTS media_items (
          id VARCHAR(64) PRIMARY KEY,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type VARCHAR(64) NOT NULL,
          size BIGINT NOT NULL,
          filepath TEXT NOT NULL,
          url TEXT NOT NULL,
          perceptual_hash VARCHAR(64),
          sha256_hash VARCHAR(64),
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          progress INT NOT NULL DEFAULT 0,
          error TEXT,
          analysis_results JSONB,
          issue_tags JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS processing_jobs (
          id VARCHAR(64) PRIMARY KEY,
          media_id VARCHAR(64) NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          attempts INT NOT NULL DEFAULT 0,
          max_attempts INT NOT NULL DEFAULT 3,
          error_log TEXT,
          duration_ms INT,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_media_status ON media_items(status);
        CREATE INDEX IF NOT EXISTS idx_media_sha256 ON media_items(sha256_hash);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
      `);

      console.log('[Database] Neon PostgreSQL schema initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Database] Neon PostgreSQL initialization error:', err.message);
  }
}

export const db = {
  query: (text, params) => pool.query(text, params),
  pool
};

export default db;

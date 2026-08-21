import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initDb } from './db/database.js';
import mediaRouter from './routes/media.js';
import analyticsRouter from './routes/analytics.js';
import { queueManager } from './services/queue.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded images statically
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Register API Routes
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/analytics', analyticsRouter);

// SSE Endpoint for Live Queue Updates & Real-time Telemetry
app.get('/api/v1/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const unsubscribe = queueManager.subscribe(sendEvent);

  req.on('close', () => {
    unsubscribe();
  });
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'SpectraTrace Intelligent Media Processing Pipeline',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve frontend static files in production if dist exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// Global Express Error Middleware (Catches Multer / JSON syntax / Unhandled Errors)
app.use((err, req, res, next) => {
  console.error('[Server Error Handler]:', err.message);
  res.status(err.status || 400).json({
    error: err.message || 'An unexpected error occurred processing your request.'
  });
});

// Async Server Startup Function
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  SpectraTrace AI Pipeline Engine Server Ready`);
      console.log(`  Server Port : http://localhost:${PORT}`);
      console.log(`  Upload API  : http://localhost:${PORT}/api/v1/media/upload`);
      console.log(`  Analytics   : http://localhost:${PORT}/api/v1/analytics/summary`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[Server Initialization Error]: Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

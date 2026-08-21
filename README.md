# SpectraTrace AI — Intelligent Media Processing Pipeline

> **Backend + AI Engineering Take-Home Submission**  
> An autonomous, asynchronous vehicle image analysis pipeline and cyber-industrial forensic telemetry terminal built with Node.js, Express, Neon PostgreSQL, Sharp, Tesseract OCR, and React.

---

## 🚀 Live Application & Repository Quick Links

- **GitHub Repository**: `https://github.com/Prajeethv21/media-processing-pipeline.git`
- **Live Local URL**: `http://localhost:5000` *(Express Gateway serving API + Web UI)*

---

## 🏛 System Architecture & Processing Flow

```
                                [ Client Web Dashboard / API ]
                                              │
                                              ▼ (POST /api/v1/media/upload)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Express API Gateway Server                               │
│                       (server/index.js & server/routes/media.js)                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Validates File MIME & File Size (Multer)                                            │
│ • Returns 400 Bad Request JSON on invalid file types (.txt, .pdf)                     │
│ • Stores Specimen on Disk (/uploads)                                                   │
│ • Inserts Media Metadata into Neon PostgreSQL DB ('pending' state)                     │
│ • Returns Media ID & Status URLs Immediately (< 50ms)                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼ (Enqueue Job ID)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             Async Queue Worker Engine                                  │
│                             (server/services/queue.js)                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Persistent Concurrency-Controlled Worker Queue (Max 2 Parallel Jobs)                 │
│ • State Machine backed by Neon PostgreSQL: pending ──► processing ──► completed/failed │
│ • Exponential Backoff Retry Strategy (Up to 3 Attempts)                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼ (Computes 6 Parallel Forensic Checks)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Image Analysis Engine                                    │
│                            (server/services/analyzer.js)                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Blur Detection        ➜ Discrete 3x3 Laplacian Edge Variance calculation            │
│ 2. Lighting & Exposure   ➜ Mean Luminance & Contrast Standard Deviation                │
│ 3. Indian License Plate  ➜ Tesseract.js OCR + Regex Format Verification               │
│ 4. Duplicate Matching    ➜ 64-bit dHash (Perceptual Difference Hash) & SHA-256        │
│ 5. Screenshot Detection  ➜ Aspect ratio analysis, UI bar & Moire frequency heuristics│
│ 6. Exif Tamper Audit     ➜ Software tag audit (Photoshop, Canva, Lightroom)            │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Persistence & Telemetry                                   │
│                            (server/db/database.js - Neon DB)                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Updates Neon PostgreSQL DB (`media_items` & `processing_jobs`) with JSONB telemetry  │
│ • Broadcasts Real-Time Server-Sent Events (SSE) to Frontend Terminal Canvas            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 6 Forensic Computer Vision & Integrity Checks

| # | Diagnostic Check | Method / Algorithm | Threshold / Criteria | Anomaly Tag Flagged |
|---|---|---|---|---|
| **1** | **Blur Detection** | 3x3 Discrete Laplacian Kernel pass on raw grayscale pixels | Variance $< 110.0$ | `BLURRY_IMAGE` |
| **2** | **Lighting Analysis** | ITU-R BT.601 Luminance Mean ($\mu$) & StdDev ($\sigma$) | Brightness $< 60$ (Dark) or $> 210$ (Glare) | `LOW_LIGHT` / `OVER_EXPOSED` |
| **3** | **Indian License Plate** | Tesseract.js OCR + Regex (`[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}`) | Validates state codes & HSRP format | `INVALID_PLATE_FORMAT` |
| **4** | **Perceptual Duplicate** | 64-bit difference Hash (dHash) & SHA-256 | Hamming Distance $\le 8$ bits | `DUPLICATE_IMAGE` |
| **5** | **Screenshot & Screen Photo** | Aspect ratio matching, status bar UI, Moire noise | Phone aspect ratio + missing EXIF camera make | `SCREENSHOT_DETECTED` / `PHOTO_OF_PHOTO` |
| **6** | **Image Tampering Audit** | EXIF header software tag inspection | Presence of Photoshop/Canva/GIMP tags | `SUSPICIOUS_EDITING` |

---

## 🤖 Mandatory AI Usage Disclosure

### 1. Where AI Was Used
- **Architecture Ideation**: Used LLM assistants to refine computer vision heuristic formulas (Laplacian edge variance vs Sobel filtering, 64-bit dHash difference hashing).
- **Frontend Telemetry Terminal**: Assisted in building custom UI canvas components and real-time Server-Sent Event (SSE) streaming state hooks.
- **Test Pipeline Automation**: Assisted in scripting automated API verification runners.

### 2. What AI Output Was Wrong / Hallucinated & How It Was Fixed
- **OpenCV Native Binding Issues on Windows**: Initial AI suggestion recommended using native Python `opencv-python` bindings via `child_process`. On Windows Node v24, this introduced native DLL path errors. **Fix**: Replaced with high-performance C++ `sharp` raw pixel buffer operations and Tesseract.js, achieving zero native installation overhead.
- **Tesseract OCR Regular Expression Flaws**: AI generated overly permissive plate regex `/[A-Z0-9]{8,10}/` which matched random noise text on bumper grilles. **Fix**: Refined regex to strictly mirror official Indian HSRP & Bharat (BH) series registration formats (`/([A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,2}\s?[0-9]{4})/g`).
- **Idealized Test Matrix Table**: Initial AI draft generated an idealized sample matrix table claiming clean sample 1 scored 100/100. **Fix**: Replaced with empirical test results generated from running the pipeline against the three provided real vehicle photo specimens (`Testimg.jpg`, `testimg1.jpg`, `TESTimg3.jpg`).

### 3. Validation Methodology
- All image analysis algorithms were validated by running `node scripts/test-verification.js` against the three provided real vehicle specimen images (`Testimg.jpg`, `testimg1.jpg`, `TESTimg3.jpg`).
- Database persistence was verified by querying Neon PostgreSQL directly (`pool.query(...)`), restarting the Node server, and verifying data survival through API GET calls.

---

## ⚖️ Database Architecture & Engineering Decisions

### Real Database Engine: Neon PostgreSQL
- **Database Engine**: Hosted Neon PostgreSQL instance connected over SSL (`pg.Pool`).
- **Configuration**: Managed via `DATABASE_URL` environment variable in `.env`.
- **Tables**: `media_items` and `processing_jobs` schema with `JSONB` telemetry columns and indexed lookup keys (`idx_media_status`, `idx_media_sha256`, `idx_jobs_status`).
- **Persistence**: All uploads, processing states, analysis results, hashes, and error logs are persisted directly in Neon PostgreSQL.

---

## ⚡ Quickstart & Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher
- **Neon PostgreSQL**: Connection string in `.env` (`DATABASE_URL=postgresql://...`)

### Standard Local Execution

```bash
# 1. Clone repository
git clone https://github.com/praje/intelligent-media-processing-pipeline.git
cd intelligent-media-processing-pipeline

# 2. Install dependencies
npm install
cd client && npm install && cd ..

# 3. Create .env file with your Neon PostgreSQL connection string
echo "DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require" > .env

# 4. Build & launch application (Runs Express API + React UI)
npm start
```

Open your browser at `http://localhost:5000` to access the **SpectraTrace Telemetry Terminal**.

---

## 🧪 Empirical Real Vehicle Specimen Results

The table below reflects **actual empirical outputs** generated by executing `node scripts/test-verification.js` against the three provided real vehicle specimen images (`Testimg.jpg`, `testimg1.jpg`, `TESTimg3.jpg`):

| Specimen File | Specimen Description | Observed Issue Tags | Quality Score | Blur Score / Status | Brightness | OCR Status | Neon DB Status |
|---|---|---|---|---|---|---|---|
| `Testimg.jpg` | Real Vehicle Specimen 1 | `INVALID_PLATE_FORMAT`, `SCREENSHOT_DETECTED` | `35 / 100` | 2163.21 (Clean) | 116.64 (Optimal) | `PARTIAL_PLATE_DETECTED` | `COMPLETED` |
| `testimg1.jpg` | Real Vehicle Specimen 2 | `INVALID_PLATE_FORMAT` | `55 / 100` | 2330.11 (Clean) | 121.00 (Optimal) | `PARTIAL_PLATE_DETECTED` | `COMPLETED` |
| `TESTimg3.jpg` | Real Vehicle Specimen 3 | `INVALID_PLATE_FORMAT`, `SCREENSHOT_DETECTED` | `35 / 100` | 881.16 (Clean) | 106.77 (Optimal) | `PARTIAL_PLATE_DETECTED` | `COMPLETED` |

---

## 📡 API Reference & CURL Examples

### 1. Upload Image (POST `/api/v1/media/upload`)

```bash
curl -X POST http://localhost:5000/api/v1/media/upload \
  -F "image=@/path/to/Testimg.jpg"
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Image uploaded successfully and queued for processing.",
  "mediaId": "c4b912a7-584e-4e6f-b2b9-123456789abc",
  "jobId": "job_1724040000_a1b2c3",
  "status": "pending",
  "progress": 0,
  "statusUrl": "/api/v1/media/status/c4b912a7-584e-4e6f-b2b9-123456789abc",
  "resultsUrl": "/api/v1/media/results/c4b912a7-584e-4e6f-b2b9-123456789abc"
}
```

### 2. Fetch Status (GET `/api/v1/media/status/:id`)

```bash
curl http://localhost:5000/api/v1/media/status/c4b912a7-584e-4e6f-b2b9-123456789abc
```

### 3. Fetch Structured Results (GET `/api/v1/media/results/:id`)

```bash
curl http://localhost:5000/api/v1/media/results/c4b912a7-584e-4e6f-b2b9-123456789abc
```

### 4. Fetch Dedicated Failure Info (GET `/api/v1/media/failure/:id`)

```bash
curl http://localhost:5000/api/v1/media/failure/c4b912a7-584e-4e6f-b2b9-123456789abc
```

---

## 📜 Submission Checklist Verification

- [x] Complete source code provided
- [x] Real Neon PostgreSQL database (`pg.Pool`) used for all persistence
- [x] Asynchronous background worker queue (`pending` → `processing` → `completed` / `failed`)
- [x] 6 Computer Vision & Image Integrity checks
- [x] REST APIs for upload, status, forensic results, dedicated failure route, analytics, and re-processing
- [x] Invalid file upload (.txt, .pdf) returns 400 Bad Request JSON response
- [x] Empirical real vehicle specimen results (`Testimg.jpg`, `testimg1.jpg`, `TESTimg3.jpg`) documented in README
- [x] Complete AI Usage Disclosure included in README
- [x] Dockerfile & `docker-compose.yml` included

# Architecture Specification: Visual Regression & Validation Platform

## 1. Overview

This system is a tool-agnostic, API-first visual validation platform for automated UI QA. It supports two primary workflows:

- Current Sprint: New Feature/Page validation using a single uploaded image and a vision model
- Regression: Existing Feature/Page validation using baseline + current images and deterministic or AI-assisted comparison modes

The currently implemented backend is a Node.js + Express API layer that matches this design. The frontend is not yet implemented in this repository; the backend is the valid source of truth for the architecture and API contract.

The backend implementation currently uses:

- Backend: Node.js + Express
- Deterministic pixel-level diff: Resemble.js
- Vision LLM: Groq or Jina AI for Vision (configurable by environment)
- Reporting model: Groq only, separate from the vision comparison model

The design supports manual image upload only; there is no browser automation, no Playwright usage, and no scraping of live pages.

---

## 2. Design Principles

1. API-first development
   - Backend contracts and REST endpoints are defined before the UI layer.
   - Frontend consumes the API rather than embedding logic into the client.

2. Tool-agnostic implementation
   - The architecture must be buildable by Claude, GitHub Copilot, Cursor, or any IDE-integrated coding assistant.
   - No tool-specific commands, proprietary APIs, or editor assumptions are allowed.

3. Environment-driven configuration
   - Every user-facing menu option, sub-menu option, provider choice, model choice, threshold, and scoring setting must be configurable from .env.
   - No hardcoded model names or thresholds in source code.

4. Deterministic-first validation
   - Pixel-level validation must always use a deterministic engine and must never call an LLM for that stage.

5. Human-equivalent AI review for layout semantics
   - Vision LLMs are used to assess layout, alignment, text, spacing, color, and missing/extra elements in image-based validation.

6. Separate reporting layer
   - Reporting and severity scoring must use a different model from the vision-comparison model.

7. All outcomes should be exportable
   - Reports are downloadable as HTML and include a summary table and pie chart.

---

## 3. Mandatory Requirements

### 3.1 Entry point
- The user manually uploads images from the local machine or a file system.
- No browser automation is allowed.
- No Playwright, Puppeteer, or live-page capture is used.

### 3.2 Top-level navigation
The application contains exactly two top-level menu paths:

- Current Sprint
- Regression

### 3.3 Current Sprint workflow
Current Sprint is for a new feature or page validation where no baseline exists.

Requirements:
- Exactly one uploaded image is required.
- A vision LLM performs the review.
- The review checks at minimum:
  - layout
  - alignment
  - text
  - spacing
  - color
  - missing elements
  - extra elements
- Output is a structured finding list with severity and rationale.

### 3.4 Regression workflow
Regression is for an existing feature or page validation.

Requirements:
- Requires two images: baseline and current.
- Three selectable sub-modes:
  - pixel-by-pixel
  - text-extraction diff
  - hybrid (pixel + text)
- The pixel-level diff path must use a deterministic library, never an LLM.

### 3.5 Model separation
- The vision comparison model and the reporting/severity model must be separate.
- In the current backend implementation, reporting is served via Groq and is configurable by .env.
- Jina AI is supported for vision review only; it is not used for the reporting/severity stage in the current implementation.

### 3.6 Environment toggles
Everything must be config-driven:
- menu availability
- submenu availability
- provider selection
- model names
- thresholds
- severity scoring weights
- report options
- allowed validation modes

### 3.7 Score conversion
A configurable scoring mechanism converts findings into a numeric severity score.

### 3.8 Report output
The platform must generate downloadable HTML reports with:
- summary table
- severity table
- findings list
- pie chart
- pass/fail status

Reports must be generated for both:
- Current Sprint
- Regression

---

## 4. High-Level System Architecture

### 4.1 Components

1. Frontend UI (React + TypeScript)
   - Upload form
   - Menu navigation
   - Validation mode selector
   - Results dashboard
   - HTML report download

2. API Gateway / Backend (Node.js + Express)
   - Auth-less SaaS-ready API layer
   - Validation orchestration
   - File upload handling
   - Job management
   - External provider orchestration
   - Reporting generation

3. Storage Layer
   - File storage for uploaded images
   - Metadata store for validation jobs
   - Report output storage

4. Deterministic Image Comparison Service
   - Uses Resemble.js for pixel diff
   - Produces masked difference maps, mismatch statistics, and thresholded results

5. Vision Analysis Service
   - Calls Groq or Jina AI Vision depending on environment configuration
   - Extracts semantic layout issues and content anomalies

6. OCR/Text Diff Service
   - Extracts text from images and compares baseline vs current text
   - Handles text mismatches, missing text, layout text drift, and grouping issues

7. Reporting and Severity Service
   - Takes raw findings and converts them into a weighted score
   - Uses a separate Groq model for severity interpretation and report narrative

8. HTML Report Renderer
   - Produces downloadable HTML page with table and chart

---

## 5. API-First Design

### 5.1 API Style
- RESTful design
- Versioned endpoints under /api/v1
- Proper HTTP status codes
- Consistent JSON error envelope
- Validation job lifecycle with status tracking

### 5.2 Recommended Base URL
- /api/v1

### 5.3 Core Endpoints

#### Uploads
- POST /api/v1/uploads
  - Upload one or two images
  - Returns upload metadata and file IDs

#### Validation Jobs
- POST /api/v1/validation/current-sprint
  - Single image flow
  - Creates a job and returns job ID

- POST /api/v1/validation/regression
  - Baseline + current flow
  - Accepts comparison mode (pixel | text | hybrid)

- GET /api/v1/validation/jobs/:jobId
  - Job status and progress

- GET /api/v1/validation/jobs/:jobId/result
  - Final output payload

- GET /api/v1/validation/jobs/:jobId/report/html
  - Returns downloadable HTML report

- POST /api/v1/validation/jobs/:jobId/retry
  - Re-run a failed or incomplete job

#### Provider / Config Endpoints
- GET /api/v1/config
  - Reads current UI and backend configuration from environment

- GET /api/v1/providers/health
  - Returns provider health and API connectivity status

### 5.4 Request and Response Standards

Success responses:
- HTTP 200 or 201 with structured body

Error responses:
- HTTP 400: invalid input
- HTTP 404: resource not found
- HTTP 409: validation conflict or duplicate job state
- HTTP 422: unsupported mode or invalid files
- HTTP 500: server-side processing failure

Example error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_MODE_UNSUPPORTED",
    "message": "The selected regression mode is not enabled for this environment.",
    "details": {
      "requestedMode": "hybrid",
      "availableModes": ["pixel", "text"]
    }
  }
}
```

---

## 6. Business Logic by Validation Type

### 6.1 Current Sprint (New Feature or Page)
Input:
- One image uploaded by user

Processing pipeline:
1. Validate image type and dimensions
2. Save image to storage
3. Invoke vision model for semantic review
4. Interpret layout and content analysis
5. Produce structured findings with severity and evidence
6. Aggregate into final score
7. Generate HTML report

Required checks:
- layout integrity
- alignment accuracy
- text readability and placement
- spacing consistency
- color correctness
- missing elements
- extra elements

Output:
- status: pass / needs review / fail
- findings array
- score
- HTML report

### 6.2 Regression (Existing Feature or Page)
Input:
- baseline image
- current image
- selected mode: pixel | text | hybrid

Processing pipeline:
1. Validate both uploaded files
2. Save baseline and current assets
3. Run deterministic pixel comparison if selected
4. Run OCR / text extraction comparison if selected
5. Run vision model review if selected or if hybrid mode requires semantic explanation
6. Merge findings from all selected paths
7. Score combined findings
8. Generate HTML report

Sub-mode behavior:

#### A. Pixel-by-pixel mode
- Deterministic library: Resemble.js
- Compares image-by-image with similarity score
- Produces diff masks, mismatch counts, and thresholds
- No LLM involved

#### B. Text-extraction diff mode
- OCR image text extraction for both images
- Compare text blocks, strings, structure, and ordering
- Detect missing or modified labels, headings, or content drifts

#### C. Hybrid mode
- Run both pixel diff and text diff
- Optionally run semantic vision reasoning for layout-level issues
- Merge results into one cumulative finding set
- Final score combines both deterministic and LLM-based observations

---

## 7. AI Provider Strategy

### 7.1 Vision Model Switching
The current backend supports two vision model providers, selected by environment:

- Groq Vision Model
- Jina AI Vision Model

The active provider is controlled by .env:

```env
VISION_PROVIDER=groq
# or VISION_PROVIDER=jina
```

### 7.2 Groq Vision Configuration
```env
GROQ_API_KEY=your_groq_key
GROQ_VISION_MODEL=llava-v1.5-7b-4096-preview
```

### 7.3 Jina AI Vision Configuration
```env
JINA_API_KEY=your_jina_key
JINA_VISION_MODEL=jina-vlm
JINA_VISION_API_URL=https://api-beta-vlm.jina.ai/v1/chat/completions
```

### 7.4 Reporting Model Restriction
The implemented backend currently supports reporting/severity generation through Groq only. If the configured reporting provider is not Groq, the code falls back to local scoring and summary generation instead of calling a remote reporting model.

```env
REPORTING_PROVIDER=groq
REPORTING_MODEL=llama-3.1-70b-versatile
```

### 7.5 Jina Request Pattern
The engineering contract for Jina vision inference is:

```json
{
  "model": "jina-vlm",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Describe this image"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA4QAAAHMCAIAAAACuPFEAAA8UUlEQVR4nO3dV1xUx8PG8YFdQJAmVW..."
          }
        }
      ]
    }
  ]
}
```

### 7.5 Reporting Model
Reporting severity and narrative must use a separate Groq model from the vision comparison model.

```env
REPORTING_PROVIDER=groq
REPORTING_MODEL=llama-3.1-70b-versatile
```

---

## 8. Configurable Scoring and Severity Logic

The score conversion must be config-driven and not hardcoded.

### 8.1 Example Configuration
```env
SEVERITY_CRITICAL_THRESHOLD=90
SEVERITY_HIGH_THRESHOLD=70
SEVERITY_MEDIUM_THRESHOLD=40
SEVERITY_LOW_THRESHOLD=15

FINDING_WEIGHT_CRITICAL=25
FINDING_WEIGHT_HIGH=15
FINDING_WEIGHT_MEDIUM=8
FINDING_WEIGHT_LOW=3

MAX_SCORE=100
MIN_SCORE=0
```

### 8.2 Scoring Formula
A suggested formula is:

- Compute weighted score per finding
- Sum all findings by severity
- Normalize to a 0-100 scale
- Apply pass/fail threshold mapping

Example pseudocode:

```text
score = min(100, sum(weightedFindingScores))
if score >= CRITICAL_THRESHOLD -> severity = "critical"
else if score >= HIGH_THRESHOLD -> severity = "high"
else if score >= MEDIUM_THRESHOLD -> severity = "medium"
else if score >= LOW_THRESHOLD -> severity = "low"
else severity = "info"
```

### 8.3 Required Result Fields
- overallScore
- severityLabel
- passFailStatus
- findingCount
- totalCritical
- totalHigh
- totalMedium
- totalLow
- summary

---

## 9. Reporting Requirements

All reports must be HTML downloadable and support both validation types.

### 9.1 Required HTML Report Contents
- Title and validation type
- Timestamp
- Input file names
- Validation mode
- Summary cards
- Table of findings with columns:
  - severity
  - category
  - description
  - evidence
  - impacted element
  - score contribution
- Pie chart of severity distribution
- Pass / fail status
- Recommendations or next action section

### 9.2 Report Generation Pipeline
1. Gather results from validation engine
2. Normalize findings
3. Score and aggregate by severity
4. Build HTML template
5. Include inline CSS and chart library or SVG rendering
6. Return downloadable file or browser save trigger

### 9.3 Download Behavior
- UI offers a button to download the HTML report
- File naming format:
  - current-sprint-report-YYYY-MM-DD-HHMMSS.html
  - regression-report-YYYY-MM-DD-HHMMSS.html

---

## 10. Frontend UX Design (After API Contract)

The frontend should be designed after the backend API contract is complete.

### 10.1 Pages and States

#### 1. Landing / Home
- Shows two top-level options:
  - Current Sprint
  - Regression

#### 2. Current Sprint Page
- Single image upload area
- Validation trigger button
- Result panel with findings
- Download HTML report button

#### 3. Regression Page
- Baseline image upload
- Current image upload
- Mode selector with:
  - pixel-by-pixel
  - text-extraction diff
  - hybrid
- Run comparison action
- Results panel with merged findings
- Download report

### 10.2 UX Principles
- Minimal friction upload flow
- Strong visual result interpretation
- Clear severity indicators
- Consistent error banners
- Downloadable results

---

## 11. Data Model

### 11.1 Job Record
```json
{
  "jobId": "uuid",
  "type": "current-sprint | regression",
  "status": "queued | processing | completed | failed",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "mode": "pixel | text | hybrid",
  "files": [
    { "id": "file-1", "name": "baseline.png", "path": "..." },
    { "id": "file-2", "name": "current.png", "path": "..." }
  ],
  "score": 0,
  "severity": "info",
  "results": {}
}
```

### 11.2 Finding Record
```json
{
  "id": "finding-1",
  "category": "layout | alignment | text | spacing | color | missing-element | extra-element",
  "severity": "critical | high | medium | low | info",
  "description": "Text overlap detected in header region.",
  "evidence": "Header text block overlaps with navigation container.",
  "scoreContribution": 18,
  "source": "vision | pixel | text | hybrid"
}
```

---

## 12. Environment Configuration (.env)

All toggles must be controlled through environment variables.

```env
# Core app settings
APP_PORT=4000
APP_ENV=development
APP_BASE_URL=http://localhost:4000

# Frontend settings
FRONTEND_ENABLED=true
UI_MENU_CURRENT_SPRINT=true
UI_MENU_REGRESSION=true
UI_MODE_PIXEL=true
UI_MODE_TEXT=true
UI_MODE_HYBRID=true

# Provider configuration
VISION_PROVIDER=groq
# Alternative: VISION_PROVIDER=jina

# Groq settings
GROQ_API_KEY=your_groq_key
GROQ_VISION_MODEL=llava-v1.5-7b-4096-preview

# Reporting settings
REPORTING_PROVIDER=groq
REPORTING_MODEL=llama-3.1-70b-versatile

# Jina AI settings
JINA_API_KEY=your_jina_key
JINA_VISION_MODEL=jina-vlm
JINA_VISION_API_URL=https://api-beta-vlm.jina.ai/v1/chat/completions

# Deterministic diff
PIXEL_DIFF_LIBRARY=resemblejs
PIXEL_DIFF_THRESHOLD=0.03
PIXEL_DIFF_MIN_DIFF_PERCENT=1

# Severity thresholds
SEVERITY_CRITICAL_THRESHOLD=90
SEVERITY_HIGH_THRESHOLD=70
SEVERITY_MEDIUM_THRESHOLD=40
SEVERITY_LOW_THRESHOLD=15

# Scoring weights
FINDING_WEIGHT_CRITICAL=25
FINDING_WEIGHT_HIGH=15
FINDING_WEIGHT_MEDIUM=8
FINDING_WEIGHT_LOW=3

# Validation options
CURRENT_SPRINT_ENABLED=true
REGRESSION_ENABLED=true
REGRESSION_MODE_PIXEL=true
REGRESSION_MODE_TEXT=true
REGRESSION_MODE_HYBRID=true

# Report output
REPORT_HTML_ENABLED=true
REPORT_INCLUDE_TABLE=true
REPORT_INCLUDE_PIE_CHART=true
REPORT_DOWNLOAD_FILENAME_TEMPLATE={type}-report-{timestamp}.html

# Storage
UPLOAD_MAX_SIZE_MB=25
STORAGE_DIR=./uploads
REPORTS_DIR=./reports
```

---

## 13. Phase-by-Phase Implementation Plan

### Phase 1: API Foundation
Objectives:
- Define REST endpoints
- Create upload flow
- Add job and result models
- Standardize error handling
- Implement health checks

Deliverables:
- /api/v1/uploads
- /api/v1/validation/current-sprint
- /api/v1/validation/regression
- /api/v1/validation/jobs/:jobId
- structured error responses

### Phase 2: Deterministic Comparison Engine
Objectives:
- Integrate Resemble.js
- Support pixel diff thresholds
- Produce mismatch metrics

Deliverables:
- pixel diff pipeline
- threshold-based mismatch scoring
- deterministic result object

### Phase 3: Vision and OCR Integration
Objectives:
- Add Groq and Jina AI support
- Add text extraction comparison
- Build semantic layout and text findings

Deliverables:
- provider abstraction layer
- Jina/Groq switch via .env
- OCR diff engine
- semantic findings pipeline

### Phase 4: Scoring and Reporting
Objectives:
- Convert raw findings to numeric severity score
- Generate HTML report with pie chart and table
- Support both Current Sprint and Regression reports

Deliverables:
- severity engine
- HTML report renderer
- downloadable artifact flow

### Phase 5: Frontend and UX
Objectives:
- Build React + TypeScript UI based on API contract
- Add upload forms and validation mode selectors
- Display findings and download report

Deliverables:
- landing page
- current sprint flow
- regression flow
- result dashboard
- HTML report download button

### Phase 6: Hardening, Observability, and Ops
Objectives:
- Logging
- Retry logic
- provider health checks
- rate limits
- security for uploads

Deliverables:
- monitoring hooks
- fault-tolerant providers
- production-safe configuration defaults

---

## 14. Non-Functional Requirements

### 14.1 Performance
- Jobs should complete within acceptable time for single-image and dual-image validation.
- Long-running tasks should be asynchronous with status polling.

### 14.2 Reliability
- Failed provider calls should be retried with sensible backoff.
- Unknown provider or invalid config should fail gracefully with actionable errors.

### 14.3 Security
- Validate file types and sizes
- Store files in dedicated directories
- Avoid direct client-side trust of uploaded files
- Do not expose API keys in client responses

### 14.4 Observability
- Log job lifecycle events
- Log provider request/response metadata
- Track validation score and failure reason

---

## 15. Acceptance Criteria

The implementation is accepted when all of the following are true:

1. Users can upload images manually with no browser automation.
2. The system supports Current Sprint and Regression top-level paths only.
3. Current Sprint validates a single image using a vision model against checklist items.
4. Regression accepts baseline + current images and supports pixel, text, and hybrid modes.
5. Pixel diff is always deterministic and uses Resemble.js or an equivalent non-LLM image-diff library.
6. Reporting uses a different model from the vision-comparison model via Groq.
7. All model choices, thresholds, menu flags, and mode flags are controllable from .env.
8. A scoring mechanism converts findings into a numeric severity score.
9. Downloadable HTML reports are generated for both Current Sprint and Regression validations.
10. The architecture is tool-agnostic and ready to be implemented by any IDE-based coding agent.

---

## 16. Final Implementation Guidance

This solution should be implemented in the following order:

1. Define REST API contracts and versioning
2. Build backend validation workflows and storage
3. Implement deterministic pixel diff
4. Add vision provider abstraction and OCR text comparison
5. Add reporting/severity scoring model
6. Generate HTML reports
7. Build the React + TypeScript UI
8. Validate end-to-end with manual sample uploads

This sequencing ensures the project remains API-first, stable, and implementation-ready without requiring further clarification from the product team.

# New Architecture for the Compliance Coverage Agent

## 1. Purpose and scope

The Compliance Coverage Agent is a retrieval-augmented generation (RAG) solution designed to map a user story or requirement to the most relevant compliance clauses from GDPR and the EU AI Act. The system must never invent clause wording or paraphrase legal text. It must retrieve and return the exact clause references, including the clause ID, title, and URL.

The architecture is intentionally API-first: backend services are implemented first, validated, and stabilized before the UI is introduced. The delivery model follows the phase-by-phase roadmap in the project image and the user story inputs in the project folders.

## 2. Architectural objectives

- Return exact compliance clause matches for a given business requirement
- Support both GDPR and EU AI Act clause stores
- Use LangChain for document loading, embeddings, MongoDB vector retrieval, and Groq-based reranking
- Use MongoDB Atlas vector search with native MongoDB driver and not Mongoose
- Support clean ingestion of scraped legal content into vector collections
- Keep the retrieval pipeline deterministic, traceable, and metadata-filtered
- Ensure backend API contracts are ready before UI implementation
- Handle Groq model and Groq reranking configuration failures proactively and clearly

## 3. Design principles

- API-first development: backend endpoints and data contracts are implemented before UI work
- Legal precision: each clause is treated as a retrieval unit; no chunking is applied to legal articles because the clause itself is the unit of meaning
- Metadata-aware retrieval: search results are filtered by standard and other required metadata
- Model governance: all embedding and reranking models are configured in environment variables and validated at startup
- Observability: every ingestion and retrieval step logs inputs, outputs, and failures clearly
- Security: secrets are not hardcoded; all keys are managed through .env and validated before runtime
- Resilience: Groq call failures are handled with explicit error messages and fallback behavior

## 4. Mandatory technology stack

### Frontend
- React.js
- TypeScript

### Backend
- Node.js
- LangChain
- MongoDB Atlas
- Native MongoDB driver only; no Mongoose
- Groq for reranking
- CheerioWebBaseLoader from LangChain for web scraping

### AI / retrieval stack
- Mistral embedding model for clause embeddings
- MongoDB Atlas vector search for retrieval
- Groq LLM for reranking candidate results
- No direct legal paraphrasing; retrieval output is restricted to source metadata and exact clause references

## 5. Reference inputs used for architecture

This architecture was designed using the project inputs in the workspace, including:

- user_stories/gdpr_user_stories.txt
- user_stories/eu_ai_act_user_stories.txt
- compliance_coverage_agent.md
- phase-by-phase-implementation.jpg

The implementation order reflects the roadmap in the image:

1. Phase 1: Backend scaffold (config, MongoDB client, env validation)
2. Phase 2: Scrapers (GDPR + EU AI Act) and JSON output verification
3. Phase 3: Vector index creation and ingestion pipelines
4. Phase 4: Retrieval + Groq reranking
5. Phase 5: Frontend menu and matching backend order
6. Phase 6: End-to-end checks with sample stories

## 6. High-level architecture

### 6.1 Layered architecture

The system is divided into six logical layers:

1. Presentation layer
   - React + TypeScript frontend
   - Menu-driven UX aligned to the required functional order
   - Displays retrieved clause list and source metadata

2. API layer
   - Node.js backend
   - REST endpoints for scraper triggers, ingestion, retrieval, and health checks
   - API-first contract design before frontend implementation

3. Orchestration layer
   - LangChain workflow orchestration
   - Embedding generation, MongoDB vector search, Groq reranking, and metadata filtering

4. Data ingestion layer
   - Web scraping modules for GDPR and EU AI Act
   - Structured JSON conversion to the required data folder structure
   - Batch ingestion into MongoDB Atlas collections

5. Vector storage and retrieval layer
   - MongoDB Atlas vector indexes for GDPR and EU AI Act
   - Metadata filters by standard and clause values
   - Top-k vector retrieval based on configurable thresholds

6. Governance and configuration layer
   - .env values for database, collection names, vector indexes, embedding model, top-k, and Groq settings
   - Strict model validation and operational safeguards

### 6.2 Functional flow

- User submits a requirement or story through the API or UI
- Requirement text is embedded using the configured Mistral embedding model
- Vector search runs against the relevant collection
- Top-k candidate clauses are selected
- Metadata filter narrows the candidate set
- Groq rerank step reorders the results by legal relevance
- Final result returns clauseId, title, and url for the selected standard

## 7. Mandatory .env configuration

The following values must exist in the environment file before the application starts.

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=compliance_coverage_agent
MONGODB_GDPR_COLLECTION=gdpr_clauses
MONGODB_EU_AI_COLLECTION=eu_ai_act_clauses
MONGODB_GDPR_VECTOR_INDEX=gdpr_vector_index
MONGODB_EU_AI_VECTOR_INDEX=eu_ai_act_vector_index

# Retrieval configuration
TOP_K=5
EMBEDDING_MODEL=mistral-embed
EMBEDDING_DIMENSIONS=1024

# Groq configuration
GROQ_API_KEY=your_groq_api_key_here
GROQ_RERANK_MODEL=your_valid_groq_rerank_model_name

# Optional operational config
NODE_ENV=development
LOG_LEVEL=info
```

### Required MongoDB design

- Two collections:
  - gdpr_clauses
  - eu_ai_act_clauses
- Two vector indexes:
  - gdpr_vector_index
  - eu_ai_act_vector_index
- Metadata stored per document includes:
  - standard
  - clauseId
  - title
  - url
  - source
- Embedding field stores a vector of dimension 1024 created from title + text

## 8. Data model and schema

Each scraped clause must be stored in a structured JSON document with the following fields:

```json
{
  "standard": "GDPR",
  "clauseId": "Art. 1 GDPR",
  "title": "Subject-matter and objectives",
  "text": "This Regulation lays down rules relating to the protection of natural persons with regard to the processing of personal data and rules relating to the free movement of personal data.",
  "url": "https://gdpr-info.eu/art-1-gdpr/"
}
```

For the EU AI Act:

```json
{
  "standard": "EU AI Act",
  "clauseId": "Article 1",
  "title": "Subject Matter",
  "text": "1. The purpose of this Regulation is to improve the functioning of the internal market and promote the uptake of human-centric and trustworthy artificial intelligence (AI)...",
  "url": "https://artificialintelligenceact.eu/article/1/"
}
```

Vector insertion should embed the concatenated text of title + text and store metadata fields only. There is no chunking because each clause is already the retrieval unit.

## 9. Data ingestion workflow

### 9.1 Web scraping for GDPR

- Source: https://gdpr-info.eu/
- Use CheerioWebBaseLoader from LangChain
- Crawl and collect all relevant articles
- Normalize each article into a JSON structure
- Persist to:
  - data/gdpr_clauses_langchain.json

### 9.2 Web scraping for EU AI Act

- Source: https://artificialintelligenceact.eu
- Use CheerioWebBaseLoader from LangChain
- Crawl and collect all relevant article entries
- Normalize each article into a JSON structure
- Persist to:
  - data/eu_ai_act_clauses_langchain.json

### 9.3 JSON validation and ingestion steps

1. Ensure crawled content has all required fields
2. Validate data quality before ingestion
3. Transform records to canonical schema
4. Batch insert documents into MongoDB Atlas
5. Compute embeddings using the Mistral embedding model
6. Insert vectors and metadata into the vector index for each standard
7. Verify collection counts and index readiness

### 9.4 Ingestion contracts

- GDPR ingestion:
  - collection: gdpr_clauses
  - vector index: gdpr_vector_index
  - metadata filter: standard = GDPR

- EU AI Act ingestion:
  - collection: eu_ai_act_clauses
  - vector index: eu_ai_act_vector_index
  - metadata filter: standard = EU AI Act

## 10. Retrieval workflow

### 10.1 GDPR retrieval flow

1. Receive an incoming user story or requirement
2. Embed the user story using the configured embedding model
3. Run vector search against the GDPR vector store
4. Select top-k matches using TOP_K from the environment file
5. Apply metadata filtering to restrict results to the selected standard and scope
6. Send candidate set to the Groq reranking model
7. Return a ranked list with:
   - clauseId
   - title
   - url

### 10.2 EU AI Act retrieval flow

1. Receive an incoming user story or requirement
2. Embed the story using the configured embedding model
3. Run vector search against the EU AI Act vector store
4. Select top-k matches using TOP_K from the environment file
5. Apply metadata filtering by standard and scope
6. Send candidate set to the Groq reranking model
7. Return a ranked list with:
   - clauseId
   - title
   - url

### 10.3 Retrieval output example

```text
Story: "User can request full deletion of their account and data"
Matches:
- GDPR Art. 17 (Right to erasure)
- GDPR Art. 5(1)(e) (Storage limitation)
```

## 11. Backend-first API design

Because the project mandates API-first implementation, the backend must be built and validated before UI development begins.

### Backend API responsibilities

1. Web scraping for GDPR clauses
   - POST /api/scrape/gdpr
   - Generates data/gdpr_clauses_langchain.json

2. Web scraping for EU AI Act clauses
   - POST /api/scrape/eu-ai-act
   - Generates data/eu_ai_act_clauses_langchain.json

3. Ingestion for GDPR clause data
   - POST /api/ingest/gdpr
   - Reads the JSON file and performs batch insertion into MongoDB Atlas

4. Ingestion for EU AI Act clause data
   - POST /api/ingest/eu-ai-act
   - Reads the JSON file and performs batch insertion into MongoDB Atlas

5. Retrieval for GDPR
   - POST /api/retrieve/gdpr
   - Accepts story text and returns ranked clause references

6. Retrieval for EU AI Act
   - POST /api/retrieve/eu-ai-act
   - Accepts story text and returns ranked clause references

### Contract behavior

- Return 200 with structured payloads for successful retrieval
- Return 400 for bad input or missing required fields
- Return 500 with actionable errors for system failures or model issues
- Log model names, API key presence state, and failure reasons without exposing secrets

## 12. Frontend architecture

The frontend is implemented only after the backend contracts and retrieval flow are stable.

### Frontend responsibilities in the same order as the menu list

1. GDPR web scraping workflow
2. EU AI Act web scraping workflow
3. GDPR ingestion workflow
4. EU AI Act ingestion workflow
5. GDPR retrieval workflow
6. EU AI Act retrieval workflow

### Frontend interface design

- Left-side navigation or menu aligned to the order above
- Search input for story text
- Standard-specific views for GDPR and EU AI Act
- Results cards containing:
  - clauseId
  - title
  - url
- Clear status messages for ingestion, scraping, and retrieval states
- Error banners for Groq or backend failures

## 13. Backend folder structure

```text
project-root/
  .env
  package.json
  src/
    app.js
    server.js
    config/
      env.js
      mongodb.js
      groq.js
    routes/
      scrapeRoutes.js
      ingestRoutes.js
      retrieveRoutes.js
    controllers/
      scrapeController.js
      ingestController.js
      retrieveController.js
    services/
      scraperService.js
      ingestionService.js
      embeddingService.js
      retrievalService.js
      rerankService.js
    utils/
      validators.js
      logger.js
      responseFormatter.js
    data/
      gdpr_clauses_langchain.json
      eu_ai_act_clauses_langchain.json
  frontend/
    src/
      components/
      pages/
      services/
      types/
```

## 14. MongoDB Atlas vector design

The data must be stored in two collections with matching vector indexes:

- gdpr_clauses + gdpr_vector_index
- eu_ai_act_clauses + eu_ai_act_vector_index

### Collection design

```json
{
  "_id": "objectId",
  "standard": "GDPR",
  "clauseId": "Art. 17 GDPR",
  "title": "Right to erasure",
  "text": "The data subject shall have the right to obtain from the controller the erasure of personal data concerning him or her without undue delay...",
  "url": "https://gdpr-info.eu/art-17-gdpr/",
  "embedding": [1024-dimensional vector],
  "metadata": {
    "standard": "GDPR",
    "clauseId": "Art. 17 GDPR",
    "title": "Right to erasure",
    "url": "https://gdpr-info.eu/art-17-gdpr/"
  }
}
```

The embedding must be created on title + text, and the vector dimension must be 1024. The vector store must be searched with metadata filters for the selected legal standard and relevant scope.

## 15. Groq integration strategy and error prevention

Groq is required for reranking only after vector retrieval. This is a critical integration point and must be hardened against the typical model and reranking failures that occur during backend implementation.

### 15.1 Required Groq safeguards

- Store the Groq API key only in .env via `GROQ_API_KEY`
- Store the Groq reranking model explicitly in .env via `GROQ_RERANK_MODEL`
- Validate both values at app startup
- Verify that the configured model is available in the current Groq account before processing requests
- Use a clear configuration guard:
  - if API key is missing → fail fast with a descriptive startup error
  - if model is missing or unsupported → fail fast with a descriptive config error
  - if API request fails → log details and return a structured backend error

### 15.2 Typical Groq errors to mitigate

The architecture must explicitly plan for the following issues:

- invalid or expired Groq API key
- model name not found or not supported
- rate limit exceeded
- timeout or transient network issue
- malformed payload or unsupported parameters
- JSON parsing failure on the model response
- missing reranking result after vector retrieval

### 15.3 Recommended runtime handling

- Wrap every Groq call in `try/catch`
- Log sanitized error codes and message fragments without exposing secrets
- If reranking fails, return a controlled fallback response such as:
  - vector-only ranked result with warning metadata, or
  - explicit backend 502/503 response with a clear message
- Enforce the same failure policy across GDPR and EU AI Act retrieval routes
- Do not silently ignore Groq errors; they must be visible in logs and returned to the caller in a structured format

### 15.4 Groq model governance rule

The application must never hardcode an unverified Groq model name into production logic. The selected model must be environment-configured and validated against the current Groq account before use. This is the primary safeguard against runtime Groq model errors and reranking failures.

## 16. Phase-by-phase implementation roadmap

### Phase 1: Backend scaffold and config validation

- Initialize Node.js backend
- Configure environment loading and validation
- Create MongoDB Atlas client using the native MongoDB driver
- Validate .env configuration for MongoDB and Groq
- Build health check endpoints
- Confirm backend service startup order before any frontend work

### Phase 2: Scrapers and JSON verification

- Build GDPR scraper with CheerioWebBaseLoader
- Build EU AI Act scraper with CheerioWebBaseLoader
- Save outputs to the required data folder
- Validate JSON structure, clause IDs, titles, and URLs
- Confirm both files match the expected schema

### Phase 3: Vector index creation and ingestion pipelines

- Create MongoDB Atlas vector indexes for GDPR and EU AI Act
- Build batch ingestion logic for JSON files
- Generate 1024-dimension embeddings from title + text
- Insert vector documents with metadata filters
- Validate collection population and vector creation

### Phase 4: Retrieval and Groq reranking

- Implement story embedding and vector retrieval for GDPR and EU AI Act
- Apply top-k and metadata filter logic
- Invoke Groq reranking model
- Return ordered clause references with clauseId, title, and url
- Enforce Groq error handling and model validation

### Phase 5: Frontend menu and ordering

- Implement menu order matching the required workflow sequence
- Connect UI to the backend APIs
- Present results in the exact same order as the backend response contract
- Keep UI logic separate from business logic

### Phase 6: End-to-end testing with sample stories

- Validate GDPR sample stories
- Validate EU AI Act sample stories
- Confirm clause retrieval quality and metadata filtering
- Confirm backend error messages for Groq failures
- Run a full end-to-end sample workflow covering scraper → ingestion → retrieval → results

## 17. Functional requirements by backend and frontend order

The following requirement sequence must be preserved exactly in both backend and frontend implementation order:

1. Web scrapping for all articles GDPR and convert to JSON under data folder
2. Web scrapping for all articles EU AI and convert to JSON under data folder
3. Ingestion for GDPR data from gdpr_clauses_langchain.json into MongoDB Atlas
4. Ingestion for EU AI data from eu_ai_act_clauses_langchain.json into MongoDB Atlas
5. Retrieval for GDPR
6. Retrieval for EU AI Act

This ordering is mandatory and must align with the menu structure and routing in the frontend.

## 18. Non-functional requirements

- Data integrity: clause text cannot be altered or paraphrased
- Performance: retrieval should remain fast with large compliance corpora
- Reliability: ingestion and retrieval must include explicit validation at each step
- Traceability: every result should include the exact source clause metadata
- Extensibility: additional standards can be added later by reusing the same ingestion and retrieval pattern
- Security: keep all credentials in .env and never expose them in frontend code or logs

## 19. Final architecture summary

The final solution is a backend-first, RAG-based compliance clause mapping system that scrapes legal articles from GDPR and the EU AI Act, stores them in MongoDB Atlas vector indexes, retrieves matching clauses using embeddings, reranks them using Groq, and returns exact clause references. The frontend is implemented only after the backend is stable and validated. The architecture is intentionally designed to prevent common Groq model issues by validating configuration, enforcing strict environment contracts, and handling all model failures with explicit error states.

This design is aligned with the provided project brief, the user stories, and the implementation roadmap shown in the project image, and it supports the phased delivery model required for successful implementation.

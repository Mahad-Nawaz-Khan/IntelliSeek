# Research: Multi-Format Parsing Layer & Upload Pipeline

## Decision: Use client-direct upload to Supabase Storage

**Rationale**: The browser uploads accepted files directly to the `academic-documents` bucket through `@supabase/supabase-js`, then sends the resulting storage path and metadata to FastAPI. This avoids routing up to 10 MB files through the Python API, reduces backend bandwidth and memory pressure, and reuses Supabase Storage bucket limits and MIME allow-listing from the foundation phase.

**Alternatives considered**: Streaming uploads through FastAPI was rejected because the backend would become a file relay before it does useful parsing work. Server-generated signed upload URLs can be considered later for stricter upload-session control, but the current Supabase client flow is the smallest viable implementation for the existing stack.

## Decision: Process document parsing in FastAPI with Python libraries

**Rationale**: Python has mature libraries for academic document extraction, and the next phase will also run Python-based embedding/vector workflows. Keeping parsing in FastAPI keeps raw text extraction near future NLP processing and avoids adding equivalent Node.js parser dependencies to the frontend service.

**Alternatives considered**: Node.js parsing in Next.js was rejected because it would mix heavy file processing into the UI service and duplicate the Python AI pipeline. External parsing services were rejected because Phase 3 can meet requirements locally with maintained Python packages.

## Decision: Use `PyPDF2`, `python-docx`, and `python-pptx`

**Rationale**: These packages are standard, maintained, and adequate for extractable-text PDF, DOCX paragraphs, and PPTX slide text. TXT parsing uses standard UTF-8 file reading. Image-only PDFs remain explicit parsing failures because OCR is out of scope.

**Alternatives considered**: `pdfplumber` offers stronger layout-aware PDF extraction but adds a heavier dependency footprint. Phase 3 starts with `PyPDF2`; `pdfplumber` can be swapped in a later refactor if representative PDFs show extraction gaps.

## Decision: Route parser selection through a Factory/Strategy boundary

**Rationale**: A base `DocumentParser` interface and `ParserFactory` keep format-specific extraction isolated and make backend validation explicit. Adding or replacing a parser requires only a new parser class and factory mapping, not API-route branching.

**Alternatives considered**: A single `if/elif` block in `/api/parse` was rejected because it would mix API validation, Supabase download, metadata persistence, cleanup, and extraction details in one function.

## Decision: Validate file constraints twice

**Rationale**: Frontend validation gives immediate user feedback and avoids unnecessary uploads. Backend validation is still mandatory because parse requests are a trust boundary and can be crafted independently of the UI. Backend validation checks storage path shape, user ownership prefix, allowed extension/MIME, declared size, and 10 MB limit before parsing.

**Alternatives considered**: Trusting only the Supabase bucket policy was rejected because the API still needs to protect parse and metadata insertion from malformed or unauthorized references.

## Decision: Delete temporary files in a `finally` cleanup path

**Rationale**: The backend downloads storage objects only long enough to parse them. Cleanup must run after successful parsing, parser failures, database insertion failures, and unexpected exceptions to avoid local disk leaks.

**Alternatives considered**: Parsing directly from bytes was considered, but the selected parser libraries generally work best with file-like objects or paths. Temporary files are acceptable with strict cleanup and size limits.

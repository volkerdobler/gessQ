PDF → Glossary extraction

Usage:

1. Install the dependency (locally):

```bash
npm install --save-dev pdf-parse
```

2. Run the extractor:

```bash
node ./tools/pdf2glossary.js manual/qdot_manual.pdf src/data/manualGlossary.json
```

This will write `src/data/manualGlossary.txt` (raw extracted text) and a best-effort `manualGlossary.json`.

Notes:

- The extractor uses simple heuristics; you may need to refine the JSON after extraction.
- For a more accurate parse, consider manual post-processing or using a structured source (if available).

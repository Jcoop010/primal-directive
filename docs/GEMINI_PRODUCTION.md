# Gemini production configuration

The only active provider is Gemini. GEMINI_API_KEY remains server-only. The verified text/structured-output model is gemini-3.1-flash-lite.

Search grounding is disabled unless GEMINI_SEARCH_GROUNDING_ENABLED=true. Do not enable that switch until the owner approves any required billing and a separate grounding test passes for the production key. The current free-tier key returned HTTP 429 for Gemini 3.1 Flash-Lite grounding, while text and JSON returned HTTP 200. Gemini 2.5 Flash-Lite returned HTTP 404 and is not a verified replacement.

Questions requiring live facts still receive a clearly labelled unverified draft. Source-backed gigs and contacts are omitted unless provider grounding metadata supplies supporting sources. No fallback provider or invented live research is permitted.

The explicit diagnostic command node scripts/verify-gemini-production.mjs always ends with a nonzero exit code, deliberately preventing publication. Run only as an intentional diagnostic build. Its --grounding-only option tests the separate capability; it never enables billing.

Production releases must use the validated immutable commit and run the Vite build separately from migrations. Do not run customer database migrations as a side effect of an AI-only release.

# Reverse engineer git

Reverse engineer git analyzes a public GitHub repository and returns a reverse-engineering brief plus a reconstruction prompt. Every analysis request requires a configured LLM provider.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and fill in your provider settings:

```bash
cp .env.example .env.local
```

3. Configure the required LLM variables:

```bash
LLM_PROVIDER=
LLM_MODEL=
LLM_API_KEY=
```

4. If your provider uses a custom OpenAI-compatible endpoint, also set:

```bash
LLM_BASE_URL=
```

5. Optionally set `GITHUB_TOKEN` to raise GitHub API rate limits for public repository analysis.

6. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and submit a public GitHub URL or `owner/repo` reference.

## Environment variables

- `LLM_PROVIDER` — required provider id. Supported runtime values are `anthropic`, `gemini`, `github-models`, and `openai-compatible`.
- `LLM_MODEL` — required model name for the selected provider.
- `LLM_API_KEY` — required API key for providers that authenticate with a key.
- `LLM_BASE_URL` — optional override for providers or gateways that need a custom base URL.
- `GITHUB_TOKEN` — optional GitHub token used server-side for higher public API limits.

If the LLM configuration is missing, analysis requests should fail with a configuration error instead of returning a fallback summary.

## API check

With the dev server running and LLM configuration set, you can verify the analysis endpoint with:

```bash
curl -sS -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"repo":"vercel/swr"}'
```

A successful response should include a non-empty `prompt` and LLM metadata for the configured provider and model.

## Scripts

- `npm run dev` — start the Next.js development server
- `npm run build` — create a production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm install` — install dependencies.
- `cp .env.example .env.local` — create local env, then set `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY`. Optionally set `LLM_BASE_URL` and `GITHUB_TOKEN`.
- `npm run dev` — start the Next.js development server.
- `npm run build` — create a production build.
- `npm run start` — run the production build.
- `npm run lint` — run ESLint with the Next.js core-web-vitals and TypeScript configs.
- API smoke test with the dev server running:
  ```bash
  curl -sS -X POST http://localhost:3000/api/analyze \
    -H 'Content-Type: application/json' \
    -d '{"repo":"vercel/swr"}'
  ```
  Expect a JSON response with a non-empty `prompt` plus `analysisMeta`.
- Tests: there is currently no test runner, no `test` script in `package.json`, and no existing single-test command.

## High-level architecture

- This is a Next.js 16 App Router app with top-level `app/`, `components/`, and `lib/` directories. The `@/*` TypeScript alias points to the repository root.
- `app/page.tsx` is intentionally thin; it just renders `components/home-shell.tsx`, which is the main UI composition root.
- The client flow is: `HomeShell` holds result/status state, `components/repo-form.tsx` submits the repository reference to `/api/analyze`, and `components/analysis-result.tsx` renders both the reverse-engineering prompt and the confidence/ambiguity metadata returned by the server.
- `app/api/analyze/route.ts` is the orchestration entry point. Its flow is: parse and normalize the repo input, resolve required LLM config, fetch a GitHub snapshot, build a heuristic seed analysis, run the iterative LLM analysis loop, then build the final reconstruction prompt returned to the client.
- `lib/github.ts` owns GitHub-side discovery. It only supports public repositories, fetches metadata plus the repo tree through the GitHub API, then samples a capped set of high-signal files for initial analysis. `GITHUB_TOKEN` is optional and only used to improve public API rate limits.
- `lib/analyze-repo.ts` is the non-LLM seed stage. It infers initial stack, app type, feature hints, architecture notes, and evidence from the sampled files before the model loop starts.
- `lib/analysis-loop.ts` and `lib/context-selection.ts` are the core of the product. The model can request additional files/folders from the repository tree, and the loop stops based on confidence, ambiguity state, remaining context, or budget limits.
- `lib/llm.ts` selects the provider adapter in `lib/llm/providers/`. `anthropic.ts`, `gemini.ts`, and `openai-compatible.ts` all return parsed JSON matching `StructuredLlmResponse`; `github-models` currently routes through the OpenAI-compatible adapter.
- `lib/build-prompt.ts` turns the final summary into the reconstruction brief shown in the UI. `lib/types.ts` is the shared contract across the API route, analysis pipeline, provider adapters, and client components.
- Styling is a mix of Tailwind v4 utility classes in components and custom global tokens/utilities in `app/globals.css`; `app/layout.tsx` defines the font variables those styles rely on.

## Behavioral constraints from the current implementation

- Every analysis request requires a configured LLM provider. Missing LLM env should fail with a configuration error; there is no fallback summary path.
- The app only accepts public GitHub repositories, either as `owner/repo` or full `github.com` URLs.
- The returned payload is not just a prompt: the UI also depends on `summary` and `analysisMeta`, so API shape changes usually affect both client rendering and the analysis loop.

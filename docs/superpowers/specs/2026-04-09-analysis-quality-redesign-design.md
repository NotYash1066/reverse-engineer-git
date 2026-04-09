# Analysis Quality Redesign Design

## Goal

Redesign the repository analysis pipeline so it produces better results on both typical repositories and difficult repositories such as large, ambiguous, or monorepo-style codebases, while staying balanced on latency and API cost.

## Scope

This design covers the first implementation phase only: analysis quality. It includes staged repository analysis, improved retrieval planning, stronger synthesis, and more explicit scoring/coverage output. It does not cover later phases for UI-focused redesign, expanded input handling beyond analysis needs, or broader product features such as share/history.

## Current constraints

- The app currently exposes a single `/api/analyze` endpoint.
- The current response contract includes `normalizedRepo`, `summary`, `prompt`, and `analysisMeta`.
- The UI already depends on `summary` and `analysisMeta`, so breaking those shapes would create unnecessary churn.
- The current implementation uses a heuristic seed analysis followed by an iterative LLM loop.
- The repository currently has no test runner or existing test command.

## Recommended architecture

Replace the current loosely staged seed-plus-loop flow with an explicit staged analysis pipeline:

1. **Discovery** — fetch repository metadata, root entries, full path inventory, and an initial high-signal file set.
2. **Classification** — determine repository shape, such as single app, service repo, library/platform, monorepo, or mixed/ambiguous structure.
3. **Targeted retrieval** — choose additional files and folders using stage-aware retrieval strategies rather than only generic high-signal path patterns.
4. **Synthesis** — combine heuristic findings and model findings into a structured summary, reconstruction prompt input, assumptions, and evidence set.
5. **Scoring** — compute confidence, ambiguity, and coverage from explicit signals gathered during analysis.

`app/api/analyze/route.ts` remains the orchestration entry point, but the core analysis implementation becomes a staged engine rather than a simple repeated loop.

## Component design

### Existing files that remain central

- `app/api/analyze/route.ts` — request entry point and response assembly
- `lib/github.ts` — GitHub metadata, tree, and file retrieval
- `lib/analysis-loop.ts` — upgraded into a staged coordinator
- `lib/build-prompt.ts` — final prompt construction from richer synthesis output
- `lib/types.ts` — shared response, analysis, and metadata contracts

### New or expanded internal responsibilities

- **Repository shaping module**
  - Derives early structural signals from the tree and sampled files
  - Identifies likely app roots, workspace roots, service/package roots, and mixed-structure indicators
  - Distinguishes monorepos from single-app repositories and docs-heavy repositories

- **Retrieval planning module**
  - Chooses retrieval targets by stage and repository shape
  - Prioritizes workspace manifests, package roots, and representative code/config files for large repositories
  - Prevents low-value expansion by favoring representative coverage over broad unfocused fetching

- **Scoring module**
  - Produces explicit confidence and coverage outputs
  - Considers unresolved ambiguity severity, number and diversity of inspected paths, evidence support, and representativeness across likely app roots

- **Synthesis layer**
  - Combines heuristic and model-derived signals into final summary fields
  - Produces a better structured evidence list and assumptions list for downstream prompt generation

## Data flow

The request flow remains:

`repo input -> parse -> fetch snapshot -> staged analysis -> response`

Internally, the staged analysis should pass through structured data that includes:

- repository classification
- discovered app/package/workspace roots
- retrieval history grouped by stage
- coverage summary of inspected repository areas
- synthesized findings
- confidence and ambiguity outputs

This internal structure should make analysis decisions inspectable and easier to evolve than the current loop-only shape.

## Response contract

Keep the existing top-level response contract:

- `normalizedRepo`
- `summary`
- `prompt`
- `analysisMeta`

Extend `analysisMeta` additively with fields that help explain result quality without breaking the existing client contract. The initial additions should be:

- `repoShape` — summary of detected repository structure
- `coverage` — summary of what kinds of areas were inspected and how complete that coverage is
- `stageSummaries` — compact information about what happened in each stage

These additions should remain optional or additive so the current UI continues to function while future UI work can expose the richer diagnostics.

## Analysis behavior

### Discovery

Discovery should still fetch metadata, root entries, and a full blob path inventory from GitHub where possible. The initial file sample should be broadened from simple pattern matching toward representative signal capture. For example, discovery should favor:

- root-level manifests and config files
- workspace manifests
- README and docs files with strong product/context signal
- one or more package-level manifests in monorepos
- a small number of representative implementation files when config/docs are insufficient to classify the repo

### Classification

Classification should happen before deep retrieval so later stages can make better choices. Classification should identify at least:

- likely repository type
- likely primary stack(s)
- monorepo/workspace indicators
- likely frontend/backend/service roots
- whether the repository is straightforward or structurally ambiguous

### Targeted retrieval

Targeted retrieval should request files and folders according to repository shape. For example:

- in a monorepo, inspect workspace root, representative package manifests, and one representative app/service branch before broadening
- in a single app repo, inspect primary config, package manifest, and a few key implementation paths
- in an ambiguous repo, retrieve files that resolve the ambiguity directly rather than broadening randomly

Retrieval should stop expanding once additional context has low expected value relative to cost and latency.

### Synthesis

Synthesis should produce:

- stronger stack identification
- clearer app/project type classification
- better key feature extraction
- architecture notes tied to observed evidence
- explicit assumptions when the system is inferring beyond direct evidence

`lib/build-prompt.ts` should use this richer synthesis output so the final reconstruction brief better reflects both known facts and bounded uncertainty.

### Scoring

Confidence should no longer depend only on one iteration-level model response. It should incorporate:

- evidence strength
- coverage breadth across likely relevant repo areas
- ambiguity count and severity
- whether representative files were inspected for each likely app root
- whether the system had to rely on assumptions rather than direct evidence

Coverage should be reported separately from confidence so the UI and downstream logic can distinguish “low confidence because weak evidence” from “low confidence because coverage was narrow.”

## Error handling and stop behavior

### Hard failures

Preserve request-level hard failures for:

- invalid repository input
- unsupported or non-public repository
- missing LLM configuration
- GitHub fetch failure before meaningful analysis can begin

### Best-effort analysis

Do not fail the entire request when later-stage retrieval is incomplete or low value. Instead:

- record evidence gaps
- reduce confidence when coverage is weak
- preserve unresolved ambiguities
- return a best-effort result when enough information exists to produce a usable reconstruction brief

### Stop logic

Stop logic should be based on a combination of:

- confidence threshold
- ambiguity severity
- coverage completeness
- marginal value of more retrieval
- cost and latency budget

This allows difficult repositories to return partial-but-usable analyses instead of either over-fetching or failing too aggressively.

## Testing strategy

Because the repository currently has no test runner, the first testing work should focus on deterministic logic introduced by the redesign.

Priority test targets:

- repository classification
- retrieval planning
- path selection logic
- scoring logic
- response-shape compatibility for `/api/analyze`

Use representative synthetic repository snapshots for at least these cases:

- simple Next.js app
- backend service repo
- monorepo/workspace repo
- ambiguous mixed-structure repo

GitHub and LLM integrations should remain thin and be tested indirectly where practical, while the core deterministic decision logic gets direct coverage.

## Rollout

Roll the redesign directly into the existing `/api/analyze` endpoint rather than adding feature flags. This repository is still early-stage, and direct replacement keeps the implementation smaller and clearer.

The redesign should preserve the current top-level response shape while allowing additive metadata changes that the existing UI can ignore until later UI work is implemented.

## Non-goals

This phase does not include:

- broader UI redesign
- export/share/history features
- full input-handling expansion beyond what analysis quality requires
- feature flags for alternate analysis engines
- a full product-level workflow redesign outside the analysis pipeline

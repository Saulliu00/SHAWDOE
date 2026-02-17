# KindWords

A Chrome browser extension that detects toxic comments on **YouTube** and **Twitch** and replaces them in real-time with warmer, reframed versions using an AI-powered pipeline hosted on AWS.

## Architecture

```
YouTube / Twitch Comments
        │
        ▼
┌─────────────────────────┐
│   Browser Extension     │  Chrome MV3 · MutationObserver · Batch Queue
│   (Content Script)      │
└──────────┬──────────────┘
           │  chrome.runtime.sendMessage
           ▼
┌─────────────────────────┐
│   Service Worker        │  Two-tier cache (memory + chrome.storage)
│   (Background)          │  Client-side rate limiting
└──────────┬──────────────┘
           │  fetch POST /v1/comments/process
           ▼
┌─────────────────────────┐
│   API Gateway + Lambda  │  Request validation (Zod) · Server-side rate limiting
│   (AWS Serverless)      │  DynamoDB cache lookup
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│   LLM Agent Pipeline  (Amazon Bedrock)      │
│                                             │
│   Stage 1: Toxicity Classifier              │
│     → not toxic? DONE (short-circuit)       │
│     → toxic? continue ↓                     │
│                                             │
│   Stage 2: Emotional Reframer               │
│     → rewrites comment warmly               │
│                                             │
│   Stage 3: Response Suggester               │
│     → suggests a kind reply                 │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│   Processed Output      │  Cached in DynamoDB (24h TTL)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   DOM Replacement       │  Reframed text + "KW" badge with tooltip
│   (Browser UI)          │  Original text viewable on click
└─────────────────────────┘
```

## Project Structure

```
kindwords/
├── apps/
│   ├── extension/          # Chrome MV3 browser extension
│   │   ├── src/
│   │   │   ├── content-scripts/
│   │   │   │   ├── platforms/   # YouTube & Twitch MutationObservers
│   │   │   │   ├── dom/         # Comment replacement & overlay UI
│   │   │   │   └── batch/       # Batching queue with dedup
│   │   │   ├── service-worker/  # API proxy, cache, message routing
│   │   │   ├── popup/           # Extension popup UI
│   │   │   └── shared/          # Config, storage helpers
│   │   └── manifest.json
│   │
│   └── infra/              # AWS CDK infrastructure
│       ├── bin/app.ts
│       └── lib/stacks/      # Data, API, Monitoring stacks
│
├── packages/
│   ├── types/              # Shared TypeScript interfaces
│   ├── utils/              # Hashing, text normalization, logger, retry
│   ├── llm-pipeline/       # 3-stage LLM agent pipeline
│   ├── data-access/        # DynamoDB repositories (cache, stats, rate-limit)
│   └── api-handlers/       # Lambda handlers + middleware
│
├── turbo.json              # Turborepo pipeline config
└── tsconfig.base.json      # Shared TypeScript config
```

## Packages

| Package | Purpose |
|---------|---------|
| `@kindwords/types` | Shared TypeScript types and interfaces across all packages |
| `@kindwords/utils` | Isomorphic utilities: SHA-256 hashing, text normalization, structured logger, retry with backoff |
| `@kindwords/llm-pipeline` | 3-stage LLM pipeline: classify toxicity → reframe emotionally → suggest kind reply |
| `@kindwords/data-access` | DynamoDB repository layer for cache, usage stats, and rate limiting |
| `@kindwords/api-handlers` | Lambda handler functions with Zod validation, CORS, rate limiting, and error handling |
| `@kindwords/extension` | Chrome Manifest V3 extension with platform observers and batch processing |
| `@kindwords/infra` | AWS CDK stacks for API Gateway, Lambda, DynamoDB, and CloudWatch |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/comments/process` | Batch process up to 25 comments through the LLM pipeline |
| `GET` | `/v1/status` | Health check (DynamoDB + Bedrock connectivity) |
| `GET` | `/v1/stats` | Aggregate usage statistics |

## Key Design Decisions

- **Batch-first processing** — Comments are queued client-side (max 25, flush every 1-2s) and batched into single LLM calls server-side
- **Two-tier caching** — Extension cache (chrome.storage, 5000 entries LRU) + server cache (DynamoDB, 24h TTL) minimize redundant LLM calls
- **Short-circuit pipeline** — Non-toxic comments exit after Stage 1 classification, saving ~80% of LLM costs
- **MutationObserver** — Efficient DOM detection without polling; catches comments as they appear
- **Atomic rate limiting** — DynamoDB conditional expressions prevent TOCTOU race conditions
- **Model-per-stage configuration** — Each pipeline stage can use a different Bedrock model via environment variables

## Tech Stack

- **Language:** TypeScript (monorepo with npm workspaces + Turborepo)
- **Extension:** Chrome Manifest V3, Webpack 5
- **Backend:** AWS Lambda (Node.js 20), API Gateway REST
- **Database:** Amazon DynamoDB (pay-per-request)
- **LLM:** Amazon Bedrock (Amazon Nova 2 Lite)
- **IaC:** AWS CDK v2
- **Testing:** Vitest
- **Validation:** Zod

## Development

```bash
# Install dependencies
npm install

# Build all packages (respects dependency order)
npm run build

# Run all tests
npm run test

# Type-check all packages
npm run typecheck

# Dev mode for extension (watch + rebuild)
npm run dev:extension
```

After building, load `apps/extension/dist/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_TABLE` | `kindwords-cache` | DynamoDB cache table name |
| `STATS_TABLE` | `kindwords-stats` | DynamoDB stats table name |
| `RATE_LIMIT_TABLE` | `kindwords-rate-limits` | DynamoDB rate limit table name |
| `BEDROCK_REGION` | `us-east-1` | AWS region for Bedrock API calls |
| `BEDROCK_MODEL_CLASSIFIER` | `amazon.nova-2-lite-v1:0` | Model for toxicity classification |
| `BEDROCK_MODEL_REFRAMER` | `amazon.nova-2-lite-v1:0` | Model for emotional reframing |
| `BEDROCK_MODEL_SUGGESTER` | `amazon.nova-2-lite-v1:0` | Model for response suggestion |

## Limits

| Limit | Value |
|-------|-------|
| Max comments per batch | 25 |
| Max comment text length | 2,000 characters |
| Client rate limit | 60 requests/minute per clientId |
| API Gateway throttle | 100 req/sec (200 burst) |
| Cache TTL (DynamoDB) | 24 hours |
| Cache TTL (extension local) | 24 hours |
| Local cache max entries | 5,000 (LRU eviction) |

## License

MIT

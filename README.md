# Auren Content OS

Multi-LLM content strategy dashboard that turns your business context, personas, and weekly brief into a research-grounded social calendar for **X**, **LinkedIn**, and **Reddit**.

Plan the week once. Generate platform-native drafts with hooks, rationale, and optional images. Log performance and feed it back into the next run.

## What it does

Auren is a single-user **content operating system** for founders and small teams who publish under multiple voices. You configure strategy once (ICP, goals, personas, story bank), set a weekly brief, and run a generation pipeline that:

1. **Researches** fresh signals (trends, competitors, news) grounded in your ICP and region
2. **Analyzes performance** from past posts to learn what worked
3. **Plans the week** with a mixed content calendar (research, story, fun, opinion)
4. **Writes each slot** through a multi-step LLM chain: draft → hook critic → polish → rationale
5. **Surfaces drafts** on a calendar or kanban board for review, approval, and export

There is also a **Rewrite** mode: paste a raw brain dump and get six platform variants (LinkedIn / X / Reddit × polished / faithful), optionally fact-checked.

## Features


| Area            | What you get                                                                               |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Calendar**    | Week view and kanban by post status (draft → approved → posted → logged)                   |
| **Strategy**    | Business profile, quarterly goals, personas with voice + cadence, story bank, weekly brief |
| **Generation**  | Research → strategy → write pipeline with per-task model routing                           |
| **Rewrite**     | Brain-dump → multi-platform social variants with optional fact-check                       |
| **Performance** | Import metrics and qualitative notes; patterns feed the next generation                    |
| **Images**      | Optional image generation for posts via your AI gateway                                    |
| **Settings**    | Per-task LLM routing, content mix ratios, generation concurrency                           |


## How generation works

Each weekly run moves through staged jobs you can watch in the UI:

```
Research → Performance digest → Strategy plan → Slot writing (parallel) → Done
```

**Content mix** defaults to 50% research, 20% story, 15% fun, 15% opinion. Story and opinion slots can draw from your **story bank** (first-person anecdotes and hot takes).

**Default model routing** (all overridable in Settings):


| Task              | Default model                                        |
| ----------------- | ---------------------------------------------------- |
| Research          | Perplexity Sonar Pro (web search, last-week recency) |
| Strategy          | Claude Sonnet 4.5                                    |
| Write             | Claude Sonnet 4.5                                    |
| Hook critic       | GPT-5.5                                              |
| Polish            | Claude Haiku 4.5                                     |
| Rationale         | Claude Sonnet 4.5                                    |
| Feedback analysis | Claude Opus 4.7                                      |


Every post ships with structured **rationale** (hook strategy, audience, slot reasoning, virality lever) and optional **citations** back to research signals, personas, goals, or performance data.

## Stack

- **Next.js 16** (App Router) + React 19 + Tailwind CSS v4
- **SQLite** via Drizzle ORM + libSQL (local file or Turso)
- **Bun** for dev scripts and DB tooling
- **[AI API Gateway](https://github.com/muneebhashone/ai-api)** for multi-provider LLM routing, web search, and image generation

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 20+
- A running **AI API Gateway** instance with at least one chat provider configured (OpenRouter recommended for the default routing)
- Optional: Turso account for hosted SQLite in production

### 1. Clone and install

```bash
git clone https://github.com/muneebhashone/auren-content.git
cd auren-content
bun install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# AI API Gateway — owns provider credentials, CLI auth, web search, and model discovery
AI_GATEWAY_BASE_URL=http://127.0.0.1:3000

# Optional image generation defaults
AI_GATEWAY_IMAGE_MODEL=codex/gpt-5.5
AI_GATEWAY_IMAGE_SIZE=1024x1024
AI_GATEWAY_IMAGE_RESPONSE_FORMAT=b64_json

# Database — local file for dev, Turso URL + token for production
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=

# Optional HTTP Basic Auth gate (set both to enable)
DASHBOARD_USER=auren
DASHBOARD_PASSWORD=your-secret
```

### 3. Initialize the database

```bash
bun run db:migrate
bun run db:seed    # optional: sample business profile + persona
```

### 4. Start the gateway and app

Run your AI gateway (see [ai-api](https://github.com/muneebhashone/ai-api)) on the port configured above, then:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dev script clears stale `running` generation jobs on startup so interrupted runs do not block new ones.

## First-run checklist

1. **Settings** — confirm your gateway is reachable; adjust per-task model routing if needed
2. **Business Profile** — ICP, services, brand pillars, voice
3. **Quarterly Goals** — activate one objective for the current quarter
4. **Personas** — add voices with platform cadence (e.g. 3× X, 2× LinkedIn per week)
5. **Story Bank** — seed anecdotes and hot takes for story/opinion slots
6. **Weekly Brief** — set focus + target segment, run research, then generate the week

## Scripts

```bash
bun run dev          # dev server (clears stuck jobs first)
bun run build        # production build
bun run start        # production server
bun run lint         # ESLint

bun run db:generate  # Drizzle migration files
bun run db:migrate   # apply migrations
bun run db:seed      # seed sample strategy data
bun run db:studio    # Drizzle Studio
```

## Project layout

```
app/
  (dashboard)/       # Calendar, rewrite, performance, strategy, settings
  api/               # Generation, rewrite, and image routes
components/          # Calendar, post detail, nav, UI primitives
lib/
  db/                # Schema, migrations, client
  generation/        # Pipeline, content mix, brief suggester, humanize
  llm/               # Gateway client, router, prompts
  images/            # Image generation helpers
scripts/             # Dev bootstrap, seed utilities
```

## Deployment notes

- Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for a hosted libSQL database
- Point `AI_GATEWAY_BASE_URL` at your deployed gateway
- Set `DASHBOARD_USER` and `DASHBOARD_PASSWORD` before exposing the dashboard publicly
- Generated images are saved under `public/generated/`

## License

MIT
# V-CLASS — AI Classroom (Next.js)

This is **V-CLASS**, the V-SCHL platform's AI classroom — a Next.js 15 / React 19 application
that turns curricula into multimodal classes (slides, narration, charts, code, quizzes, PBL
projects). It is derived from the OpenMAIC lineage (AGPL-3.0) and integrates with V-SCHL Core
for identity, with V-SCHL Billing for token entitlements, and with multiple LLM providers
(Anthropic, OpenAI, Google) through the AI SDK.

It orchestrates generation through LangGraph, streams agent output to the browser via the AI
SDK + CopilotKit, exports artifacts to PDF/PPTX/JSON, and stores per-classroom state both
client-side (Dexie/IndexedDB) and server-side (filesystem under `data/classrooms`).

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + strict TypeScript
- **AI SDK:** `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/react`
- **Agent Orchestration:** LangChain Core + LangGraph (`@langchain/core`, `@langchain/langgraph`)
- **Copilot Runtime:** `@copilotkit/runtime` + `@copilotkit/backend` for streaming agent UIs
- **MCP:** `@modelcontextprotocol/sdk` (tool servers)
- **UI:** Radix Primitives + Base UI + Tailwind (via PostCSS) + `lucide-react` icons + `geist`
- **Editor / Rich Text:** ProseMirror (`lib/prosemirror/`)
- **Visualization:** ECharts, `@xyflow/react`, KaTeX (math), `mathml2omml` (workspace pkg)
- **Audio / Video / Image:** `@napi-rs/canvas`, file-saver, JSZip, Azure voices route
- **Local DB:** Dexie (IndexedDB) for offline classroom drafts
- **State:** Zustand (`lib/store/`, `lib/stores/`) + Immer
- **Testing:** Vitest (unit) + Playwright (e2e)
- **Package Manager:** pnpm (workspace — `pnpm-workspace.yaml` includes `packages/*`)
- **License:** AGPL-3.0 (inherited from OpenMAIC) — preserve attribution

---

## Project Structure

```
V-CLASS/
├── app/                              # Next.js App Router
│   ├── (app)/                        # Authenticated app shell (route group)
│   ├── admin/                        # Admin console pages
│   ├── api/                          # Route handlers
│   │   ├── auth/                     # Login / session
│   │   ├── chat/                     # Streaming agent chat
│   │   ├── classroom/                # Classroom CRUD & job control
│   │   ├── classroom-media/          # Slide/audio/video asset routes
│   │   ├── generate/                 # Curriculum → classroom generation
│   │   ├── generate-classroom/       # Long-running generation orchestrator
│   │   ├── parse-pdf/                # Upload → text extraction
│   │   ├── pbl/                      # Project-based learning flows
│   │   ├── providers/, server-providers/, verify-*-provider/   # LLM provider routing & health
│   │   ├── quiz-grade/               # Quiz auto-grading
│   │   ├── transcription/, azure-voices/    # Speech-to-text & TTS voices
│   │   ├── symfony/                  # Proxy/bridge to V-SCHL Core (Symfony)
│   │   ├── web-search/               # Agent web-search tool
│   │   ├── proxy-media/              # Authenticated media proxy
│   │   ├── me/, health/, admin/
│   ├── classroom/                    # Live classroom pages
│   ├── generation-preview/           # Generation diff/preview screens
│   ├── login/
│   ├── layout.tsx, page.tsx, globals.css, *icon.png
├── components/                       # React components
│   ├── ai-elements/                  # Streaming UI primitives (token stream, tool call cards)
│   ├── agent/, chat/, audio/, canvas/, generation/
│   ├── slide-renderer/, scene-renderers/, stage/
│   ├── roundtable/                   # Multi-agent debate UI
│   ├── token-usage-orb/, quota-dialog.tsx, api-error-boundary.tsx
│   ├── settings/, admin/, server-providers-init.tsx
├── lib/                              # Domain code (NOT React)
│   ├── ai/                           # Provider-routing, model registry, tool schemas
│   ├── action/                       # Server actions
│   ├── api/                          # Typed client wrappers
│   ├── audio/, media/, playback/, pdf/, prosemirror/
│   ├── auth/                         # Session + Core JWT exchange
│   ├── chat/, generation/, orchestration/, pbl/
│   ├── i18n/                         # Localization
│   ├── server/                       # Server-only helpers
│   ├── storage/, store/, stores/     # Dexie + Zustand
│   ├── web-search/
│   └── logger.ts, types/, utils/, constants/, contexts/, hooks/, buffer/, export/
├── packages/                         # pnpm workspace packages
│   ├── mathml2omml/                  # MathML → OOXML for PPTX export
│   └── pptxgenjs/                    # Vendored / patched PPTX generator
├── configs/                          # animation, chart, element, font, hotkey, shapes, theme...
├── data/                             # Server-side persisted data (classrooms, jobs)
│   ├── classrooms/
│   └── classroom-jobs/
├── e2e/                              # Playwright suites
├── public/                           # Static assets
├── proxy.ts                          # Dev proxy (Symfony / Core bridging)
├── playwright.config.ts, vitest.config.ts (if present), eslint.config.mjs
├── next.config.ts, postcss.config.mjs, components.json (shadcn)
└── docker-compose.yml, Dockerfile
```

---

## Auth Flow (JWT Bearer Token)

V-CLASS does **not** issue its own identities — it federates with **V-SCHL Core**. The Next.js
server exchanges Core's JWT for a V-CLASS session cookie, then forwards Core JWTs server-side
when calling Core APIs.

```
1. Login
   POST /api/auth/login  { email, password }
      ↓ server-side
   Next.js calls Core POST /api/v1/auth/login
      ↓
   Sets httpOnly cookie holding { coreAccessToken, coreRefreshToken, userMeta }

2. Browser → Next.js Route Handler
   Every /api/* handler reads the session cookie, attaches Authorization: Bearer <coreAccessToken>
   when calling Core (via app/api/symfony/* or lib/api/*).

3. LLM Provider Calls (server-only)
   Anthropic / OpenAI / Google keys live in env. They are NEVER exposed to the browser.
   The browser talks only to /api/chat, /api/generate, etc., which proxy to providers.

4. Entitlement / Token Quota
   On every generation route, server checks the student's token balance via Core's projection
   of Billing's `tokens.granted` ledger. Insufficient balance → 402 + quota-dialog.
```

### Key Rules
- **Provider API keys never reach the client.** They live in env and are read only inside
  server route handlers / server actions.
- **The Core JWT is the source of truth for identity.** Never trust `userId` from a request
  body — read it from the verified session.
- **Refresh token rotation** is handled in `lib/auth/`. Do not duplicate refresh logic in
  route handlers.
- **Token quota enforcement** wraps every LLM-calling route — bypassing it is a billing leak.

---

## Feature Implementation Order

### Priority 1: Identity & Quota (foundational)
- Login / session cookie / Core JWT exchange (`lib/auth/`, `app/api/auth/*`)
- Token-balance check + 402 quota response on every LLM route
- Provider registry & verification routes (`/api/verify-*-provider`)

### Priority 2: Curriculum → Classroom Generation
- PDF/text ingestion (`/api/parse-pdf`)
- LangGraph generation pipeline (`lib/orchestration/`, `/api/generate-classroom`)
- Streaming preview UI (`components/generation/`, `app/generation-preview/`)
- Persisted job records under `data/classroom-jobs/`

### Priority 3: Live Classroom Playback
- Slide renderer + scene renderers + stage (`components/slide-renderer/`, `stage/`)
- Audio narration (Azure voices, TTS) and transcription
- Real-time chat with the classroom agent (`/api/chat`, `components/chat/`)

### Priority 4: Assessment & PBL
- Quiz generation + auto-grading (`/api/quiz-grade`)
- Project-Based Learning flows (`/api/pbl`, `lib/pbl/`)
- Roundtable multi-agent debates (`components/roundtable/`)

### Priority 5: Export & Admin
- PPTX / PDF / JSON export (`packages/pptxgenjs`, `packages/mathml2omml`, `lib/export/`)
- Admin console (`app/admin/`, `components/admin/`) for provider routing & quota overrides

---

## API Conventions

V-CLASS exposes two API surfaces:

1. **Internal Next.js route handlers** (`app/api/*`) — consumed only by the V-CLASS browser
   client. They are NOT a public API.
2. **Server-side calls to Core / Billing** — must follow Core's envelope shape.

### Internal Response Shape
```ts
type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string; code?: string; details?: unknown };
```

### Streaming Responses
- LLM-streaming routes use the AI SDK's `streamText` / `streamObject` and emit Server-Sent
  Events; the browser consumes them with `@ai-sdk/react` hooks.
- Do not mix REST JSON and SSE in the same route.

### Datetime Handling
- All timestamps **UTC ISO-8601** (`...Z`) on the wire; format for display in the client.

### File Uploads
- Multipart `POST` to dedicated routes (`/api/parse-pdf`, `/api/classroom-media/*`); validate
  size + MIME server-side; never trust client-reported MIME alone.

---

## Service & Hook Patterns

### Server Route Handler (thin — validates, delegates, streams)
```ts
// app/api/generate-classroom/route.ts
export async function POST(req: Request) {
  const session = await requireSession(req);
  await assertTokenBalance(session.userId, { needed: 1 });
  const dto = generateClassroomSchema.parse(await req.json());
  const stream = generateClassroomGraph.stream({ ...dto, userId: session.userId });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}
```

### Domain Module (orchestration lives in `lib/`, not in routes)
```ts
// lib/orchestration/generate-classroom-graph.ts
export const generateClassroomGraph = new StateGraph(ClassroomState)
  .addNode("plan", planNode)
  .addNode("draft", draftNode)
  .addNode("polish", polishNode)
  .addEdge("plan", "draft")
  .addEdge("draft", "polish")
  .compile();
```

### Client Hook (consumes the stream)
```tsx
// components/generation/use-classroom-generation.ts
export function useClassroomGeneration() {
  const { messages, append, isLoading } = useChat({ api: "/api/generate-classroom" });
  // ...
}
```

---

## State Management (Database, Cache, Sessions)

- **Server-side persistence:** filesystem under `data/classrooms/` and `data/classroom-jobs/`
  for classroom artifacts and long-running job state (the source of truth lives in Core; this
  is a working cache + draft store).
- **Client-side persistence:** **Dexie / IndexedDB** for offline classroom drafts and the
  generation timeline (`lib/storage/`).
- **In-memory state:** **Zustand** stores (`lib/store/`, `lib/stores/`) with Immer for the
  active classroom, playback position, and agent panels.
- **Sessions:** httpOnly cookie holding the Core JWT + minimal user metadata. Stateless on
  the server beyond that.
- **No client-side cache of LLM provider keys.** Ever.

---

## Security Rules (built-in, not bolt-on)

- **AGPL-3.0 compliance:** preserve license headers and `LICENSE` / `OpenMAIC Commercial
  Licensing and Cooperation Statement.pdf`. Any new file derived from upstream must keep its
  license notice.
- **Provider API keys are server-only.** They are read in route handlers / server actions
  from env. They MUST NOT be exposed via `NEXT_PUBLIC_*` or shipped in the client bundle.
- **CSP & headers:** keep Next.js security headers strict; do not relax for convenience.
- **Token quota gating:** every route that calls an LLM provider must call
  `assertTokenBalance` (or its successor) before dispatching the call. Bypassing this is a
  billing leak.
- **PII in prompts:** sanitize student PII from prompts and tool inputs before sending to
  third-party LLMs.
- **PDF parsing & uploads:** validate size + MIME server-side, run in isolated paths, never
  pass user file paths to shell commands.
- **MCP servers:** treat any external MCP tool as untrusted; never auto-execute tool calls
  that mutate Core/Billing state without explicit user confirmation.
- **Rate-limiting:** apply per-user limits on generation and chat routes — outbound spend is
  unbounded otherwise.

---

## Deployment

### Build & Run
```bash
pnpm install                                  # workspace install + postinstall builds packages/*
pnpm dev                                      # next dev
pnpm build                                    # next build (verify before merge)
pnpm start                                    # next start (production)
```

### Workspace Note (CRITICAL)
- `packages/mathml2omml` and `packages/pptxgenjs` are built by the `postinstall` script.
  If their source changes, **re-run `pnpm install`** so consumers pick up the rebuild.

### Environment
- LLM provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`), Core base URL,
  service shared secrets, and Azure voice keys must be set in env. Validate via the
  `/api/verify-*-provider` routes during pre-deploy smoke tests.

### Docker
```bash
docker compose up --build
```

---

## Key Files in the Project

| File | Purpose |
|------|---------|
| [package.json](package.json) | Scripts, AI SDK + LangGraph + CopilotKit deps, license AGPL-3.0 |
| [pnpm-workspace.yaml](pnpm-workspace.yaml) | Workspace packages (`mathml2omml`, `pptxgenjs`) |
| [next.config.ts](next.config.ts) | Next.js config (image domains, experimental flags) |
| [proxy.ts](proxy.ts) | Dev-time proxy to Core / Symfony |
| [app/api/generate-classroom/](app/api/generate-classroom/) | Long-running curriculum → classroom orchestrator |
| [app/api/chat/](app/api/chat/) | Streaming classroom chat |
| [app/api/symfony/](app/api/symfony/) | Bridge routes to V-SCHL Core |
| [lib/ai/](lib/ai/) | Provider registry, model routing, tool schemas |
| [lib/orchestration/](lib/orchestration/) | LangGraph state graphs |
| [lib/auth/](lib/auth/) | Session + Core JWT exchange |
| [configs/theme.ts](configs/theme.ts) | Visual theme tokens |
| [e2e/](e2e/) | Playwright suites |

---

## Code Quality Verification (MANDATORY)

**After EVERY code modification, run these checks before claiming work is done:**

```bash
# Lint & format
pnpm lint
pnpm check                # prettier --check

# Type-check + production build
pnpm build

# Tests
pnpm test                 # vitest run
pnpm test:e2e             # playwright test (when touching user-flow code)
```

### Zero-Tolerance Rules
- **No `NEXT_PUBLIC_*` provider keys.** No `process.env.*_API_KEY` reads in client components.
- **No LLM route without `assertTokenBalance`** (or its successor quota gate).
- **No `any` in route handlers.** Validate request bodies with a schema (Zod / a typed parser).
- **No raw `fetch` from the browser to LLM providers** — always proxy through `app/api/*`.
- **No client-side import from `lib/server/*`** — Next.js will error; respect the boundary.
- **No filesystem writes outside `data/`** in server code; that directory is the only sandbox.
- **No hardcoded user-facing text** — route through `lib/i18n/`.
- **No editing `packages/*` outputs by hand** — they are rebuilt by `postinstall`.

---

## Working With Sibling Services

- **V-SCHL-CORE** (`../V-SCHL-CORE/`) — identity & academic source of truth. V-CLASS consumes
  Core's `/api/v1/auth/*`, student/course endpoints, and the `tokens` projection. The
  integration contract lives in
  [../V-SCHL-CORE/docs/openmaic-integration-guide.md](../V-SCHL-CORE/docs/openmaic-integration-guide.md).
- **V-SCHL-BILLING** (`../V-SCHL-BILLING/`) — entitlement & money. V-CLASS does **not** call
  Billing directly. It reads token balances through Core's projection of Billing's
  `tokens.granted` webhook.
- **V-HUB** (`../V-HUB/`) — control plane. Not called from V-CLASS today; future federation
  may flow through Hub.
- **V-SCHL-PORTAL** (`../V-SCHL-PORTAL/`) — student portal. Top-up purchases happen in
  Portal; V-CLASS sees the resulting balance through Core.
- **V-SCHL-WEBSITE** — marketing site only; no integration.

Cross-service contracts: snake_case JSON, ISO-8601 UTC, Bearer JWT issued by Core.

---

## Decision Making

When unsure about an implementation choice:

1. **Secrets stay server-side.** If a change would even *enable* shipping a provider key to
   the browser, redesign.
2. **Quota before LLM.** Every code path that costs money must check entitlement first.
3. **Streaming over blocking.** Long-running generation must stream incrementally; do not
   buffer a 60-second response.
4. **Idempotent generation jobs.** Generation jobs in `data/classroom-jobs/` must be safe to
   resume after a server restart.
5. **Localization first.** All learner-facing strings go through `lib/i18n/` — French and
   English at minimum.
6. **Respect the package boundary.** App code lives in `app/`, `components/`, `lib/`. Generic
   library code that could be reused belongs in `packages/*`.
7. **AGPL compliance.** Derivative work obligations apply — never remove upstream attribution
   or license headers.
8. **Consistency.** Follow patterns in the surrounding folder. Thin route handlers, fat
   `lib/` modules, schema-validated inputs, typed clients.


---

## ⚠️ UI/UX FOUNDATION — MANDATORY FOR ALL INTERFACE WORK

Every UI implementation in this project — new page, redesign, component, flow, form, empty state, error state, upgrade/paywall, onboarding, or button/prompt copy — **MUST** be grounded in the **`ux-psychology-principles`** skill (`.claude/skills/ux-psychology-principles/SKILL.md`). This is the **non-negotiable core foundation**, not optional garnish.

Its six behavioral-psychology principles are the default design lens:

1. **Smart Defaults** — pre-fill every field with the likely choice; turn "fill from scratch" into "scan & adjust."
2. **Goal Gradient** — never start progress at 0%; credit an action already taken as step one.
3. **Reciprocity** — deliver real value *before* asking for signup/email.
4. **IKEA Effect** — let users build/customize/invest *before* the registration gate.
5. **Loss Aversion** — frame CTAs around what inaction truthfully costs, not abstract gains.
6. **Contrast / Anchoring** — never show a price in isolation; give every cost an honest relative frame.

**Ethical guardrail:** apply these to reduce friction and communicate value honestly — never to deceive, fabricate urgency, or trap users.

### How to apply on every UI task
1. **Foundation first** — apply `ux-psychology-principles` as the core lens before anything else.
2. **Then shape the craft** — layer these design skills on top for execution quality:
   - **`frontend-design`** — distinctive, intentional visual direction (never templated defaults).
   - **`impeccable`** — visual hierarchy, spacing, typography, color, motion, accessibility, responsive polish.
   - **`emil-design-eng`** — component-level detail, interaction feel, the invisible polish that makes UI feel great.
3. **Review before "done"** — run the **UX Psychology Design Review Checklist** at the end of the skill. For each principle: apply it, or explicitly note why it doesn't apply to this screen.

This foundation applies to **all** V-SCHL surfaces (Core, HUB, Portal, AI Classroom, Website, Admin) — apply it biblically.

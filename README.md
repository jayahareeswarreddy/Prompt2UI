# Deterministic UI Builder

**Live demo → [prompt2-ui-tau.vercel.app](https://prompt2-ui-tau.vercel.app/)**

Describe an interface in plain English and watch it render — but without a language
model inventing markup. Every screen this app produces is assembled from a fixed,
audited component set, so the same prompt always yields the same UI.

---

## The idea

Most "prompt to UI" tools hand the whole problem to an LLM and hope the output
compiles. That gives you three failure modes: the generated code breaks, the visual
language drifts from your design system, and nobody can explain why the model chose
what it chose.

This project takes the opposite position. The prompt only decides **which approved
components to use and how to configure them** — it never writes raw markup or CSS. The
result is a UI generator that is reproducible, reviewable, and impossible to break with
a bad prompt.

That constraint is the whole point. A model that cannot freestyle cannot hallucinate a
broken layout.

## How it works

```
prompt ──► planner ──► validator ──► generator ──► preview
                │                         │
                └──────► explainer ◄──────┘
                              │
                         version history
```

| Stage | What it does |
| --- | --- |
| **Planner** | Reads the prompt and derives a structured `UIPlan` — layout, tone, component list, and content. Carries the previous plan forward so edits are incremental rather than starting over. |
| **Validator** | Rejects any plan with an unknown component, a missing layout or tone, an empty component list, or no title. Nothing reaches the renderer unvalidated. |
| **Generator** | Turns the approved plan into JSX, composed only from whitelisted components. |
| **Explainer** | Writes a plain-English justification for each structural decision, so the output is auditable rather than magic. |
| **Versioning** | Every run is snapshotted. You can diff, roll back, and keep iterating without fear. |

### The component whitelist

```
AppShell  TopNav  Sidebar  KPIGrid  LineChartCard
BarChartCard  DataTable  SettingsModal  EmptyState
```

Anything outside this set is refused at validation time with a named error. Custom CSS
is deliberately blocked — it is the main way generated UIs drift away from a design
system.

### Layouts

Three layout families are recognised — `dashboard`, `landing`, and `settings` — each
with four tones (`minimal`, `bold`, `playful`, `enterprise`). The planner infers both
from the prompt, and you can pin a heading explicitly with `title:` or `name:`.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI primitives, wouter
  for routing, TanStack Query for client state
- **Server:** Node.js, Express, TypeScript — bundled with esbuild for fast cold starts
- **Build:** a single `script/build.ts` that runs the Vite client build and the esbuild
  server bundle together
- **Hosting:** Vercel

The planner, validator, generator, and explainer are **pure TypeScript functions with
no network calls and no API keys**. The pipeline is deterministic by construction, not
by prompt engineering — which is why the demo needs no backend and no credentials to
run.

## Running it locally

```bash
git clone https://github.com/jayahareeswarreddy/Prompt2UI.git
cd Prompt2UI
npm install
```

The generation pipeline is entirely client-side, so the quickest way in is the Vite dev
server:

```bash
npm run dev:client        # http://localhost:5000
```

To run the Express host as well:

```bash
npm run dev               # development, via tsx
npm run build && npm start  # production bundle
```

Type-check with `npm run check`.

## Project structure

```
client/src/
  pages/ui-studio.tsx   the full pipeline — planner, validator,
                        generator, explainer, preview, history
  components/ui/        Radix-based component library
server/
  index.ts              Express host + request logging
  static.ts             serves the built client with SPA fallback
script/build.ts         Vite client build + esbuild server bundle
shared/schema.ts        shared types
```

## Design notes

**Why rules instead of a model?** Because the interesting problem is not generating a
UI — it is generating one you can ship. Determinism buys reproducible output, zero
inference cost and latency, no API key in the demo, and a validator that gives a
precise reason whenever a plan is rejected.

**Where a model would fit.** The planner is a single function with a typed input and a
typed output, so an LLM could replace it tomorrow — emitting a `UIPlan` as a structured
response. The validator, whitelist, and version history would stay exactly as they are,
which is the point: the safety rails live outside the model, so swapping the planner
never widens the blast radius.

## Roadmap

- [ ] Optional LLM planner behind the existing validator, via structured outputs
- [ ] Export the generated plan as a real `.tsx` file
- [ ] More layout families and a user-extensible component registry
- [ ] Side-by-side version diffing

## License

MIT

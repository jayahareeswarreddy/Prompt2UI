import React, { useMemo, useRef, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ALLOWED_COMPONENTS,
  PARTS,
  SUBJECTS,
  TONES,
  composePrompt,
  describePlan,
  planner,
  validatePlan,
  type ComponentName,
  type PlanTrace,
  type UIPlan,
} from "@/lib/planner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Terminal,
  Code2,
  Eye,
  FileClock,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  ts: number;
};

type UIModel = {
  plan: UIPlan;
  code: string;
  explanation: string;
};


function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function now() {
  return Date.now();
}

function clampText(s: string, max = 5000) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function generator(plan: UIPlan): { code: string } {
  const chosen = plan.components;
  const lines: string[] = [];
  lines.push(`// Generated deterministically from the plan`);
  lines.push(`const plan = ${JSON.stringify(plan, null, 2)};`);
  lines.push("");
  lines.push("<AppShell>");
  if (chosen.includes("TopNav")) lines.push("  <TopNav title={plan.content.title} subtitle={plan.content.subtitle} />");
  lines.push("  <main>");
  if (chosen.includes("Sidebar")) lines.push("    <Sidebar />");
  lines.push("    <section>");
  if (chosen.includes("KPIGrid")) lines.push("      <KPIGrid items={plan.content.kpis} />");
  if (chosen.includes("LineChartCard")) lines.push("      <LineChartCard />");
  if (chosen.includes("BarChartCard")) lines.push("      <BarChartCard />");
  if (chosen.includes("DataTable"))
    lines.push("      <DataTable columns={plan.content.table?.columns} rows={plan.content.table?.rows} />");
  if (chosen.includes("EmptyState")) lines.push("      <EmptyState />");
  if (chosen.includes("SettingsModal")) lines.push("      <SettingsModal />");
  lines.push("    </section>");
  lines.push("  </main>");
  lines.push("</AppShell>");

  return { code: lines.join("\n") };
}

function explainer(plan: UIPlan): string {
  const parts: string[] = [];
  parts.push(`Layout: ${plan.layout}. Tone: ${plan.tone}.`);

  if (plan.components.includes("Sidebar")) {
    parts.push("Sidebar was selected for predictable navigation structure.");
  }
  if (plan.components.includes("KPIGrid")) {
    parts.push("KPI grid surfaces key metrics at a glance without custom styling.");
  }
  if (plan.components.includes("DataTable")) {
    parts.push("Table is used for structured information and deterministic rendering.");
  }
  if (plan.components.includes("SettingsModal")) {
    parts.push("Settings modal enables iterative changes while keeping a strict component whitelist.");
  }

  parts.push("All output is constrained to a fixed set of components for consistency and safety.");
  return parts.join(" ");
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="relative">
      <pre
        className={cn(
          "ui-mono ui-inset-ring ui-focus ui-surface",
          "rounded p-4 text-[12px] leading-relaxed",
          "overflow-auto max-h-[60vh]",
        )}
        tabIndex={0}
        data-testid="code-generated"
      >
        <code>{value}</code>
      </pre>
    </div>
  );
}

/**
 * A real chart, drawn from a seeded series.
 *
 * The cards previously showed an empty gradient rectangle, which read as
 * a component that had failed to load. The series is derived from the
 * plan's subject, so the same plan always draws the same chart - the
 * determinism promise has to hold for the pictures too.
 */
function seededSeries(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(28 + (Math.abs(h) % 68));
  }
  return out;
}

function MiniChart({ kind, seed }: { kind: "line" | "bar"; seed: string }) {
  const count = kind === "line" ? 16 : 7;
  const values = seededSeries(seed, count);
  const w = 320;
  const h = 110;
  const pad = 6;
  const max = Math.max(...values) + 8;

  if (kind === "bar") {
    const slot = (w - pad * 2) / values.length;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img"
           aria-label={`Bar chart with ${values.length} bars`} data-testid="svg-bar">
        {values.map((v, i) => {
          const bh = (v / max) * (h - pad * 2);
          return (
            <rect
              key={i}
              x={pad + i * slot + slot * 0.18}
              y={h - pad - bh}
              width={slot * 0.64}
              height={bh}
              rx="1"
              className="fill-accent"
              opacity={0.55 + (i % 3) * 0.15}
            />
          );
        })}
      </svg>
    );
  }

  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img"
         aria-label={`Line chart with ${values.length} points`} data-testid="svg-line">
      <polygon points={area} className="fill-primary" opacity="0.12" />
      <polyline points={line} fill="none" strokeWidth="2" strokeLinejoin="round"
                strokeLinecap="round" className="stroke-primary" />
      {pts.map((pt, i) => (
        <circle key={i} cx={pt[0]} cy={pt[1]} r="2" className="fill-primary" opacity="0.8" />
      ))}
    </svg>
  );
}

function PreviewMock({ model }: { model: UIModel }) {
  const plan = model.plan;

  // AppShell and TopNav draw chrome, not content. A plan holding only
  // those rendered a completely blank panel, which is what made a
  // restored early version look like a broken rollback.
  const BODY_COMPONENTS = ["KPIGrid", "LineChartCard", "BarChartCard", "DataTable", "EmptyState"];
  const hasBody = plan.components.some((c) => BODY_COMPONENTS.includes(c));

  // Token-based so each tone reads in both themes, and so the four tones
  // are actually distinguishable - the old values (white/70, /65, /60,
  // /60) were indistinguishable in light mode and invisible in dark.
  const toneClasses =
    plan.tone === "minimal"
      ? "bg-card"
      : plan.tone === "enterprise"
        ? "bg-muted/70"
        : plan.tone === "playful"
          ? "bg-accent/10"
          : "bg-primary/5";

  return (
    <div
      className={cn("rounded ui-surface ui-inset-ring overflow-hidden", "min-h-[520px]")}
      data-testid="preview-root"
    >
      <div className={cn("p-4 border-b", toneClasses)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-title text-lg" data-testid="text-preview-title">
              {plan.content.title}
            </div>
            {plan.content.subtitle ? (
              <div className="text-sm text-muted-foreground" data-testid="text-preview-subtitle">
                {plan.content.subtitle}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="badge-layout">
              {plan.layout}
            </Badge>
            <Badge variant="outline" data-testid="badge-tone">
              {plan.tone}
            </Badge>
          </div>
        </div>
      </div>

      {plan.components.includes("TopNav") ? (
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          data-testid="panel-topnav"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
          <span className="text-xs font-medium">{plan.content.title}</span>
          <span className="ml-auto ui-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {plan.components.length} components
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-12">
        {plan.components.includes("Sidebar") ? (
          <div className="col-span-12 md:col-span-3 border-r p-3" data-testid="panel-sidebar">
            <div className="text-xs text-muted-foreground mb-2">Navigation</div>
            <div className="space-y-1">
              {(plan.content.nav ?? ["Overview", "Reports", "Alerts", "Settings"]).map((x) => (
                <button
                  key={x}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 text-sm",
                    "hover:bg-muted transition-colors",
                  )}
                  data-testid={`button-nav-${x.toLowerCase()}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            plan.components.includes("Sidebar") ? "col-span-12 md:col-span-9" : "col-span-12",
            "p-4",
          )}
          data-testid="panel-main"
        >
          {plan.components.includes("KPIGrid") && plan.content.kpis ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="grid-kpis">
              {plan.content.kpis.map((k, idx) => (
                <div
                  key={k.label}
                  className="rounded ui-inset-ring bg-card/70 p-3"
                  data-testid={`card-kpi-${idx}`}
                >
                  <div className="text-xs text-muted-foreground" data-testid={`text-kpi-label-${idx}`}>
                    {k.label}
                  </div>
                  <div className="text-lg font-semibold" data-testid={`text-kpi-value-${idx}`}>
                    {k.value}
                  </div>
                  {k.delta ? (
                    <div className="text-xs text-muted-foreground" data-testid={`text-kpi-delta-${idx}`}>
                      {k.delta}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4" data-testid="grid-charts">
            {plan.components.includes("LineChartCard") ? (
              <div className="rounded ui-inset-ring bg-card/70 p-3" data-testid="card-line-chart">
                <div className="text-sm font-medium mb-2">{plan.content.lineTitle ?? "Trend"}</div>
                <MiniChart kind="line" seed={`${plan.domain}-line`} />
              </div>
            ) : null}
            {plan.components.includes("BarChartCard") ? (
              <div className="rounded ui-inset-ring bg-card/70 p-3" data-testid="card-bar-chart">
                <div className="text-sm font-medium mb-2">{plan.content.barTitle ?? "Breakdown"}</div>
                <MiniChart kind="bar" seed={`${plan.domain}-bar`} />
              </div>
            ) : null}
          </div>

          {plan.components.includes("DataTable") && plan.content.table ? (
            <div className="rounded ui-inset-ring bg-card/70 p-3" data-testid="card-table">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium">Spec</div>
                <Badge variant="secondary" data-testid="badge-safe">
                  whitelist
                </Badge>
              </div>
              <div className="overflow-auto">
                <Table data-testid="table-preview">
                  <TableHeader>
                    <TableRow>
                      {plan.content.table.columns.map((c, i) => (
                        <TableHead key={c} data-testid={`th-${i}`}>
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.content.table.rows.map((r, ri) => (
                      <TableRow key={ri} data-testid={`tr-${ri}`}>
                        {r.map((cell, ci) => (
                          <TableCell key={ci} data-testid={`td-${ri}-${ci}`}>
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {plan.components.includes("EmptyState") ? (
            <div className="mt-4 rounded ui-inset-ring bg-card/60 p-6 text-center" data-testid="empty-state">
              <div className="ui-title text-xl">No data yet</div>
              <div className="text-sm text-muted-foreground mt-1">Ask for a table or metrics in chat.</div>
            </div>
          ) : null}

          {!hasBody ? (
            <div
              className="rounded ui-inset-ring bg-muted/40 p-8 text-center"
              data-testid="preview-no-body"
            >
              <div className="text-sm font-medium">This plan is only a shell</div>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                It holds {plan.components.join(" and ")} — chrome, but nothing to put inside.
                Ask for a sidebar, charts or a table to fill it.
              </p>
            </div>
          ) : null}

          {plan.components.includes("SettingsModal") ? (
            <div className="mt-4" data-testid="settings-inline">
              <Button variant="secondary" data-testid="button-open-settings">
                Open settings (mock)
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VersionDialog({
  versions,
  currentId,
  onRestore,
}: {
  versions: Array<{ id: string; label: string; prompt: string; ts: number }>;
  currentId: string;
  onRestore: (id: string) => void;
}) {
  // Uncontrolled, the dialog stayed open over the preview after a restore,
  // so the restore looked like it had done nothing.
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2" data-testid="button-versions">
          <FileClock className="h-4 w-4" />
          Versions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" data-testid="dialog-versions">
        <DialogHeader>
          <DialogTitle>Rollback</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          Every generation is kept. Restoring one replaces the current preview and code.
        </div>
        <Separator className="my-3" />
        <div className="space-y-2 max-h-[50vh] overflow-auto" data-testid="list-versions">
          {versions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No versions yet.</div>
          ) : (
            versions
              .slice()
              .reverse()
              .map((v) => (
                <button
                  key={v.id}
                  className={cn(
                    "w-full text-left rounded p-3 ui-inset-ring",
                    "hover:bg-muted/60 transition-colors",
                  )}
                  onClick={() => {
                    onRestore(v.id);
                    setOpen(false);
                  }}
                  data-testid={`button-restore-${v.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="ui-mono text-xs text-muted-foreground tabular-nums">
                          v{Number(v.id) + 1}
                        </span>
                        <span className="font-medium" data-testid={`text-version-label-${v.id}`}>
                          {v.label}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-sm text-muted-foreground" title={v.prompt}>
                        {v.prompt}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-version-ts-${v.id}`}>
                        {new Date(v.ts).toLocaleTimeString()}
                      </div>
                    </div>
                    {v.id === currentId ? (
                      <Badge data-testid={`badge-current-${v.id}`}>Current</Badge>
                    ) : (
                      <Badge variant="outline">Restore</Badge>
                    )}
                  </div>
                </button>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type VersionEntry = { model: UIModel; ts: number; prompt: string };

/** Starting points, so the first run is one click rather than a blank box. */
const PROMPT_EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Analytics dashboard",
    prompt: "Create a dashboard with a sidebar, KPIs, a line chart and a table. Keep it minimal.",
  },
  {
    label: "Revenue report",
    prompt: "Enterprise dashboard with a bar chart for revenue, KPIs and a sales table.",
  },
  {
    label: "Settings screen",
    prompt: "A settings page with a modal for preferences and a table of options.",
  },
  {
    label: "Landing page",
    prompt: "A playful landing page with a hero and a pricing table. title: Prompt2UI",
  },
  {
    label: "Empty state",
    prompt: "Dashboard with a sidebar but no data yet, show an empty state.",
  },
];

type StageState = "idle" | "running" | "ok" | "blocked";

type Stages = {
  planner: StageState;
  validator: StageState;
  generator: StageState;
  explainer: StageState;
};

const IDLE_STAGES: Stages = {
  planner: "idle",
  validator: "idle",
  generator: "idle",
  explainer: "idle",
};

const STAGE_COPY: { key: keyof Stages; name: string; note: string }[] = [
  { key: "planner", name: "Planner", note: "Prompt becomes a structured plan" },
  { key: "validator", name: "Validator", note: "Rejects anything off the whitelist" },
  { key: "generator", name: "Generator", note: "Composes approved components only" },
  { key: "explainer", name: "Explainer", note: "Writes down why, in English" },
];

/**
 * The pipeline, made visible.
 *
 * This is the product's whole argument - a prompt cannot reach the
 * renderer without passing a validator - and it was previously stated
 * once in a subtitle and never shown. Each stage reports its real
 * outcome; a blocked run stops at the validator and says so.
 */
function PipelineRail({ stages }: { stages: Stages }) {
  return (
    <ol
      className="flex flex-wrap items-stretch gap-px overflow-hidden rounded ui-inset-ring bg-border"
      data-testid="rail-pipeline"
      aria-label="Generation pipeline"
    >
      {STAGE_COPY.map((stage, index) => {
        const state = stages[stage.key];
        const tone =
          state === "blocked"
            ? "text-destructive"
            : state === "ok"
              ? "text-[hsl(var(--success))]"
              : state === "running"
                ? "text-accent ui-running"
                : "text-muted-foreground";

        return (
          <li
            key={stage.key}
            className="flex min-w-[9.5rem] flex-1 flex-col gap-1 bg-card px-3 py-2.5"
            data-testid={`stage-${stage.key}`}
            data-state={state}
          >
            <div className="flex items-center gap-2">
              <span className={cn("ui-mono text-[11px] tabular-nums", tone)}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium">{stage.name}</span>
              <span className={cn("ml-auto ui-mono text-[10px] uppercase tracking-wider", tone)}>
                {state === "idle" ? "ready" : state}
              </span>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">{stage.note}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function UIStudio() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // Side-by-side panels are unusable at phone width, so they stack there.
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid("m"),
      role: "assistant",
      content:
        "Describe a UI (e.g. ‘Create a dashboard with a sidebar, charts, and a table’). I’ll produce a plan, deterministic code, and a preview — and you can iterate safely.",
      ts: now(),
    },
  ]);

  const [prompt, setPrompt] = useState<string>(
    "Create a dashboard with a sidebar, charts, and a table. Make it minimal and add a settings modal.",
  );

  const initialPlan = useMemo<UIPlan>(
    () => planner("A minimal dashboard with a sidebar, KPIs, a trend chart and a table.").plan,
    [],
  );

  const [model, setModel] = useState<UIModel>(() => {
    const plan = initialPlan;
    const validation = validatePlan(plan);
    const safePlan = validation.ok ? plan : planner("dashboard").plan;
    const code = generator(safePlan).code;
    const explanation = explainer(safePlan);
    return { plan: safePlan, code, explanation };
  });

  // A version used to be a bare model, so the history showed identical
  // labels and timestamps invented from the first chat message.
  const [versions, setVersions] = useState<VersionEntry[]>(() => [
    { model, ts: now(), prompt: "Starting plan" },
  ]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Stages>(IDLE_STAGES);
  const [trace, setTrace] = useState<PlanTrace | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);

  // The builder's choices. They compose a sentence which goes through the
  // same planner as typed text, so clicking and typing cannot diverge.
  const [subject, setSubject] = useState<string | null>("support");
  const [parts, setParts] = useState<ComponentName[]>([
    "Sidebar",
    "KPIGrid",
    "LineChartCard",
    "DataTable",
  ]);
  const [toneChoice, setToneChoice] = useState<UIPlan["tone"]>("minimal");
  const composed = useMemo(
    () => composePrompt(subject, parts, toneChoice),
    [subject, parts, toneChoice],
  );

  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  function pushMessage(role: Role, content: string) {
    setMessages((m) => [...m, { id: uid("m"), role, content: clampText(content, 3000), ts: now() }]);
    setTimeout(() => {
      const el = chatViewportRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 50);
  }

  function runAgent(userText: string, mode: "generate" | "modify") {
    setError(null);
    setStages({ ...IDLE_STAGES, planner: "running" });

    const { plan: nextPlan, trace } = planner(userText, mode === "modify" ? model.plan : undefined);
    setTrace(trace);
    const validation = validatePlan(nextPlan);

    if (!validation.ok) {
      // The run really does stop here, so the rail stops here too.
      setStages({ ...IDLE_STAGES, planner: "ok", validator: "blocked" });
      setError(validation.error);
      setLastReply(null);
      pushMessage("assistant", `Blocked: ${validation.error}`);
      return;
    }

    const nextCode = generator(nextPlan).code;
    const nextExplanation = explainer(nextPlan);

    const nextModel: UIModel = {
      plan: nextPlan,
      code: nextCode,
      explanation: nextExplanation,
    };

    setModel(nextModel);
    setVersions((v) => {
      // An unchanged plan is not a new version; the history filled up with
      // duplicates that were impossible to tell apart.
      const last = v[v.length - 1];
      if (last && JSON.stringify(last.model.plan) === JSON.stringify(nextModel.plan)) {
        setCurrentVersion(v.length - 1);
        return v;
      }
      setCurrentVersion(v.length);
      return [...v, { model: nextModel, ts: now(), prompt: userText.trim() || "(empty prompt)" }];
    });

    // Every stage below already ran synchronously and these are their real
    // outcomes; the delays only let the eye follow the order.
    setStages({ ...IDLE_STAGES, planner: "ok", validator: "running" });
    window.setTimeout(
      () => setStages({ ...IDLE_STAGES, planner: "ok", validator: "ok", generator: "running" }),
      110,
    );
    window.setTimeout(
      () =>
        setStages({
          ...IDLE_STAGES,
          planner: "ok",
          validator: "ok",
          generator: "ok",
          explainer: "running",
        }),
      220,
    );
    window.setTimeout(
      () => setStages({ planner: "ok", validator: "ok", generator: "ok", explainer: "ok" }),
      330,
    );

    // Plain English. Component names are an implementation detail and mean
    // nothing to someone who did not write this code.
    const summary = describePlan(nextPlan);
    setLastReply(`Built it. ${summary}`);
    pushMessage("assistant", summary);

    // Only worth mentioning when enough was missed to explain a surprise.
    if (trace.ignored.length >= 2) {
      pushMessage(
        "assistant",
        `I did not understand ${trace.ignored.slice(0, 6).join(", ")} — so nothing on screen came from those words.`,
      );
    }
  }

  const versionItems = versions.map((v, idx) => ({
    id: String(idx),
    label: `${v.model.plan.layout} · ${v.model.plan.tone} · ${v.model.plan.components.length} components`,
    prompt: v.prompt,
    ts: v.ts,
  }));

  function restoreByIndex(indexId: string) {
    const idx = Number(indexId);
    const entry = versions[idx];
    if (!entry) return;
    setModel(entry.model);
    setCurrentVersion(idx);
    setError(null);
    setStages({ planner: "ok", validator: "ok", generator: "ok", explainer: "ok" });
    pushMessage(
      "assistant",
      `Went back to version ${idx + 1}: ${describePlan(entry.model.plan).toLowerCase()}`,
    );
    setLastReply(`Restored version ${idx + 1}. ${describePlan(entry.model.plan)}`);
  }

  return (
    <div
      className={cn("min-h-screen", theme === "dark" ? "dark" : "", "ui-grid")}
      data-testid="page-ui-studio"
    >
      <div className="relative border-b bg-card/70 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 py-6">
          <div className="flex flex-wrap items-start justify-between gap-6" data-enter>
            <div className="max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 place-items-center rounded bg-primary text-primary-foreground"
                  aria-hidden="true"
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="ui-label">Prompt2UI</span>
              </div>

              <h1 className="ui-title mt-4 text-3xl leading-[1.1] sm:text-4xl" data-testid="text-app-title">
                Describe an interface.
                <br />
                Get the same one every time.
              </h1>

              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground" data-testid="text-app-subtitle">
                The prompt chooses which approved components to use and how to configure them — it
                never writes markup. Nine components are whitelisted; anything else is refused at
                validation with a named error.
              </p>
            </div>

            <div className="flex flex-1 flex-col items-stretch gap-4 lg:max-w-sm">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  className="gap-2 ui-press"
                  onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                  data-testid="button-toggle-theme"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {theme === "light" ? "Dark" : "Light"}
                </Button>

                <VersionDialog
                  versions={versionItems}
                  currentId={String(currentVersion)}
                  onRestore={(id) => restoreByIndex(id)}
                />
              </div>

              {/* The constraint is the product. Showing the whole allowed
                  set is the most direct way to say what cannot happen. */}
              <div className="rounded ui-inset-ring bg-card p-4" data-testid="panel-whitelist">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="ui-label">Component whitelist</span>
                  <span className="ui-mono text-xs tabular-nums text-muted-foreground">
                    {ALLOWED_COMPONENTS.length} allowed
                  </span>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {ALLOWED_COMPONENTS.map((name) => (
                    <li
                      key={name}
                      className="ui-mono rounded-sm bg-muted px-1.5 py-1 text-[11px] text-foreground/80"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-snug text-muted-foreground">
                  Custom CSS is blocked. A model that cannot freestyle cannot hallucinate a broken
                  layout.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <PipelineRail stages={stages} />
          </div>

          <div className="mt-4">
            <ResizablePanelGroup
              direction={isMobile ? "vertical" : "horizontal"}
              className={cn("rounded ui-surface ui-inset-ring", isMobile && "min-h-[150vh]")}
            >
              <ResizablePanel defaultSize={32} minSize={24} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Build your screen</div>
                    <p className="text-xs text-muted-foreground">
                      Pick what it is about and what goes on it.
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1" data-testid="badge-deterministic">
                    <ShieldCheck className="h-3 w-3" /> no AI
                  </Badge>
                </div>

                <Separator className="my-3" />

                <ScrollArea className="h-[56vh] pr-3" data-testid="scroll-builder">
                  <div className="space-y-5">
                    <div>
                      <div className="ui-label mb-2">1 · What is it about?</div>
                      <div className="flex flex-wrap gap-1.5" data-testid="list-subjects">
                        {SUBJECTS.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSubject(subject === s.id ? null : s.id)}
                            className={cn(
                              "rounded-sm px-2 py-1 text-xs transition-colors ui-inset-ring",
                              subject === s.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                            data-testid={`chip-subject-${s.id}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="ui-label mb-2">2 · What goes on it?</div>
                      <div className="grid gap-1.5" data-testid="list-parts">
                        {PARTS.map((part) => {
                          const on = parts.includes(part.component);
                          return (
                            <button
                              key={part.component}
                              type="button"
                              onClick={() =>
                                setParts((cur) =>
                                  cur.includes(part.component)
                                    ? cur.filter((c) => c !== part.component)
                                    : [...cur, part.component],
                                )
                              }
                              className={cn(
                                "flex items-start gap-2 rounded-sm px-2 py-1.5 text-left transition-colors ui-inset-ring",
                                on ? "bg-primary/10" : "bg-card hover:bg-muted",
                              )}
                              aria-pressed={on}
                              data-testid={`toggle-part-${part.component}`}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border",
                                )}
                                aria-hidden="true"
                              >
                                {on ? <Check className="h-3 w-3" /> : null}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-medium">{part.label}</span>
                                <span className="block text-[11px] leading-tight text-muted-foreground">
                                  {part.hint}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="ui-label mb-2">3 · Style</div>
                      <div className="flex flex-wrap gap-1.5" data-testid="list-tones">
                        {TONES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setToneChoice(t.id)}
                            className={cn(
                              "rounded-sm px-2 py-1 text-xs transition-colors ui-inset-ring",
                              toneChoice === t.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                            data-testid={`chip-tone-${t.id}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-sm bg-muted/50 p-3" data-testid="text-composed">
                      <div className="ui-label mb-1">This asks for</div>
                      <p className="text-sm leading-snug">{composed}</p>
                    </div>
                  </div>
                </ScrollArea>

                <div className="mt-3 space-y-2">
                  <Button
                    className="w-full gap-2 ui-press"
                    onClick={() => {
                      pushMessage("user", composed);
                      runAgent(composed, "generate");
                    }}
                    data-testid="button-generate"
                  >
                    <Wand2 className="h-4 w-4" />
                    Build it
                  </Button>

                  {lastReply ? (
                    <div
                      className="flex items-start gap-2 rounded-sm bg-[hsl(var(--success))]/10 px-3 py-2"
                      role="status"
                      data-testid="status-built"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
                      <span className="text-xs leading-snug">{lastReply}</span>
                    </div>
                  ) : null}

                  <details className="rounded-sm ui-inset-ring bg-card" data-testid="details-freeform">
                    <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
                      Or describe it in your own words
                    </summary>
                    <div className="space-y-2 border-t p-3">
                      <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. a support desk with open tickets and a bar chart, no sidebar"
                        className="min-h-[72px] resize-none text-sm"
                        data-testid="input-prompt"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-2 ui-press"
                          onClick={() => {
                            pushMessage("user", prompt);
                            runAgent(prompt, "generate");
                          }}
                          data-testid="button-generate-text"
                        >
                          Build from text
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-2 ui-press"
                          onClick={() => {
                            pushMessage("user", prompt);
                            runAgent(prompt, "modify");
                          }}
                          data-testid="button-modify"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refine current
                        </Button>
                      </div>
                    </div>
                  </details>

                  {error ? (
                    <div
                      className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      role="alert"
                      data-testid="status-error"
                    >
                      {error}
                    </div>
                  ) : null}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={68} minSize={38}>
                <Tabs defaultValue="preview" className="h-full">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <TabsList data-testid="tabs-right">
                      <TabsTrigger value="preview" className="gap-2" data-testid="tab-preview">
                        <Eye className="h-4 w-4" /> Preview
                      </TabsTrigger>
                      <TabsTrigger value="code" className="gap-2" data-testid="tab-code">
                        <Code2 className="h-4 w-4" /> Code
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Drag to resize
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <TabsContent value="preview" className="p-4" data-testid="panel-preview">
                    <PreviewMock model={model} />
                    <div className="mt-4 rounded-sm ui-inset-ring bg-muted/40 p-4" data-testid="text-summary">
                      <div className="ui-label mb-1">What this is</div>
                      <p className="text-sm leading-snug">{describePlan(model.plan)}</p>
                    </div>

                    <details className="mt-3 rounded-sm ui-inset-ring bg-card" data-testid="details-technical">
                      <summary className="cursor-pointer px-4 py-2.5 text-xs text-muted-foreground">
                        Technical details — the plan, the reasoning and the guardrails
                      </summary>
                      <div className="border-t p-4">
                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="grid-meta">
                      <Card className="p-4" data-testid="card-planner">
                        <div className="text-xs text-muted-foreground">Planner output</div>
                        <div className="mt-2 ui-mono text-xs whitespace-pre-wrap" data-testid="text-plan-json">
                          {JSON.stringify(model.plan, null, 2)}
                        </div>
                      </Card>
                      <Card className="p-4" data-testid="card-explainer">
                        <div className="text-xs text-muted-foreground">Explainer</div>
                        <div className="mt-2 text-sm" data-testid="text-explainer">
                          {model.explanation}
                        </div>
                      </Card>
                      <Card className="p-4" data-testid="card-guardrails">
                        <div className="text-xs text-muted-foreground">Guardrails</div>
                        <div className="mt-2 space-y-2 text-sm">
                          <div className="flex items-center justify-between" data-testid="row-guard-1">
                            <span>Whitelist</span>
                            <Badge variant="secondary">on</Badge>
                          </div>
                          <div className="flex items-center justify-between" data-testid="row-guard-2">
                            <span>Plan validation</span>
                            <Badge variant="secondary">on</Badge>
                          </div>
                          <div className="flex items-center justify-between" data-testid="row-guard-3">
                            <span>Safe render</span>
                            <Badge variant="secondary">mock</Badge>
                          </div>
                        </div>
                      </Card>
                    </div>
                      </div>
                    </details>
                  </TabsContent>

                  <TabsContent value="code" className="p-4" data-testid="panel-code">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" data-testid="badge-readonly">
                        generated
                      </Badge>
                      <Badge variant="outline" data-testid="badge-whitelist">
                        whitelist enforced
                      </Badge>
                    </div>
                    <CodeBlock value={model.code} />
                    <div className="mt-3 text-xs text-muted-foreground" data-testid="text-code-note">
                      Note: in this mockup the “code” is a deterministic template output. In a full app, this would be a
                      real editor + sandboxed render.
                    </div>
                  </TabsContent>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5" data-testid="card-feature-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded ui-surface ui-inset-ring grid place-items-center ui-lift">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold">Deterministic components</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The agent can only compose from a fixed component whitelist — no ad-hoc components or styling.
            </p>
          </Card>
          <Card className="p-5" data-testid="card-feature-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded ui-surface ui-inset-ring grid place-items-center ui-lift">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold">Three-step agent</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Planner chooses layout/components → Generator emits structured code → Explainer justifies decisions.
            </p>
          </Card>
          <Card className="p-5" data-testid="card-feature-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded ui-surface ui-inset-ring grid place-items-center ui-lift">
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold">Iteration & rollback</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Every run is versioned so you can undo safely and keep changes incremental.
            </p>
          </Card>
        </div>

        <div className="mt-6 rounded ui-surface ui-inset-ring p-5" data-testid="card-footer">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="ui-title text-xl">Try prompts like</div>
              <div className="text-sm text-muted-foreground mt-1">
                “Create a landing page with pricing cards”, “Add a bar chart”, “Make it enterprise”, “Show empty state”.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value="Create a dashboard with sidebar and table"
                readOnly
                className="max-w-[340px]"
                data-testid="input-example"
              />
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => {
                  setPrompt("Create a landing page with pricing and a features table. Make it bold.");
                }}
                data-testid="button-use-example"
              >
                Use
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded ui-inset-ring bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground" data-testid="text-disclaimer">
          <strong className="text-foreground">No model is involved.</strong> The planner is a set of
          rules that reads your prompt for known words and maps them onto the component whitelist —
          there is no LLM, no API key and no network call. That is the point: the same prompt
          produces the same interface every time, and the output can be audited line by line.
        </div>
      </div>
    </div>
  );
}

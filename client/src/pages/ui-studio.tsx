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
  planner,
  validatePlan,
  type PlanTrace,
  type UIPlan,
} from "@/lib/planner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
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
                <div className="h-36 rounded bg-gradient-to-b from-primary/20 to-transparent" />
              </div>
            ) : null}
            {plan.components.includes("BarChartCard") ? (
              <div className="rounded ui-inset-ring bg-card/70 p-3" data-testid="card-bar-chart">
                <div className="text-sm font-medium mb-2">{plan.content.barTitle ?? "Breakdown"}</div>
                <div className="h-36 rounded bg-gradient-to-b from-accent/35 to-transparent" />
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

    const removedNote = trace.removed.length ? ` Removed: ${trace.removed.join(", ")}.` : "";
    pushMessage(
      "assistant",
      `${nextPlan.layout} layout, ${nextPlan.tone} tone, subject "${nextPlan.domain}".
` +
        `Components: ${nextPlan.components.join(", ")}.${removedNote}`,
    );
    if (trace.ignored.length) {
      pushMessage(
        "assistant",
        `I did not act on: ${trace.ignored.join(", ")}. Those words are not in the planner's vocabulary.`,
      );
    }
    pushMessage("assistant", nextExplanation);
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
      `Restored v${idx + 1} — ${entry.model.plan.layout}, ${entry.model.plan.components.length} components.`,
    );
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
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Prompt</div>
                  </div>
                  <Badge variant="secondary" className="gap-1" data-testid="badge-deterministic">
                    <ShieldCheck className="h-3 w-3" /> deterministic
                  </Badge>
                </div>

                <Separator className="my-3" />

                <ScrollArea className="h-[52vh] pr-3" data-testid="scroll-chat">
                  <div ref={chatViewportRef} className="space-y-3" data-testid="list-messages">
                    {messages.map((m, i) => (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded p-3 ui-inset-ring",
                          m.role === "user" ? "bg-primary/8" : "bg-card/60",
                        )}
                        data-testid={`message-${m.role}-${i}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground">{m.role === "user" ? "You" : "Planner"}</div>
                          <div className="text-[11px] text-muted-foreground">{new Date(m.ts).toLocaleTimeString()}</div>
                        </div>
                        <div className="text-sm mt-2 whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="mt-3 space-y-2">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the UI you want…"
                    className="min-h-[88px] resize-none"
                    data-testid="input-prompt"
                  />

                  <div className="flex flex-wrap gap-1.5" data-testid="list-examples">
                    {PROMPT_EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        className="rounded-sm ui-inset-ring bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => {
                          setPrompt(ex.prompt);
                          pushMessage("user", ex.prompt);
                          runAgent(ex.prompt, "generate");
                        }}
                        data-testid={`button-example-${ex.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="gap-2 ui-press"
                      onClick={() => {
                        pushMessage("user", prompt);
                        runAgent(prompt, "generate");
                      }}
                      data-testid="button-generate"
                    >
                      <Wand2 className="h-4 w-4" />
                      Generate UI
                    </Button>

                    <Button
                      variant="secondary"
                      className="gap-2 ui-press"
                      onClick={() => {
                        pushMessage("user", prompt);
                        runAgent(prompt, "modify");
                      }}
                      data-testid="button-modify"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Modify UI
                    </Button>

                    <Button
                      variant="ghost"
                      className="gap-2 ui-press"
                      onClick={() => {
                        setPrompt("");
                      }}
                      data-testid="button-clear"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>

                  {error ? (
                    <div className="rounded bg-destructive/10 text-destructive px-3 py-2 text-sm" data-testid="status-error">
                      {error}
                    </div>
                  ) : null}

                  <div className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="text-safety">
                    Safety: component whitelist + plan validation before rendering.
                  </div>
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

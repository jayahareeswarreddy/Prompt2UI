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
  ArrowLeft,
  ArrowRight,
  Bot,
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

type UIPlan = {
  layout: "dashboard" | "landing" | "settings";
  tone: "minimal" | "bold" | "playful" | "enterprise";
  components: Array<
    | "AppShell"
    | "TopNav"
    | "Sidebar"
    | "KPIGrid"
    | "LineChartCard"
    | "BarChartCard"
    | "DataTable"
    | "SettingsModal"
    | "EmptyState"
  >;
  content: {
    title: string;
    subtitle?: string;
    kpis?: Array<{ label: string; value: string; delta?: string }>;
    table?: { columns: string[]; rows: string[][] };
  };
};

type UIModel = {
  plan: UIPlan;
  code: string;
  explanation: string;
};

const ALLOWED_COMPONENTS = new Set<string>([
  "AppShell",
  "TopNav",
  "Sidebar",
  "KPIGrid",
  "LineChartCard",
  "BarChartCard",
  "DataTable",
  "SettingsModal",
  "EmptyState",
]);

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function now() {
  return Date.now();
}

function clampText(s: string, max = 5000) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function validatePlan(plan: UIPlan): { ok: true } | { ok: false; error: string } {
  if (!plan?.layout || !plan.tone) return { ok: false, error: "Plan missing layout/tone." };
  if (!Array.isArray(plan.components) || plan.components.length === 0)
    return { ok: false, error: "Plan needs at least one component." };
  for (const c of plan.components) {
    if (!ALLOWED_COMPONENTS.has(c)) return { ok: false, error: `Component not allowed: ${c}` };
  }
  if (!plan.content?.title) return { ok: false, error: "Plan missing title." };
  return { ok: true };
}

function planner(userText: string, prev?: UIPlan): UIPlan {
  const t = userText.toLowerCase();

  const wantDashboard = /dashboard|kpi|analytics|chart|table|sidebar/.test(t);
  const wantSettings = /settings|preferences|modal/.test(t);
  const wantLanding = /landing|hero|marketing|pricing/.test(t);

  const tone: UIPlan["tone"] = /minimal|clean|simple/.test(t)
    ? "minimal"
    : /playful|fun|bright/.test(t)
      ? "playful"
      : /enterprise|professional|corporate/.test(t)
        ? "enterprise"
        : "bold";

  const layout: UIPlan["layout"] = wantLanding ? "landing" : wantSettings ? "settings" : "dashboard";

  const base: UIPlan = {
    layout,
    tone,
    components: ["AppShell", "TopNav"],
    content: {
      title: "Deterministic UI Builder",
      subtitle: "Planner → Generator → Explainer (fixed components, safe output).",
      kpis: [
        { label: "Iterations", value: "7", delta: "+2" },
        { label: "Latency", value: "820ms", delta: "-12%" },
        { label: "Coverage", value: "92%", delta: "+4%" },
        { label: "Risk", value: "Low", delta: "Stable" },
      ],
      table: {
        columns: ["Component", "Purpose", "Status"],
        rows: [
          ["Sidebar", "Navigation", "Allowed"],
          ["DataTable", "Structured data", "Allowed"],
          ["SettingsModal", "Safe edits", "Allowed"],
          ["Custom CSS", "Determinism", "Blocked"],
        ],
      },
    },
  };

  const plan = prev ? structuredClone(prev) : base;
  plan.layout = layout;
  plan.tone = tone;

  const next = new Set(plan.components);

  if (wantDashboard || /chart|table|sidebar/.test(t)) {
    next.add("Sidebar");
    next.add("KPIGrid");
    next.add("LineChartCard");
    next.add("DataTable");
  }

  if (/bar chart|bars|revenue|sales/.test(t)) {
    next.add("BarChartCard");
  }

  if (wantSettings) {
    next.add("SettingsModal");
  }

  if (/empty|no data|blank/.test(t)) {
    next.add("EmptyState");
  }

  if (/(title:|name:)/.test(t)) {
    const m = userText.match(/(?:title:|name:)\s*(.+)$/i);
    if (m?.[1]) plan.content.title = clampText(m[1].trim(), 80);
  }

  plan.components = Array.from(next) as UIPlan["components"];

  if (plan.layout === "landing") {
    plan.content.subtitle = "Describe a UI in chat, and watch it render deterministically.";
    plan.content.kpis = undefined;
    plan.content.table = {
      columns: ["Feature", "Why it matters"],
      rows: [
        ["Fixed components", "Consistent visuals + controllable output"],
        ["Planner/Generator/Explainer", "Traceable, explainable changes"],
        ["Rollback", "Fast iteration without fear"],
      ],
    };
    plan.components = ["AppShell", "TopNav", "DataTable"];
  }

  if (plan.layout === "settings") {
    plan.content.subtitle = "Ship safe customization without letting the model freestyle UI.";
    next.add("SettingsModal");
    next.add("DataTable");
    plan.components = Array.from(next) as UIPlan["components"];
  }

  return plan;
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
          "rounded-xl p-4 text-[12px] leading-relaxed",
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

  const toneClasses =
    plan.tone === "minimal"
      ? "bg-white/70"
      : plan.tone === "enterprise"
        ? "bg-white/60"
        : plan.tone === "playful"
          ? "bg-white/65"
          : "bg-white/60";

  return (
    <div
      className={cn("rounded-2xl ui-surface ui-inset-ring overflow-hidden", "min-h-[520px]")}
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

      <div className="grid grid-cols-12">
        {plan.components.includes("Sidebar") ? (
          <div className="col-span-12 md:col-span-3 border-r p-3" data-testid="panel-sidebar">
            <div className="text-xs text-muted-foreground mb-2">Navigation</div>
            <div className="space-y-1">
              {["Overview", "Reports", "Alerts", "Settings"].map((x) => (
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
                  className="rounded-xl ui-inset-ring bg-card/70 p-3"
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
              <div className="rounded-xl ui-inset-ring bg-card/70 p-3" data-testid="card-line-chart">
                <div className="text-sm font-medium mb-2">Trend</div>
                <div className="h-36 rounded-lg bg-gradient-to-b from-primary/15 to-transparent" />
              </div>
            ) : null}
            {plan.components.includes("BarChartCard") ? (
              <div className="rounded-xl ui-inset-ring bg-card/70 p-3" data-testid="card-bar-chart">
                <div className="text-sm font-medium mb-2">Breakdown</div>
                <div className="h-36 rounded-lg bg-gradient-to-b from-accent/35 to-transparent" />
              </div>
            ) : null}
          </div>

          {plan.components.includes("DataTable") && plan.content.table ? (
            <div className="rounded-xl ui-inset-ring bg-card/70 p-3" data-testid="card-table">
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
            <div className="mt-4 rounded-xl ui-inset-ring bg-card/60 p-6 text-center" data-testid="empty-state">
              <div className="ui-title text-xl">No data yet</div>
              <div className="text-sm text-muted-foreground mt-1">Ask for a table or metrics in chat.</div>
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
  onRestore,
}: {
  versions: Array<{ id: string; label: string; ts: number }>;
  onRestore: (id: string) => void;
}) {
  return (
    <Dialog>
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
        <div className="text-sm text-muted-foreground">Restore a previous generated version.</div>
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
                    "w-full text-left rounded-xl p-3 ui-inset-ring",
                    "hover:bg-muted/60 transition-colors",
                  )}
                  onClick={() => onRestore(v.id)}
                  data-testid={`button-restore-${v.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium" data-testid={`text-version-label-${v.id}`}>
                        {v.label}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-version-ts-${v.id}`}>
                        {new Date(v.ts).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="outline">Restore</Badge>
                  </div>
                </button>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UIStudio() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

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
    () => planner("Create a dashboard with a sidebar, charts, and a table. Make it minimal.", undefined),
    [],
  );

  const [model, setModel] = useState<UIModel>(() => {
    const plan = initialPlan;
    const validation = validatePlan(plan);
    const safePlan = validation.ok ? plan : planner("Create a dashboard", undefined);
    const code = generator(safePlan).code;
    const explanation = explainer(safePlan);
    return { plan: safePlan, code, explanation };
  });

  const [versions, setVersions] = useState<UIModel[]>([{ ...model }]);
  const [error, setError] = useState<string | null>(null);

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

    const nextPlan = planner(userText, mode === "modify" ? model.plan : undefined);
    const validation = validatePlan(nextPlan);
    if (!validation.ok) {
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
    setVersions((v) => [...v, nextModel]);

    pushMessage(
      "assistant",
      `Plan: ${nextPlan.layout} • tone: ${nextPlan.tone} • components: ${nextPlan.components.join(", ")}`,
    );
    pushMessage("assistant", nextExplanation);
  }

  const versionItems = versions.map((v, idx) => ({
    id: String(idx),
    label: `${v.plan.layout} • ${v.plan.tone} • ${v.plan.components.length} components`,
    ts: messages[0]?.ts + idx * 1000,
  }));

  function restoreByIndex(indexId: string) {
    const idx = Number(indexId);
    const v = versions[idx];
    if (!v) return;
    setModel(v);
    pushMessage("assistant", `Restored version #${idx + 1}.`);
  }

  const headerGlow =
    "bg-[radial-gradient(1200px_circle_at_20%_10%,hsl(var(--primary)/0.22),transparent_60%),radial-gradient(900px_circle_at_90%_20%,hsl(var(--chart-2)/0.16),transparent_55%)]";

  return (
    <div
      className={cn("min-h-screen", theme === "dark" ? "dark" : "", "ui-grid")}
      data-testid="page-ui-studio"
    >
      <div className={cn("relative", headerGlow)}>
        <div className="ui-noise absolute inset-0" />
        <div className="mx-auto max-w-[1400px] px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-xl ui-surface ui-inset-ring grid place-items-center"
                  aria-hidden="true"
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h1 className="ui-title text-2xl" data-testid="text-app-title">
                  Deterministic UI Builder
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl" data-testid="text-app-subtitle">
                A three-step agent (Planner → Generator → Explainer) that only composes from a fixed component
                whitelist.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                data-testid="button-toggle-theme"
              >
                <ShieldCheck className="h-4 w-4" />
                {theme === "light" ? "Dark" : "Light"}
              </Button>

              <VersionDialog versions={versionItems} onRestore={(id) => restoreByIndex(id)} />
            </div>
          </div>

          <div className="mt-6">
            <ResizablePanelGroup direction="horizontal" className="rounded-2xl ui-surface ui-inset-ring">
              <ResizablePanel defaultSize={32} minSize={24} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Chat</div>
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
                          "rounded-2xl p-3 ui-inset-ring",
                          m.role === "user" ? "bg-primary/8" : "bg-card/60",
                        )}
                        data-testid={`message-${m.role}-${i}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground">{m.role === "user" ? "You" : "Agent"}</div>
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

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="gap-2"
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
                      className="gap-2"
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
                      className="gap-2"
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
                    <div className="rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-sm" data-testid="status-error">
                      {error}
                    </div>
                  ) : null}

                  <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="text-safety">
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
              <div className="h-9 w-9 rounded-xl ui-surface ui-inset-ring grid place-items-center">
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
              <div className="h-9 w-9 rounded-xl ui-surface ui-inset-ring grid place-items-center">
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
              <div className="h-9 w-9 rounded-xl ui-surface ui-inset-ring grid place-items-center">
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold">Iteration & rollback</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Every run is versioned so you can undo safely and keep changes incremental.
            </p>
          </Card>
        </div>

        <div className="mt-6 rounded-2xl ui-surface ui-inset-ring p-5" data-testid="card-footer">
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

        <div className="mt-10 text-xs text-muted-foreground" data-testid="text-disclaimer">
          This is a frontend-only mockup that demonstrates the deterministic agent loop. To connect a real LLM, code
          sandboxing, and persistence, you’d typically add a backend.
        </div>
      </div>
    </div>
  );
}

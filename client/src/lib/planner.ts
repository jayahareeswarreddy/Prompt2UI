/**
 * The planner: plain English in, a validated UIPlan out.
 *
 * No model is involved. The prompt is matched against a vocabulary of
 * phrasings and a table of subject domains, and the result is a plan drawn
 * only from the component whitelist. That is what makes the same prompt
 * produce the same interface every time, and it is why the planner can
 * tell you exactly which words it acted on and which it ignored - a thing
 * a language model cannot do about itself.
 */

export const ALLOWED_COMPONENTS = [
  "AppShell",
  "TopNav",
  "Sidebar",
  "KPIGrid",
  "LineChartCard",
  "BarChartCard",
  "DataTable",
  "SettingsModal",
  "EmptyState",
] as const;

export type ComponentName = (typeof ALLOWED_COMPONENTS)[number];

export type UIPlan = {
  layout: "dashboard" | "landing" | "settings";
  tone: "minimal" | "bold" | "playful" | "enterprise";
  domain: string;
  components: ComponentName[];
  content: {
    title: string;
    subtitle?: string;
    kpis?: Array<{ label: string; value: string; delta?: string }>;
    table?: { columns: string[]; rows: string[][] };
    nav?: string[];
    lineTitle?: string;
    barTitle?: string;
  };
};

export type PlanTrace = {
  /** Phrases the planner acted on, and what each one decided. */
  understood: Array<{ term: string; effect: string }>;
  /** Words it saw and did nothing with. */
  ignored: string[];
  /** Components the prompt explicitly asked to leave out. */
  removed: ComponentName[];
};

// ---------------------------------------------------------------------------
// Subject domains
//
// The old planner always produced the same four KPIs ("Iterations, Latency,
// Coverage, Risk") whatever you asked for, so a sales dashboard and a
// hospital dashboard were identical. The subject now drives the content.
// ---------------------------------------------------------------------------

type Domain = {
  id: string;
  label: string;
  match: RegExp;
  title: string;
  subtitle: string;
  nav: string[];
  kpis: Array<{ label: string; value: string; delta?: string }>;
  table: { columns: string[]; rows: string[][] };
  lineTitle: string;
  barTitle: string;
};

export const DOMAINS: Domain[] = [
  {
    id: "sales",
    label: "sales",
    match: /\b(sales|revenue|deals?|pipeline|crm|leads?|quota)\b/,
    title: "Sales overview",
    subtitle: "Pipeline, revenue and deal flow at a glance.",
    nav: ["Overview", "Pipeline", "Accounts", "Forecast"],
    kpis: [
      { label: "Revenue", value: "£248k", delta: "+12%" },
      { label: "Deals won", value: "37", delta: "+5" },
      { label: "Win rate", value: "41%", delta: "+3%" },
      { label: "Avg. deal", value: "£6.7k", delta: "-2%" },
    ],
    table: {
      columns: ["Account", "Stage", "Value", "Owner"],
      rows: [
        ["Northwind Ltd", "Negotiation", "£42,000", "A. Rahman"],
        ["Acme Systems", "Proposal", "£18,500", "P. Shah"],
        ["Bluefin Co", "Closed won", "£61,200", "A. Rahman"],
        ["Harbour Group", "Discovery", "£7,400", "L. Novak"],
      ],
    },
    lineTitle: "Revenue over time",
    barTitle: "Revenue by region",
  },
  {
    id: "users",
    label: "users",
    match: /\b(users?|accounts?|members?|customers?|people|subscribers?|signups?|crm contacts?)\b/,
    title: "User accounts",
    subtitle: "Who is signed up, and how active they are.",
    nav: ["All users", "Active", "Invited", "Roles"],
    kpis: [
      { label: "Total users", value: "12,480", delta: "+320" },
      { label: "Active today", value: "3,104", delta: "+4%" },
      { label: "New this week", value: "286", delta: "+18%" },
      { label: "Churn", value: "1.8%", delta: "-0.3%" },
    ],
    table: {
      columns: ["Name", "Email", "Role", "Status"],
      rows: [
        ["Asha Rao", "asha@example.com", "Admin", "Active"],
        ["Bala Kumar", "bala@example.com", "Editor", "Active"],
        ["Chen Wei", "chen@example.com", "Viewer", "Invited"],
        ["Dana Novak", "dana@example.com", "Editor", "Suspended"],
      ],
    },
    lineTitle: "Signups over time",
    barTitle: "Users by plan",
  },
  {
    id: "support",
    label: "support",
    match: /\b(support|tickets?|helpdesk|issues?|complaints?|service desk|sla)\b/,
    title: "Support queue",
    subtitle: "Open tickets, response times and backlog.",
    nav: ["Inbox", "Assigned", "Escalated", "Resolved"],
    kpis: [
      { label: "Open tickets", value: "142", delta: "-12" },
      { label: "First response", value: "1h 12m", delta: "-8%" },
      { label: "Resolved today", value: "63", delta: "+9" },
      { label: "Breaching SLA", value: "4", delta: "-2" },
    ],
    table: {
      columns: ["Ticket", "Subject", "Priority", "Status"],
      rows: [
        ["#4821", "Cannot reset password", "High", "Open"],
        ["#4819", "Invoice missing VAT", "Normal", "Assigned"],
        ["#4802", "Export times out", "Urgent", "Escalated"],
        ["#4788", "Feature request: dark mode", "Low", "Resolved"],
      ],
    },
    lineTitle: "Tickets over time",
    barTitle: "Tickets by priority",
  },
  {
    id: "ecommerce",
    label: "orders",
    match: /\b(orders?|shop|store|ecommerce|e-commerce|products?|checkout|cart|inventory|stock)\b/,
    title: "Orders",
    subtitle: "What sold, what shipped and what is still in stock.",
    nav: ["Orders", "Products", "Inventory", "Refunds"],
    kpis: [
      { label: "Orders today", value: "418", delta: "+7%" },
      { label: "Revenue", value: "£31,240", delta: "+11%" },
      { label: "Avg. basket", value: "£74.70", delta: "+3%" },
      { label: "Out of stock", value: "12", delta: "+2" },
    ],
    table: {
      columns: ["Order", "Customer", "Items", "Status"],
      rows: [
        ["#10482", "A. Rao", "3", "Shipped"],
        ["#10481", "M. Oyelaran", "1", "Packing"],
        ["#10479", "T. Berg", "7", "Delivered"],
        ["#10474", "S. Patel", "2", "Refunded"],
      ],
    },
    lineTitle: "Orders over time",
    barTitle: "Sales by category",
  },
  {
    id: "finance",
    label: "finance",
    match: /\b(finance|financial|invoices?|billing|payments?|expenses?|budget|accounting|payroll)\b/,
    title: "Finance",
    subtitle: "Invoices, payments and spend against budget.",
    nav: ["Summary", "Invoices", "Expenses", "Budgets"],
    kpis: [
      { label: "Outstanding", value: "£87,300", delta: "-6%" },
      { label: "Paid this month", value: "£214,900", delta: "+9%" },
      { label: "Overdue", value: "9", delta: "-3" },
      { label: "Burn rate", value: "£62k/mo", delta: "+2%" },
    ],
    table: {
      columns: ["Invoice", "Client", "Amount", "Due"],
      rows: [
        ["INV-2041", "Northwind Ltd", "£12,400", "Overdue"],
        ["INV-2038", "Acme Systems", "£4,900", "14 days"],
        ["INV-2035", "Bluefin Co", "£22,150", "Paid"],
        ["INV-2031", "Harbour Group", "£1,800", "30 days"],
      ],
    },
    lineTitle: "Cash flow over time",
    barTitle: "Spend by category",
  },
  {
    id: "health",
    label: "clinical",
    match: /\b(health|patients?|clinic|hospital|medical|appointments?|doctors?|wards?)\b/,
    title: "Clinic overview",
    subtitle: "Appointments, waiting times and ward capacity.",
    nav: ["Today", "Appointments", "Patients", "Wards"],
    kpis: [
      { label: "Appointments", value: "208", delta: "+14" },
      { label: "Avg. wait", value: "22 min", delta: "-5 min" },
      { label: "Beds free", value: "17", delta: "-3" },
      { label: "No-shows", value: "6%", delta: "-1%" },
    ],
    table: {
      columns: ["Patient", "Clinician", "Time", "Status"],
      rows: [
        ["P-10233", "Dr Ahmed", "09:15", "Seen"],
        ["P-10240", "Dr Blake", "09:40", "Waiting"],
        ["P-10244", "Dr Ahmed", "10:05", "Booked"],
        ["P-10251", "Dr Costa", "10:30", "Cancelled"],
      ],
    },
    lineTitle: "Appointments over time",
    barTitle: "Visits by department",
  },
  {
    id: "education",
    label: "education",
    match: /\b(students?|courses?|school|education|learning|classes?|grades?|lessons?|enrol)/,
    title: "Course overview",
    subtitle: "Enrolment, progress and assessment results.",
    nav: ["Courses", "Students", "Assignments", "Results"],
    kpis: [
      { label: "Enrolled", value: "1,284", delta: "+96" },
      { label: "Completion", value: "78%", delta: "+4%" },
      { label: "Avg. grade", value: "B+", delta: "+1" },
      { label: "At risk", value: "34", delta: "-7" },
    ],
    table: {
      columns: ["Student", "Course", "Progress", "Grade"],
      rows: [
        ["A. Rao", "Databases", "92%", "A"],
        ["B. Kumar", "Networks", "64%", "C+"],
        ["C. Wei", "Algorithms", "88%", "A-"],
        ["D. Novak", "Operating Systems", "41%", "At risk"],
      ],
    },
    lineTitle: "Enrolment over time",
    barTitle: "Students by course",
  },
  {
    id: "logistics",
    label: "logistics",
    match: /\b(logistics|shipping|deliver(y|ies)|fleet|warehouse|routes?|drivers?|freight)\b/,
    title: "Deliveries",
    subtitle: "Fleet status, routes and delivery performance.",
    nav: ["Live map", "Routes", "Drivers", "Warehouses"],
    kpis: [
      { label: "In transit", value: "326", delta: "+18" },
      { label: "On time", value: "94%", delta: "+2%" },
      { label: "Delayed", value: "19", delta: "-4" },
      { label: "Avg. distance", value: "38 km", delta: "-1 km" },
    ],
    table: {
      columns: ["Consignment", "Route", "Driver", "Status"],
      rows: [
        ["C-8841", "Hyderabad → Pune", "R. Iyer", "In transit"],
        ["C-8839", "Chennai → Kochi", "S. Menon", "Delivered"],
        ["C-8830", "Delhi → Jaipur", "V. Singh", "Delayed"],
        ["C-8826", "Mumbai → Surat", "A. Desai", "Loading"],
      ],
    },
    lineTitle: "Deliveries over time",
    barTitle: "Volume by route",
  },
  {
    id: "marketing",
    label: "marketing",
    match: /\b(marketing|campaigns?|ads?|traffic|seo|email blast|newsletter|conversions?)\b/,
    title: "Campaign performance",
    subtitle: "Traffic, conversions and spend by channel.",
    nav: ["Overview", "Campaigns", "Channels", "Audiences"],
    kpis: [
      { label: "Sessions", value: "182k", delta: "+9%" },
      { label: "Conversions", value: "4,310", delta: "+12%" },
      { label: "Cost per lead", value: "£14.20", delta: "-6%" },
      { label: "Spend", value: "£61k", delta: "+4%" },
    ],
    table: {
      columns: ["Campaign", "Channel", "Spend", "Conversions"],
      rows: [
        ["Spring launch", "Paid search", "£18,400", "1,204"],
        ["Retargeting", "Display", "£7,900", "612"],
        ["Newsletter", "Email", "£1,100", "988"],
        ["Brand", "Social", "£12,250", "431"],
      ],
    },
    lineTitle: "Sessions over time",
    barTitle: "Conversions by channel",
  },
  {
    id: "devops",
    label: "infrastructure",
    match: /\b(infra(structure)?|devops|servers?|deploys?|incidents?|uptime|monitoring|logs?|clusters?|kubernetes)\b/,
    title: "Service health",
    subtitle: "Uptime, deploys and open incidents.",
    nav: ["Services", "Deploys", "Incidents", "Alerts"],
    kpis: [
      { label: "Uptime", value: "99.97%", delta: "+0.02%" },
      { label: "Deploys today", value: "14", delta: "+3" },
      { label: "Open incidents", value: "2", delta: "-1" },
      { label: "p95 latency", value: "214 ms", delta: "-18 ms" },
    ],
    table: {
      columns: ["Service", "Version", "Latency", "Status"],
      rows: [
        ["api-gateway", "v2.14.1", "186 ms", "Healthy"],
        ["auth", "v1.9.0", "92 ms", "Healthy"],
        ["billing", "v3.2.7", "640 ms", "Degraded"],
        ["search", "v0.8.3", "210 ms", "Healthy"],
      ],
    },
    lineTitle: "Requests over time",
    barTitle: "Errors by service",
  },
  {
    id: "projects",
    label: "projects",
    match: /\b(projects?|tasks?|sprints?|backlog|issues? tracker|kanban|roadmap|milestones?)\b/,
    title: "Project tracker",
    subtitle: "Workload, progress and what is blocked.",
    nav: ["Board", "Backlog", "Sprints", "Team"],
    kpis: [
      { label: "In progress", value: "28", delta: "+4" },
      { label: "Done this sprint", value: "46", delta: "+11" },
      { label: "Blocked", value: "5", delta: "-2" },
      { label: "Velocity", value: "62 pts", delta: "+8" },
    ],
    table: {
      columns: ["Task", "Assignee", "Sprint", "Status"],
      rows: [
        ["Rewrite planner", "A. Rao", "S-24", "In progress"],
        ["Fix rollback", "B. Kumar", "S-24", "Done"],
        ["Dark mode audit", "C. Wei", "S-25", "Blocked"],
        ["Add examples", "D. Novak", "S-24", "Done"],
      ],
    },
    lineTitle: "Throughput over time",
    barTitle: "Tasks by status",
  },
  {
    id: "generic",
    label: "general",
    match: /.^/, // never matches; the explicit fallback
    title: "Overview",
    subtitle: "A generated interface, composed from whitelisted components.",
    nav: ["Overview", "Reports", "Alerts", "Settings"],
    kpis: [
      { label: "Records", value: "1,284", delta: "+36" },
      { label: "Active", value: "412", delta: "+8%" },
      { label: "Pending", value: "57", delta: "-4" },
      { label: "Errors", value: "3", delta: "-1" },
    ],
    table: {
      columns: ["Item", "Category", "Updated", "Status"],
      rows: [
        ["Item A", "Group 1", "Today", "Active"],
        ["Item B", "Group 2", "Yesterday", "Pending"],
        ["Item C", "Group 1", "3 days ago", "Active"],
        ["Item D", "Group 3", "Last week", "Archived"],
      ],
    },
    lineTitle: "Volume over time",
    barTitle: "Breakdown by category",
  },
];

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const COMPONENT_VOCAB: Array<{ component: ComponentName; terms: string[] }> = [
  {
    component: "Sidebar",
    terms: [
      "sidebar", "side bar", "side nav", "side navigation", "left nav",
      "left menu", "navigation rail", "nav rail", "drawer", "menu",
      "navigation",
    ],
  },
  {
    component: "TopNav",
    terms: ["top nav", "topnav", "navbar", "nav bar", "header", "top bar", "app bar"],
  },
  {
    component: "KPIGrid",
    terms: [
      "kpi", "kpis", "metric", "metrics", "stat", "stats", "statistics",
      "summary cards", "number cards", "counters", "scorecard", "tiles",
      "at a glance", "highlights", "totals",
    ],
  },
  {
    component: "LineChartCard",
    terms: [
      "line chart", "line graph", "trend", "trends", "over time", "time series",
      "timeseries", "growth", "history chart", "sparkline", "trajectory",

    ],
  },
  {
    component: "BarChartCard",
    terms: [
      "bar chart", "bar graph", "bars", "column chart", "histogram",
      "comparison", "breakdown", "by category", "by region", "by channel",
      "ranking",
    ],
  },
  {
    component: "DataTable",
    terms: [
      "table", "data table", "grid", "list", "listing", "rows", "records",
      "spreadsheet", "directory", "log", "entries", "results",
    ],
  },
  {
    component: "SettingsModal",
    terms: [
      "settings", "preferences", "modal", "dialog", "popup", "pop up",
      "configuration", "config", "options panel", "account settings",
    ],
  },
  {
    component: "EmptyState",
    terms: [
      "empty state", "empty", "no data", "nothing yet", "blank state",
      "zero state", "placeholder", "first run", "onboarding",
    ],
  },
];

const TONE_VOCAB: Array<{ tone: UIPlan["tone"]; terms: string[] }> = [
  { tone: "minimal", terms: ["minimal", "clean", "simple", "sparse", "plain", "uncluttered", "bare"] },
  { tone: "playful", terms: ["playful", "fun", "bright", "friendly", "colourful", "colorful", "casual"] },
  { tone: "enterprise", terms: ["enterprise", "professional", "corporate", "serious", "business", "formal", "b2b"] },
  { tone: "bold", terms: ["bold", "striking", "dramatic", "high contrast", "loud", "punchy"] },
];

const LAYOUT_VOCAB: Array<{ layout: UIPlan["layout"]; terms: string[] }> = [
  { layout: "landing", terms: ["landing", "landing page", "marketing page", "hero", "pricing page", "homepage", "home page", "splash"] },
  { layout: "settings", terms: ["settings page", "settings screen", "preferences page", "account page", "configuration page", "admin settings"] },
  { layout: "dashboard", terms: ["dashboard", "console", "control panel", "admin panel", "overview page", "analytics"] },
];

/** Words that carry no instruction; not worth reporting as ignored. */
const STOP_WORDS = new Set(
  ("a an the and or but with without for to of in on at by from as is are be " +
    "make making create creating build building design designing show showing " +
    "add adding give me i want need please can you it this that some any my " +
    "page screen ui interface app application view also plus include including " +
    "using use like new simple one two three four five").split(" "),
);

const NEGATION = /\b(no|not|without|hide|remove|exclude|drop|omit|skip)\b/;

/**
 * Every single word appearing anywhere in the vocabulary.
 *
 * Without this the "ignored" list named words it had in fact acted on: a
 * prompt saying "a trend chart" matches on "trend", so "chart" looked
 * unrecognised even though it had just produced a chart.
 */
const VOCAB_WORDS: Set<string> = new Set(
  [
    ...COMPONENT_VOCAB.flatMap((v) => v.terms),
    ...TONE_VOCAB.flatMap((v) => v.terms),
    ...LAYOUT_VOCAB.flatMap((v) => v.terms),
  ]
    .flatMap((term) => term.split(" "))
    .concat(["tone", "kpis", "kpi", "chart", "charts", "title", "name", "called"]),
);

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

function clampText(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function pickDomain(text: string): Domain {
  for (const d of DOMAINS) {
    if (d.id !== "generic" && d.match.test(text)) return d;
  }
  return DOMAINS[DOMAINS.length - 1];
}

/** True when `term` appears inside a clause that negates it. */
function isNegated(text: string, term: string): boolean {
  const at = text.indexOf(term);
  if (at < 0) return false;
  // Look back over the preceding clause only, so "no sidebar, with charts"
  // removes the sidebar without also removing the charts.
  const start = Math.max(0, at - 28);
  const before = text.slice(start, at);
  const clause = before.split(/[,.;]/).pop() ?? before;
  return NEGATION.test(clause);
}

export function planner(userText: string, prev?: UIPlan): { plan: UIPlan; trace: PlanTrace } {
  const text = ` ${userText.toLowerCase().replace(/\s+/g, " ")} `;

  const understood: PlanTrace["understood"] = [];
  const removed: ComponentName[] = [];
  const consumed: string[] = [];

  // --- layout -------------------------------------------------------------
  let layout: UIPlan["layout"] = prev?.layout ?? "dashboard";
  outer: for (const entry of LAYOUT_VOCAB) {
    for (const term of entry.terms) {
      if (text.includes(term)) {
        layout = entry.layout;
        understood.push({ term, effect: `layout → ${entry.layout}` });
        consumed.push(term);
        break outer;
      }
    }
  }

  // --- tone ---------------------------------------------------------------
  let tone: UIPlan["tone"] = prev?.tone ?? "minimal";
  outerTone: for (const entry of TONE_VOCAB) {
    for (const term of entry.terms) {
      if (text.includes(term)) {
        tone = entry.tone;
        understood.push({ term, effect: `tone → ${entry.tone}` });
        consumed.push(term);
        break outerTone;
      }
    }
  }

  // --- subject ------------------------------------------------------------
  const domain = pickDomain(text);
  if (domain.id !== "generic") {
    understood.push({ term: domain.label, effect: `subject → ${domain.label}` });
  }

  // --- components ---------------------------------------------------------
  // Start from the previous plan when the user is refining, so "add a bar
  // chart" means add, not start over.
  const chosen = new Set<ComponentName>(prev ? prev.components : ["AppShell", "TopNav"]);
  chosen.add("AppShell");
  chosen.add("TopNav");

  for (const { component, terms } of COMPONENT_VOCAB) {
    for (const term of terms) {
      if (!text.includes(term)) continue;
      consumed.push(term);
      if (isNegated(text, term)) {
        if (component !== "AppShell" && component !== "TopNav") {
          chosen.delete(component);
          if (!removed.includes(component)) removed.push(component);
          understood.push({ term, effect: `remove ${component}` });
        }
      } else {
        chosen.add(component);
        understood.push({ term, effect: `add ${component}` });
      }
      break;
    }
  }

  // A dashboard with nothing in it is not a dashboard. Only fill in when
  // the user has not removed things on purpose.
  const bodyComponents: ComponentName[] = [
    "KPIGrid", "LineChartCard", "BarChartCard", "DataTable", "EmptyState",
  ];
  // "chart" on its own names no particular card. Resolve it only after the
  // specific ones have had their turn, so "a bar chart" does not also
  // produce a line chart.
  if (/ (charts|chart|graphs|graph|plot|visualisations?|visualizations?)[ ,.]/.test(text)) {
    if (!chosen.has("BarChartCard") && !chosen.has("LineChartCard")) {
      chosen.add("LineChartCard");
      understood.push({ term: "chart", effect: "add LineChartCard" });
    }
  }

  // A dashboard is a set of numbers first; asking for "a dashboard with a
  // table" should still produce the numbers unless they were refused.
  if (layout === "dashboard" && !chosen.has("KPIGrid") && !removed.includes("KPIGrid")) {
    chosen.add("KPIGrid");
    understood.push({ term: "dashboard", effect: "add KPIGrid" });
  }

  const hasBody = bodyComponents.some((c) => chosen.has(c));
  if (!hasBody && removed.length === 0) {
    if (layout === "landing") {
      chosen.add("DataTable");
      understood.push({ term: "landing", effect: "default → DataTable" });
    } else if (layout === "settings") {
      chosen.add("SettingsModal");
      chosen.add("DataTable");
      understood.push({ term: "settings", effect: "default → SettingsModal, DataTable" });
    } else {
      chosen.add("KPIGrid");
      chosen.add("LineChartCard");
      chosen.add("DataTable");
      understood.push({ term: "dashboard", effect: "default → KPIGrid, LineChartCard, DataTable" });
    }
  }

  // --- explicit title -----------------------------------------------------
  let title = domain.title;
  const titleMatch = userText.match(/(?:title|name|call(?:ed)?|heading)\s*[:=-]?\s*["“']?([^"”'\n]{2,60})/i);
  if (titleMatch?.[1]) {
    title = clampText(titleMatch[1].trim(), 60);
    understood.push({ term: titleMatch[0].trim(), effect: `title → ${title}` });
    consumed.push(titleMatch[0].toLowerCase());
  }

  // --- what it did not act on --------------------------------------------
  const ignored = Array.from(
    new Set(
      text
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter((w) => w.length > 2)
        .filter((w) => !STOP_WORDS.has(w))
        .filter((w) => !consumed.some((c) => c.includes(w)))
        .filter((w) => !VOCAB_WORDS.has(w))
        .filter((w) => !domain.match.test(` ${w} `)),
    ),
  ).slice(0, 12);

  const plan: UIPlan = {
    layout,
    tone,
    domain: domain.id,
    components: ALLOWED_COMPONENTS.filter((c) => chosen.has(c)),
    content: {
      title,
      subtitle: domain.subtitle,
      nav: domain.nav,
      kpis: chosen.has("KPIGrid") ? domain.kpis : undefined,
      table: chosen.has("DataTable") ? domain.table : undefined,
      lineTitle: domain.lineTitle,
      barTitle: domain.barTitle,
    },
  };

  return { plan, trace: { understood, ignored, removed } };
}

export function validatePlan(plan: UIPlan): { ok: true } | { ok: false; error: string } {
  if (!plan.components.length) return { ok: false, error: "Plan has no components." };
  for (const c of plan.components) {
    if (!(ALLOWED_COMPONENTS as readonly string[]).includes(c)) {
      return { ok: false, error: `Component "${c}" is not on the whitelist.` };
    }
  }
  if (!plan.content.title.trim()) return { ok: false, error: "Plan has no title." };
  if (!plan.layout) return { ok: false, error: "Plan has no layout." };
  if (!plan.tone) return { ok: false, error: "Plan has no tone." };
  return { ok: true };
}

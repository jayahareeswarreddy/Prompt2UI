/** Exercises the planner against real prompts. Run: npx tsx scripts/check-planner.ts */
import { planner, validatePlan } from "../client/src/lib/planner";

const cases = [
  "A sales dashboard with a sidebar, KPIs, a trend chart and a deals table. Enterprise tone.",
  "make me a purple unicorn spaceship interface",
  "support helpdesk, no sidebar, with a bar chart",
  "hospital clinic appointments table",
  "a playful landing page. title: Bloom Store",
];

let failures = 0;
for (const c of cases) {
  const { plan, trace } = planner(c);
  const v = validatePlan(plan);
  if (!v.ok) failures++;
  console.log(`\nPROMPT: ${c}`);
  console.log(`  valid=${v.ok} layout=${plan.layout} tone=${plan.tone} domain=${plan.domain}`);
  console.log(`  title=${plan.content.title}`);
  console.log(`  components=${plan.components.join(", ")}`);
  console.log(`  removed=${trace.removed.join(", ") || "-"}`);
  console.log(`  IGNORED=${trace.ignored.join(", ") || "-"}`);
}
console.log(`\n${cases.length - failures}/${cases.length} produced a valid plan`);

// Regression: a bar chart must not also produce a line chart.
const bar = planner("support helpdesk, no sidebar, with a bar chart").plan;
console.log(
  `\nbar-chart-only: ${bar.components.includes("BarChartCard") && !bar.components.includes("LineChartCard") ? "PASS" : "FAIL"} (${bar.components.join(", ")})`,
);
const generic = planner("dashboard with charts").plan;
console.log(
  `generic-chart:  ${generic.components.includes("LineChartCard") ? "PASS" : "FAIL"} (${generic.components.join(", ")})`,
);

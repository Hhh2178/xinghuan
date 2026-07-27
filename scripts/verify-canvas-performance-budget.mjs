import { readFile } from "node:fs/promises";

const inputPath = process.env.CANVAS_PERF_INPUT;
if (!inputPath) throw new Error("CANVAS_PERF_INPUT must point to a measurement JSON artifact");
const budgetPath = new URL("../config/canvas-performance-budget.json", import.meta.url);
const [input, budget] = await Promise.all([
  readFile(inputPath, "utf8").then(JSON.parse),
  readFile(budgetPath, "utf8").then(JSON.parse),
]);
const failures = [];
for (const measurement of input.scenarios || []) {
  const scenario = budget.scenarios?.[String(measurement.scenario)];
  if (!scenario) {
    failures.push(`scenario ${measurement.scenario}: no recorded budget`);
    continue;
  }
  if (measurement.renderedNodeCount < measurement.scenario) failures.push(`scenario ${measurement.scenario}: rendered ${measurement.renderedNodeCount}/${measurement.scenario} nodes`);
  if (Number(measurement.navigationDurationMs) > scenario.maxNavigationDurationMs) failures.push(`scenario ${measurement.scenario}: navigation ${measurement.navigationDurationMs}ms > ${scenario.maxNavigationDurationMs}ms`);
  if (Number(measurement.resourceCount) > scenario.maxResourceCount) failures.push(`scenario ${measurement.scenario}: resources ${measurement.resourceCount} > ${scenario.maxResourceCount}`);
  if (Number(measurement.longTaskCount) > scenario.maxLongTaskCount) failures.push(`scenario ${measurement.scenario}: long tasks ${measurement.longTaskCount} > ${scenario.maxLongTaskCount}`);
  if (Number(measurement.longTaskDurationMs) > scenario.maxLongTaskDurationMs) failures.push(`scenario ${measurement.scenario}: long-task duration ${measurement.longTaskDurationMs}ms > ${scenario.maxLongTaskDurationMs}ms`);
  if (Array.isArray(measurement.runtimeErrors) && measurement.runtimeErrors.length > 0) failures.push(`scenario ${measurement.scenario}: runtime errors ${measurement.runtimeErrors.length}`);
}
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, version: input.version, scenarios: input.scenarios?.map(({ scenario, renderedNodeCount, navigationDurationMs, longTaskCount }) => ({ scenario, renderedNodeCount, navigationDurationMs, longTaskCount })) }, null, 2));

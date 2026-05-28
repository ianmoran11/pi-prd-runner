import type { PiHost } from "../core/host.js";
import { defaultInitialState, loadConfigOrDefault } from "../core/config.js";
import { readEvents } from "../core/events.js";
import { loadPrds } from "../core/prd-parser.js";
import { loadState } from "../core/state.js";
import { buildDashboardModel } from "./dashboard-model.js";
import { renderDashboard, type RenderDashboardOptions } from "./dashboard-renderer.js";

export async function showDashboard(cwd: string, host: PiHost, options: RenderDashboardOptions = {}): Promise<string> {
  const config = await loadConfigOrDefault(cwd);
  const state = await loadState(cwd).catch(() => defaultInitialState(config.project.baseBranch));
  const prds = await loadPrds(cwd, config).catch(() => []);
  const events = await readEvents(cwd).catch(() => []);
  const model = buildDashboardModel(state, prds, events);
  const rendered = renderDashboard(model, options);
  if (host.renderDashboard) {
    host.renderDashboard({ title: model.title, lines: rendered.split(/\r?\n/) });
  } else {
    host.log(rendered);
  }
  return rendered;
}


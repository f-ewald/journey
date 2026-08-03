import "@f-ewald/components/status-banner.js";
import type { SourceIssue } from "../journey/load.ts";

/**
 * Replaces the page with a single visible failure message. Used for YAML
 * validation problems and for a missing Mapbox token alike, so no failure mode
 * can leave a blank screen behind.
 *
 * Each issue is shown with the file and line it came from and the offending
 * source line itself, since the whole point is to be able to go and fix it
 * without hunting through the document.
 */
export function renderError(
  host: HTMLElement,
  title: string,
  issues: SourceIssue[],
): void {
  host.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "error-view";

  const banner = document.createElement("status-banner");
  banner.setAttribute("variant", "danger");
  banner.textContent = title;
  wrapper.append(banner);

  if (issues.length > 0) {
    const list = document.createElement("ul");
    list.className = "error-view__details";
    for (const issue of issues) list.append(createIssue(issue));
    wrapper.append(list);
  }

  host.append(wrapper);
}

function createIssue(issue: SourceIssue): HTMLElement {
  const item = document.createElement("li");
  item.className = "error-view__issue";

  const location = locationOf(issue);
  if (location) {
    const element = document.createElement("p");
    element.className = "error-view__location";
    element.textContent = location;
    item.append(element);
  }

  const message = document.createElement("p");
  message.className = "error-view__message";
  message.textContent = issue.path
    ? `${issue.path} — ${issue.message}`
    : issue.message;
  item.append(message);

  if (issue.excerpt !== undefined && issue.excerpt !== "") {
    item.append(createExcerpt(issue));
  }

  return item;
}

/** `journey.yaml:42:7`, degrading to just the file when there is no position. */
function locationOf(issue: SourceIssue): string | null {
  if (!issue.file) return null;
  if (issue.line === undefined) return issue.file;
  const column = issue.column === undefined ? "" : `:${issue.column}`;
  return `${issue.file}:${issue.line}${column}`;
}

/**
 * The offending source line with a caret under the exact column, which is what
 * turns "somewhere in this file" into "this character".
 */
function createExcerpt(issue: SourceIssue): HTMLElement {
  const excerpt = document.createElement("pre");
  excerpt.className = "error-view__excerpt";

  const gutter = issue.line === undefined ? "" : `${issue.line} | `;
  const lines = [`${gutter}${issue.excerpt}`];
  if (issue.column !== undefined) {
    lines.push(`${" ".repeat(gutter.length + issue.column - 1)}^`);
  }
  excerpt.textContent = lines.join("\n");

  return excerpt;
}

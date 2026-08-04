import type { SourceIssue } from "./load.ts";

/**
 * Rendering shared by the on-screen error view and the CLI validator. Kept free
 * of DOM references so the Node validator can import it, which `ui/error-view`
 * cannot offer — that module imports a custom element for its side effect.
 */

/** `journey.yaml:42:7`, dropping each part that the issue does not carry. */
export function formatLocation(issue: SourceIssue): string {
  if (!issue.file) return "";
  if (issue.line === undefined) return issue.file;
  // A missing column is left off rather than defaulted to 1, which would claim
  // a precision the issue does not have.
  const column = issue.column === undefined ? "" : `:${issue.column}`;
  return `${issue.file}:${issue.line}${column}`;
}

/**
 * The offending source line, and a caret under the exact column — the pair that
 * turns "somewhere in this file" into "this character". Empty when the issue
 * carries no excerpt.
 */
export function formatExcerpt(issue: SourceIssue): string[] {
  if (!issue.excerpt) return [];

  const gutter = issue.line === undefined ? "" : `${issue.line} | `;
  const lines = [`${gutter}${issue.excerpt}`];
  if (issue.column !== undefined) {
    lines.push(`${" ".repeat(gutter.length + issue.column - 1)}^`);
  }
  return lines;
}

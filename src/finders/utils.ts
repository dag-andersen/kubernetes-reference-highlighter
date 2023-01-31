import { findBestMatch } from "string-similarity";
import { generateNotFoundMessage } from "../extension";
import { Highlight, K8sResource } from "../types";
import * as vscode from "vscode";

export function getPositions(match: RegExpMatchArray, name: string) {
  const shift = match[0].indexOf(name);
  const start = (match.index || 0) + shift;
  const end = start + name.length;
  return { start, end };
}

export function similarity<T>(l: T[], name: string, f: (r: T) => string) {
  var similarity = findBestMatch(name, l.map(f));

  return l.map((r, b, _) => {
    return { ...r, rating: similarity.ratings[b].rating };
  });
}

export function getSimilarHighlights(
  resources: K8sResource[],
  name: string,
  start: number,
  end: number,
  activeFilePath: string
): Highlight[] {
  return similarity<K8sResource>(resources, name, (r) => r.metadata.name)
    .filter((r) => r.rating > 0.8)
    .map((r) => {
      return {
        start: start,
        end: end,
        message: generateNotFoundMessage(
          name,
          r.metadata.name,
          activeFilePath,
          r.where
        ),
        severity: vscode.DiagnosticSeverity.Hint,
      };
    });
}

import * as vscode from "vscode";
import { findBestMatch } from "string-similarity";
import { Position } from "vscode";
import { Highlight, K8sResource } from "../types";

export function getPositions(
  doc: vscode.TextDocument | undefined,
  match: RegExpMatchArray,
  shift: number,
  name?: string
): Position | undefined {
  const nameShift = name ? match[0].indexOf(name) : 0;
  const start = match.index || 0;
  return doc?.lineAt(doc?.positionAt(shift + start + nameShift)).range.end;
}

export function similarity<T>(l: T[], name: string, f: (r: T) => string) {
  if (l.length === 0) {
    return [];
  }
  var similarity = findBestMatch(name, l.map(f));

  return l.map((r, b, _) => ({ content: r, rating: similarity.ratings[b].rating }));
}

export function getSimilarHighlights(
  resources: K8sResource[],
  name: string,
  position: Position | undefined,
  pwd: string
): Highlight[] {
  return similarity<K8sResource>(resources, name, (r) => r.metadata.name)
    .filter((r) => r.rating > 0.8)
    .map((r): Highlight => {
      return {
        definition: r.content,
        position: position,
        message: {
          type: "ReferenceNotFound",
          targetName: name,
          suggestion: r.content.metadata.name,
          pwd,
          fromWhere: r.content.where,
        },
        type: "suggestion",
      };
    });
}

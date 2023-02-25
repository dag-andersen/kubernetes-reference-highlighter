import { findBestMatch } from "string-similarity";
import { Highlight, K8sResource } from "../types";

export function getPositions(match: RegExpMatchArray, name: string) {
  const shift = match[0].indexOf(name);
  const start = (match.index || 0) + shift;
  const end = start + name.length;
  return { start, end };
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
  start: number,
  pwd: string
): Highlight[] {
  return similarity<K8sResource>(resources, name, (r) => r.metadata.name)
    .filter((r) => r.rating > 0.8)
    .map((r): Highlight => {
      return {
        definition: r.content,
        start: start,
        message: {
          type: "ReferenceNotFound",
          targetName: name,
          suggestion: r.content.metadata.name,
          pwd,
          fromWhere: r.content.where,
        },
        type: "hint",
      };
    });
}

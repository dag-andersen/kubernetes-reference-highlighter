import { findBestMatch } from "string-similarity";
import { FromWhere, Highlight, K8sResource } from "../types";
import * as vscode from "vscode";

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

export function generateMessage(
  type: string,
  name: string,
  activeFilePath: string,
  fromWhere?: FromWhere
) {
  const p = require("path");
  let message = "";
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message = `Found ${type} in ${fromWhere}`;
    } else {
      const fromFilePath = fromWhere.path;
      const relativeFilePathFromRoot = vscode.workspace.asRelativePath(
        fromFilePath || ""
      );
      const activeDirPath: string = p.dirname(activeFilePath || "");
      const relativePathFromActive: string = p.relative(
        activeDirPath || "",
        fromFilePath
      );
      const path =
        relativeFilePathFromRoot.length < relativePathFromActive.length
          ? "/" + relativeFilePathFromRoot
          : relativePathFromActive.includes("/")
          ? relativePathFromActive
          : "./" + relativePathFromActive;
      message = `✅ Found ${type} in ${fromWhere.place} at ${path}`;
    }
  } else {
    message = `✅Found ${type}, ${name}`;
  }
  return message;
}

export function generateNotFoundMessage(
  name: string,
  suggestion: string,
  activeFilePath: string,
  fromWhere?: FromWhere
) {
  const p = require("path");
  if (fromWhere) {
    if (typeof fromWhere !== "string") {
      const fromFilePath = fromWhere.path;
      const relativeFilePathFromRoot = vscode.workspace.asRelativePath(
        fromFilePath || ""
      );
      const activeDirPath: string = p.dirname(activeFilePath || "");
      const relativePathFromActive: string = p.relative(
        activeDirPath || "",
        fromFilePath
      );
      const path =
        relativeFilePathFromRoot.length < relativePathFromActive.length
          ? "/" + relativeFilePathFromRoot
          : relativePathFromActive.includes("/")
          ? relativePathFromActive
          : "./" + relativePathFromActive;
      return `🤷‍♂️ ${name} not found. Did you mean ${suggestion}? (in ${fromWhere.place} at ${path})`;
    }
  }
  return `🤷‍♂️ ${name} not found. Did you mean ${suggestion}?`;
}
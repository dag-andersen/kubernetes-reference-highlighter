import { K8sResource, Highlight } from "./types";
import * as vscode from "vscode";
import { generateMessage, logText } from "./extension";
import { findBestMatch } from "string-similarity";
import { format } from "util";

export function findServices(
  resources: K8sResource[],
  thisResource: K8sResource,
  activeFilePath: string,
  text: string
): Highlight[] {
  if (thisResource.kind === "Ingress" || thisResource.kind === "Service") {
    return [];
  }

  const refType = "Service";

  return resources
    .filter((r) => r.kind === refType)
    .flatMap((r) => {
      const name =
        thisResource.metadata.namespace === r.metadata.namespace
          ? r.metadata.name
          : `${r.metadata.name}.${r.metadata.namespace}`;

      const regex = new RegExp(`(?:"|".*[^a-zA-Z-])${name}(?:"|[^a-zA-Z-].*")`, "g");
      const matches = text.matchAll(regex);

      return [...matches].map((match) => {
        const start = (match.index || 0) + 1;
        const end = start + name.length;
        return {
          start: start,
          end: end,
          message: generateMessage(refType, name, activeFilePath, r.where),
        };
      });
    });
}

export function findValueFromKeyRef(
  resources: K8sResource[],
  thisResource: K8sResource,
  activeFilePath: string,
  text: string,
  enableCorrectionHints: boolean
): Highlight[] {
  switch (thisResource.kind) {
    case "Deployment":
    case "Pod":
    case "StatefulSet":
    case "DaemonSet":
    case "Job":
    case "CronJob":
      break;
    default:
      return [];
  }

  const regex =
    /valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))/gm;

  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    let refType = "";
    switch (match[1]) {
      case "secret":
        refType = "Secret";
        break;
      case "configMap":
        refType = "ConfigMap";
        break;
      default:
        return [];
    }

    let name = match[2] || match[3];

    const { start, end } = getPositions(match, name);

    let resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    var exactMatches = resourcesScoped.filter((r) => r.metadata.name === name);
    if (exactMatches.length > 0) {
      return resources.flatMap((r) => {
        return {
          start: start,
          end: end,
          message: generateMessage(refType, name, activeFilePath, r.where),
        };
      });
    } else {
      return enableCorrectionHints
        ? getSimilarHighlights(resourcesScoped, name, start, end)
        : [];
    }
  });
}

export function findIngressService(
  resources: K8sResource[],
  thisResource: K8sResource,
  activeFilePath: string,
  text: string,
  enableCorrectionHints: boolean
): Highlight[] {
  if (thisResource.kind !== "Ingress") {
    return [];
  }

  let refType = "Service";
  const regex =
    /service:\s*(?:name:\s*([a-zA-Z-]+)\s*port:\s*(number|name):\s*(\d+|[a-zA-Z]+)|port:\s*(number|name):\s*(\d+|[a-zA-Z]+)\s*name:\s*([a-zA-Z-]+))/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    logText(format(match));

    var name = "not found";
    var portRef = "";
    var portType = "";
    if (match[2] === "number" || match[2] === "name") {
      name = match[1];
      portRef = match[3];
      portType = match[2];
      logText(name + " " + portRef.toString());
    }
    if (match[4] === "number" || match[4] === "name") {
      name = match[6];
      portRef = match[5];
      portType = match[4];
      logText(name + " " + portRef.toString());
    }

    let resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    const { start, end } = getPositions(match, name);

    var exactMatches = resourcesScoped.filter((r) => r.metadata.name === name);
    if (exactMatches.length > 0) {
      return exactMatches.flatMap((r) => {
        let nameHighlight: Highlight = {
          start: start,
          end: end,
          message: generateMessage(refType, name, activeFilePath, r.where),
        };
        if (
          (portType === "number" &&
            r.spec?.ports?.find((p: any) => p?.port === parseInt(portRef))) ||
          (portType === "name" &&
            r.spec?.ports?.find((p: any) => p?.name === portRef))
        ) {
          let portHighlight: Highlight = {
            ...getPositions(match, portRef),
            message: "Port Found",
          };
          nameHighlight.importance = 1;
          return [nameHighlight, portHighlight];
        }

        return nameHighlight;
      });
    } else {
      return enableCorrectionHints
        ? getSimilarHighlights(resourcesScoped, name, start, end)
        : [];
    }
  });
}

function getPositions(match: RegExpMatchArray, name: string) {
  const shift = match[0].indexOf(name);
  const start = (match.index || 0) + shift;
  const end = start + name.length;
  return { start, end };
}

function getSimilarHighlights(
  resources: K8sResource[],
  name: string,
  start: number,
  end: number
): Highlight[] {
  return similarity<K8sResource>(resources, name, (r) => r.metadata.name)
    .filter((r) => r.rating > 0.8)
    .map((r) => {
      return {
        start: start,
        end: end,
        message: `'${name}' not found. Did you mean '${r.metadata.name}' from ${r.where}?`,
        severity: vscode.DiagnosticSeverity.Hint,
      };
    });
}

function similarity<T>(l: T[], name: string, f: (r: T) => string) {
  var similarity = findBestMatch(name, l.map(f));

  return l.map((r, b, _) => {
    return { ...r, rating: similarity.ratings[b].rating };
  });
}

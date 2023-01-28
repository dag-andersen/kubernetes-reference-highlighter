import { K8sResource, Highlight } from "./types";
import * as vscode from "vscode";
import { generateMessage } from "./extension";
import { findBestMatch } from "string-similarity";

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
  text: string
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

    const shift = match[0].indexOf(name);
    const start = (match.index || 0) + shift;
    const end = start + name.length;

    let resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    return getHighlights(
      resourcesScoped,
      name,
      start,
      end,
      activeFilePath,
      refType
    );
  });
}

export function findIngressService(
  resources: K8sResource[],
  thisResource: K8sResource,
  activeFilePath: string,
  text: string
): Highlight[] {
  if (thisResource.kind !== "Ingress") {
    return [];
  }

  let refType = "Service";
  const regex =
    /service:\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    let name = match[1] || match[2];

    let resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    const shift = match[0].indexOf(name);
    const start = (match.index || 0) + shift;
    const end = start + name.length;

    return getHighlights(
      resourcesScoped,
      name,
      start,
      end,
      activeFilePath,
      refType
    );
  });
}

function getHighlights(
  resources: K8sResource[],
  name: string,
  start: number,
  end: number,
  activeFilePath: string,
  refType: string
): Highlight[] {
  var similarity = findBestMatch(
    name,
    resources.map((r) => r.metadata.name)
  );

  var resourcesWithRatings = resources.map((r, b, _) => {
    return { ...r, rating: similarity.ratings[b].rating };
  });

  var exactMatches = resourcesWithRatings.filter((r) => r.rating === 1);
  if (exactMatches.length > 0) {
    return exactMatches.map((r) => {
      return {
        start: start,
        end: end,
        message: generateMessage(refType, name, activeFilePath, r.where),
      };
    });
  }

  return resourcesWithRatings
    .filter((r) => r.rating > 0.8)
    .map((r) => {
      return {
        start: start,
        end: end,
        message: `'${name}' not found. Did you mean '${r.metadata.name}'?`,
        severity: vscode.DiagnosticSeverity.Hint,
      };
    });
}

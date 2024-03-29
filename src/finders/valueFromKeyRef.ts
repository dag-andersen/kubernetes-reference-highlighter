import * as vscode from "vscode";
import { K8sResource, Highlight } from "../types";
import { getPositions, getSimilarHighlights, similarity } from "./utils";

/*
  TODO: configMapRef and secretRef are not supported yet
  TODO: Added `_` to regex 
  regex to object (?:[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*)
*/

export function find(
  doc: vscode.TextDocument | undefined,
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string,
  enableSuggestions: boolean,
  onlyReferences: boolean,
  shift: number
): Highlight[] {
  switch (thisResource.kind) {
    case "Deployment":
    case "Pod":
    case "StatefulSet":
    case "DaemonSet":
    case "ReplicaSet":
    case "Job":
    case "CronJob":
    case "ReplicationController":
      break;
    default:
      return [];
  }

  const regex =
    /valueFrom:\s*(?:#.*\s*)?([a-z0-9A-Z]+)KeyRef:\s*(?:#.*\s*)?(?:(name):\s*([a-z0-9A-Z-]+)\s*(?:#.*\s*)?(key):\s*([a-z0-9A-Z-_]+)|(key):\s*([a-z0-9A-Z-_]+)\s*(?:#.*\s*)?(name):\s*([a-z0-9A-Z-]+))/gm;

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

    var name = "Name not found";
    var key = "Key not found";
    if (match[2] === "name" || match[4] === "key") {
      name = match[3];
      key = match[5];
    } else if (match[6] === "key" || match[8] === "name") {
      key = match[7];
      name = match[9];
    }

    const position = getPositions(doc, match, shift, name);

    const resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    var exactMatches = resourcesScoped.filter((r) => r.metadata.name === name);
    if (exactMatches.length > 0) {
      return exactMatches.flatMap((r) => {
        if (onlyReferences) {
          const highlight: Highlight = {
            position: position,
            type: "reference",
            definition: r,
            message: {
              type: "ReferencedBy",
              sourceName: thisResource.metadata.name,
              sourceType: thisResource.kind,
              lineNumber: position?.line,
              pwd: r.where.path,
              fromWhere: thisResource.where,
            },
          };
          return [highlight];
        }

        const nameHighlight: Highlight = {
          position: position,
          type: "reference",
          definition: r,
          message: {
            type: "ReferenceFound",
            targetType: refType,
            targetName: name,
            pwd: thisResource.where.path,
            fromWhere: r.where,
          },
        };

        if (r.data && r.data[key]) {
          const keyHighlight: Highlight = {
            position: getPositions(doc, match, shift, key),
            type: "reference",
            definition: r,
            message: {
              type: "SubItemFound",
              subType: "key",
              mainType: refType,
              subName: key,
              mainName: name,
              pwd: thisResource.where.path,
              fromWhere: r.where,
            },
          };
          return [nameHighlight, keyHighlight];
        }

        if (enableSuggestions) {
          const keys = r.data ? Object.keys(r.data) : [];

          if (keys.length > 0) {
            const keySuggestion: Highlight[] = similarity<string>(keys, key, (a) => a)
              .filter((a) => a.rating > 0.8)
              .map((a) => ({
                position: getPositions(doc, match, shift, key),
                type: "suggestion",
                definition: r,
                message: {
                  type: "SubItemNotFound",
                  subType: "key",
                  mainType: refType,
                  subName: key,
                  mainName: name,
                  suggestion: a.content,
                  pwd: thisResource.where.path,
                  fromWhere: r.where,
                },
              }));
            return [nameHighlight, ...keySuggestion];
          }
        }

        return nameHighlight;
      });
    } else {
      return enableSuggestions
        ? getSimilarHighlights(resourcesScoped, name, position, thisResource.where.path)
        : [];
    }
  });
}

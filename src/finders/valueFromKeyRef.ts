import { K8sResource, Highlight } from "../types";
import { getPositions, getSimilarHighlights, similarity } from "./utils";

/*
  TODO: configMapRef and secretRef are not supported yet
  TODO: Added `_` to regex 
  regex to object (?:[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*)
*/

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  pwd: string,
  text: string,
  enableCorrectionHints: boolean,
  onlyReferences: boolean
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

    const { start, end } = getPositions(match, name);

    const resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    var exactMatches = resourcesScoped.filter((r) => r.metadata.name === name);
    if (exactMatches.length > 0) {
      
      return exactMatches.flatMap((r) => {
        if (onlyReferences) {
          const highlight: Highlight = {
            start: start,
            type: "reference",
            definition: r,
            message: {
              type: "ReferencedBy",
              sourceName: thisResource.metadata.name,
              sourceType: thisResource.kind,
              charIndex: start,
              pwd,
              fromWhere: thisResource.where,
            },
          };
          return [highlight];
        }

        const nameHighlight: Highlight = {
          start: start,
          type: "reference",
          definition: r,
          message: {
            type: "ReferenceFound",
            targetType: refType,
            targetName: name,
            pwd,
            fromWhere: r.where,
          },
        };

        if (r.data && r.data[key]) {
          const keyHighlight: Highlight = {
            ...getPositions(match, key),
            type: "reference",
            definition: r,
            message: {
              type: "SubItemFound",
              subType: "key",
              mainType: refType,
              subName: key,
              mainName: name,
              pwd,
              fromWhere: r.where,
            },
          };
          return [nameHighlight, keyHighlight];
        }

        if (enableCorrectionHints) {
          const keys = Object.keys(r.data);

          if (keys.length > 0) {
            const keySuggestion: Highlight[] = similarity<string>(keys, key, (a) => a)
              .filter((a) => a.rating > 0.8)
              .map((a) => ({
                ...getPositions(match, key),
                type: "hint",
                definition: r,
                message: {
                  type: "SubItemNotFound",
                  subType: "key",
                  mainType: refType,
                  subName: key,
                  mainName: name,
                  suggestion: a.content,
                  pwd,
                  fromWhere: r.where,
                },
              }));
            return [nameHighlight, ...keySuggestion];
          }
        }

        return nameHighlight;
      });
    } else {
      return enableCorrectionHints ? getSimilarHighlights(thisResource, resourcesScoped, name, start, pwd) : [];
    }
  });
}

import { K8sResource, Highlight } from "../types";
import { getPositions, getSimilarHighlights, similarity } from "./utils";

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  pwd: string,
  text: string,
  enableCorrectionHints: boolean
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
    /valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:(name):\s*([a-zA-Z-]+)\s*(key):\s*([a-zA-Z-]+)|(key):\s*([a-zA-Z-]+)\s*(name):\s*([a-zA-Z-]+))/gm;

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
        const nameHighlight: Highlight = {
          start: start,
          type: "reference",
          message: {
            type: "ReferenceFound",
            targetType: refType,
            targetName: name,
            pwd,
            fromWhere: r.where,
          },
        };

        if (r.data[key]) {
          const keyHighlight: Highlight = {
            ...getPositions(match, key),
            type: "reference",
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
              .map((a) => {
                return {
                  ...getPositions(match, key),
                  type: "hint",
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
                };
              });
            return [nameHighlight, ...keySuggestion];
          }
        }

        return nameHighlight;
      });
    } else {
      return enableCorrectionHints
        ? getSimilarHighlights(resourcesScoped, name, start, pwd)
        : [];
    }
  });
}

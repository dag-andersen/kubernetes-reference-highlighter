import { K8sResource, Highlight } from "../types";
import { logText } from "../utils";
import { getPositions, getSimilarHighlights, similarity } from "./utils";

export function find(
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

    let resourcesScoped = resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace);

    var exactMatches = resourcesScoped.filter((r) => r.metadata.name === name);
    if (exactMatches.length > 0) {
      return exactMatches.flatMap((r) => {
        let nameHighlight: Highlight = {
          start: start,
          type: "reference",
          message: { type: refType, name, activeFilePath, fromWhere: r.where },
        };
        //TODO: add suggestions for keys
        if (r.data[key]) {
          let keyHighlight: Highlight = {
            ...getPositions(match, key),
            type: "reference",
            message: {
              subType: "key",
              mainType: refType,
              subName: key,
              mainName: name,
              activeFilePath,
              fromWhere: r.where,
            },
          };
          return [nameHighlight, keyHighlight];
        }
        
        logText("hej", 1);
        let keys = Object.keys(r.data);
          
        if (keys.length > 0) {
          let keySuggestion: Highlight[] = similarity<string>(keys, key, (a) => a)
            .filter((a) => a.rating > 0.8)
            .map((a) => {
              return {
                ...getPositions(match, key),
                type: "hint",
                message: {
                  subType: "key",
                  mainType: refType,
                  subName: key,
                  mainName: name,
                  suggestion: a.valueOf().toString(),
                  activeFilePath,
                  fromWhere: r.where,
                },
              };
            });
          logText(keySuggestion,2);
          return [nameHighlight, ...keySuggestion];
        }

        return nameHighlight;
      });
    } else {
      return enableCorrectionHints
        ? getSimilarHighlights(resourcesScoped, name, start, activeFilePath)
        : [];
    }
  });
}

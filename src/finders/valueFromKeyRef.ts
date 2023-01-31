import { K8sResource, Highlight } from "../types";
import { generateMessage } from "../extension";
import { getPositions, getSimilarHighlights } from "./utils";
import { logText } from "../utils";

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
    case "Job":
    case "CronJob":
      break;
    default:
      return [];
  }

  const regex =
    /valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:(name):\s*([a-zA-Z-]+)\s*(key):\s*([a-zA-Z-]+)|(key):\s*([a-zA-Z-]+)\s*(name):\s*([a-zA-Z-]+))/gm;

  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {

    let match1 = match[1];
    let refType =
      match1 === "secret"
        ? "Secret"
        : match1 === "configMap"
        ? "ConfigMap"
        : "";

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
          end: end,
          message: generateMessage(refType, name, activeFilePath, r.where),
        };
        if (r.data[key]) {
          let keyHighlight: Highlight = {
            ...getPositions(match, key),
            message: "Key Found",
          };
          nameHighlight.importance = 1;
          return [nameHighlight, keyHighlight];
        }

        return nameHighlight;
      });
    } else {
      return enableCorrectionHints
        ? getSimilarHighlights(resourcesScoped, name, start, end, activeFilePath)
        : [];
    }
  });
}

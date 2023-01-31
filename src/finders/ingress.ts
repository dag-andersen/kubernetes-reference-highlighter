import { K8sResource, Highlight } from "../types";
import {
  generateMessage,
} from "../extension";
import { getPositions, getSimilarHighlights } from "./utils";

export function find(
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

    var name = "not found";
    var portRef = "";
    var portType = "";
    if (match[2] === "number" || match[2] === "name") {
      name = match[1];
      portRef = match[3];
      portType = match[2];
    }
    if (match[4] === "number" || match[4] === "name") {
      name = match[6];
      portRef = match[5];
      portType = match[4];
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
        ? getSimilarHighlights(resourcesScoped, name, start, end, activeFilePath)
        : [];
    }
  });
}

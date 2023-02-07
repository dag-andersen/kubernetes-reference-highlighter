import { K8sResource, Highlight } from "../types";
import { getPositions, getSimilarHighlights, similarity } from "./utils";

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
    /service:\s*(?:name:\s*([a-zA-Z-]+)\s*port:\s*(number|name):\s*(\d+|[a-zA-Z-]+)|port:\s*(number|name):\s*(\d+|[a-zA-Z-]+)\s*name:\s*([a-zA-Z-]+))/gm;
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
          type: "reference",
          message: { type: refType, name, activeFilePath, fromWhere: r.where },
        };

        if (
          (portType === "number"  && r.spec?.ports?.find((p: any) => p?.port === parseInt(portRef))) ||
          (portType === "name"    && r.spec?.ports?.find((p: any) => p?.name === portRef))
        ) {
          let portHighlight: Highlight = {
            ...getPositions(match, portRef),
            type: "reference",
            message: {
              subType: "port",
              mainType: refType,
              subName: portRef,
              mainName: name,
              activeFilePath,
              fromWhere: r.where,
            },
          };
          return [nameHighlight, portHighlight];
        }

        if (enableCorrectionHints) {
          function getPortSimilarities(
            ports: string[],
            rating: number
          ): Highlight[] {
            return similarity<string>(ports, portRef, (a) => a)
              .filter((a) => a.rating > rating)
              .map((a) => {
                return {
                  ...getPositions(match, portRef),
                  type: "hint",
                  message: {
                    subType: "port",
                    mainType: refType,
                    subName: portRef,
                    mainName: name,
                    suggestion: a.content,
                    activeFilePath,
                    fromWhere: r.where,
                  },
                };
              });
          }

          if (portType === "number") {
            let ports: string[] = r.spec?.ports?.map((p: any) => "" + p?.port) || [];
            let portSuggestion: Highlight[] = getPortSimilarities(ports, 0.5);
            if (portSuggestion.length > 0) {
              return [nameHighlight, ...portSuggestion];
            }
          }

          if (portType === "name") {
            let ports: string[] = r.spec?.ports?.map((p: any) => p?.name) || [];
            let portSuggestion: Highlight[] = getPortSimilarities(ports, 0.8);
            if (portSuggestion.length > 0) {
              return [nameHighlight, ...portSuggestion];
            }
          }
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

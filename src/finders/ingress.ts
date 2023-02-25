import { K8sResource, Highlight } from "../types";
import { getPositions, getSimilarHighlights, similarity } from "./utils";

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string,
  enableCorrectionHints: boolean,
  onlyReferences: boolean
): Highlight[] {
  if (thisResource.kind !== "Ingress") {
    return [];
  }

  const targetType = "Service";
  const regex =
    /service:\s*(?:name:\s*([a-z0-9A-Z-]+)\s*port:\s*(number|name):\s*(\d+|[a-z0-9A-Z-]+)|port:\s*(number|name):\s*(\d+|[a-z0-9A-Z-]+)\s*name:\s*([a-z0-9A-Z-]+))/gm;
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

    const resourcesScoped = resources
      .filter((r) => r.kind === targetType)
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
              pwd: r.where.path,
              fromWhere: thisResource.where,
            },
          };
          return [highlight];
        }

        const nameHighlight: Highlight = {
          start: start,
          definition: r,
          type: "reference",
          message: {
            type: "ReferenceFound",
            targetType,
            targetName: name,
            pwd: thisResource.where.path,
            fromWhere: r.where,
          },
        };

        // PORT REFERENCE
        if (
          (portType === "number" && r.spec?.ports?.find((p: any) => p?.port === parseInt(portRef))) ||
          (portType === "name"   && r.spec?.ports?.find((p: any) => p?.name === portRef))
        ) {
          const portHighlight: Highlight = {
            ...getPositions(match, portRef),
            type: "reference",
            definition: r,
            message: {
              type: "SubItemFound",
              subType: "port",
              mainType: targetType,
              subName: portRef,
              mainName: name,
              pwd: thisResource.where.path,
              fromWhere: r.where,
            },
          };
          return [nameHighlight, portHighlight];
        }

        if (enableCorrectionHints) {
          function getPortSimilarities(ports: string[], rating: number): Highlight[] {
            return similarity<string>(ports, portRef, (a) => a)
              .filter((a) => a.rating > rating)
              .map((a) => ({
                ...getPositions(match, portRef),
                type: "hint",
                definition: r,
                message: {
                  type: "SubItemNotFound",
                  subType: "port",
                  mainType: targetType,
                  subName: portRef,
                  mainName: name,
                  suggestion: a.content,
                  pwd: thisResource.where.path,
                  fromWhere: r.where,
                },
              }));
          }

          if (portType === "number") {
            const ports: string[] = r.spec?.ports?.map((p: any) => "" + p?.port) || [];
            const portSuggestion: Highlight[] = getPortSimilarities(ports, 0.5);
            if (portSuggestion.length > 0) {
              return [nameHighlight, ...portSuggestion];
            }
          }

          if (portType === "name") {
            const ports: string[] = r.spec?.ports?.map((p: any) => p?.name) || [];
            const portSuggestion: Highlight[] = getPortSimilarities(ports, 0.8);
            if (portSuggestion.length > 0) {
              return [nameHighlight, ...portSuggestion];
            }
          }
        }

        return nameHighlight;
      });
    } else {
      return enableCorrectionHints
        ? getSimilarHighlights(resourcesScoped, name, start, thisResource.where.path)
        : [];
    }
  });
}

import { K8sResource, Highlight } from "./types";

export function findServices(
  resources: K8sResource[],
  thisResource: K8sResource,
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

      const regex = new RegExp(`[^a-zA-Z-]${name}[^a-zA-Z-]`, "g");
      const matches = text.matchAll(regex);

      return [...matches].map((match) => {
        const start = (match.index || 0) + 1;
        const end = start + name.length;
        return {
          start: start,
          end: end,
          text: text,
          type: refType,
          name: name,
          from: r.where,
        };
      });
    });
}

export function findValueFromKeyRef(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  if (thisResource.kind !== "Deployment") {
    return [];
  }

  const regex =
    /valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))/gm;
  //valueFrom:\s*([a-zA-Z]+)KeyRef:\s*([a-zA-Z]+):\s*([a-zA-Z-]+)\s*([a-zA-Z]+):\s*([a-zA-Z-]+)/gm;
  //valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*([a-zA-Z]+):\s*([a-zA-Z-]+)/gm;

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

    return resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
      .filter((r) => r.metadata.name === name)
      .map((r) => {
        const shift = match[0].indexOf(name);
        const start = (match.index || 0) + shift;
        const end = start + name.length;
        return {
          start: start,
          end: end,
          text: text,
          type: refType,
          name: name,
          from: r.where,
        };
      });
  });
}

export function findIngressService(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  if (thisResource.kind !== "Ingress") {
    return [];
  }

  const regex =
    /service:\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    let refType = "Service";
    let name = match[1] || match[2];

    return resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
      .filter((r) => r.metadata.name === name)
      .map((r) => {
        const shift = match[0].indexOf(name);
        const start = (match.index || 0) + shift;
        const end = start + name.length;
        return {
          start: start,
          end: end,
          text: text,
          type: refType,
          name: name,
          from: r.where,
        };
      });
  });
}

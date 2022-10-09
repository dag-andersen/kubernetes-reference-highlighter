import { K8sResource, Highlight } from "./types";

export function findServices(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  const highlights: Highlight[] = [];

  if (thisResource.kind === "Ingress" || thisResource.kind === "Service") {
    return highlights;
  }

  const refType = "Service";

  resources
    .filter((r) => r.kind === refType)
    .forEach((r) => {
      const name =
        thisResource.metadata.namespace === r.metadata.namespace
          ? r.metadata.name
          : `${r.metadata.name}.${r.metadata.namespace}`;

      const regex = new RegExp(`[^a-zA-Z-]${name}[^a-zA-Z-]`, "g");
      const matches = text.matchAll(regex);

      for (const match of matches) {
        const start = (match.index || 0) + 1;
        const end = start + name.length;
        // get column and line number from index
        highlights.push({
          start: start,
          end: end,
          text: text,
          type: refType,
          name: name,
          from: r.where,
        });
      }
    });

  return highlights;
}

export function findValueFromKeyRef(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  const highlights: Highlight[] = [];

  if (thisResource.kind !== "Deployment") {
    return highlights;
  }

  const regex =
    /valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))/gm;
  //valueFrom:\s*([a-zA-Z]+)KeyRef:\s*([a-zA-Z]+):\s*([a-zA-Z-]+)\s*([a-zA-Z]+):\s*([a-zA-Z-]+)/gm;
  //valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*([a-zA-Z]+):\s*([a-zA-Z-]+)/gm;

  const matches = text.matchAll(regex);

  for (const match of matches) {
    let refType = "";
    switch (match[1]) {
      case "secret":
        refType = "Secret";
        break;
      case "configMap":
        refType = "ConfigMap";
        break;
      default:
        continue;
    }

    let name = match[2] || match[3];

    resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
      .filter((r) => r.metadata.name === name)
      .forEach((r) => {
        const shift = match[0].indexOf(name);
        const start = (match.index || 0) + shift;
        const end = start + name.length;
        highlights.push({
          start: start,
          end: end,
          text: text,
          type: refType,
          name: name,
          from: r.where,
        });
      });
  }

  return highlights;
}

export function findIngressService(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  const highlights: Highlight[] = [];

  if (thisResource.kind !== "Ingress") {
    return highlights;
  }

  const regex =
    /service:\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))/gm;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    let refType = "Service";
    let name = match[1] || match[2];

    resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
      .filter((r) => r.metadata.name === name)
      .forEach((r) => {
        const shift = match[0].indexOf(name);
        const start = (match.index || 0) + shift;
        const end = start + name.length;
        highlights.push({
          start: start,
          end: end,
          text: text,
          type: refType,
          name: name,
          from: r.where,
        });
      });
  }

  return highlights;
}

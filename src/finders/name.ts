import { IncomingReference } from "../sources/workspace";
import { K8sResource, Highlight } from "../types";

export function find(
  incomingReference: IncomingReference[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  if (incomingReference.length === 0) {
    return [];
  }

  const name = thisResource.metadata?.name;

  if (!name) {
    return [];
  }

  let regex = new RegExp(`  name:\\s*${thisResource.metadata.name}`, `g`);
  let matches = text.matchAll(regex);
  let list = [...matches];

  if (list.length !== 1) {
    return [];
  }

  let match = list[0];

  const start = (match.index || 0) + 1;

  return incomingReference
    .filter((r) => r.definition.metadata.name === name)
    .flatMap(
      (r): Highlight => ({
        start: start,
        type: "reference",
        source: thisResource, // this is wrong?
        message: r.message,
      })
    );
}

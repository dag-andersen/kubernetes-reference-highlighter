import * as vscode from "vscode";
import { K8sResource, Highlight, IncomingReference } from "../types";
import { getPositions } from "./utils";

export function find(
  doc: vscode.TextDocument | undefined,
  incomingReference: IncomingReference[],
  thisResource: K8sResource,
  text: string,
  shift: number
): Highlight[] {
  if (incomingReference.length === 0) {
    return [];
  }

  const name = thisResource.metadata?.name;

  if (!name) {
    return [];
  }

  let regex = new RegExp(`^  name:\\s*${name}`, `gm`);
  let matches = text.matchAll(regex);
  let list = [...matches];

  if (list.length !== 1) {
    return [];
  }

  let match = list[0];

  const position = getPositions(doc, match, shift);

  return incomingReference
    .filter((r) => r.definition.metadata.name === name)
    .flatMap(
      (r): Highlight => ({
        position: position,
        type: "reference",
        definition: thisResource, // this is wrong?
        message: r.message,
      })
    );
}

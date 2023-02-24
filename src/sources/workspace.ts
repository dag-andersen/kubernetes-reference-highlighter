import { K8sResource } from "../types";
import { getHighlights, textToK8sResource } from "../extension";
import { getAllYamlFilesInVsCodeWorkspace } from "./util";
import { Prefs } from "../prefs";
import { logText } from "../utils";
import { Message, ReferencedBy } from "../decorations/messages";
import * as vscode from "vscode";
import { lookup } from "dns";

export function getK8sResourcesInWorkspace(): K8sResource[] {
  return getAllYamlFilesInVsCodeWorkspace().flatMap(({ fileName, text }) =>
    text.split("---").flatMap((text) => textToWorkspaceK8sResource(text, fileName) ?? [])
  );
}

export function textToWorkspaceK8sResource(
  text: string,
  fileName: string
): K8sResource | undefined {
  try {
    return {
      ...textToK8sResource(text),
      where: { place: "workspace", path: fileName },
    };
  } catch (e) {}
  return undefined;
}

export function getLookupIncomingReferences(kubeResources: K8sResource[], prefs: Prefs): LookupIncomingReferences {
  let lookup: LookupIncomingReferences = {};
  const files = getAllYamlFilesInVsCodeWorkspace();
  files.forEach(({ text, fileName }) => {
    getReferencesFromFile(text, kubeResources, fileName, prefs, 0).forEach(
      ({ ref, definition, message }) => {
        if (lookup[definition.where.path]) {
          lookup[definition.where.path].push({
            definition: definition,
            ref: ref,
            message: message,
          });
        } else {
          lookup[definition.where.path] = [{ definition: definition, ref: ref, message: message }];
        }
      }
    );
  });

  return lookup;
}

const toPath = (path: string) => vscode.workspace.asRelativePath(path || "");

export type LookupIncomingReferences = Record<string, IncomingReference[]>;

export type IncomingReference = {
  ref: K8sResource; // delete this???
  definition: K8sResource;
  message: Message;
};

function getReferencesFromFile(
  text: string,
  kubeResources: K8sResource[],
  fileName: string,
  prefs: Prefs,
  currentIndex: number
): {
  ref: K8sResource;
  definition: K8sResource;
  message: Message;
}[] {
  const split = "---";
  return text
    .split(split)
    .flatMap((textSplit) => {
      const thisResource = textToWorkspaceK8sResource(textSplit, fileName);
      if (!thisResource) {
        currentIndex += textSplit.length + split.length;
        return [];
      }
      const highlights = getHighlights(
        thisResource,
        kubeResources,
        [],
        fileName,
        textSplit,
        prefs,
        currentIndex,
        true
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.map((hh) => ({
        ref: h.thisResource,
        definition: hh.source,
        message: hh.message,
      }))
    );
}

export function getMermaid(lookup: LookupIncomingReferences) {
  let string = "graph LR;";
  for (const incomingReference of Object.values(lookup)) {
    string += incomingReference
      .map(({ definition, ref, message }) => {
        const m = message as ReferencedBy;
        return (
          `\n subgraph ${toPath(definition.where.path)}; ${definition.metadata.name}; end;` +
          `\n subgraph ${toPath(ref.where.path)}; ${ref.metadata.name}; end;` +
          `\n ${ref.metadata.name} --> ${definition.metadata.name};`
        );
      })
      .join("");
  }
  return string;
}

export function showMermaid(text: string) {
  const webview = vscode.window.createWebviewPanel("test", "test", vscode.ViewColumn.Two, {
    enableScripts: true,
  });
  webview.webview.html = `
  <!DOCTYPE html>
<html lang="en">

<body>
    <pre class="mermaid">
  ${text}
    </pre>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    </script>
</body>

</html>
  `;
}

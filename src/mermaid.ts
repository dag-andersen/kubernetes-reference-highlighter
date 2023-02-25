import * as vscode from "vscode";
import { LookupIncomingReferences, toPath } from "./sources/workspace";
import { K8sResource } from "./types";

let webview: vscode.WebviewPanel | undefined;

export function showMermaid(lookup: LookupIncomingReferences, k8sResources: K8sResource[]) {
  if (!webview) {
    webview = vscode.window.createWebviewPanel("mermaid", "Mermaid", vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: false,
    });
    webview.onDidDispose(() => {
      webview = undefined;
    });
  } else {
    webview.reveal();
  }
  updateMermaid(lookup, k8sResources);
}

export function updateMermaid(lookup: LookupIncomingReferences, k8sResources: K8sResource[]) {
  if (!webview) {
    return;
  }

  const text = getMermaid(lookup, k8sResources);
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

function getMermaid(lookup: LookupIncomingReferences, k8sResources: K8sResource[]) {
  const pathToResource = k8sResources
    .sort((a, b) => a.where.path.localeCompare(b.where.path))
    .reduce((acc, current) => {
      if (acc[current.where.path]) {
        acc[current.where.path].push(current);
      } else {
        acc[current.where.path] = [current];
      }
      return acc;
    }, {} as Record<string, K8sResource[]>);

  let string = "graph LR;";

  for (const [path, resources] of Object.entries(pathToResource)) {
    string += `\n subgraph ${toPath(path)};`;
    for (const resource of resources) {
      string += `\n ${resource.metadata.name};`;
    }
    string += "\n end;";
  }

  for (const incomingReference of Object.values(lookup)) {
    string += incomingReference
      .map(({ definition, ref, message }) => {
        return `\n ${ref.metadata.name} --> ${definition.metadata.name};`;
      })
      .join("");
  }
  return string;
}

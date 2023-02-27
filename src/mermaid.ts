import * as vscode from "vscode";
import { LookupIncomingReferences, toPath } from "./sources/workspace";
import { K8sResource } from "./types";

let webview: vscode.WebviewPanel | undefined;

const title = "Kubernetes Resource Highlighter: Resource Diagram";

export function showMermaid(lookup: LookupIncomingReferences, k8sResources: K8sResource[]) {
  if (!webview) {
    webview = vscode.window.createWebviewPanel("KRH", title, vscode.ViewColumn.Beside, {
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

export function closeMermaid() {
  webview?.dispose();
}

export function updateMermaid(lookup: LookupIncomingReferences, k8sResources: K8sResource[]) {
  if (!webview || !webview?.visible) {
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

  let mermaid = "graph LR;";

  for (const [path, resources] of Object.entries(pathToResource)) {
    mermaid += `\n subgraph ${path}[${toPath(path)}];`;
    for (const resource of resources) {
      mermaid += `\n ${resource.where.path}${resource.metadata.name}[${resource.metadata.name}];`;
    }
    mermaid += "\n end;";
  }

  const arrow = (a: K8sResource, b: K8sResource) =>
    `\n ${a.where.path}${a.metadata.name} ==> ${b.where.path}${b.metadata.name};`;

  return Object.values(lookup).reduce((acc, incomingReferences) => {
    return (
      acc +
      incomingReferences.map(({ definition, ref }) => `\n ${arrow(ref, definition)};`).join("")
    );
  }, mermaid);
}

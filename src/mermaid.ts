import * as vscode from "vscode";
import { Prefs } from "./prefs";
import { getLookupIncomingReferencesKustomize } from "./sources/kustomize";
import { K8sResource, LookupIncomingReferences } from "./types";

let webview: vscode.WebviewPanel | undefined;

const title = "Kubernetes Resource Highlighter: Resource Diagram";

export function showMermaid(
  lookup: LookupIncomingReferences,
  k8sResources: K8sResource[],
  prefs: Prefs
) {
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
  updateMermaid(lookup, k8sResources, prefs);
}

export function closeMermaid() {
  webview?.dispose();
}

export function updateMermaid(
  lookup: LookupIncomingReferences,
  k8sResources: K8sResource[],
  prefs: Prefs
) {
  if (!webview || !webview?.visible) {
    return;
  }

  const text = getMermaid(lookup, k8sResources, prefs);
  webview.webview.html = `
  <!DOCTYPE html>
<html lang="en">

<body>
  <pre class="mermaid">
  ${text}
  </pre>
  <script type="module">
    const callback = function () {
      alert('A callback was triggered');
    };
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      logLevel: "error", // [1]
      securityLevel: "loose", // [2]
      flowchart: {
        defaultRenderer: "elk",
        useMaxWidth: false,
      },
      theme: (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ?
        "dark" :
        "default" // [3]
    })
  </script>
</body>

</html>
  `;
}

function getMermaid(
  lookup: LookupIncomingReferences,
  k8sResources: K8sResource[],
  prefs: Prefs,
  onlyUsed = true
) {
  const toPath = (path: string) => vscode.workspace.asRelativePath(path || "");

  const something = getLookupIncomingReferencesKustomize(k8sResources);

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

  const isAllowed = (r: K8sResource) =>
    (prefs.kustomizeScanning && r.where.place === "kustomize") ||
    (prefs.workSpaceScanning && r.where.place === "workspace") ||
    (prefs.clusterScanning && r.where.place === "cluster") ||
    (prefs.helmScanning && r.where.place === "helm");

  const arrow = (a: K8sResource, b: K8sResource) =>
    `\n ${a.where.path}${a.metadata.name} ==> ${b.where.path}${b.metadata.name}`;

  mermaid = Object.values(something).reduce((acc, incomingReferences) => {
    return (
      acc +
      incomingReferences
        .filter(({ definition, ref }) => isAllowed(definition) && isAllowed(ref))
        .map(({ definition, ref }) => `\n ${arrow(ref, definition)};`)
        .join("")
    );
  }, mermaid);

  mermaid = Object.values(lookup).reduce((acc, incomingReferences) => {
    return (
      acc +
      incomingReferences
        .filter(({ definition, ref }) => isAllowed(definition) && isAllowed(ref))
        .map(({ definition, ref }) => `\n ${arrow(ref, definition)};`)
        .join("")
    );
  }, mermaid);

  for (const [path, resources] of Object.entries(pathToResource)) {
    const res = resources.filter(
      (r) => !onlyUsed || mermaid.includes(`${r.where.path}${r.metadata.name}`)
    );
    if (onlyUsed && !mermaid.includes(path) && res.length === 0) {
      continue;
    }
    mermaid += `\n subgraph ${path}[${toPath(path)}];`;
    for (const r of res) {
      mermaid += `\n ${r.where.path}${r.metadata.name}[${r.metadata.name}]; click ${r.where.path}${r.metadata.name} href "${path}" _self`;
    }
    mermaid += "\n end;";
  }

  return mermaid;
}

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
      retainContextWhenHidden: true,
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

  const allResources = getMermaid(lookup, k8sResources, prefs, false);
  const onlyDependencies = getMermaid(lookup, k8sResources, prefs, true);
  webview.webview.html = `
<html lang="en">
  <body>
    <label><input id="checkbox1" type="checkbox" /> Only show resources with references </label>

    <pre id="mermaid1" class="mermaid" style="margin: 0; width: 0; height: 0; overflow: hidden">
       ${allResources}
    </pre>
    <pre id="mermaid2" class="mermaid" style="margin: 0; width: 0; height: 0; overflow: hidden">
       ${onlyDependencies}
    </pre>
    <script type="module">
      const mermaidElement1 = document.getElementById("mermaid1");
      const mermaidElement2 = document.getElementById("mermaid2");
      const hide = ({ style }) => {
        style.width = 0;
        style.height = 0;
        style.overflow = "hidden";
      };
      const show = ({ style }) => {
        style.width = "auto";
        style.height = "auto";
        style.overflow = "visible";
      };

      const checkbox = document.getElementById("checkbox1");
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          hide(mermaidElement1);
          show(mermaidElement2);
        } else {
          show(mermaidElement1);
          hide(mermaidElement2);
        }
      });

      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
      mermaid.initialize({
        startOnLoad: false,
        logLevel: "error",
        securityLevel: "loose",
        flowchart: {
          defaultRenderer: "elk",
          useMaxWidth: false,
        },
        theme:
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "default",
      });

      await mermaid.run();
      show(mermaidElement1);
    </script>
  </body>
</html>
  `;
}

//"graph LR;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-configmap.ymlbackend-config ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-service.ymlbackend;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-deployment.ymlbackend ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.ymlpostgres-config;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-deployment.ymlbackend ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.ymlpostgres-config;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-deployment.ymlpostgres ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.ymlpostgres-config;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-deployment.ymlpostgres ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.ymlpostgres-config;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-service.ymlbackend ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-deployment.ymlbackend;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.ymlpostgres-config ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-service.ymlpostgres;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-deployment.ymlpostgres ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-secret.ymlpostgres-secret;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-service.ymlpostgres ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-deployment.ymlpostgres;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-deployment.ymlfrontend ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-configmap.ymlbackend-config;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-deployment.ymlfrontend ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-configmap.ymlbackend-config;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-ingress.ymlingress ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-service.ymlfrontend;  /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-service.ymlfrontend ==> /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-deployment.ymlfrontend; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-configmap.yml[backend-configmap.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-configmap.ymlbackend-config[backend-config]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-deployment.yml[backend-deployment.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-deployment.ymlbackend[backend]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-service.yml[backend-service.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/backend-service.ymlbackend[backend]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.yml[db-configmap.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-configmap.ymlpostgres-config[postgres-config]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-deployment.yml[db-deployment.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-deployment.ymlpostgres[postgres]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-secret.yml[db-secret.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-secret.ymlpostgres-secret[postgres-secret]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-service.yml[db-service.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/db-service.ymlpostgres[postgres]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-deployment.yml[frontend-deployment.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-deployment.ymlfrontend[frontend]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-ingress.yml[frontend-ingress.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-ingress.ymlingress[ingress]; end; subgraph /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-service.yml[frontend-service.yml]; /Users/dag/CodeProjects/KRH-assignments/assignments/assignment1/frontend-service.ymlfrontend[frontend]; end;"

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
    ` ${a.where.path}${a.metadata.name} ==> ${b.where.path}${b.metadata.name}`;

  mermaid = Object.values(something).reduce((acc, incomingReferences) => {
    return (
      acc +
      incomingReferences
        .filter(({ definition, ref }) => isAllowed(definition) && isAllowed(ref))
        .map(({ definition, ref }) => ` ${arrow(ref, definition)};`)
        .join("")
    );
  }, mermaid);

  mermaid = Object.values(lookup).reduce((acc, incomingReferences) => {
    return (
      acc +
      incomingReferences
        .filter(({ definition, ref }) => isAllowed(definition) && isAllowed(ref))
        .map(({ definition, ref }) => ` ${arrow(ref, definition)};`)
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
    mermaid += ` subgraph ${path}[${toPath(path)}];`;
    for (const r of res) {
      mermaid += ` ${r.where.path}${r.metadata.name}[${r.metadata.name}]; click ${r.where.path}${r.metadata.name} href "vscode://file/${path}" _self;`;
    }
    mermaid += " end;";
  }

  return mermaid;
}


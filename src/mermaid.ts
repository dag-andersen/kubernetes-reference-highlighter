import * as vscode from "vscode";
import { Prefs } from "./prefs";
import { getLookupIncomingReferencesKustomize } from "./sources/kustomize";
import { K8sResource, LookupIncomingReferences } from "./types";

let webview: vscode.WebviewPanel | undefined;

const title = "Kubernetes Resource Highlighter: Resource Diagram";
let onlyDependencies: boolean;
let onlyDependenciesGraph = "";
let allResourcesGraph = "";

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
    onlyDependencies = false;
    const { base, onlyUsedString, notOnlyUsedString } = getMermaid(lookup, k8sResources, prefs);
    webview.webview.html = getHtml(
      onlyDependencies ? `${base}${onlyUsedString}` : `${base}${notOnlyUsedString}`
    );
    webview.onDidDispose(() => {
      webview = undefined;
    });
    webview.webview.onDidReceiveMessage(({ content }) => {
      onlyDependencies = content;
      reRenderMermaid(onlyDependencies ? onlyDependenciesGraph : allResourcesGraph);
    });
  } else {
    webview.reveal();
  }
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

  const { base, onlyUsedString, notOnlyUsedString } = getMermaid(lookup, k8sResources, prefs);

  const OD = `${base}${onlyUsedString}`;
  const AR = `${base}${notOnlyUsedString}`;

  if (onlyDependenciesGraph !== OD) {
    onlyDependenciesGraph = OD;
    if (onlyDependencies) {
      reRenderMermaid(onlyDependenciesGraph);
    }
  }
  if (allResourcesGraph !== AR) {
    allResourcesGraph = AR;
    if (!onlyDependencies) {
      reRenderMermaid(allResourcesGraph);
    }
  }
}

function reRenderMermaid(graph: string) {
  webview?.webview.postMessage(graph);
}

function getHtml(initialGraph: string) {
  return `
<html lang="en" style="height: 100%;">
  <body style="padding: 0; height: 100%;">
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      <label style="text-align: center; display: block"
        ><input id="checkbox1" type="checkbox" /> Only show resources with references
      </label>
      <div style="zoom: 80%; flex-grow: 1; overflow: auto;">
        <pre
          id="mermaid"
          class="mermaid"
          style="text-align: center; display: block; margin: 0; width: 0; height: 0; overflow: hidden"
        >
          ${initialGraph}
        </pre>
      </div>
    </div>

    <script type="module">
      const vscode = acquireVsCodeApi();

      const mermaidElement = document.getElementById("mermaid");
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
        vscode.postMessage({ content: e.target.checked });
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
      show(mermaidElement);

      window.addEventListener("message", async (event) => {
        const message = event.data; // The JSON data our extension sent
        mermaidElement.innerHTML = message;
        mermaidElement.removeAttribute("data-processed");
        hide(mermaidElement);
        await mermaid.run({
          querySelector: ".mermaid",
        });
        show(mermaidElement);
      });
    </script>
  </body>
</html>

  `;
}

function getMermaid(lookup: LookupIncomingReferences, k8sResources: K8sResource[], prefs: Prefs) {
  const toPath = (path: string) => vscode.workspace.asRelativePath(path || "");

  const lookupKustomize = getLookupIncomingReferencesKustomize(k8sResources);

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

  const isAllowed = (r: K8sResource) =>
    (prefs.kustomizeScanning && r.where.place === "kustomize") ||
    (prefs.workSpaceScanning && r.where.place === "workspace") ||
    (prefs.clusterScanning && r.where.place === "cluster") ||
    (prefs.helmScanning && r.where.place === "helm");

  const nodeReference = (r: K8sResource) => `${r.where.path}${r.metadata.name}`;

  const arrow = (a: K8sResource, b: K8sResource) =>
    `${nodeReference(a)} ==> ${nodeReference(b)}`;

  const node = (r: K8sResource) =>
    `${r.where.path}${r.metadata.name}[${r.metadata.name}]; click ${r.where.path}${r.metadata.name} href "vscode://file/${r.where.path}" _self;`;

  const fileSubgraph = (filePath: string, resource: K8sResource[]) =>
    resource.reduce(
      (acc, r) => acc + node(r),
      ` subgraph ${filePath}[${toPath(filePath)}];`
    ) + " end;";

  const getArrows = (lookup: LookupIncomingReferences) =>
    Object.values(lookup).reduce(
      (acc, incomingRefs) =>
        acc +
        incomingRefs
          .filter(({ definition, ref }) => isAllowed(definition) && isAllowed(ref))
          .map(({ definition, ref }) => ` ${arrow(ref, definition)};`)
          .join(""),
      ""
    );

  let mermaid = `graph LR;${getArrows(lookupKustomize)}${getArrows(lookup)}`;

  const { onlyUsedString, notOnlyUsedString } = Object.entries(pathToResource).reduce(
    (acc, [path, resources]) => {
      acc.notOnlyUsedString += fileSubgraph(path, resources);

      const res = resources.filter((r) => mermaid.includes(`${r.where.path}${r.metadata.name}`));
      if (!mermaid.includes(path) && res.length === 0) {
        return acc;
      }
      acc.onlyUsedString += fileSubgraph(path, res);
      return acc;
    },
    { onlyUsedString: "", notOnlyUsedString: "" }
  );

  return { base: mermaid, onlyUsedString, notOnlyUsedString };
}

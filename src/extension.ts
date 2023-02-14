// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as workspace from "./sources/workspace";
import * as cluster from "./sources/cluster";
import * as kustomize from "./sources/kustomize";
import * as helm from "./sources/helm";
import * as valueFromKeyRef from "./finders/valueFromKeyRef";
import * as ingress from "./finders/ingress";
import * as service from "./finders/service";

import { K8sResource } from "./types";
import { parse } from "yaml";
import { loadPreferences, Prefs, updateConfigurationKey } from "./prefs";
import { decorate, highlightsToDecorations } from "./decorations/decoration";
import { find } from "./finders/serviceport";

// This method is called when the extension is activated
// The extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, extension "Kubernetes Reference Highlighter" is now active!'
  );

  let clusterClient = cluster.getKubeClient();

  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let kubeResourcesKustomize: K8sResource[] = [];
  let kubeResourcesHelm: K8sResource[] = [];

  let k8sResources: K8sResource[] = [];

  const reloadK8sResources = () => {
    k8sResources = [
      kubeResourcesCluster,
      kubeResourcesWorkspace,
      kubeResourcesKustomize,
      kubeResourcesHelm,
    ].flat();
  };

  const prefs = loadPreferences();

  const enableClusterScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableClusterScanning",
    () => {
      clusterClient = cluster.getKubeClient();
      if (clusterClient) {
        prefs.clusterScanning = !prefs.clusterScanning;
        updateConfigurationKey("enableClusterScanning", prefs.clusterScanning);
        vscode.window.showInformationMessage(
          `Cluster Scanning: ${prefs.clusterScanning ? "Enabled" : "Disabled"}`
        );
        updateRemoteResources();
      } else {
        vscode.window.showErrorMessage(`Cluster Scanning: Not available`);
      }
    }
  );

  const enableWorkSpaceScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableWorkSpaceScanning",
    () => {
      prefs.workSpaceScanning = !prefs.workSpaceScanning;
      updateConfigurationKey(
        "enableWorkSpaceScanning",
        prefs.workSpaceScanning
      );
      vscode.window.showInformationMessage(
        `WorkSpace Scanning: ${
          prefs.workSpaceScanning ? "Enabled" : "Disabled"
        }`
      );
      updateK8sResourcesFromWorkspace();
      updateLocalResources();
    }
  );

  const enableKustomizeScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableKustomizeScanning",
    () => {
      prefs.kustomizeScanning = !prefs.kustomizeScanning;
      updateConfigurationKey(
        "enableKustomizeScanning",
        prefs.kustomizeScanning
      );
      vscode.window.showInformationMessage(
        `Kustomize Scanning: ${
          prefs.kustomizeScanning ? "Enabled" : "Disabled"
        }`
      );
      updateK8sResourcesFromKustomize();
      updateLocalResources();
    }
  );

  const enableHelmScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableHelmScanning",
    () => {
      if (!helm.isHelmInstalled) {
        vscode.window.showErrorMessage(
          "Helm is not installed. Please install it first."
        );
        return;
      }
      prefs.helmScanning = !prefs.helmScanning;
      updateConfigurationKey("enableHelmScanning", prefs.helmScanning);
      vscode.window.showInformationMessage(
        `Helm Scanning: ${prefs.helmScanning ? "Enabled" : "Disabled"}`
      );
      updateK8sResourcesFromHelm;
      updateLocalResources();
    }
  );

  const enableCorrectionHintsCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableCorrectionHints",
    () => {
      prefs.hints = !prefs.hints;
      updateConfigurationKey("enableCorrectionHints", prefs.hints);
      vscode.window.showInformationMessage(
        `Reference Correction Hints: ${prefs.hints ? "Enabled" : "Disabled"}`
      );
    }
  );

  const updateK8sResourcesFromWorkspace = () => {
    kubeResourcesWorkspace = prefs.workSpaceScanning ? workspace.getK8sResourceNamesInWorkspace() : [];
  };

  const updateK8sResourcesFromKustomize = () => {
    kubeResourcesKustomize = prefs.kustomizeScanning ? kustomize.getKustomizeResources() : [];
  };

  const updateK8sResourcesFromHelm = () => {
    kubeResourcesHelm = helm.isHelmInstalled() && prefs.helmScanning ? helm.getHelmResources() : [];
  };

  const updateK8sResourcesFromCluster = async () => {
    kubeResourcesCluster = clusterClient && prefs.clusterScanning ? await cluster.getClusterResources(clusterClient) : [];
  };

  const updateLocalResources = () => {
    updateK8sResourcesFromWorkspace();
    updateK8sResourcesFromKustomize();
    updateK8sResourcesFromHelm();

    reloadK8sResources();
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources);
  };

  const updateRemoteResources = async () => {
    await updateK8sResourcesFromCluster();
    reloadK8sResources();
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources);
  };

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!doc.fileName.endsWith(".yaml") && !doc.fileName.endsWith(".yml")) {
      return;
    }
    debounce();
  });

  const onOpen = vscode.workspace.onDidOpenTextDocument((doc) => {
    debounce();
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources);
  });

  const onChange = vscode.workspace.onDidChangeTextDocument((event) => {
    debounce();
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources);
  });

  const onTextEditorChange = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      debounce();
      updateHighlighting(editor, prefs, k8sResources);
    }
  );

  context.subscriptions.push(
    enableClusterScanningCommand,
    enableWorkSpaceScanningCommand,
    enableKustomizeScanningCommand,
    onTextEditorChange,
    enableHelmScanningCommand,
    enableCorrectionHintsCommand,
    onSave,
    onChange,
    onOpen
  );

  updateLocalResources();
  updateRemoteResources();

  // update loop for local resources
  let readyForNewLocalRefresh = true;
  let skipThisTime = false;
  setInterval(() => {
    if (readyForNewLocalRefresh) {
      if (skipThisTime) {
        skipThisTime = false;
        return;
      }
      updateLocalResources();
      readyForNewLocalRefresh = false; 
    }
  }, 1000 * 3);

  // Update loop for cluster resources
  let readyForNewClusterRefresh = true;
  setInterval(() => {
    if (readyForNewClusterRefresh) {
      updateRemoteResources();
      readyForNewClusterRefresh = false;
    }
  }, 1000 * 15);

  // Update loop for cluster client
  setInterval(() => {
    clusterClient = cluster.getKubeClient();
  }, 1000 * 15);

  function debounce() {
    skipThisTime = true;
    readyForNewLocalRefresh = true;
    readyForNewClusterRefresh = true;
  }
}

export function textToK8sResource(text: string) {
  const yml = parse(text);
  return {
    kind: yml.kind,
    spec: yml.spec,
    data: yml.data,
    metadata: {
      name: yml.metadata?.name,
      namespace: yml.metadata?.namespace,
      labels: yml.metadata?.labels,
    },
  };
}

// this method is called when your extension is deactivated
export function deactivate() {}

function updateHighlighting(
  editor: vscode.TextEditor | undefined,
  prefs: Prefs,
  kubeResources: K8sResource[]
) {
  const doc = editor?.document;

  if (!doc) {
    return;
  }

  const fileName = doc.fileName;
  if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) {
    return;
  }

  const fileText = doc.getText();

  const split = "---";

  const fileTextSplitted = fileText.split(split);

  let currentIndex = 0;

  const decorationsCombined =
    kubeResources.length === 0
      ? []
      : fileTextSplitted.flatMap((textSplit) => {
          let thisResource: K8sResource;

          try {
            thisResource = {
              ...textToK8sResource(textSplit),
              where: { place: "workspace", path: fileName },
            };
          } catch (e) {
            currentIndex += textSplit.length + split.length;
            return [];
          }

          const serviceHighlights = service.find(
            kubeResources,
            thisResource,
            fileName,
            textSplit
          );
          const serviceportHighlights = find(
            kubeResources,
            thisResource,
            fileName,
            textSplit
          );
          const valueFromHighlights = valueFromKeyRef.find(
            kubeResources,
            thisResource,
            fileName,
            textSplit,
            prefs.hints
          );
          const ingressHighlights = ingress.find(
            kubeResources,
            thisResource,
            fileName,
            textSplit,
            prefs.hints
          );

          const highlights = [
            ...serviceHighlights,
            ...serviceportHighlights,
            ...valueFromHighlights,
            ...ingressHighlights,
          ];

          if (
            prefs.kustomizeScanning &&
            (fileName.endsWith("kustomization.yaml") ||
              fileName.endsWith("kustomization.yml"))
          ) {
            highlights.push(
              ...kustomize.verifyKustomizeBuild(
                thisResource,
                textSplit,
                fileName,
                currentIndex
              )
            );
          }

          if (prefs.helmScanning && fileName.endsWith("Chart.yaml")) {
            highlights.push(
              ...helm.verifyHelmBuild(
                thisResource,
                textSplit,
                fileName,
                currentIndex
              )
            );
          }

          const decorations = highlightsToDecorations(
            doc,
            highlights,
            currentIndex
          );

          currentIndex += textSplit.length + split.length;
          decorations.sort(
            (a, b) =>
              (a.renderOptions?.after?.contentText?.length ?? 0) -
              (b.renderOptions?.after?.contentText?.length ?? 0)
          );
          return decorations;
        });

  decorate(editor, decorationsCombined);
}

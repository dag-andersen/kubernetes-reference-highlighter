// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as workspace from "./sources/workspace";
import * as mermaid from "./mermaid";
import * as cluster from "./sources/cluster";
import * as kustomize from "./sources/kustomize";
import * as helm from "./sources/helm";
import * as valueFromKeyRef from "./finders/valueFromKeyRef";
import * as ingress from "./finders/ingress";
import * as serviceFreeText from "./finders/serviceFreeText";
import * as serviceSelector from "./finders/serviceSelector";
import * as name from "./finders/name";

import { Highlight, K8sResource } from "./types";
import { parse } from "yaml";
import { loadPreferences, Prefs, updateConfigurationKey } from "./prefs";
import { decorate, highlightsToDecorations } from "./decorations/decoration";
import { getAllYamlFileNamesInDirectory, getAllYamlFilesInVsCodeWorkspace } from "./sources/util";
import { logText } from "./utils";
import { Message } from "./decorations/messages";
import {
  IncomingReference,
  LookupIncomingReferences,
  getLookupIncomingReferences,
} from "./sources/workspace";

// This method is called when the extension is activated
// The extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, extension "Kubernetes Reference Highlighter" is now active!');

  let clusterClient = cluster.getKubeClient();

  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let kubeResourcesKustomize: K8sResource[] = [];
  let kubeResourcesHelm: K8sResource[] = [];

  let k8sResources: K8sResource[] = [];

  let lookup: LookupIncomingReferences = {};

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
      updateConfigurationKey("enableWorkSpaceScanning", prefs.workSpaceScanning);
      vscode.window.showInformationMessage(
        `WorkSpace Scanning: ${prefs.workSpaceScanning ? "Enabled" : "Disabled"}`
      );
      updateK8sResourcesFromWorkspace();
      updateLocalResources();
    }
  );

  const enableKustomizeScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableKustomizeScanning",
    () => {
      prefs.kustomizeScanning = !prefs.kustomizeScanning;
      updateConfigurationKey("enableKustomizeScanning", prefs.kustomizeScanning);
      vscode.window.showInformationMessage(
        `Kustomize Scanning: ${prefs.kustomizeScanning ? "Enabled" : "Disabled"}`
      );
      updateK8sResourcesFromKustomize();
      updateLocalResources();
    }
  );

  const enableHelmScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableHelmScanning",
    () => {
      if (!helm.isHelmInstalled) {
        vscode.window.showErrorMessage("Helm is not installed. Please install it first.");
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

  const enableIncomingReferencesCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableIncomingReferences",
    () => {
      prefs.incomingReferences = !prefs.incomingReferences;
      updateConfigurationKey("enableIncomingReferences", prefs.incomingReferences);
      vscode.window.showInformationMessage(
        `Incoming reference highlighting: ${prefs.incomingReferences ? "Enabled" : "Disabled"}`
      );
      if (prefs.incomingReferences) {
        updateIncomingReferences();
      } else {
        lookup = {};
        mermaid.closeMermaid();
      }
    }
  );

    const showDependencyDiagramCommand = vscode.commands.registerCommand(
      "kubernetes-reference-highlighter.showDependencyDiagram",
      () => {
        if (!prefs.incomingReferences) {
          vscode.window.showErrorMessage(
            "Incoming Reference is disabled.",
            "Enable it!"
          ).then((selection) => {
            if (selection === "Enable it!") {
              vscode.commands.executeCommand(
                "kubernetes-reference-highlighter.enableIncomingReferences"
              );
              mermaid.showMermaid(lookup, k8sResources);
            }
          });
          return;
        }
        lookup = getLookupIncomingReferences(k8sResources);
        mermaid.showMermaid(lookup, k8sResources);
      }
    );

  const updateK8sResourcesFromWorkspace = () => {
    kubeResourcesWorkspace = prefs.workSpaceScanning ? workspace.getK8sResourcesInWorkspace() : [];
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

  const updateIncomingReferences = () => {
    lookup = prefs.incomingReferences ? getLookupIncomingReferences(k8sResources) : {};
    mermaid.updateMermaid(lookup, k8sResources);
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources, lookup);
  };

  const updateLocalResources = () => {
    updateK8sResourcesFromWorkspace();
    updateK8sResourcesFromKustomize();
    updateK8sResourcesFromHelm();

    reloadK8sResources();
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources, lookup);
  };

  const updateRemoteResources = async () => {
    await updateK8sResourcesFromCluster();
    reloadK8sResources();
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources, lookup);
  };

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!doc.fileName.endsWith(".yaml") && !doc.fileName.endsWith(".yml")) {
      return;
    }
    readyForNewClusterRefresh = true;
    readyForNewLocalRefresh = true;
    readyForIncomingRefresh = true;
    skipNewLocalRefresh = true;
  });

  const onChange = vscode.workspace.onDidChangeTextDocument((event) => { // keystrokes
    readyForNewClusterRefresh = true;
    readyForNewLocalRefresh = true;
    skipNewLocalRefresh = true;
    updateHighlighting(vscode.window.activeTextEditor, prefs, k8sResources, lookup);
  });

  const onTextEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => { // active file change
    skipIncomingRefresh = true;
    readyForIncomingRefresh = true;
    updateHighlighting(editor, prefs, k8sResources, lookup);
  });

  context.subscriptions.push(
    enableClusterScanningCommand,
    enableWorkSpaceScanningCommand,
    enableKustomizeScanningCommand,
    showDependencyDiagramCommand,
    onTextEditorChange,
    enableHelmScanningCommand,
    enableCorrectionHintsCommand,
    enableIncomingReferencesCommand,
    onTextEditorChange,
    onSave,
    onChange
  );

  updateLocalResources();
  updateRemoteResources();

  // update loop for local resources
  let readyForNewLocalRefresh = true;
  let skipNewLocalRefresh = false;

  // Update loop for incoming references
  let readyForIncomingRefresh = true;
  let skipIncomingRefresh = false;

  setInterval(() => {
    if (readyForNewLocalRefresh) {
      if (skipNewLocalRefresh) {
        skipNewLocalRefresh = false;
      } else {
        updateLocalResources();
        readyForNewLocalRefresh = false;
      }
    }
    if (readyForIncomingRefresh && prefs.incomingReferences) {
      if (skipIncomingRefresh) {
        skipIncomingRefresh = false;
      } else {
        updateIncomingReferences();
        readyForIncomingRefresh = false;
      }
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
  kubeResources: K8sResource[],
  lookupIncomingReferences: LookupIncomingReferences
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

  let currentIndex = 0;

  if (kubeResources.length === 0) {
    decorate(editor, []);
    return;
  }

  const decorations = fileText.split(split).flatMap((textSplit) => {
    let thisResource = workspace.textToWorkspaceK8sResource(textSplit, fileName);
    if (!thisResource) {
      currentIndex += textSplit.length + split.length;
      return [];
    }
    const highlights = getHighlights(
      thisResource,
      kubeResources,
      lookupIncomingReferences[fileName] ?? [],
      fileName,
      textSplit,
      prefs,
      currentIndex,
      false
    );
    const decorations = highlightsToDecorations(doc, highlights, currentIndex).sort(
      (a, b) =>
        (a.renderOptions?.after?.contentText?.length ?? 0) -
        (b.renderOptions?.after?.contentText?.length ?? 0)
    );
    currentIndex += textSplit.length + split.length;
    return decorations;
  });

  decorate(editor, decorations);
}

export function getHighlights(
  thisResource: K8sResource,
  kubeResources: K8sResource[],
  incomingReferences: IncomingReference[],
  fileName: string,
  textSplit: string,
  prefs: Prefs,
  currentIndex: number,
  onlyReferences: boolean
): Highlight[] {
  const serviceHighlights = serviceFreeText.find(
    kubeResources,
    thisResource,
    fileName,
    textSplit,
    prefs.hints,
    onlyReferences
  );
  const serviceSelectorHighlights = serviceSelector.find(
    kubeResources,
    thisResource,
    fileName,
    textSplit,
    onlyReferences
  );
  const valueFromHighlights = valueFromKeyRef.find(
    kubeResources,
    thisResource,
    fileName,
    textSplit,
    prefs.hints,
    onlyReferences
  );
  const ingressHighlights = ingress.find(
    kubeResources,
    thisResource,
    fileName,
    textSplit,
    prefs.hints,
    onlyReferences
  );
  
  const highlights = [
    ...serviceHighlights,
    ...serviceSelectorHighlights,
    ...valueFromHighlights,
    ...ingressHighlights,
  ];
  
  if (!onlyReferences) {
    const incomingHighlights = name.find(incomingReferences, thisResource, textSplit);
    highlights.push(...incomingHighlights);
  }

  if (
    prefs.kustomizeScanning &&
    (fileName.endsWith("kustomization.yaml") || fileName.endsWith("kustomization.yml"))
  ) {
    highlights.push(
      ...kustomize.verifyKustomizeBuild(thisResource, textSplit, fileName, currentIndex)
    );
  }

  if (prefs.helmScanning && fileName.endsWith("Chart.yaml")) {
    highlights.push(...helm.verifyHelmBuild(thisResource, textSplit, fileName, currentIndex));
  }

  return highlights;
}

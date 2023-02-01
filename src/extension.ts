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
import { loadPreferences, Prefs, updateConfigurationKey } from "./Prefs";
import { logRest, logText } from "./utils";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, extension "Kubernetes Reference Highlighter" is now active!'
  );

  let k8sApi = cluster.getKubeClient();

  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let kubeResourcesKustomize: K8sResource[] = [];
  let kubeResourcesHelm: K8sResource[] = [];

  const resources = () =>
    [
      kubeResourcesCluster,
      kubeResourcesWorkspace,
      kubeResourcesKustomize,
      kubeResourcesHelm,
    ].flat();

  let prefs = loadPreferences();

  const enableClusterScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableClusterScanning",
    () => {
      k8sApi = cluster.getKubeClient();
      if (k8sApi) {
        prefs.clusterScanning = !prefs.clusterScanning;
        updateConfigurationKey("enableClusterScanning", prefs.clusterScanning);
        vscode.window.showInformationMessage(
          `Cluster Scanning: ${prefs.clusterScanning ? "Enabled" : "Disabled"}`
        );
        updateK8sResourcesFromCluster();
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

  const updateK8sResourcesFromCluster = () => {
    kubeResourcesCluster = k8sApi && prefs.clusterScanning ? cluster.getClusterResources(k8sApi) : [];
  };
  
  const updateK8sResourcesFromHelm = () => {
    kubeResourcesHelm = helm.isHelmInstalled() && prefs.helmScanning ? helm.getHelmResources() : [];
  };

  const updateK8sResourcesFromKustomize = () => {
    kubeResourcesKustomize = prefs.kustomizeScanning ? kustomize.getKustomizeResources() : [];
  };

    const updateResources = () => {
      updateK8sResourcesFromCluster();
      updateK8sResourcesFromWorkspace();
      updateK8sResourcesFromKustomize();
      updateK8sResourcesFromHelm();
    };

  // create diagnostic collection
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "kubernetes-reference-highlighter"
  );

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!doc.fileName.endsWith(".yaml") && !doc.fileName.endsWith(".yml")) {
      return;
    }
    updateResources();
    updateDiagnostics(doc, prefs, diagnosticCollection, resources());
  });

  const onOpen = vscode.workspace.onDidOpenTextDocument((doc) =>
    updateDiagnostics(doc, prefs, diagnosticCollection, resources())
  );
  const onChange = vscode.workspace.onDidChangeTextDocument((event) =>
    updateDiagnostics(event.document, prefs, diagnosticCollection, resources())
  );

  context.subscriptions.push(
    enableClusterScanningCommand,
    enableWorkSpaceScanningCommand,
    enableKustomizeScanningCommand,
    enableHelmScanningCommand,
    enableCorrectionHintsCommand,
    diagnosticCollection,
    onSave,
    onChange,
    onOpen
  );

  updateResources();
  updateDiagnostics(
    vscode.window.activeTextEditor!.document,
    prefs,
    diagnosticCollection,
    resources()
  );

  console.log("Kubernetes Reference Highlighter activated");
}

export function getAllFileNamesInDirectory(dirPath: string) {
  const fs = require("fs");
  const path = require("path");

  let files: string[] = [];

  function walkSync(dir: string, fileList: string[]) {
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        fileList = walkSync(path.join(dir, file), fileList);
      } else {
        fileList.push(path.join(dir, file));
      }
    });

    return fileList;
  }

  files = walkSync(dirPath, files).filter((file: string) => {
    return file.endsWith(".yml") || file.endsWith(".yaml");
  });

  return files;
}

export function createDiagnostic(
  start: number,
  end: number,
  text: string,
  message: string,
  level: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Information
): vscode.Diagnostic {
  const range = toRange(text, start, end);
  return new vscode.Diagnostic(range, message, level);
}

function toRange(text: string, start: number, end: number): vscode.Range {
  const diff = end - start;
  const lines = text.substring(0, end).split(/\r?\n/);
  const endLine = lines.length - 1;
  const endCharacter = lines[endLine].length;

  let currentCharacter = diff;
  let currentLine = endLine;
  while (currentCharacter > 0 && currentLine >= 0) {
    if (lines[currentLine].length < currentCharacter) {
      currentCharacter -= lines[currentLine].length + 1;
      currentLine--;
    } else {
      break;
    }
  }

  const startLine = currentLine;
  const startCharacter = lines[startLine].length - currentCharacter;

  return new vscode.Range(startLine, startCharacter, endLine, endCharacter);
}

export function textToK8sResource(text: string): K8sResource {
  const yml = parse(text);
  return {
    kind: yml.kind,
    spec: yml.spec,
    data: yml.data,
    metadata: {
      name: yml.metadata?.name,
      namespace: yml.metadata?.namespace,
    },
  };
}

// this method is called when your extension is deactivated
export function deactivate() {}

function updateDiagnostics(
  doc: vscode.TextDocument,
  prefs: Prefs,
  diagnosticCollection: vscode.DiagnosticCollection,
  kubeResources: K8sResource[]
) {
  logRest();
  logText("hej");
  const fileName = doc.fileName;
  if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) {
    return;
  }

  const fileText = doc.getText();

  // if (fileText === lastDocumentChanged) {
  //   return;
  // }
  // lastDocumentChanged = fileText;

  const split = "---";

  const fileTextSplitted = fileText.split(split);

  let currentIndex = 0;

  const diagnosticsCombined =
    kubeResources.length === 0
      ? []
      : fileTextSplitted.flatMap((textSplit) => {
          let thisResource: K8sResource;

          logText(textSplit);

          try {
            thisResource = textToK8sResource(textSplit);
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
          const valueFromHighlights = valueFromKeyRef.find(
            kubeResources,
            thisResource,
            fileName,
            textSplit,
            prefs.hints
          );
          logText(valueFromHighlights, 3);
          const ingressHighlights = ingress.find(
            kubeResources,
            thisResource,
            fileName,
            textSplit,
            prefs.hints
          );
          logText("hej", 8);
          const highlights = [
            ...serviceHighlights,
            ...valueFromHighlights,
            ...ingressHighlights,
          ];

          let diagnostics = highlights
            .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
            .map((h) => {
              return createDiagnostic(
                h.start + currentIndex,
                h.end + currentIndex,
                fileText,
                h.message,
                h.severity
              );
            });

          if (
            prefs.kustomizeScanning &&
            (fileName.endsWith("kustomization.yaml") ||
              fileName.endsWith("kustomization.yml"))
          ) {
            diagnostics.push(
              ...kustomize.verifyKustomizeBuild(
                thisResource,
                textSplit,
                fileText,
                fileName,
                currentIndex
              )
            );
          }

          if (prefs.helmScanning && fileName.endsWith("Chart.yaml")) {
            diagnostics.push(
              ...helm.verifyHelmBuild(
                thisResource,
                textSplit,
                fileText,
                fileName,
                currentIndex
              )
            );
          }

          currentIndex += textSplit.length + split.length;
          diagnostics.sort((a, b) => a.message.length - b.message.length);
          return diagnostics;
        });

  //diagnosticCollection.clear();
  diagnosticCollection.set(doc.uri, diagnosticsCombined);
}

// function listener(editor: vscode.TextEditor | undefined): Promise<void> {
//   return Promise.resolve();
// }

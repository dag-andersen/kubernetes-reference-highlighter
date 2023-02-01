import * as vscode from "vscode";

export type Prefs = {
  workSpaceScanning: boolean;
  kustomizeScanning: boolean;
  helmScanning: boolean;
  clusterScanning: boolean;
  hints: boolean;
};

export function loadPreferences(): Prefs {
  return {
    workSpaceScanning:  getConfigurationValue("enableWorkSpaceScanning")  ?? true,
    kustomizeScanning:  getConfigurationValue("enableKustomizeScanning")  ?? true,
    helmScanning:       getConfigurationValue("enableHelmScanning")       ?? true,
    clusterScanning:    getConfigurationValue("enableClusterScanning")    ?? true,
    hints:              getConfigurationValue("enableCorrectionHints")    ?? false,
  };
}

export function updateConfigurationKey(key: string, value: any) {
  return vscode.workspace
    .getConfiguration("kubernetesReferenceHighlighter")
    .update(key, value, true);
}

export function getConfigurationValue(key: string) {
  return vscode.workspace
    .getConfiguration("kubernetesReferenceHighlighter")
    .get<boolean>(key);
}

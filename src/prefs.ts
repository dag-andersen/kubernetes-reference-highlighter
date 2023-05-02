import * as vscode from "vscode";

export type Prefs = {
  workSpaceScanning: boolean;
  kustomizeScanning: boolean;
  helmScanning: boolean;
  clusterScanning: boolean;
  suggestions: boolean;
  biDirectionalReferences: boolean;
};

export function loadPreferences(): Prefs {
  // prettier-ignore
  return {
    workSpaceScanning:        getConfigurationValue("enableWorkSpaceScanning")        ?? true,
    kustomizeScanning:        getConfigurationValue("enableKustomizeScanning")        ?? true,
    helmScanning:             getConfigurationValue("enableHelmScanning")             ?? true,
    clusterScanning:          getConfigurationValue("enableClusterScanning")          ?? true,
    suggestions:              getConfigurationValue("enableSuggestions")              ?? true,
    biDirectionalReferences:  getConfigurationValue("enabledBiDirectionalReferences") ?? true,
  };
}

export const updateConfigurationKey = (key: string, value: any) =>
  vscode.workspace.getConfiguration("kubernetesReferenceHighlighter").update(key, value, true);

export const getConfigurationValue = (key: string) =>
  vscode.workspace.getConfiguration("kubernetesReferenceHighlighter").get<boolean>(key);

import { K8sResource } from "./types";
import * as vscode from "vscode";
import { getAllFileNamesInDirectory, textToK8sResource } from "./extension";

// get all kubernetes resource names in folder and subfolders
export function getK8sResourceNamesInWorkspace(): K8sResource[] {
  const fs = require("fs");

  const workspaceFolders =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!workspaceFolders) {
    return [];
  }

  const files = getAllFileNamesInDirectory(workspaceFolders);

  return files.flatMap((file) => {
    const fileText: string = fs.readFileSync(file, "utf8");
    const split = fileText.split("---");
    return split.flatMap((text) => {
      try {
        return {
          ...textToK8sResource(text),
          where: { place: "workspace", path: file },
        };
      } catch (e) {}
      return [];
    });
  });
}

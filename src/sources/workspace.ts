import * as vscode from "vscode";
import { K8sResource } from "../types";
import { textToK8sResource } from "../extension";
import { logText } from "../utils";
import { getAllFileNamesInDirectory } from "./util";
import { readFileSync } from "fs";

export function getK8sResourceNamesInWorkspace(): K8sResource[] {

  const workspaceFolders =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!workspaceFolders) {
    return [];
  }
  
  const files = getAllFileNamesInDirectory(workspaceFolders);
  const openFiles = vscode.workspace.textDocuments.filter(
    (doc) => doc.fileName.endsWith(".yaml") || doc.fileName.endsWith(".yml")
  );

  const filesToScan = files.map((file) => {
    // check if file exist in open files
    const openFile = openFiles.find((openFile) => openFile.fileName === file);
    return openFile ? { fileName: file, text: openFile.getText() } : { fileName: file, text: readFileSync(file, "utf8") };
  });

  return filesToScan.flatMap(({ fileName, text }) =>
    text.split("---").flatMap((text) => {
      logText(fileName);
      try {
        return {
          ...textToK8sResource(text),
          where: { place: "workspace", path: fileName },
        };
      } catch (e) {}
      return [];
    })
  );
}

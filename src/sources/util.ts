import { readFileSync } from "fs";
import * as vscode from "vscode";

export function getAllYamlFileNamesInDirectory(dirPath?: string) {
  dirPath =
    dirPath ||
    (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath);

  if (!dirPath) {
    return [];
  }

  const fs = require("fs");
  const path = require("path");

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

  const files = walkSync(dirPath, []).filter((file: string) => {
    return file.endsWith(".yml") || file.endsWith(".yaml");
  });

  return files;
}

export function getAllYamlFilesInVsCodeWorkspace() {
  const files = getAllYamlFileNamesInDirectory();
  if (files.length === 0) {
    return [];
  }

  const openFiles = vscode.workspace.textDocuments.filter(
    (doc) => doc.fileName.endsWith(".yaml") || doc.fileName.endsWith(".yml")
  );

  return files.map((file) => {
    // check if file exist in open files
    const openFile = openFiles.find((openFile) => openFile.fileName === file);
    return openFile
      ? { fileName: file, text: openFile.getText() }
      : { fileName: file, text: readFileSync(file, "utf8") };
  });
}
import * as vscode from "vscode";
import { readFileSync } from "fs";
import { getHighlights } from "../extension";
import { parse } from "yaml";
import { Prefs } from "../prefs";
import { IncomingReference, K8sResource, Place } from "../types";

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
    const openFile = openFiles.find((openFile) => openFile.fileName === file);
    return openFile
      ? { fileName: file, text: openFile.getText(), doc: openFile }
      : { fileName: file, text: readFileSync(file, "utf8"), doc: openFile };
  });
}

function parseYaml(text: string) {
  const yml = parse(text);
  return {
    apiVersion: yml.apiVersion,
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

export function textToK8sResourced(
  text: string,
  fileName: string,
  place: Place
): K8sResource | undefined {
  try {
    return {
      ...parseYaml(text),
      where: { place: place, path: fileName },
    };
  } catch (e) {}
  return undefined;
}

export function getReferencesFromFile(
  doc: vscode.TextDocument | undefined,
  text: string,
  kubeResources: K8sResource[],
  fileName: string,
  place: Place
): IncomingReference[] {
  let currentIndex = 0;
  const split = "---";
  return text
    .split(split)
    .flatMap((textSplit) => {
      const thisResource = textToK8sResourced(textSplit, fileName, place);
      if (!thisResource) {
        currentIndex += textSplit.length + split.length;
        return [];
      }
      const highlights = getHighlights(
        doc,
        thisResource,
        kubeResources,
        [],
        textSplit,
        {} as Prefs,
        true,
        currentIndex
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.map((hh) => ({
        ref: h.thisResource,
        definition: hh.definition,
        message: hh.message,
      }))
    );
}

import { K8sResource } from "../types";
import { getHighlights, textToK8sResource } from "../extension";
import { getAllYamlFilesInVsCodeWorkspace } from "./util";
import { Prefs } from "../prefs";
import { logText } from "../utils";
import { resourceLimits } from "worker_threads";
import { Message, ReferencedBy } from "../decorations/messages";
import * as vscode from "vscode";

export function getK8sResourcesInWorkspace(): K8sResource[] {
  return getAllYamlFilesInVsCodeWorkspace().flatMap(({ fileName, text }) =>
    text.split("---").flatMap((text) => textToWorkspaceK8sResource(text, fileName) ?? [])
  );
}

export function textToWorkspaceK8sResource(
  text: string,
  fileName: string
): K8sResource | undefined {
  try {
    return {
      ...textToK8sResource(text),
      where: { place: "workspace", path: fileName },
    };
  } catch (e) {}
  return undefined;
}

export function testtesttest(kubeResources: K8sResource[], prefs: Prefs): LookupIncomingReferences {
  let refToSource: LookupIncomingReferences = {};
  const files = getAllYamlFilesInVsCodeWorkspace();
  files.forEach(({ text, fileName }) => {
    getReferencesFromFile(text, kubeResources, fileName, prefs, 0).forEach((ref) => {
      const { thisResource, source, message } = ref;
      if (refToSource[source.where.path]) {
        refToSource[source.where.path].push({
          source: source,
          resource: thisResource,
          message: message,
        });
      } else {
        refToSource[source.where.path] = [
          { source: source, resource: thisResource, message: message },
        ];
      }
    });
  });

  // loop over record
  let string = "```mermaid\ngraph LR;";
  for (const [pathToFile, value] of Object.entries(refToSource)) {
    string += value
      .map(({ source, resource, message }) => {
        const m = message as ReferencedBy;
        return (
          `\n subgraph ${toPath(source.where.path)}; ${source.metadata.name}; end;` +
          `\n subgraph ${toPath(resource.where.path)}; ${resource.metadata.name}; end;` +
          ` ${resource.metadata.name} --> ${source.metadata.name};`
        );
      })
      .join("");
  }
  string += "\n```";
  writeToFile(string);
  logText(string);

  return refToSource;
}

const toPath = (path: string) => vscode.workspace.asRelativePath(path || "");

export type LookupIncomingReferences = Record<string, IncomingReference[]>;

export type IncomingReference = {
  resource: K8sResource; // delete this???
  source: K8sResource;
  message: Message;
};

function getReferencesFromFile(
  text: string,
  kubeResources: K8sResource[],
  fileName: string,
  prefs: Prefs,
  currentIndex: number
): {
  thisResource: K8sResource;
  source: K8sResource;
  message: Message;
}[] {
  const split = "---";
  return text
    .split(split)
    .flatMap((textSplit) => {
      const thisResource = textToWorkspaceK8sResource(textSplit, fileName);
      if (!thisResource) {
        currentIndex += textSplit.length + split.length;
        return [];
      }
      const highlights = getHighlights(
        thisResource,
        kubeResources,
        [],
        fileName,
        textSplit,
        prefs,
        currentIndex,
        true
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.map((hh) => ({
        thisResource: h.thisResource,
        source: hh.source,
        message: hh.message,
      }))
    );
}

function writeToFile(text: string) {
  const fs = require("fs");
  fs.writeFile("/Users/dag/CodeProjects/kubernetes-reference-highlighter/test.md", text, function (err: any) {
    if (err) {
      return logText(err);
    }
    logText("The file was saved!");
  });
}

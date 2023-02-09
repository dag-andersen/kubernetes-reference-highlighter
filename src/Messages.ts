import * as vscode from "vscode";
import { FromWhere } from "./types";

type DefaultMessage = {
  content: string;
};

export type Message = SubItemNotFound |
  ReferenceNotFound |
  ReferenceFound |
  SubItemFound |
  DefaultMessage;

export function generateMessage(mg: Message[]): string {
  if (mg.every((m) => "type" in m)) {
    return generateFoundMessage(mg as ReferenceFound[]);
  } else if (mg.every((m) => "suggestion" in m && "subType" in m)) {
    return generateSubItemNotFoundMessage(mg as SubItemNotFound[]);
  } else if (mg.every((m) => "suggestion" in m)) {
    return generateNotFoundMessage(mg as ReferenceNotFound[]);
  } else if (mg.every((m) => "subType" in m)) {
    return generateSubItemFoundMessage(mg as SubItemFound[]);
  }
  let mes = mg as DefaultMessage[];
  return mes.reduce((acc, m) => acc + m.content + "\\\n", "");
}

type ReferenceFound = {
  type: string;
  name: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateFoundMessage(mg: ReferenceFound[]): string {
  let message = "";
  mg.forEach((mg, i) => {
    if (i > 0) {
      message += "\\\n";
    }
    const { type, name, activeFilePath, fromWhere } = mg;
    message += `✅ Found ${type}: \`${name}\``;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` in ${fromWhere}`;
      } else {
        const relativePath = getRelativePath(fromWhere.path, activeFilePath);
        message +=
          fromWhere.place === "workspace"
            ? ` in \`${relativePath}\``
            : ` with ${fromWhere.place} at \`${relativePath}\``;
      }
    }
  });
  return message;
}

type ReferenceNotFound = {
  name: string;
  suggestion: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateNotFoundMessage(mg: ReferenceNotFound[]): string {
  let message = "";
  mg.forEach((mg, i) => {
    if (i > 0) {
      message += "\\\n";
    }
    const { name, activeFilePath, fromWhere, suggestion } = mg;
    message += `🤷‍♂️ \`${name}\` not found. Did you mean \`${suggestion}\`?`;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` (found in ${fromWhere})`;
      } else {
        const relativePath = getRelativePath(fromWhere.path, activeFilePath);
        message +=
          fromWhere.place === "workspace"
            ? ` (in \`${relativePath}\`)`
            : ` (with ${fromWhere.place} at \`${relativePath}\`)`;
      }
    }
  });
  return message;
}

type SubItemFound = {
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};
function generateSubItemFoundMessage(mg: SubItemFound[]): string {
  let message = "";
  mg.forEach((mg, i) => {
    if (i > 0) {
      message += "\\\n";
    }
    const { subType, mainType, subName, mainName, activeFilePath, fromWhere } = mg;
    message += `✅ Found ${subType}: \`${subName}\` in ${mainType}: \`${mainName}\``;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` at ${fromWhere}`;
      } else {
        const relativePath = getRelativePath(fromWhere.path, activeFilePath);
        message +=
          fromWhere.place === "workspace"
            ? ` in \`${relativePath}\``
            : ` with ${fromWhere.place} at \`${relativePath}\``;
      }
    }
  });
  return message;
}

type SubItemNotFound = {
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  suggestion: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateSubItemNotFoundMessage(mg: SubItemNotFound[]): string {
  let message = "";
  mg.forEach((mg, i) => {
    if (i > 0) {
      message += "\\\n";
    }
    const { subType, activeFilePath, subName, mainType, fromWhere, suggestion, mainName } = mg;
    message += `🤷‍♂️ _${subType}_: \`${subName}\` not found in _${mainType}_: \`${mainName}\``;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` (in ${fromWhere})`;
      } else {
        const relativePath = getRelativePath(fromWhere.path, activeFilePath);
        message +=
          fromWhere.place === "workspace"
            ? ` (in \`${relativePath}\`)`
            : ` (with ${fromWhere.place} at \`${relativePath}\`)`;
      }
    }
    message += `.\\\nDid you mean \`${suggestion}\`?`;
  });
  return message;
}

function getRelativePath(path: string, activeFilePath: string): string {
  const p = require("path");
  const fromFilePath = path;
  const relativeFilePathFromRoot = vscode.workspace.asRelativePath(
    fromFilePath || ""
  );
  const activeDirPath: string = p.dirname(activeFilePath || "");
  const relativePathFromActive: string = p.relative(
    activeDirPath || "",
    fromFilePath
  );
  return relativeFilePathFromRoot.length < relativePathFromActive.length
    ? "/" + relativeFilePathFromRoot
    : relativePathFromActive.includes("/")
      ? relativePathFromActive
      : "./" + relativePathFromActive;
}

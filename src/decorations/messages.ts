import * as vscode from "vscode";
import { FromWhere } from "../types";

export type Message =
  | SubItemNotFound
  | ReferenceNotFound
  | ReferenceFound
  | SubItemFound
  | SelectorFound
  | ServiceFreeTextFound
  | ReferencedBy
  | PlainText;

export type ExclusiveArray<T extends { type: string }> = {
  [TType in T["type"]]: Array<T & { type: TType }>;
}[T["type"]];

export function generateMessage(mg: ExclusiveArray<Message>): string {
  if (mg.length === 0) {
    return "Error";
  }

  /* eslint-disable @typescript-eslint/naming-convention */
  const myMap: Record<Message["type"], () => string> = {
    ReferenceFound: () => generateFoundMessage(mg as ReferenceFound[]),
    SubItemNotFound: () => generateSubItemNotFoundMessage(mg as SubItemNotFound[]),
    ReferenceNotFound: () => generateNotFoundMessage(mg as ReferenceNotFound[]),
    SubItemFound: () => generateSubItemFoundMessage(mg as SubItemFound[]),
    SelectorFound: () => generateSelectorFoundMessage(mg as SelectorFound[]),
    ServiceFreeTextFound: () => generateServiceFreeTextFoundMessage(mg as ServiceFreeTextFound[]),
    ReferencedBy: () => generateReferencedByMessage(mg as ReferencedBy[]),
    PlainText: () => (mg as PlainText[]).map((m) => m.content).join("\\\n"),
  };

  return myMap[mg[0].type]();
}

type PlainText = {
  type: "PlainText";
  content: string;
};

type ReferenceFound = {
  type: "ReferenceFound";
  targetType: string;
  targetName: string;
  pwd: string;
  fromWhere: FromWhere;
};

function generateFoundMessage(mg: ReferenceFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { targetType, targetName, pwd, fromWhere } = mg[0];
    return `✅ Found ${i(targetType)}: ${c(targetName)} ${individualRef(fromWhere, pwd)}`;
  }

  const type = mg[0].targetType;
  const name = mg[0].targetName;

  const header = `✅ Found ${i(type)}: ${c(name)} in:`;
  return mg.reduce((acc, { pwd, fromWhere }) => acc + `\n- ${listRef(fromWhere, pwd)}`, header);
}

type ReferenceNotFound = {
  type: "ReferenceNotFound";
  targetName: string;
  suggestion: string;
  pwd: string;
  fromWhere: FromWhere;
};

function generateNotFoundMessage(mg: ReferenceNotFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }

  if (mg.length === 1) {
    const { targetName, pwd, fromWhere, suggestion } = mg[0];
    return `🤷‍♂️ ${c(targetName)} not found. Did you mean ${c(suggestion)}? (From ${individualRef(fromWhere, pwd)})`;
  }

  const { targetName } = mg[0];
  const header = `🤷‍♂️ ${c(targetName)} not found.`;
  return mg.reduce(
    (acc, { pwd, fromWhere, suggestion }) => acc + `\n- Did you mean ${c(suggestion)}? (From ${listRef(fromWhere, pwd)})`,
    header
  );
}

type SubItemFound = {
  type: "SubItemFound";
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  pwd: string;
  fromWhere: FromWhere;
};

function generateSubItemFoundMessage(mg: SubItemFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  // prettier-ignore

  if (mg.length === 1) {
    const { subType, mainType, subName, mainName, pwd, fromWhere } = mg[0];
    return `✅ Found ${i(subType)}: ${c(subName)} in ${i(mainType)}: ${c(mainName)} ${individualRef(fromWhere, pwd)}`;
  }

  const { subType, mainType, subName, mainName } = mg[0];
  const header = `✅ Found ${i(subType)}: ${c(subName)} in ${i(mainType)}: ${c(mainName)} in:`;
  return mg.reduce((acc, { pwd, fromWhere }) => acc + `\n- ${listRef(fromWhere, pwd)}`, header);
}

type SubItemNotFound = {
  type: "SubItemNotFound";
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  suggestion: string;
  pwd: string;
  fromWhere: FromWhere;
};

function generateSubItemNotFoundMessage(mg: SubItemNotFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { subType, pwd, subName, mainType, fromWhere, suggestion, mainName } = mg[0];
    // prettier-ignore
    return `🤷‍♂️ ${i(subType)}: ${c(subName)} not found in ${i(mainType)}: ${c(mainName)} ${individualRef(fromWhere, pwd)}.\\\nDid you mean ${i(subType)}: ${c(suggestion)}?`;
  }

  const { subType, subName, mainType, mainName } = mg[0];
  const header = `🤷‍♂️ ${i(subType)}: ${c(subName)} is ***not*** in:`;
  return mg.reduce(
    // prettier-ignore
    (acc, { pwd, fromWhere, suggestion }) =>
      acc + `\n- ${i(mainType)}: ${c(mainName)} found ${individualRef(fromWhere, pwd)}.\\\nDid you mean ${i(subType)}: ${c(suggestion)}?`,
    header
  );
}

type SelectorFound = {
  type: "SelectorFound";
  targetType: string;
  targetName: string;
  pwd: string;
  fromWhere: FromWhere;
};

function generateSelectorFoundMessage(mg: SelectorFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { targetType, targetName, pwd, fromWhere } = mg[0];
    return `✅ Selector points to: ${i(targetType)}: ${c(targetName)} ${individualRef(fromWhere, pwd)}`;
  }

  const header = `✅ Selector points to:`;
  return mg.reduce(
    (acc, { targetType, targetName, pwd, fromWhere }) =>
      acc + `\n- ${i(targetType)}: ${c(targetName)} ${listRef(fromWhere, pwd)}`,
    header
  );
}

type ServiceFreeTextFound = {
  type: "ServiceFreeTextFound";
  targetType?: string;
  targetName: string;
  targetPort?: string;
  pwd: string;
  fromWhere: FromWhere;
};

function generateServiceFreeTextFoundMessage(mg: ServiceFreeTextFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { targetType, targetName, targetPort, pwd, fromWhere } = mg[0];
    const type = targetType ?? "Service";
    const port = targetPort ? `with _port_:${targetPort}` : "";
    return `✅ Found ${i(type)}: ${c(targetName)} ${individualRef(fromWhere, pwd)} ${port}`;
  }

  const type = mg[0].targetType ?? "Service";
  const name = mg[0].targetName;

  const header = `✅ Found ${i(type)}: ${c(name)} in:`;
  return mg.reduce((acc, { targetName, targetPort, pwd, fromWhere }) => {
    const port = targetPort ? `with _port_:${targetPort}` : "";
    return acc + `\n- ${i(type)}: ${c(targetName)} ${listRef(fromWhere, pwd)} ${port}`;
  }, header);
}

type ReferencedBy = {
  type: "ReferencedBy";
  sourceType: string;
  sourceName: string;
  charIndex: number;
  pwd: string;
  fromWhere: FromWhere;
};

function generateReferencedByMessage(mg: ReferencedBy[]): string {
  if (mg.length === 0) {
    return "Error";
  }

  const line = (number: number, file: string) => {
    const doc = vscode.workspace.textDocuments.find((doc) => doc.fileName === file);
    if (!doc) {
      return "unknown";
    }
    return doc.positionAt(number).line + 1;
  };

  if (mg.length === 1) {
    const { sourceType, sourceName, charIndex, pwd, fromWhere } = mg[0];
    return `🔗 Referenced by ${i(sourceType)}: ${c(sourceName)} ${individualRef(
      fromWhere,
      pwd
    )} on line ${line(charIndex, fromWhere.path)}`;
  }

  const header = `🔗 Referenced by:`;
  return mg.reduce((acc, { sourceType, sourceName, pwd, fromWhere, charIndex }) => {
    return (
      acc +
      `\n- ${i(sourceType)}: ${c(sourceName)} ${listRef(fromWhere, pwd)} on line ${line(
        charIndex,
        fromWhere.path
      )}`
    );
  }, header);
}

function getRelativePath(path: string, pwd: string): string {
  const p = require("path");
  const fromFilePath = path;
  const relativeFilePathFromRoot = vscode.workspace.asRelativePath(fromFilePath || "");
  const activeDirPath: string = p.dirname(pwd || "");
  const relativePathFromActive: string = p.relative(activeDirPath || "", fromFilePath);
  return relativeFilePathFromRoot.length < relativePathFromActive.length
    ? "/" + relativeFilePathFromRoot
    : relativePathFromActive.includes("/")
    ? relativePathFromActive
    : "./" + relativePathFromActive;
}

function individualRef(fromWhere: FromWhere, pwd: string): string {
  const { place } = fromWhere;

  if (place === "cluster") {
    return `in Cluster (${c(fromWhere.path)})`;
  }

  if (place === "workspace") {
    return `in ${link(fromWhere, pwd)}`;
  }
  if (place === "kustomize" || place === "helm") {
    return `with ${i(capitalize(place))} at ${link(fromWhere, pwd)}`;
  }
  return "Error";
}

function listRef(fromWhere: FromWhere, pwd: string): string {
  const { place } = fromWhere;

  if (place === "cluster") {
    return `Cluster (${i(fromWhere.path)})`;
  }

  if (place === "kustomize" || place === "helm") {
    return `${link(fromWhere, pwd)} (${i(capitalize(fromWhere.place))})`;
  }

  return link(fromWhere, pwd);
}

function link(local: FromWhere, pwd: string): string {
  const { place, path } = local;

  if (place === "kustomize" || place === "helm") {
    const folder = path.substring(0, path.lastIndexOf("/"));
    const relativePath = getRelativePath(folder, pwd);
    return `[\`${relativePath}\`](${path})`;
  }

  const relativePath = getRelativePath(path, pwd);
  return `[\`${relativePath}\`](${path})`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const c = (s: string): string => `\`${s}\``;
const i = (s: string): string => `_${s}_`;

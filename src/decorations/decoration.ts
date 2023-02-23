import {
  window,
  DecorationOptions,
  Range,
  TextEditor,
  MarkdownString,
  Position,
  TextDocument,
} from "vscode";
import { ExclusiveArray, generateMessage, Message } from "./messages";
import { Highlight, HighLightType } from "../types";

const deco = window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 0.5em",
  },
});

export function decorate(editor: TextEditor, decorations: DecorationOptions[]) {
  editor.setDecorations(deco, decorations);
}

type DecorationGroup = {
  ln: number;
  highLightType: HighLightType;
  position: Position;
  message: ExclusiveArray<Message>;
};

export function highlightsToDecorations(
  doc: TextDocument,
  highlights: Highlight[],
  shift: number
): DecorationOptions[] {

  if (highlights.length === 0) {
    return [];
  }

  const decorations = highlights.map((highlight) => ({
    position: doc.lineAt(doc.positionAt(highlight.start + shift)).range.end,
    highlight: highlight,
  }));

  const grouped: DecorationGroup[] = decorations
    .sort((a, b) => a.highlight.type > b.highlight.type ? 1 : -1)
    .sort((a, b) => b.position.line - a.position.line)
    .reduce((acc, current, index) => {
      const previous = decorations[index - 1];
      const message = current.highlight.message;
      const currentLineNumber = current.position.line;
      if (
        previous &&
        previous.highlight.type === current.highlight.type &&
        previous.position.line === currentLineNumber
      ) {
        // @ts-ignore
        acc[acc.length - 1].message.push(message);
      } else {
        acc.push({
          ln: current.position.line,
          position: current.position,
          message: [message] as ExclusiveArray<Message>,
          highLightType: current.highlight.type,
        });
      }
      return acc;
    }, [] as DecorationGroup[]);

  return grouped.map((d) => getDecoration(generateMessage(d.message), d.highLightType, d.position));
}

function getDecoration(
  message: string,
  icon: HighLightType,
  posIndex: Position
): DecorationOptions {
  const markdown = new MarkdownString(message);
  markdown.isTrusted = true;

  const decoration: DecorationOptions = {
    range: new Range(posIndex, posIndex),
    hoverMessage: markdown,
    renderOptions: {
      after: {
        contentText: getEmoji(icon),
      },
    },
  };

  return decoration;
}

function getEmoji(highLightType: HighLightType) {
  const toEmoji: Record<HighLightType, string> = {
    "success": "✅",
    "error": "❌",
    "hint": "🤷‍♂️",
    "reference": "🔗",
    "dirty": "🧼",
  };
  return toEmoji[highLightType];
}

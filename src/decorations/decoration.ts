import { window, DecorationOptions, Range, TextEditor, MarkdownString, Position } from "vscode";
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
  highLightType: HighLightType;
  position: Position;
  message: ExclusiveArray<Message>;
};

export function highlightsToDecorations(highlights: Highlight[]): DecorationOptions[] {
  if (highlights.length === 0) {
    return [];
  }

  const grouped: DecorationGroup[] = highlights
    .filter((h) => h.position)
    .sort((a, b) => (a.type > b.type ? 1 : -1))
    .sort((a, b) => b.position!.line - a.position!.line)
    .reduce((acc, current, index) => {
      const previous = acc[acc.length - 1];
      const message = current.message;
      if (
        previous &&
        previous.highLightType === current.type &&
        previous.position!.line === current.position!.line
      ) {
        // @ts-ignore
        acc[acc.length - 1].message.push(message);
      } else {
        acc.push({
          position: current.position!,
          message: [message] as ExclusiveArray<Message>,
          highLightType: current.type,
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
    success: "✅",
    error: "❌",
    hint: "🤷‍♂️",
    reference: "🔗",
    dirty: "🧼",
  };
  return toEmoji[highLightType];
}

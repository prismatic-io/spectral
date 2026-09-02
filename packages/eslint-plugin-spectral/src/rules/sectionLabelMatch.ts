import { createRule, withSectionAnalysis } from "../sections";

type MessageIds = "mismatch";

export default createRule<[], MessageIds>({
  name: "section-label-match",
  meta: {
    type: "problem",
    docs: {
      description: "Require a sectionEnd label to match the label of the section it closes",
    },
    schema: [],
    messages: {
      mismatch:
        'This label "{{endLabel}}" does not match the open section "{{startLabel}}", so this call is ignored at runtime and the section is left open.',
    },
  },
  defaultOptions: [],
  create: withSectionAnalysis<MessageIds>((context, event) => {
    if (event.type !== "labelMismatch") {
      return;
    }

    context.report({
      node: event.node,
      messageId: "mismatch",
      data: { startLabel: event.startLabel, endLabel: event.endLabel },
    });
  }),
});

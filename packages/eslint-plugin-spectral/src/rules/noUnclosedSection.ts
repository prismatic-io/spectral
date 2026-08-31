import { createRule, withSectionAnalysis } from "../sections";

type MessageIds = "unclosed" | "unclosedUnknownLabel" | "strayEnd";

export default createRule<[], MessageIds>({
  name: "no-unclosed-section",
  meta: {
    type: "problem",
    docs: {
      description: "Require every log section to be closed in the function that opened it",
    },
    schema: [],
    messages: {
      unclosed:
        'The section "{{label}}" is never closed in this function. Call logger.sectionEnd({ label: "{{label}}" }) before the function returns.',
      unclosedUnknownLabel:
        "This section is never closed in this function. Call logger.sectionEnd() with the same label before the function returns.",
      strayEnd:
        "There is no open section for this logger.sectionEnd() to close, so it is ignored at runtime.",
    },
  },
  defaultOptions: [],
  create: withSectionAnalysis<MessageIds>((context, event) => {
    if (event.type === "strayEnd") {
      context.report({ node: event.node, messageId: "strayEnd" });
      return;
    }

    if (event.type !== "unclosed") {
      return;
    }

    if (event.label === undefined) {
      context.report({ node: event.node, messageId: "unclosedUnknownLabel" });
      return;
    }

    context.report({
      node: event.node,
      messageId: "unclosed",
      data: { label: event.label },
    });
  }),
});

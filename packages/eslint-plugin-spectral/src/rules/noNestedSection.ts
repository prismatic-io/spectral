import { createRule, withSectionAnalysis } from "../sections";

type MessageIds = "nested" | "nestedUnknownLabel";

export default createRule<[], MessageIds>({
  name: "no-nested-section",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow opening a log section while another section is still open",
    },
    schema: [],
    messages: {
      nested:
        'This section cannot be opened while the section "{{openLabel}}" is still open. Sections cannot be nested, so this call is ignored at runtime. Close the open section with logger.sectionEnd() first.',
      nestedUnknownLabel:
        "This section cannot be opened while another section is still open. Sections cannot be nested, so this call is ignored at runtime. Close the open section with logger.sectionEnd() first.",
    },
  },
  defaultOptions: [],
  create: withSectionAnalysis<MessageIds>((context, event) => {
    if (event.type !== "nested") {
      return;
    }

    if (event.openLabel === undefined) {
      context.report({ node: event.node, messageId: "nestedUnknownLabel" });
      return;
    }

    context.report({
      node: event.node,
      messageId: "nested",
      data: { openLabel: event.openLabel },
    });
  }),
});

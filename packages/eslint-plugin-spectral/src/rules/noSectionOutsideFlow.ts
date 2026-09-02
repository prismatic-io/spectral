import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule, withSectionCalls } from "../sections";

type MessageIds = "outsideFlow";

const HANDLER = "onExecution";

/**
 * A handler is normally an object property (`onExecution: async () => {}`), but a flow can
 * also be assembled from a separately declared function of the same name.
 */
const isHandler = (ancestor: TSESTree.Node): boolean => {
  if (ancestor.type === "Property" && !ancestor.computed) {
    if (ancestor.key.type === "Identifier") {
      return ancestor.key.name === HANDLER;
    }

    return ancestor.key.type === "Literal" && ancestor.key.value === HANDLER;
  }

  if (ancestor.type === "VariableDeclarator" && ancestor.id.type === "Identifier") {
    return ancestor.id.name === HANDLER;
  }

  return ancestor.type === "FunctionDeclaration" && ancestor.id?.name === HANDLER;
};

export default createRule<[], MessageIds>({
  name: "no-section-outside-flow",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow log sections outside of a code-native flow's onExecution handler",
    },
    schema: [],
    messages: {
      outsideFlow:
        "Call logger.{{name}}() inside a flow's onExecution handler rather than in a helper function. A section opened in a helper can nest inside its caller's section, which the runtime silently drops.",
    },
  },
  defaultOptions: [],
  create: withSectionCalls<MessageIds>((context, node, kind) => {
    const sourceCode: TSESLint.SourceCode = context.sourceCode ?? context.getSourceCode();

    if (sourceCode.getAncestors(node).some(isHandler)) {
      return;
    }

    context.report({
      node,
      messageId: "outsideFlow",
      data: { name: kind === "start" ? "section" : "sectionEnd" },
    });
  }),
});

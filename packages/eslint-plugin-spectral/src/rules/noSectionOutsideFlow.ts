import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule, withSectionCalls } from "../sections";

type MessageIds = "outsideFlow";
type Options = [{ handlers?: string[] }?];

const DEFAULT_HANDLERS = [
  "onExecution",
  "onTrigger",
  "onDeployTrigger",
  "onInstanceDeploy",
  "onInstanceDelete",
];

/**
 * A handler is normally an object property (`onExecution: async () => {}`), but a flow can
 * also be assembled from a separately declared function of the same name.
 */
const isHandler = (ancestor: TSESTree.Node, handlers: Set<string>): boolean => {
  if (ancestor.type === "Property" && !ancestor.computed) {
    if (ancestor.key.type === "Identifier") {
      return handlers.has(ancestor.key.name);
    }

    return (
      ancestor.key.type === "Literal" &&
      typeof ancestor.key.value === "string" &&
      handlers.has(ancestor.key.value)
    );
  }

  if (ancestor.type === "VariableDeclarator" && ancestor.id.type === "Identifier") {
    return handlers.has(ancestor.id.name);
  }

  return ancestor.type === "FunctionDeclaration" && !!ancestor.id && handlers.has(ancestor.id.name);
};

export default createRule<Options, MessageIds>({
  name: "no-section-outside-flow",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow log sections outside of a code-native flow handler",
    },
    schema: [
      {
        type: "object",
        properties: {
          handlers: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      outsideFlow:
        "Call logger.{{name}}() inside a flow handler ({{handlerList}}) rather than in a helper function. A section opened in a helper can nest inside its caller's section, which the runtime silently drops.",
    },
  },
  defaultOptions: [{}],
  create: withSectionCalls<MessageIds, Options>((context, node, kind) => {
    const handlers = new Set(context.options[0]?.handlers ?? DEFAULT_HANDLERS);
    const sourceCode: TSESLint.SourceCode = context.sourceCode ?? context.getSourceCode();

    if (sourceCode.getAncestors(node).some((ancestor) => isHandler(ancestor, handlers))) {
      return;
    }

    context.report({
      node,
      messageId: "outsideFlow",
      data: {
        name: kind === "start" ? "section" : "sectionEnd",
        handlerList: [...handlers].join(", "),
      },
    });
  }),
});

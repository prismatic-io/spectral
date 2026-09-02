import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, withSectionCalls } from "../sections";

type MessageIds = "sectionInLoop";

/** Sections a single flow execution records before the runtime stops recording them. */
const SECTION_LIMIT = 1000;

/** Array methods that call their callback once per element. */
const ITERATION_METHODS = new Set([
  "forEach",
  "map",
  "flatMap",
  "filter",
  "reduce",
  "reduceRight",
  "some",
  "every",
]);

/**
 * True when `child` is the part of `parent` that runs repeatedly: a loop body, or the
 * callback handed to an array iteration method. Matching the body specifically — rather
 * than just the ancestor's type — keeps a section opened in a `for` initializer, which
 * runs once, from being reported.
 */
const isRepeated = (parent: TSESTree.Node, child: TSESTree.Node): boolean => {
  switch (parent.type) {
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
      return parent.body === child;
    case "CallExpression":
      return (
        parent.callee.type === "MemberExpression" &&
        !parent.callee.computed &&
        parent.callee.property.type === "Identifier" &&
        ITERATION_METHODS.has(parent.callee.property.name) &&
        (parent.arguments as TSESTree.Node[]).includes(child)
      );
    default:
      return false;
  }
};

export default createRule<[], MessageIds>({
  name: "section-in-loop",
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn that log sections opened in a loop scale with the size of the data",
    },
    schema: [],
    messages: {
      sectionInLoop:
        "This opens one section per iteration, and a flow execution records at most {{limit}} sections. Past that limit the logs are still written, but are no longer grouped into sections. If this loop scales with the size of your data, open one section per batch instead of one per record.",
    },
  },
  defaultOptions: [],
  create: withSectionCalls<MessageIds>((context, node, kind) => {
    if (kind !== "start") {
      return;
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const path: TSESTree.Node[] = [...sourceCode.getAncestors(node), node];

    for (let index = 0; index < path.length - 1; index += 1) {
      if (isRepeated(path[index], path[index + 1])) {
        context.report({
          node,
          messageId: "sectionInLoop",
          data: { limit: SECTION_LIMIT },
        });
        return;
      }
    }
  }),
});

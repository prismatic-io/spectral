import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../sections";

type MessageIds = "distImport" | "distImportNoPublicPath";

const PACKAGE = "@prismatic-io/spectral";
const DIST = `${PACKAGE}/dist`;

/** dist/ modules whose exports are also available from a public entry point, so a bare source
 * rewrite is a safe fix. Keys are the path under dist/, without extension or a trailing /index. */
const PUBLIC_PATH_FOR: Record<string, string> = {
  "": PACKAGE,
  errors: PACKAGE,
  types: PACKAGE,
  "clients/http": `${PACKAGE}/http`,
  testing: `${PACKAGE}/testing`,
};

export const isDistImport = (source: string): boolean =>
  source === DIST || source.startsWith(`${DIST}/`);

/** The public import that exposes the same module, if there is one. */
export const publicPathFor = (source: string): string | undefined => {
  const underDist = source
    .slice(DIST.length)
    .replace(/^\//, "")
    .replace(/\.(js|cjs|mjs|ts|d\.ts)$/, "")
    .replace(/(^|\/)index$/, "");
  return PUBLIC_PATH_FOR[underDist];
};

export default createRule<[], MessageIds>({
  name: "no-dist-imports",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing from @prismatic-io/spectral's build output (dist/), which is deprecated in favor of its public entry points",
    },
    fixable: "code",
    schema: [],
    messages: {
      distImport:
        '"{{source}}" reaches into spectral\'s build output, which is deprecated and may stop resolving. Import from "{{replacement}}" instead.',
      distImportNoPublicPath:
        '"{{source}}" reaches into spectral\'s build output, which is deprecated and may stop resolving. Import what you need from "@prismatic-io/spectral" (or its "/http" and "/testing" entry points) instead; if it is not exported there, it is not part of the public API.',
    },
  },
  defaultOptions: [],
  create(context) {
    const check = (node: TSESTree.Node, source: TSESTree.Node) => {
      if (source.type !== "Literal" || typeof source.value !== "string") {
        return;
      }
      const value = source.value;
      if (!isDistImport(value)) {
        return;
      }

      const replacement = publicPathFor(value);
      if (replacement === undefined) {
        context.report({ node, messageId: "distImportNoPublicPath", data: { source: value } });
        return;
      }

      const quote = source.raw.startsWith("'") ? "'" : '"';
      context.report({
        node,
        messageId: "distImport",
        data: { source: value, replacement },
        fix: (fixer) => fixer.replaceText(source, `${quote}${replacement}${quote}`),
      });
    };

    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => {
        if (node.source) {
          check(node, node.source);
        }
      },
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      // `import("...").Thing` in a type position: the source sits inside a TSLiteralType.
      TSImportType: (node) =>
        check(node, node.argument.type === "TSLiteralType" ? node.argument.literal : node.argument),
      CallExpression: (node) => {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length === 1
        ) {
          check(node, node.arguments[0]);
        }
      },
    };
  },
});

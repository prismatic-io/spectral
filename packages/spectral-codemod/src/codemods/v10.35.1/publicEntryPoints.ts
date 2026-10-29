import { Node, SyntaxKind } from "ts-morph";
import { defineCodemod, eachFile } from "../../codemod";

/** Soft-deprecated dist paths and the public entry points that resolve to the same module. */
const ENTRY_POINTS = new Map([
  ["@prismatic-io/spectral/dist", "@prismatic-io/spectral"],
  ["@prismatic-io/spectral/dist/index", "@prismatic-io/spectral"],
  ["@prismatic-io/spectral/dist/clients/http", "@prismatic-io/spectral/http"],
  ["@prismatic-io/spectral/dist/clients/http/index", "@prismatic-io/spectral/http"],
  ["@prismatic-io/spectral/dist/testing", "@prismatic-io/spectral/testing"],
]);

/**
 * The entry point for a dist path, with or without a `.js` extension or a trailing slash.
 * Node once resolved `@prismatic-io/spectral/dist/` through the folder, but spectral's
 * exports list no such path.
 */
const entryPointFor = (specifier: string): string | undefined =>
  ENTRY_POINTS.get(specifier.replace(/\/+$/, "").replace(/\.js$/, ""));

const DIST_PATH = /^@prismatic-io\/spectral\/dist(?:\/|$)/;

/**
 * Whether a string names a module: an import or export source, an `import("...")` type, or
 * the first argument of a call such as `require`, dynamic `import`, or `vi.mock`.
 */
const namesModule = (node: Node): boolean => {
  const parent = node.getParent();
  if (!parent) return false;
  if (Node.isImportDeclaration(parent) || Node.isExportDeclaration(parent)) return true;
  if (Node.isLiteralTypeNode(parent)) return Node.isImportTypeNode(parent.getParent());
  return Node.isCallExpression(parent) && parent.getArguments()[0] === node;
};

export default defineCodemod({
  version: "10.35.1",
  name: "public-entry-points",
  description: "Import Spectral from its public entry points instead of dist/ paths",
  transform: eachFile((file, context) => {
    let changed = false;
    const unmoved = new Set<string>();
    for (const literal of file.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const specifier = literal.getLiteralValue();
      if (!DIST_PATH.test(specifier) || !namesModule(literal)) continue;
      const entryPoint = entryPointFor(specifier);
      if (entryPoint) {
        literal.setLiteralValue(entryPoint);
        changed = true;
      } else {
        unmoved.add(specifier);
      }
    }
    for (const specifier of unmoved) {
      context.warn(
        `${specifier} has no public entry point, so it stays as it is. Spectral's dist/ paths are deprecated; move off it by hand.`,
        file.getFilePath(),
      );
    }
    return changed;
  }),
});

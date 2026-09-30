import { Node, type Project, type SourceFile, SyntaxKind } from "ts-morph";
import { IDENTIFIER } from "./ast";
import {
  configVarsReads,
  findElement,
  isContextFunction,
  prependComments,
  type Replacement,
  rewriteConfigVarsReads,
} from "./configVarsReads";
import type { ClassifiedElement } from "./element";

const TODO = [
  "// TODO: Fix the configVars reads the codemod could not convert. Read saved values",
  "// from context.configuration and context.userConfiguration, and connections from",
  "// context.connections.",
].join("\n");

/** `?.key` or `?.["key"]`: a flow's configurations and connections can be absent. */
const optionalAccessor = (key: string): string =>
  IDENTIFIER.test(key) ? `?.${key}` : `?.[${JSON.stringify(key)}]`;

/**
 * Where a flow now reads a migrated config var: a connection from
 * `context.connections.<scope>`, a value from the configuration of its scope.
 */
const flowReplacement = (element: ClassifiedElement): Replacement =>
  element.kind === "connection"
    ? {
        contextProperty: "connections",
        access: `?.${element.scope}${optionalAccessor(element.key)}`,
      }
    : {
        contextProperty: element.scope === "instance" ? "configuration" : "userConfiguration",
        access: optionalAccessor(element.key),
      };

/**
 * Rewrites the `configVars` reads of every function in the project, other than those
 * inside `excluded`, to the context properties that replace them. A function left with
 * a read the codemod could not convert gets a TODO; the compiler flags the read, because
 * no config page declares config vars any more.
 *
 * Returns the files it changed.
 */
export const migrateFlowReads = (
  project: Project,
  elements: ClassifiedElement[],
  excluded: Node[],
): SourceFile[] => {
  const isExcluded = (node: Node): boolean =>
    excluded.some(
      (root) => !root.wasForgotten() && (node === root || node.getAncestors().includes(root)),
    );
  return project.getSourceFiles().filter((file) => {
    if (file.isDeclarationFile() || file.isInNodeModules()) {
      return false;
    }
    const functions = () =>
      file
        .getDescendants()
        .filter(isContextFunction)
        .filter((node) => !isExcluded(node));
    let changed = false;
    // Rewriting a read changes no function, so each keeps its index in the file.
    for (let index = 0; index < functions().length; index++) {
      const fn = () => functions()[index];
      if (configVarsReads(fn()).length === 0) {
        continue;
      }
      const { converted, unresolved } = rewriteConfigVarsReads(
        fn,
        (key) => findElement(elements, key, "instance"),
        flowReplacement,
      );
      const body = fn().getBody();
      if (unresolved && body) {
        prependComments(body, TODO);
      }
      changed ||= converted.length > 0 || unresolved;
    }
    return changed;
  });
};

/**
 * Points each `{ configVar: "<connection>" }` reference, such as a component trigger's
 * connection input, at the connection's new key, `<scope>.<key>`. A reference to any
 * other config var is left as it is.
 *
 * Returns the files it changed.
 */
export const migrateConfigVarReferences = (
  project: Project,
  elements: ClassifiedElement[],
): SourceFile[] =>
  project.getSourceFiles().filter((file) => {
    let changed = false;
    for (const property of file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (property.wasForgotten() || property.getName() !== "configVar") continue;
      const value = property.getInitializer();
      if (!Node.isStringLiteral(value) && !Node.isNoSubstitutionTemplateLiteral(value)) continue;
      const connection = elements.find(
        (element) => element.kind === "connection" && element.key === value.getLiteralText(),
      );
      if (connection) {
        property.setInitializer(JSON.stringify(`${connection.scope}.${connection.key}`));
        changed = true;
      }
    }
    return changed;
  });

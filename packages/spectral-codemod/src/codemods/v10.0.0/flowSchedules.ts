import {
  Node,
  type ObjectLiteralExpression,
  type Project,
  type PropertyAssignment,
  type ShorthandPropertyAssignment,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import {
  isSpectralImport,
  literalString,
  ownProperties,
  propertyValue,
  resolveObjectLiteral,
} from "./ast";
import { configVarsReadKeys, findElement, isContextFunction } from "./configVarsReads";
import type { ClassifiedElement } from "./element";

const DEPLOYER_SCHEDULE = "{ fromDeployer: true }";

const UNRESOLVED_TODO = [
  "// TODO: An integration with a configuration has no config vars, so this schedule",
  "// cannot read one. Use a fixed { value } or { fromDeployer: true }.",
].join("\n");

const sharedTodo = (key: string, flows: number): string =>
  [
    `// TODO: ${flows} flows read their schedule from the config var ${JSON.stringify(key)}.`,
    "// The deploying user now supplies a schedule for each flow.",
  ].join("\n");

type ScheduleProperty = PropertyAssignment | ShorthandPropertyAssignment;

interface FlowSchedule {
  property: ScheduleProperty;
  /** The schedule's object literal: inline, or the declaration the property refers to. */
  literal: ObjectLiteralExpression;
  element: ClassifiedElement | undefined;
}

/**
 * Rewrites each flow schedule that reads a config var to `{ fromDeployer: true }`. An
 * integration with a configuration has no config vars, so the deploying user supplies
 * the schedule and its timezone. A schedule that reads a config var the integration does
 * not declare gets a TODO, and so do the schedules of flows that shared one config var.
 *
 * Returns the files it changed, and the elements that only a schedule read. Those are
 * no longer part of the configuration.
 */
export const migrateFlowSchedules = (
  project: Project,
  elements: ClassifiedElement[],
): { files: SourceFile[]; scheduleOnly: Set<ClassifiedElement> } => {
  const files = sourceFiles(project);
  const schedules = files.flatMap((file) =>
    file.getDescendants().flatMap((node): FlowSchedule[] => {
      if (!isScheduleProperty(node)) return [];
      const literal = resolveObjectLiteral(propertyValue(node));
      if (!literal?.getProperty("configVar")) return [];
      const key = literalString(literal, "configVar");
      const element = key === undefined ? undefined : findElement(elements, key, "instance");
      return [
        { property: node, literal, element: element?.kind === "connection" ? undefined : element },
      ];
    }),
  );
  const scheduleOnly = scheduleOnlyElements(
    files,
    schedules.flatMap(({ element }) => element ?? []),
    schedules.map(({ literal }) => literal),
  );

  // Every edit is planned before any is made, because a rewrite forgets the nodes it
  // replaces.
  const flowsByElement = new Map<ClassifiedElement, number>();
  for (const { element } of schedules) {
    if (element) flowsByElement.set(element, (flowsByElement.get(element) ?? 0) + 1);
  }
  const edits = schedules.map(({ property, literal, element }) => ({
    property,
    // A schedule declared apart from its flow is rewritten where it is declared.
    literal: element && propertyValue(property) !== literal ? literal : undefined,
    text: element ? scheduleText(property) : property.getText(),
    todo: !element
      ? UNRESOLVED_TODO
      : (flowsByElement.get(element) ?? 0) > 1
        ? sharedTodo(element.key, flowsByElement.get(element) ?? 0)
        : undefined,
  }));
  const changed = new Set<SourceFile>();
  for (const { literal } of edits) {
    if (literal && !literal.wasForgotten()) {
      changed.add(literal.getSourceFile());
      literal.replaceWithText(DEPLOYER_SCHEDULE);
    }
  }
  for (const { property, text, todo } of edits) {
    if (text === property.getText() && !todo) continue;
    changed.add(property.getSourceFile());
    // ts-morph indents each added line as the property is indented.
    property.replaceWithText(todo ? `${todo}\n${text}` : text);
  }
  return { files: [...changed], scheduleOnly };
};

/** The property with its inline schedule replaced, or as it is when it refers to one. */
const scheduleText = (property: ScheduleProperty): string =>
  Node.isPropertyAssignment(property) && Node.isObjectLiteralExpression(property.getInitializer())
    ? `${property.getNameNode().getText()}: ${DEPLOYER_SCHEDULE}`
    : property.getText();

const sourceFiles = (project: Project): SourceFile[] =>
  project.getSourceFiles().filter((file) => !file.isDeclarationFile() && !file.isInNodeModules());

/** A `schedule` property of a flow definition. */
const isScheduleProperty = (node: Node): node is ScheduleProperty => {
  if (
    !(Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) ||
    node.getName() !== "schedule"
  ) {
    return false;
  }
  const literal = node.getParent();
  return Node.isObjectLiteralExpression(literal) && isFlow(literal);
};

/** The argument of spectral's `flow()`, or an object literal with an `onExecution`. */
const isFlow = (literal: ObjectLiteralExpression): boolean => {
  const parent = literal.getParent();
  if (Node.isCallExpression(parent) && isSpectralImport(parent.getExpression(), "flow")) {
    return true;
  }
  try {
    return ownProperties(literal).has("onExecution");
  } catch {
    return literal.getProperty("onExecution") !== undefined;
  }
};

/**
 * The elements of `scheduled` that nothing reads other than the `schedules`: no
 * `configVars` read names them, and no other `{ configVar }` refers to them. When a
 * function uses `configVars` without naming a key, any element could be read, so none
 * is schedule only.
 */
const scheduleOnlyElements = (
  files: SourceFile[],
  scheduled: ClassifiedElement[],
  schedules: ObjectLiteralExpression[],
): Set<ClassifiedElement> => {
  const read = new Set<string>();
  for (const file of files) {
    for (const fn of file.getDescendants().filter(isContextFunction)) {
      const { keys, dynamic } = configVarsReadKeys(fn);
      if (dynamic) return new Set();
      for (const key of keys) read.add(key);
    }
    for (const property of file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const parent = property.getParent();
      if (
        property.getName() === "configVar" &&
        Node.isObjectLiteralExpression(parent) &&
        !schedules.includes(parent)
      ) {
        const key = literalString(parent, "configVar");
        if (key !== undefined) read.add(key);
      }
    }
  }
  return new Set(scheduled.filter((element) => !read.has(element.key)));
};

import { ASTUtils, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";

const SECTION = "section";
const SECTION_END = "sectionEnd";

export const createRule = ESLintUtils.RuleCreator(
  () => "https://prismatic.io/docs/integrations/code-native/",
);

export type SectionCallKind = "start" | "end";

/**
 * What a rule was able to learn about a section label. `text` is only set when the
 * label resolves to a string at lint time; `variable` lets two labels be compared as
 * equal when they are the same binding even though its value is unknowable.
 */
interface LabelInfo {
  text?: string;
  variable?: TSESLint.Scope.Variable;
}

interface SectionCall {
  kind: SectionCallKind;
  node: TSESTree.CallExpression;
  label: LabelInfo | null;
}

export type SectionEvent =
  | { type: "nested"; node: TSESTree.CallExpression; openLabel?: string }
  | { type: "strayEnd"; node: TSESTree.CallExpression }
  | { type: "unclosed"; node: TSESTree.CallExpression; label?: string }
  | {
      type: "labelMismatch";
      node: TSESTree.CallExpression;
      startLabel: string;
      endLabel: string;
    };

type SectionRuleCreate<
  TMessageIds extends string,
  TOptions extends readonly unknown[] = [],
> = TSESLint.RuleModule<TMessageIds, TOptions>["create"];

const isLoggerName = (name: string): boolean => name.toLowerCase().endsWith("logger");

const isLoggerReceiver = (node: TSESTree.Node): boolean => {
  if (node.type === "Identifier") {
    return isLoggerName(node.name);
  }

  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    isLoggerName(node.property.name)
  );
};

const getSectionCallKind = (node: TSESTree.CallExpression): SectionCallKind | null => {
  const { callee } = node;

  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.property.type !== "Identifier"
  ) {
    return null;
  }

  if (!isLoggerReceiver(callee.object)) {
    return null;
  }

  if (callee.property.name === SECTION) {
    return "start";
  }

  return callee.property.name === SECTION_END ? "end" : null;
};

/** `sectionEnd({ label })` — the label lives on the options object, not the argument list. */
const getEndLabelArgument = (node: TSESTree.CallExpression): TSESTree.Expression | null => {
  const [argument] = node.arguments;

  if (argument?.type !== "ObjectExpression") {
    return null;
  }

  for (const property of argument.properties) {
    if (property.type !== "Property" || property.value.type === "AssignmentPattern") {
      continue;
    }

    if (ASTUtils.getPropertyName(property) === "label") {
      return property.value as TSESTree.Expression;
    }
  }

  return null;
};

const resolveLabel = (
  node: TSESTree.Node | null | undefined,
  scope: TSESLint.Scope.Scope,
): LabelInfo | null => {
  if (!node || node.type === "SpreadElement") {
    return null;
  }

  const variable = node.type === "Identifier" ? ASTUtils.findVariable(scope, node) : null;
  const text = ASTUtils.getStringIfConstant(node, scope);

  if (text !== null) {
    return { text, variable: variable ?? undefined };
  }

  if (!variable) {
    return null;
  }

  return { variable };
};

const compareLabels = (
  a: LabelInfo | null,
  b: LabelInfo | null,
): "match" | "mismatch" | "unknown" => {
  if (!a || !b) {
    return "unknown";
  }

  if (a.text !== undefined && b.text !== undefined) {
    return a.text === b.text ? "match" : "mismatch";
  }

  if (a.variable && a.variable === b.variable) {
    return "match";
  }

  return "unknown";
};

/**
 * Replays a scope's section calls the way the runtime logger does: a section opened
 * while another is still open is dropped, and an end whose label doesn't match the open
 * section is dropped. A mismatch closes the section here anyway so that one typo doesn't
 * also cascade into an "unclosed section" report.
 */
const simulate = (calls: SectionCall[]): SectionEvent[] => {
  const events: SectionEvent[] = [];
  let open: SectionCall | null = null;

  for (const call of calls) {
    if (call.kind === "start") {
      if (open) {
        events.push({ type: "nested", node: call.node, openLabel: open.label?.text });
      } else {
        open = call;
      }
      continue;
    }

    if (!open) {
      events.push({ type: "strayEnd", node: call.node });
      continue;
    }

    if (compareLabels(open.label, call.label) === "mismatch") {
      events.push({
        type: "labelMismatch",
        node: call.node,
        startLabel: open.label?.text as string,
        endLabel: call.label?.text as string,
      });
    }

    open = null;
  }

  if (open) {
    events.push({ type: "unclosed", node: open.node, label: open.label?.text });
  }

  return events;
};

/**
 * Walks each function body independently and hands the resulting section events to
 * `onEvent`. Calls are analyzed in source order per scope; a section opened in one
 * function and closed in another is out of reach of static analysis and is deliberately
 * not reported.
 */
export const withSectionAnalysis =
  <TMessageIds extends string>(
    onEvent: (
      context: Readonly<TSESLint.RuleContext<TMessageIds, []>>,
      event: SectionEvent,
    ) => void,
  ): SectionRuleCreate<TMessageIds> =>
  (context) => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const stack: SectionCall[][] = [];

    const enterScope = (): void => {
      stack.push([]);
    };

    const exitScope = (): void => {
      const calls = stack.pop();

      if (!calls?.length) {
        return;
      }

      for (const event of simulate(calls)) {
        onEvent(context, event);
      }
    };

    return {
      Program: enterScope,
      "Program:exit": exitScope,
      ":function": enterScope,
      ":function:exit": exitScope,
      CallExpression(node) {
        const kind = getSectionCallKind(node);

        if (!kind) {
          return;
        }

        const labelNode = kind === "start" ? node.arguments[0] : getEndLabelArgument(node);
        const label = resolveLabel(labelNode, sourceCode.getScope(node));

        stack[stack.length - 1]?.push({ kind, node, label });
      },
    };
  };

/**
 * Sees every section call on its own, without the per-scope pairing analysis. Rules that
 * only care about where a call appears use this.
 */
export const withSectionCalls =
  <TMessageIds extends string, TOptions extends readonly unknown[] = []>(
    onCall: (
      context: Readonly<TSESLint.RuleContext<TMessageIds, TOptions>>,
      node: TSESTree.CallExpression,
      kind: SectionCallKind,
    ) => void,
  ): SectionRuleCreate<TMessageIds, TOptions> =>
  (context) => ({
    CallExpression(node) {
      const kind = getSectionCallKind(node);

      if (kind) {
        onCall(context, node, kind);
      }
    },
  });

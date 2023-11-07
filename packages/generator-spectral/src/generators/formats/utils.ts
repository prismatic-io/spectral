import {
  ActionDefinition,
  ComponentDefinition,
  InputFieldDefinition,
  ConnectionDefinition,
  ConnectionInput as ConnectionInputDefinition,
  InputFieldChoice,
} from "@prismatic-io/spectral";
import { camelCase } from "lodash";
import stripTags from "striptags";
import { WriterFunction } from "ts-morph";
import { toWords } from "number-to-words";

const keywordReplacements: Record<string, string> = {
  default: "defaultValue",
  public: "isPublic",
  protected: "isProtected",
  private: "isPrivate",
  interface: "anInterface",
  context: "ctx",
  data: "aData",
  case: "aCase",
};

/** Convert key to a "safe key" or "clean identifier". Specifically avoiding Javascript/Typescript keywords
 * and invalid syntax (such as hyphenated identifiers or leading numbers).
 */
export const cleanIdentifier = (key: string): string =>
  keywordReplacements[key] ??
  camelCase(
    key.replace(
      /^([0-9])(.+)?$/,
      (_, num, rest = "") => `${toWords(num)}${rest}`
    )
  );

export const stripUndefined = <T extends Record<string, any>>(data: T): T =>
  Object.entries(data ?? {}).reduce<T>((result, [key, value]) => {
    if (typeof value === "undefined") {
      return result;
    }
    return { ...result, [key]: value };
  }, {} as T);

export const createDescription = (text?: string): string => {
  if (!text) {
    return "";
  }

  const strippedText = stripTags(text);
  const [nonEmptyLine] = strippedText.split("\n").filter((t) => t.trim() != "");
  const [fragment] = nonEmptyLine.split(/[.!?]/g);
  return escapeText(fragment);
};

export const escapeText = (text?: unknown): string => {
  if (!text) {
    return "";
  }
  return `${text}`.replace(/"/g, '\\"');
};

export type GeneratedFunction = string | WriterFunction;

export type Input = Omit<
  InputFieldDefinition,
  "clean" | "collection" | "model"
> & {
  clean: GeneratedFunction;
  /** Upstream API key for this input */
  upstreamKey: string;
  /** Key to use in code generation */
  key: string;
  // FIXME: Improve type safety here by using the original model definition from InputFieldDefinition.
  model?: InputFieldChoice[];
};

export type Action = Omit<
  ActionDefinition<any, any, any>,
  | "perform"
  | "terminateExecution"
  | "breakLoop"
  | "allowsBranching"
  | "staticBranchNames"
  | "dynamicBranchInput"
> & {
  perform: GeneratedFunction;
  groupTag?: string;
  key: string;
};

export type ConnectionInput = ConnectionInputDefinition;
export type Connection = ConnectionDefinition & {
  /** Ordering priority for this Connection. Lower values will be earlier in the preferred Connection sequence. */
  orderPriority: number;
};

export type Component = Pick<ComponentDefinition<false>, "display">;

export interface Result {
  baseUrl: string;
  component: Component;
  actions: Action[];
  connections: Connection[];
}

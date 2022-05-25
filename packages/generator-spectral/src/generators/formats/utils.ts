import {
  ActionDefinition,
  ComponentDefinition,
  InputFieldDefinition,
  ConnectionDefinition,
  ConnectionInput as ConnectionInputDefinition,
  InputFieldChoice,
} from "@prismatic-io/spectral";
import stripTags from "striptags";
import { WriterFunction } from "ts-morph";

export const stripUndefined = <T extends Record<string, any>>(data: T): T =>
  Object.entries(data ?? {}).reduce<T>((result, [key, value]) => {
    if (typeof value === "undefined") {
      return result;
    }
    return { ...result, [key]: value };
  }, {} as T);

export const escapeQuotes = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/"/g, '\\"');
};

export const createDescription = (text?: string): string => {
  if (!text) {
    return "";
  }

  const strippedText = stripTags(text);
  const [nonEmptyLine] = strippedText.split("\n").filter((t) => t.trim() != "");
  const [fragment] = nonEmptyLine.split(/[.!?]/g);
  return fragment.replace(/[`'"]/g, '\\"');
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
export type Connection = ConnectionDefinition;

export type Component = Pick<ComponentDefinition<false>, "display">;

export interface Result {
  baseUrl: string;
  component: Component;
  actions: Action[];
  connections: Connection[];
}

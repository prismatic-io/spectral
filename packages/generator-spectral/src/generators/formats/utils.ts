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

// TODO: Find a better solution than this function.
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
  key: string;
  // FIXME: Improve type safety here by using the original model definition.
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

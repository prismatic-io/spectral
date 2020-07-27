import {
  ComponentDefinition,
  ActionDefinition,
  InputFieldDefinition,
} from "./types";

export const component = (definition: ComponentDefinition) => definition;
export const action = (
  definition: ActionDefinition
): Record<string, ActionDefinition> => ({
  [definition.key]: definition,
});
export const input = (definition: InputFieldDefinition) => definition;

// Make types defined in types.ts importable from @prismatic-io/spectral
export * from "./types";

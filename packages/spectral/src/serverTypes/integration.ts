import type { StepErrorConfig } from "../types";

export const DefinitionVersion = 7;

export type ComponentReference =
  | {
      component: {
        key: string;
        version: number | "LATEST";
        isPublic: boolean;
      };
      key: string;
      template?: string;
    }
  | {
      component: {
        key: string;
        signature: string;
        isPublic: boolean;
      };
      key: string;
      template?: string;
    };

export type Input =
  | {
      name?: string | Input;
      type: "value" | "reference" | "configVar" | "template";
      value: string;
      meta?: Record<string, unknown>;
    }
  | {
      name?: string | Input;
      type: "complex";
      value: string | Input | Input[];
      meta?: Record<string, unknown>;
    };

/** A step of a flow in the integration definition. */
export interface Step {
  name: string;
  stableKey: string;
  description: string;
  isTrigger?: boolean;
  action?: ComponentReference;
  inputs?: Record<string, Input>;
  branches?: { name: string; steps: Step[] }[];
  schedule?: Record<string, unknown>;
  errorConfig?: Partial<StepErrorConfig>;
}

export interface ConnectionRequiredConfigVariable {
  key: string;
  stableKey: string;
  description?: string;
  orgOnly?: boolean;
  dataType: "connection";
  onPremiseConnectionConfig?: string;
  connection: ComponentReference;
  inputs?: Record<string, Input>;
  meta?: Record<string, unknown>;
}

export interface DefaultRequiredConfigVariable {
  key: string;
  stableKey: string;
  defaultValue?: string;
  dataType:
    | "string"
    | "date"
    | "timestamp"
    | "picklist"
    | "schedule"
    | "code"
    | "boolean"
    | "number"
    | "objectSelection"
    | "objectFieldMap"
    | "jsonForm";
  pickList?: string[];
  scheduleType?: "none" | "once" | "custom" | "minute" | "hour" | "day" | "week";
  timeZone?: string;
  codeLanguage?: "json" | "xml" | "html";
  description?: string;
  orgOnly?: boolean;
  collectionType?: "valuelist" | "keyvaluelist";
  dataSource?: ComponentReference;
  inputs?: Record<string, Input>;
  meta?: Record<string, unknown>;
}

export interface FieldMappingStaticOptionDefinition {
  key: string;
  label?: string;
}

/** A side has exactly one of `dataSource` or `staticOptions`. */
export type FieldMappingSideDefinition =
  | { dataSource: ComponentReference; inputs?: Record<string, Input> }
  | { staticOptions: FieldMappingStaticOptionDefinition[] };

export interface FieldMappingRuleDefinition {
  mode: "required" | "optional" | "static";
  sourceField?: string;
  destField?: string;
}

export interface FieldMappingDefinition {
  source: FieldMappingSideDefinition;
  destination: FieldMappingSideDefinition;
  allowAdditionalMappings?: boolean;
  allowNewFields?: boolean;
  rules?: FieldMappingRuleDefinition[];
}

export interface FieldMappingRequiredConfigVariable {
  key: string;
  stableKey: string;
  description?: string;
  orgOnly?: boolean;
  dataType: "fieldMapping";
  fieldMapping: FieldMappingDefinition;
  /** The platform refuses top-level inputs on a field mapping. Each side has its own inputs. */
  inputs?: never;
  meta?: Record<string, unknown>;
}

export interface OrganizationActivatedConnectionRequiredConfigVariable {
  key: string;
  dataType: "connection";
  inputs?: never;
  useScopedConfigVar: string;
}

export type RequiredConfigVariable =
  | DefaultRequiredConfigVariable
  | ConnectionRequiredConfigVariable
  | OrganizationActivatedConnectionRequiredConfigVariable
  | FieldMappingRequiredConfigVariable;

export interface ConfigPage {
  name: string;
  tagline?: string;
  userLevelConfigured?: boolean;
  elements: ConfigPageElement[];
}

export interface ConfigPageElement {
  type: "configVar" | "htmlElement" | "jsonForm";
  value: string;
}

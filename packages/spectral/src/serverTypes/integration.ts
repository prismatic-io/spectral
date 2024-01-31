export const DefinitionVersion = 7;

export interface ComponentReference {
  key: string;
  version: number | "LATEST";
  isPublic: boolean;
}

export type Input =
  | {
      name?: string;
      type: "value" | "reference" | "configVar" | "template";
      value: string;
      meta?: Record<string, unknown>;
    }
  | {
      name?: string;
      type: "complex";
      value: string | Input;
      meta?: Record<string, unknown>;
    };

export interface ConnectionRequiredConfigVariable {
  key: string;
  stableKey: string;
  description?: string;
  orgOnly?: boolean;
  dataType: "connection";
  connection: {
    component: ComponentReference;
    key: string;
  };
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
  scheduleType?: "none" | "custom" | "minute" | "hour" | "day" | "week";
  timeZone?: string;
  codeLanguage?: "json" | "xml" | "html";
  description?: string;
  orgOnly?: boolean;
  collectionType?: "valuelist" | "keyvaluelist";
  dataSource?: {
    component: ComponentReference;
    key: string;
  };
  inputs?: Record<string, Input>;
  meta?: Record<string, unknown>;
}

export type RequiredConfigVariable =
  | DefaultRequiredConfigVariable
  | ConnectionRequiredConfigVariable;

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

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
      value: string | Input;
      meta?: Record<string, unknown>;
    };

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
  scheduleType?: "none" | "custom" | "minute" | "hour" | "day" | "week";
  timeZone?: string;
  codeLanguage?: "json" | "xml" | "html";
  description?: string;
  orgOnly?: boolean;
  collectionType?: "valuelist" | "keyvaluelist";
  dataSource?: ComponentReference;
  inputs?: Record<string, Input>;
  meta?: Record<string, unknown>;
}

export interface OrganizationActivatedConnectionRequiredConfigVariable {
  key: string;
  dataType: "connection";
  orgOnly: false;
  inputs?: never;
  useScopedConfigVar: string;
}

export type RequiredConfigVariable =
  | DefaultRequiredConfigVariable
  | ConnectionRequiredConfigVariable
  | OrganizationActivatedConnectionRequiredConfigVariable;

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

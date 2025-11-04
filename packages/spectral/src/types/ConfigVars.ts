import type { ValidationMode } from "./jsonforms/ValidationMode";
import type { Prettify, UnionToIntersection } from "./utils";

import { isComponentReference } from "./ComponentRegistry";
import type {
  ComponentRegistryConnection,
  ComponentRegistryDataSource,
  DataSourceReference,
} from "./ComponentRegistry";
import type {
  ConfigVarResultCollection,
  Connection,
  Inputs,
  JSONForm,
  ObjectFieldMap,
  ObjectSelection,
  Schedule,
} from "./Inputs";
import type { CollectionDataSourceType, DataSourceType } from "./DataSourceResult";
import type { DataSourceDefinition } from "./DataSourceDefinition";
import type { ConnectionDefinition } from "./ConnectionDefinition";
import type {
  OrganizationActivatedConnectionConfigVar,
  ScopedConfigVarMap,
} from "./ScopedConfigVars";
import type {
  ConfigPage,
  ConfigPageElement,
  ConfigPages,
  UserLevelConfigPages,
} from "./ConfigPages";

/** Supported data types for config variables. */
export type ConfigVarDataType =
  | "string"
  | "date"
  | "timestamp"
  | "picklist"
  | "code"
  | "boolean"
  | "number"
  | "schedule"
  | "objectSelection"
  | "objectFieldMap"
  | "jsonForm"
  | "htmlElement";

type ConfigVarDataTypeDefaultValueMap<
  TMap extends Record<ConfigVarDataType, unknown> = {
    string: string;
    date: string;
    timestamp: string;
    picklist: string;
    code: string;
    boolean: boolean;
    number: number;
    schedule: string;
    objectSelection: ObjectSelection;
    objectFieldMap: ObjectFieldMap;
    jsonForm: JSONForm;
    htmlElement: string;
  },
> = TMap;

type ConfigVarDataTypeRuntimeValueMap<
  TMap extends Record<ConfigVarDataType, unknown> = {
    string: string;
    date: string;
    timestamp: string;
    picklist: string;
    code: string;
    boolean: boolean;
    number: number;
    schedule: Schedule;
    objectSelection: ObjectSelection;
    objectFieldMap: ObjectFieldMap;
    jsonForm: unknown;
    htmlElement: string;
  },
> = TMap;

/** Choices of collection types for multi-value config vars. */
export type CollectionType = "valuelist" | "keyvaluelist";

type ConfigVarSingleDataType = Extract<
  ConfigVarDataType,
  "schedule" | "objectSelection" | "objectFieldMap" | "jsonForm"
>;

export type PermissionAndVisibilityType = "customer" | "embedded" | "organization";

export interface ConfigVarVisibility {
  /**
   * Optional value that sets the permission and visibility of the config variable. See
   * https://prismatic.io/docs/integrations/code-native/config-wizard/#config-variable-visibility-in-code-native
   *
   * - `"customer"` - Customers can view and edit the config variable.
   * - `"embedded"` - Customers cannot view or update the config variable as the value will be set programmatically.
   * - `"organization"` - Customers cannot view or update the config variable as it will always have a default value or be set by the organization.
   *
   * @default `"customer"`
   */
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  /**
   * Optional value that specifies whether this config var is visible to an organization deployer.
   * @default true
   */
  visibleToOrgDeployer?: boolean;
}

interface ConfigVarInputVisibility {
  /**
   * Optional value that sets the permission and visibility of the config variable input. See
   * https://prismatic.io/docs/integrations/code-native/config-wizard/#config-variable-visibility-in-code-native
   *
   * - `"customer"` - Customers can view and edit the config variable input.
   * - `"embedded"` - Customers cannot view or update the config variable input as the value will be set programmatically.
   * - `"organization"` - Customers cannot view or update the config variable input as it will always have a default value or be set by the organization.
   *
   * @default `"customer"`
   */
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  /**
   * Optional value that specifies whether this config var input is visible to an organization deployer.
   * @default true
   */
  visibleToOrgDeployer?: boolean;
}

/** Common attribute shared by all types of config variables. */
type BaseConfigVar = {
  /** A unique, unchanging value that is used to maintain identity for the config variable even if the key changes. */
  stableKey: string;
  /** Description for this config variable. */
  description?: string;
} & ConfigVarVisibility;

type GetDynamicProperties<
  TValue,
  TCollectionType extends CollectionType | undefined,
> = TCollectionType extends undefined
  ? {
      defaultValue?: TValue;
      /** Value to specify the type of collection if the config variable is multi-value. */
      collectionType?: undefined;
    }
  : TCollectionType extends "valuelist"
    ? {
        defaultValue?: TValue[];
        /** Value to specify the type of collection if the config variable is multi-value. */
        collectionType: "valuelist";
      }
    : {
        defaultValue?: Record<string, TValue> | Array<{ key: string; value: TValue }>;
        /** Value to specify the type of collection if the config variable is multi-value. */
        collectionType: "keyvaluelist";
      };

type StandardConfigVarDynamicProperties<TDataType extends ConfigVarDataType> =
  | CollectionType
  | undefined extends infer TCollectionType
  ? TCollectionType extends CollectionType | undefined
    ? TDataType extends ConfigVarSingleDataType
      ? TCollectionType extends undefined
        ? GetDynamicProperties<ConfigVarDataTypeDefaultValueMap[TDataType], undefined>
        : never
      : GetDynamicProperties<ConfigVarDataTypeDefaultValueMap[TDataType], TCollectionType>
    : never
  : never;

type CreateStandardConfigVar<TDataType extends ConfigVarDataType> = BaseConfigVar &
  StandardConfigVarDynamicProperties<TDataType> & {
    /** The data type of the config variable. */
    dataType: TDataType;
  };

type StringConfigVar = CreateStandardConfigVar<"string">;

type DateConfigVar = CreateStandardConfigVar<"date">;

type TimestampConfigVar = CreateStandardConfigVar<"timestamp">;

type PicklistConfigVar = CreateStandardConfigVar<"picklist"> & {
  /** List of picklist values. */
  pickList: string[];
};

/** Syntax highlighting to use for this code config variable. */
export type CodeLanguageType = "json" | "xml" | "html";

type CodeConfigVar = CreateStandardConfigVar<"code"> & {
  /** Value to specify the type of language of a code config variable. */
  codeLanguage: CodeLanguageType;
};

type BooleanConfigVar = CreateStandardConfigVar<"boolean">;

type NumberConfigVar = CreateStandardConfigVar<"number">;

type ScheduleConfigVar = CreateStandardConfigVar<"schedule"> & {
  /** Timezone for the schedule. */
  timeZone?: string;
};

type ObjectSelectionConfigVar = CreateStandardConfigVar<"objectSelection">;

type ObjectFieldMapConfigVar = CreateStandardConfigVar<"objectFieldMap">;

type JsonFormConfigVar = CreateStandardConfigVar<"jsonForm"> & {
  validationMode?: ValidationMode;
};

type JsonFormDataSourceDefinitionConfigVar = DataSourceDefinitionConfigVar & {
  validationMode?: ValidationMode;
};

type HtmlElementConfigVar = CreateStandardConfigVar<"htmlElement">;

export type StandardConfigVar =
  | StringConfigVar
  | DateConfigVar
  | TimestampConfigVar
  | PicklistConfigVar
  | CodeConfigVar
  | BooleanConfigVar
  | NumberConfigVar
  | ScheduleConfigVar
  | ObjectSelectionConfigVar
  | ObjectFieldMapConfigVar
  | JsonFormConfigVar
  | HtmlElementConfigVar;

// Data Source Config Vars
type BaseDataSourceConfigVar<TDataSourceType extends DataSourceType = DataSourceType> =
  TDataSourceType extends CollectionDataSourceType
    ? {
        dataSourceType: TDataSourceType;
        collectionType?: CollectionType | undefined;
      } & BaseConfigVar
    : TDataSourceType extends Exclude<DataSourceType, CollectionDataSourceType>
      ? TDataSourceType extends Extract<DataSourceType, "jsonForm">
        ? BaseConfigVar & {
            dataSourceType: Extract<DataSourceType, "jsonForm">;
            collectionType?: undefined;
            validationMode?: ValidationMode;
          }
        : BaseConfigVar & {
            dataSourceType: TDataSourceType;
            collectionType?: undefined;
          }
      :
          | ({
              dataSourceType: Extract<CollectionDataSourceType, TDataSourceType>;
              collectionType: CollectionType;
            } & BaseConfigVar)
          | (BaseConfigVar & {
              dataSourceType: Extract<
                Exclude<DataSourceType, CollectionDataSourceType>,
                TDataSourceType
              >;
              collectionType?: undefined;
            });

type DataSourceDefinitionConfigVar = DataSourceType extends infer TDataSourceType
  ? TDataSourceType extends DataSourceType
    ? BaseDataSourceConfigVar<TDataSourceType> &
        Omit<
          DataSourceDefinition<Inputs, ConfigVarResultCollection, TDataSourceType>,
          "display" | "inputs" | "examplePayload" | "detailDataSource"
        >
    : never
  : never;

type DataSourceReferenceConfigVar =
  ComponentRegistryDataSource extends infer TDataSourceReference extends ComponentRegistryDataSource
    ? Omit<BaseDataSourceConfigVar<TDataSourceReference["dataSourceType"]>, "dataSourceType"> & {
        dataSource: TDataSourceReference["reference"];
        validationMode?: ValidationMode;
      }
    : never;

/** Defines attributes of a data source config variable. */
export type DataSourceConfigVar = DataSourceDefinitionConfigVar | DataSourceReferenceConfigVar;

// Connection Config Vars
type BaseConnectionConfigVar = BaseConfigVar & {
  dataType: "connection";
};

type ConnectionDefinitionConfigVar =
  ConnectionDefinition extends infer TConnectionDefinitionType extends ConnectionDefinition
    ? TConnectionDefinitionType extends infer TConnectionDefinition extends ConnectionDefinition
      ? BaseConnectionConfigVar &
          Omit<TConnectionDefinition, "inputs" | "display" | "key"> & {
            icons?: TConnectionDefinition["display"]["icons"];
            inputs: {
              [Key in keyof TConnectionDefinition["inputs"]]: TConnectionDefinition["inputs"][Key] &
                ConfigVarInputVisibility;
            };
          }
      : never
    : never;

type OnPremiseConnectionConfigTypeEnum = "allowed" | "disallowed" | "required";

type ConnectionReferenceConfigVar = ComponentRegistryConnection extends infer TConnectionReference
  ? TConnectionReference extends ComponentRegistryConnection
    ? BaseConnectionConfigVar & {
        connection: TConnectionReference["reference"] &
          ("onPremAvailable" extends keyof TConnectionReference
            ? TConnectionReference["onPremAvailable"] extends true
              ? {
                  template?: string;
                  onPremiseConnectionConfig?: OnPremiseConnectionConfigTypeEnum;
                }
              : {
                  template?: string;
                  onPremiseConnectionConfig?: undefined;
                }
            : {
                template?: string;
                onPremiseConnectionConfig?: undefined;
              });
      }
    : never
  : never;

/** Defines attributes of a config variable that represents a connection. */
export type ConnectionConfigVar = ConnectionDefinitionConfigVar | ConnectionReferenceConfigVar;

export type ConfigVar =
  | StandardConfigVar
  | DataSourceConfigVar
  | ConnectionConfigVar
  | OrganizationActivatedConnectionConfigVar;

type WithCollectionType<TValue, TCollectionType extends CollectionType | undefined> =
  | undefined
  | unknown extends TCollectionType
  ? TValue
  : TCollectionType extends "valuelist"
    ? TValue[]
    : Array<{ key: string; value: TValue }>;

type GetDataSourceReference<
  TComponent extends DataSourceReference["component"],
  TKey extends DataSourceReference["key"],
> = ComponentRegistryDataSource extends infer TDataSourceReference
  ? TDataSourceReference extends ComponentRegistryDataSource
    ? TComponent extends TDataSourceReference["reference"]["component"]
      ? TKey extends TDataSourceReference["reference"]["key"]
        ? TDataSourceReference
        : never
      : never
    : never
  : never;

type DataSourceToRuntimeType<TElement extends ConfigPageElement> =
  TElement extends DataSourceDefinitionConfigVar
    ? TElement["dataSourceType"] extends infer TType
      ? TType extends DataSourceType
        ? ConfigVarDataTypeRuntimeValueMap[TType]
        : never
      : never
    : TElement extends DataSourceReferenceConfigVar
      ? GetDataSourceReference<
          TElement["dataSource"]["component"],
          TElement["dataSource"]["key"]
        >["dataSourceType"] extends infer TType
        ? TType extends DataSourceType
          ? ConfigVarDataTypeRuntimeValueMap[TType]
          : never
        : never
      : never;

type ElementToRuntimeType<TElement extends ConfigPageElement> = TElement extends ConfigVar
  ? TElement extends ConnectionConfigVar
    ? Connection
    : TElement extends StandardConfigVar
      ? WithCollectionType<
          ConfigVarDataTypeRuntimeValueMap[TElement["dataType"]],
          TElement["collectionType"]
        >
      : TElement extends DataSourceConfigVar
        ? WithCollectionType<DataSourceToRuntimeType<TElement>, TElement["collectionType"]>
        : never
  : never;

type ExtractConfigVars<TConfigPages extends { [key: string]: ConfigPage }> =
  keyof TConfigPages extends infer TPageName
    ? TPageName extends keyof TConfigPages
      ? TConfigPages[TPageName] extends infer TConfigPage
        ? TConfigPage extends ConfigPage
          ? {
              [Key in keyof TConfigPage["elements"] as Key extends string
                ? TConfigPage["elements"][Key] extends ConfigVar
                  ? Key
                  : never
                : never]: ElementToRuntimeType<TConfigPage["elements"][Key]>;
            }
          : never
        : never
      : never
    : never;

type ExtractScopedConfigVars<
  TScopedConfigVarMap extends {
    [key: string]: string | OrganizationActivatedConnectionConfigVar;
  },
> = keyof TScopedConfigVarMap extends infer TScopedConfigVarName
  ? TScopedConfigVarName extends keyof TScopedConfigVarMap
    ? TScopedConfigVarMap[TScopedConfigVarName] extends infer TScopedConfigVar
      ? TScopedConfigVar extends OrganizationActivatedConnectionConfigVar
        ? {
            [Key in keyof TScopedConfigVarMap as Key extends string
              ? TScopedConfigVarMap[Key] extends OrganizationActivatedConnectionConfigVar
                ? Key
                : never
              : never]: Connection;
          }
        : never
      : never
    : never
  : never;

export type ConfigVars = Prettify<UnionToIntersection<ExtractConfigVars<ConfigPages>>> &
  Prettify<UnionToIntersection<ExtractConfigVars<UserLevelConfigPages>>> &
  Prettify<UnionToIntersection<ExtractScopedConfigVars<ScopedConfigVarMap>>>;

export const isHtmlElementConfigVar = (cv: ConfigVar): cv is HtmlElementConfigVar =>
  "dataType" in cv && cv.dataType === "htmlElement";

export const isCodeConfigVar = (cv: ConfigVar): cv is CodeConfigVar =>
  "dataType" in cv && cv.dataType === "code";

export const isScheduleConfigVar = (cv: ConfigVar): cv is ScheduleConfigVar =>
  "dataType" in cv && cv.dataType === "schedule";

export const isJsonFormConfigVar = (cv: ConfigVar): cv is JsonFormConfigVar =>
  "dataType" in cv && cv.dataType === "jsonForm";

export const isJsonFormDataSourceConfigVar = (
  cv: ConfigVar,
): cv is JsonFormDataSourceDefinitionConfigVar =>
  "dataSourceType" in cv && cv.dataSourceType === "jsonForm";

export const isDataSourceDefinitionConfigVar = (
  cv: ConfigVar,
): cv is DataSourceDefinitionConfigVar =>
  "dataSourceType" in cv && "perform" in cv && typeof cv.perform === "function";

export const isDataSourceReferenceConfigVar = (
  // FIXME: Module augmetation causes this to produce a compile error while
  // running `tsd`. I'm pretty uncertain how this happens but leaving as
  // `unkonwn` is fine for now.
  cv: unknown,
): cv is DataSourceReferenceConfigVar =>
  typeof cv === "object" &&
  cv !== null &&
  "dataSource" in cv &&
  isComponentReference((cv as DataSourceReferenceConfigVar).dataSource);

export const isConnectionDefinitionConfigVar = (
  cv: ConfigVar,
): cv is ConnectionDefinitionConfigVar =>
  "dataType" in cv && cv.dataType === "connection" && "inputs" in cv;

export const isConnectionReferenceConfigVar = (
  // FIXME: Module augmetation causes this to produce a compile error while
  // running `tsd`. I'm pretty uncertain how this happens but leaving as
  // `unkonwn` is fine for now.
  cv: unknown,
): cv is ConnectionReferenceConfigVar =>
  typeof cv === "object" &&
  cv !== null &&
  "connection" in cv &&
  isComponentReference((cv as ConnectionReferenceConfigVar).connection);

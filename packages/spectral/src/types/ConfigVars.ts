import { ValidationMode } from "@jsonforms/core";
import {
  type DataSourceDefinition,
  type ConnectionDefinition,
  type Inputs,
  type DataSourceType,
  type Connection,
  type JSONForm,
  type ObjectFieldMap,
  type ObjectSelection,
  type ConfigVarResultCollection,
  type Schedule,
  type CollectionDataSourceType,
  type DataSourceReference,
  isComponentReference,
  type ConfigPage,
  type ConfigPages,
  type ConfigPageElement,
  type ComponentRegistryDataSource,
  type ComponentRegistryConnection,
  type UserLevelConfigPages,
  type OrganizationActivatedConnectionConfigVar,
  type ScopedConfigVarMap,
} from ".";
import type { Prettify, UnionToIntersection } from "./utils";

/** Supported data types for Config Vars. */
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
  | "jsonForm";

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
  },
> = TMap;

/** Choices of collection types for multi-value Config Vars. */
export type CollectionType = "valuelist" | "keyvaluelist";

type ConfigVarSingleDataType = Extract<
  ConfigVarDataType,
  "schedule" | "objectSelection" | "objectFieldMap" | "jsonForm"
>;

export type PermissionAndVisibilityType = "customer" | "embedded" | "organization";

export interface ConfigVarVisibility {
  /**
   * Optional value that sets the permission and visibility of the Config Var. @default "customer"
   *
   * "customer" - Customers can view and edit the Config Var.
   * "embedded" - Customers cannot view or update the Config Var as the value will be set programmatically.
   * "organization" - Customers cannot view or update the Config Var as it will always have a default value or be set by the organization.
   */
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  /** Optional value that specifies whether this Config Var is visible to an Organization deployer. @default true */
  visibleToOrgDeployer?: boolean;
}

export interface ConfigVarInputVisibility {
  /**
   * Optional value that sets the permission and visibility of the Config Var Input. @default "customer"
   *
   * "customer" - Customers can view and edit the Config Var Input.
   * "embedded" - Customers cannot view or update the Config Var Input as the value will be set programmatically.
   * "organization" - Customers cannot view or update the Config Var Input as it will always have a default value or be set by the organization.
   */
  permissionAndVisibilityType?: PermissionAndVisibilityType;
  /** Optional value that specifies whether this Config Var Input is visible to an Organization deployer. @default true */
  visibleToOrgDeployer?: boolean;
}

/** Common attribute shared by all types of Config Vars. */
type BaseConfigVar = {
  /** A unique, unchanging value that is used to maintain identity for the Config Var even if the key changes. */
  stableKey: string;
  /** Optional description for this Config Var. */
  description?: string;
} & ConfigVarVisibility;

type GetDynamicProperties<
  TValue,
  TCollectionType extends CollectionType | undefined,
> = TCollectionType extends undefined
  ? {
      defaultValue?: TValue;
      /** Optional value to specify the type of collection if the Config Var is multi-value. */
      collectionType?: undefined;
    }
  : TCollectionType extends "valuelist"
    ? {
        defaultValue?: TValue[];
        /** Optional value to specify the type of collection if the Config Var is multi-value. */
        collectionType: "valuelist";
      }
    : {
        defaultValue?: Record<string, TValue> | Array<{ key: string; value: TValue }>;
        /** Optional value to specify the type of collection if the Config Var is multi-value. */
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
    /** The data type of the Config Var. */
    dataType: TDataType;
  };

type StringConfigVar = CreateStandardConfigVar<"string">;

type DateConfigVar = CreateStandardConfigVar<"date">;

type TimestampConfigVar = CreateStandardConfigVar<"timestamp">;

type PicklistConfigVar = CreateStandardConfigVar<"picklist"> & {
  /** List of picklist values. */
  pickList: string[];
};

/** Choices of programming languages that may be used for Config Var code values. */
export type CodeLanguageType = "json" | "xml" | "html";

type CodeConfigVar = CreateStandardConfigVar<"code"> & {
  /** Value to specify the type of language of a code Config Var. */
  codeLanguage: CodeLanguageType;
};

type BooleanConfigVar = CreateStandardConfigVar<"boolean">;

type NumberConfigVar = CreateStandardConfigVar<"number">;

type ScheduleConfigVar = CreateStandardConfigVar<"schedule"> & {
  /** Optional timezone for the schedule. */
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
  | JsonFormConfigVar;

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
            dataSource?: never;
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

export type DataSourceDefinitionConfigVar = DataSourceType extends infer TDataSourceType
  ? TDataSourceType extends DataSourceType
    ? BaseDataSourceConfigVar<TDataSourceType> &
        Omit<
          DataSourceDefinition<Inputs, ConfigVarResultCollection, TDataSourceType>,
          "display" | "inputs" | "examplePayload" | "detailDataSource"
        >
    : never
  : never;

export type DataSourceReferenceConfigVar =
  ComponentRegistryDataSource extends infer TDataSourceReference extends ComponentRegistryDataSource
    ? Omit<BaseDataSourceConfigVar<TDataSourceReference["dataSourceType"]>, "dataSourceType"> & {
        dataSource: TDataSourceReference["reference"];
        validationMode?: ValidationMode;
      }
    : never;

export type DataSourceReferenceConfigVarMap = UnionToIntersection<
  DataSourceReferenceConfigVar extends infer T
    ? T extends DataSourceReferenceConfigVar
      ? {
          [TComponentKey in T["dataSource"]["component"]]: {
            [TDataSourceKey in T["dataSource"]["component"] extends TComponentKey
              ? T["dataSource"]["key"]
              : never]: T;
          };
        }
      : never
    : never
>;

/** Defines attributes of a data source Config Var. */
export type DataSourceConfigVar = DataSourceDefinitionConfigVar | DataSourceReferenceConfigVar;

// Connection Config Vars

type BaseConnectionConfigVar = BaseConfigVar & {
  dataType: "connection";
};

export type ConnectionDefinitionConfigVar =
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

export type ConnectionReferenceConfigVar =
  ComponentRegistryConnection extends infer TConnectionReference
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

export type ConnectionReferenceConfigVarMap = UnionToIntersection<
  ConnectionReferenceConfigVar extends infer T
    ? T extends ConnectionReferenceConfigVar
      ? {
          [TComponentKey in T["connection"]["component"]]: {
            [TConnectionKey in T["connection"]["component"] extends TComponentKey
              ? T["connection"]["key"]
              : never]: T;
          };
        }
      : never
    : never
>;

/** Defines attributes of a Config Var that represents a Connection. */
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

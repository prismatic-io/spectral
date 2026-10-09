import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { ZodType } from "zod";
import type { ActionLogger } from "./ActionLogger";
import type { ComponentRegistry } from "./ComponentRegistry";
import type { ConnectionConfigVar } from "./ConfigVars";
import type { CustomerAttributes } from "./CustomerAttributes";
import type { Connection } from "./Inputs";
import type { InstanceAttributes } from "./InstanceAttributes";
import type {
  CustomerActivatedConnectionConfigVar,
  OrganizationActivatedConnectionConfigVar,
  UserActivatedConnectionConfigVar,
} from "./ScopedConfigVars";
import type { UserAttributes } from "./UserAttributes";

export type JsonSchema = JSONSchema;
export type SchemaInput = ZodType | JsonSchema;
interface ConfigurationValueOf<TSchema extends SchemaInput> {
  value: TSchema extends ZodType
    ? TSchema["_zod"]["output"]
    : TSchema extends JsonSchema
      ? FromSchema<TSchema>
      : never;
}
export type ConfigurationValue<TSchema extends SchemaInput> =
  ConfigurationValueOf<TSchema>["value"];
export type DeepReadonly<TValue> = TValue extends (infer TElement)[]
  ? ReadonlyArray<DeepReadonly<TElement>>
  : TValue extends object
    ? { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> }
    : TValue;
export type StoredConfigurationValue<TSchema extends SchemaInput> = DeepReadonly<
  ConfigurationValue<TSchema>
>;
export type UiSchema = { readonly [key: string]: unknown };
export type ConfigurationUi =
  | { type: "uiSchema"; value: UiSchema }
  | { type: "custom"; value: unknown };
export type VersionSchemas = Record<string, SchemaInput>;
export type ConfigurationConnection =
  | CustomerActivatedConnectionConfigVar
  | OrganizationActivatedConnectionConfigVar
  | ConnectionConfigVar;
export type UserConfigurationConnection = UserActivatedConnectionConfigVar | ConnectionConfigVar;
export interface ConfigurationScope<TConnection = ConfigurationConnection> {
  schema: SchemaInput;
  version: string;
  ui?: ConfigurationUi;
  /** Published historical schemas used to narrow migration values. */
  versionSchemas?: VersionSchemas;
  /** Authoring-only shape for values migrated from legacy config pages. */
  configPagesSchema?: SchemaInput;
  connections?: Record<string, TConnection>;
}
export type QualifiedConnectionKeys<TInstance, TUserLevel> =
  | (TInstance extends { connections: infer TConnections }
      ? `instance.${Extract<keyof TConnections, string>}`
      : never)
  | (TUserLevel extends { connections: infer TConnections }
      ? `userLevel.${Extract<keyof TConnections, string>}`
      : never);
export type ConfigurationConnections<TConnectionKey extends string> = {
  [TScope in "instance" | "userLevel" as Extract<
    TConnectionKey,
    `${TScope}.${string}`
  > extends never
    ? never
    : TScope]: {
    [TKey in TConnectionKey as TKey extends `${TScope}.${infer TName}` ? TName : never]: Connection;
  };
};
export interface ConfigurationContext<TInstance = unknown, TUserLevel = unknown> {
  logger: ActionLogger;
  customer?: CustomerAttributes;
  instance?: InstanceAttributes;
  user?: UserAttributes;
  connections: ConfigurationConnections<`instance.${string}` | `userLevel.${string}`>;
  configuration: TInstance;
  userConfiguration: TUserLevel;
}
/** A unique discriminant prevents unknown versions overlapping declared literals. */
declare const unrecognizedVersion: unique symbol;
export type UnrecognizedVersion = typeof unrecognizedVersion;
type HistoricalSchemas<TScope> = TScope extends {
  versionSchemas: infer TSchemas extends VersionSchemas;
}
  ? TSchemas
  : Record<never, never>;
type LegacyConfigurationValue<TScope> = TScope extends {
  configPagesSchema: infer TSchema extends SchemaInput;
}
  ? Partial<StoredConfigurationValue<TSchema>>
  : unknown;
type VersionSchemaMap<TScope extends ConfigurationScope<unknown>> = Omit<
  HistoricalSchemas<TScope>,
  TScope["version"]
> &
  Record<TScope["version"], TScope["schema"]>;
type ConfigurationVersionArms<TScope extends ConfigurationScope<unknown>> =
  | {
      [TVersion in keyof VersionSchemaMap<TScope> & string]: {
        configurationVersion: TVersion;
        configuration: StoredConfigurationValue<
          Extract<VersionSchemaMap<TScope>[TVersion], SchemaInput>
        >;
      };
    }[keyof VersionSchemaMap<TScope> & string]
  | { configurationVersion: null; configuration: LegacyConfigurationValue<TScope> }
  | { configurationVersion: UnrecognizedVersion; configuration: unknown };
export type ConfigurationInitContext<
  TInstance extends ConfigurationScope<unknown>,
  TConnectionKey extends string = never,
> = Omit<ConfigurationContext, "connections" | "configuration"> & {
  connections: ConfigurationConnections<TConnectionKey>;
  configVars: Record<string, unknown>;
} & ConfigurationVersionArms<TInstance>;
export type ConfigurationInitResult<
  TInstance extends ConfigurationScope<unknown>,
  TUserLevel extends ConfigurationScope<unknown> | undefined = undefined,
> = {
  configuration: ConfigurationValue<TInstance["schema"]>;
} & (TUserLevel extends ConfigurationScope<unknown>
  ? { userConfiguration: ConfigurationValue<TUserLevel["schema"]> }
  : Record<never, never>);
export type AnyConfigurationInit = (context: never) => Promise<unknown>;
export interface AnyIntegrationConfiguration {
  instance: ConfigurationScope;
  userLevel?: ConfigurationScope<UserConfigurationConnection>;
  init?: { connections?: readonly string[]; perform: AnyConfigurationInit };
  serverFunctions?: Record<string, AnyServerFunction>;
}
export type IntegrationConfiguration = AnyIntegrationConfiguration;
export type ConfiguredComponents = {
  [TComponent in keyof ComponentRegistry]: {
    [TAction in keyof ComponentRegistry[TComponent]["actions"]]: ComponentRegistry[TComponent]["actions"][TAction] extends {
      perform: infer TPerform;
    }
      ? TPerform
      : never;
  };
};
/** Saved values can be empty or historical during configuration; inputs are typed separately. */
export interface ServerFunctionContext<TConnectionKey extends string = never>
  extends Omit<ConfigurationContext, "connections"> {
  connections: ConfigurationConnections<TConnectionKey>;
  components: ConfiguredComponents;
}
export type ServerFunctionPerform<
  TInputSchema extends SchemaInput,
  TConnectionKey extends string,
  TResult,
> = (
  context: ServerFunctionContext<TConnectionKey>,
  params: ConfigurationValue<TInputSchema>,
) => Promise<TResult>;
export interface AnyServerFunction {
  inputSchema: SchemaInput;
  outputSchema: SchemaInput;
  connections?: readonly string[];
  perform: (context: never, params: never) => Promise<unknown>;
  label?: string;
  description?: string;
}
export type DeclaredConnectionKeys<TFunctions> =
  TFunctions[keyof TFunctions] extends infer TFunction
    ? TFunction extends { connections?: readonly (infer TKey extends string)[] }
      ? TKey
      : never
    : never;
export interface ServerFunction<
  TInputSchema extends SchemaInput = SchemaInput,
  TOutputSchema extends SchemaInput = SchemaInput,
  TConnectionKey extends string = never,
  TResult = unknown,
> {
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  connections?: readonly TConnectionKey[];
  perform: ServerFunctionPerform<TInputSchema, TConnectionKey, TResult>;
  label?: string;
  description?: string;
}
/** Augment with the return type of `configuration()` to type flow contexts. */
export interface IntegrationDefinitionConfiguration {}
export type ConfiguredValue = IntegrationDefinitionConfiguration extends {
  instance: { schema: infer TSchema extends SchemaInput };
}
  ? ConfigurationValue<TSchema>
  : unknown;
/** The current user schema's value, usable after validating independently versioned saved data. */
export type ConfiguredUserValue = keyof IntegrationDefinitionConfiguration extends never
  ? unknown
  : IntegrationDefinitionConfiguration extends {
        userLevel: { schema: infer TSchema extends SchemaInput };
      }
    ? ConfigurationValue<TSchema>
    : Record<string, never>;
export type ConfiguredConnections = keyof IntegrationDefinitionConfiguration extends never
  ? ConfigurationConnections<`instance.${string}` | `userLevel.${string}`>
  : ConfigurationConnections<
      QualifiedConnectionKeys<
        IntegrationDefinitionConfiguration extends { instance: infer TInstance }
          ? TInstance
          : never,
        IntegrationDefinitionConfiguration extends { userLevel: infer TUserLevel }
          ? TUserLevel
          : never
      >
    >;

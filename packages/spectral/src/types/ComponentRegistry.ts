import type { ComponentManifest } from "./ComponentManifest";
import type { ConfigVarVisibility } from "./ConfigVars";
import type { Prettify, UnionToIntersection } from "./utils";

/**
 * Root ComponentRegistry type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface IntegrationDefinitionComponentRegistry {
 *   [key: string]: ComponentManifest
 * }
 * ```
 *
 */
export interface IntegrationDefinitionComponentRegistry {}

export type ComponentRegistry = keyof IntegrationDefinitionComponentRegistry extends never
  ? {
      [key: string]: ComponentManifest;
    }
  : UnionToIntersection<
      keyof IntegrationDefinitionComponentRegistry extends infer TComponentKey
        ? TComponentKey extends keyof IntegrationDefinitionComponentRegistry
          ? {
              [Key in TComponentKey]: IntegrationDefinitionComponentRegistry[TComponentKey];
            }
          : never
        : never
    >;

export type ConfigVarExpression = { configVar: string };
export type TemplateExpression = {
  /**
   * Use a template to concatenate strings and other config variables together.
   * For example, if you have a config variable named "Sharepoint Site", you
   * can provide a value `/sites/{{#Sharepoint Site}}/drives`, and your `{{#}}`
   * config variable will be concatenated with `/sites/` and `/drives`.
   */
  template: string;
};
export type ValueExpression<TValueType = unknown> = {
  value: TValueType;
};

type ComponentReferenceType = Extract<
  keyof ComponentManifest,
  "actions" | "triggers" | "dataSources" | "connections"
>;

type ComponentReferenceTypeValueMap<
  TValue,
  TMap extends Record<ComponentReferenceType, unknown> = {
    actions: ValueExpression<TValue>;
    triggers: ValueExpression<TValue> | ConfigVarExpression;
    dataSources: ValueExpression<TValue> | ConfigVarExpression | TemplateExpression;
    connections: (ValueExpression<TValue> | ConfigVarExpression) &
      ConfigVarVisibility & { writeOnly?: true };
  },
> = TMap;

export type ComponentReference<
  TComponentReference extends {
    component: string;
    key: string;
    values?: {
      [key: string]: ValueExpression | ConfigVarExpression | TemplateExpression;
    };
    template?: string;
  } = {
    component: string;
    key: string;
    values?: {
      [key: string]: ValueExpression | ConfigVarExpression | TemplateExpression;
    };
    template?: string;
  },
> = TComponentReference;

export const isComponentReference = (ref: unknown): ref is ComponentReference =>
  typeof ref === "object" && ref !== null && "key" in ref && "component" in ref;

type ComponentRegistryFunctionsByType = UnionToIntersection<
  ComponentReferenceType extends infer TComponentReferenceType
    ? TComponentReferenceType extends Extract<
        keyof ComponentManifest,
        "actions" | "triggers" | "dataSources" | "connections"
      >
      ? {
          [Key in TComponentReferenceType]: keyof ComponentRegistry extends infer TComponentKey
            ? TComponentKey extends keyof ComponentRegistry
              ? TComponentKey extends string
                ? TComponentReferenceType extends keyof ComponentRegistry[TComponentKey]
                  ? keyof ComponentRegistry[TComponentKey][TComponentReferenceType] extends infer TComponentPropertyKey
                    ? TComponentPropertyKey extends keyof ComponentRegistry[TComponentKey][TComponentReferenceType]
                      ? TComponentPropertyKey extends string
                        ? "perform" extends keyof ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey]
                          ? ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey]["perform"] extends (
                              ...args: any[]
                            ) => any
                            ? Parameters<
                                ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey]["perform"]
                              >[0] extends infer TInputs
                              ? Prettify<
                                  Omit<
                                    ComponentRegistry[TComponentKey][TComponentReferenceType][TComponentPropertyKey],
                                    "perform"
                                  > & {
                                    reference: ComponentReference<{
                                      component: TComponentKey;
                                      key: TComponentPropertyKey;
                                      values: {
                                        [Key in keyof TInputs]: ComponentReferenceTypeValueMap<
                                          TInputs[Key]
                                        >[TComponentReferenceType];
                                      };
                                    }>;
                                  }
                                >
                              : never
                            : never
                          : never
                        : never
                      : never
                    : never
                  : never
                : never
              : never
            : never;
        }
      : never
    : never
>;

export type ComponentRegistryTrigger = ComponentRegistryFunctionsByType["triggers"];
export type TriggerReference = ComponentRegistryTrigger["reference"];

export type ComponentRegistryAction = ComponentRegistryFunctionsByType["actions"];
export type ActionReference = ComponentRegistryAction["reference"];

export type ComponentRegistryDataSource = ComponentRegistryFunctionsByType["dataSources"];
export type DataSourceReference = ComponentRegistryDataSource["reference"];

export type ComponentRegistryConnection = ComponentRegistryFunctionsByType["connections"];
export type ConnectionReference = ComponentRegistryConnection["reference"];

import { ComponentManifest, PermissionAndVisibilityType } from ".";
import { Prettify, UnionToIntersection } from "./utils";

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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IntegrationDefinitionComponentRegistry {}

export type ComponentRegistry =
  keyof IntegrationDefinitionComponentRegistry extends never
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

export interface ConnectionInputPermissionAndVisibility {
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

export type ConfigVarExpression = { configVar: string };
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
    dataSources: ValueExpression<TValue> | ConfigVarExpression;
    connections: (ValueExpression<TValue> | ConfigVarExpression) &
      ConnectionInputPermissionAndVisibility;
  }
> = TMap;

export type ComponentReference<
  TComponentReference extends {
    component: string;
    key: string;
    values?: {
      [key: string]: ValueExpression | ConfigVarExpression;
    };
    template?: string;
  } = {
    component: string;
    key: string;
    values?: {
      [key: string]: ValueExpression | ConfigVarExpression;
    };
    template?: string;
  }
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

export type ComponentRegistryTrigger =
  ComponentRegistryFunctionsByType["triggers"];
export type TriggerReference = ComponentRegistryTrigger["reference"];

export type ComponentRegistryAction =
  ComponentRegistryFunctionsByType["actions"];
export type ActionReference = ComponentRegistryAction["reference"];

export type ComponentRegistryDataSource =
  ComponentRegistryFunctionsByType["dataSources"];
export type DataSourceReference = ComponentRegistryDataSource["reference"];

export type ComponentRegistryConnection =
  ComponentRegistryFunctionsByType["connections"];
export type ConnectionReference = ComponentRegistryConnection["reference"];

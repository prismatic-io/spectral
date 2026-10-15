import type { InputValue } from "./ActionInputParameters";
import type { ConfigVarExpression, TemplateExpression, ValueExpression } from "./ComponentRegistry";
import type { ConfigVarVisibility } from "./ConfigVars";
import type { DataSourceType } from "./DataSourceResult";
import type { Inputs } from "./Inputs";

export interface ComponentClientIdentity {
  key: string;
  isPublic: boolean;
}

type ReferenceValue<
  TInput,
  TKind extends "trigger" | "dataSource" | "connection",
> = TKind extends "trigger"
  ? ValueExpression<InputValue<TInput>> | ConfigVarExpression
  : TKind extends "dataSource"
    ? ValueExpression<InputValue<TInput>> | ConfigVarExpression | TemplateExpression
    :
        | ((ValueExpression<InputValue<TInput>> | ConfigVarExpression) &
            ConfigVarVisibility & { writeOnly?: true })
        | (ConfigVarVisibility & { writeOnly?: true });

export type ComponentClientReferenceValues<
  TInputs extends Record<string, unknown>,
  TKind extends "trigger" | "dataSource" | "connection",
> = {
  [K in keyof TInputs]?: ReferenceValue<TInputs[K], TKind>;
};

export interface ComponentClientReference<
  TInputs extends Record<string, unknown> = Inputs,
  TKind extends "trigger" | "dataSource" | "connection" = "trigger" | "dataSource" | "connection",
> {
  __componentClientReference: true;
  kind: TKind;
  component: ComponentClientIdentity;
  key: string;
  inputs: TInputs;
  values: ComponentClientReferenceValues<TInputs, TKind>;
  dataSourceType?: DataSourceType;
  template?: string;
  onPremiseConnectionConfig?: "allowed" | "disallowed" | "required";
}

export const isComponentClientReference = (value: unknown): value is ComponentClientReference =>
  typeof value === "object" &&
  value !== null &&
  (value as { __componentClientReference?: unknown }).__componentClientReference === true;

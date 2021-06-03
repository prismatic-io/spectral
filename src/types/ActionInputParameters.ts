import { InputFieldDefinition, Inputs, InputFieldTypeMap } from ".";

/** Collection of input parameters provided by the user or previous steps' outputs */
export type ActionInputParameters<T extends Inputs> = T extends Record<
  string,
  InputFieldDefinition
>
  ? { [K in keyof T]: ExtractValue<T[K]> }
  : never;

export type ExtractValue<TValue extends InputFieldDefinition> =
  MapCollectionValues<InputFieldTypeMap[TValue["type"]], TValue["collection"]>;

export type MapCollectionValues<
  TValue,
  TCollection extends InputFieldDefinition["collection"] | undefined
> = TCollection extends "keyvaluelist"
  ? KeyValuePair<TValue>[] | undefined
  : TCollection extends "valuelist"
  ? TValue[] | undefined
  : TValue;

/** KeyValuePair input parameter type */
export interface KeyValuePair<V = unknown> {
  /** Key of the KeyValuePair */
  key: string;
  /** Value of the KeyValuePair */
  value: V;
}

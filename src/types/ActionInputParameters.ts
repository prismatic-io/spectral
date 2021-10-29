import {
  InputFieldDefinition,
  Inputs,
  InputFieldTypeMap,
  Connection,
  ConnectionFieldDefinition,
} from ".";

/**
 * Collection of input parameters.
 * Inputs can be static values, references to config variables, or
 * references to previous steps' outputs.
 */
export type ActionInputParameters<TInputs extends Inputs> = {
  [Property in keyof TInputs]: TInputs[Property] extends ConnectionFieldDefinition
    ? Connection<TInputs[Property]>
    : ExtractValue<TInputs[Property]>;
};

export type ExtractValue<TValue extends InputFieldDefinition> =
  MapCollectionValues<InputFieldTypeMap[TValue["type"]], TValue["collection"]>;

export type MapCollectionValues<
  TType,
  TCollection extends InputFieldDefinition["collection"] | undefined
> = TCollection extends "keyvaluelist"
  ? KeyValuePair<TType>[] | undefined
  : TCollection extends "valuelist"
  ? TType[] | undefined
  : TType;

/**
 * KeyValuePair input parameter type.
 * This allows users to input multiple keys / values as an input.
 * To see an example of how this can be used, see the `tagging` input
 * of the `putObject` action of the AWS S3 component:
 * https://github.com/prismatic-io/examples/blob/main/components/aws-s3/src/actions.ts
 */
export interface KeyValuePair<V = unknown> {
  /** Key of the KeyValuePair */
  key: string;
  /** Value of the KeyValuePair */
  value: V;
}

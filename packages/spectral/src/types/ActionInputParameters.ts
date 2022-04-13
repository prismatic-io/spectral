import { Inputs } from ".";
import { ConditionalExpression } from "./conditional-logic";
import { InputFieldCollection, InputCleanFunction, Connection } from "./Inputs";

/**
 * Collection of input parameters.
 * Inputs can be static values, references to config variables, or
 * references to previous steps' outputs.
 */
export type ActionInputParameters<TInputs extends Inputs> = {
  [Property in keyof TInputs]: TInputs[Property]["clean"] extends InputCleanFunction<any>
    ? ReturnType<TInputs[Property]["clean"]>
    : TInputs[Property]["type"] extends "connection"
    ? ExtractValue<Connection, TInputs[Property]["collection"]>
    : TInputs[Property]["type"] extends "conditional"
    ? ExtractValue<ConditionalExpression, TInputs[Property]["collection"]>
    : ExtractValue<
        TInputs[Property]["default"],
        TInputs[Property]["collection"]
      >;
};

export type ExtractValue<
  TType,
  TCollection extends InputFieldCollection | undefined
> = TCollection extends "keyvaluelist"
  ? KeyValuePair<TType>[]
  : TCollection extends "valuelist"
  ? TType[]
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

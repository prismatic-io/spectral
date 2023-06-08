import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { camelCase, isEmpty, startCase } from "lodash";
import { getInputs } from "./inputs";
import { Action, Input, stripUndefined } from "../../utils";
import { WriterFunction } from "ts-morph";
import { toGroupTag, toOperationName } from "./util";

const buildPerformFunction = (
  pathTemplate: string,
  verb: string,
  pathInputs: Input[],
  queryInputs: Input[],
  bodyInputs: Input[]
): WriterFunction => {
  const destructureNames = [...pathInputs, ...queryInputs, ...bodyInputs]
    .map(({ key }) => key)
    .join(", ");

  // Path inputs are handled by matching casing and using string interpolation.
  const path = pathInputs
    .reduce<string>(
      (result, { key, upstreamKey }) =>
        result.replace(`{${upstreamKey}}`, `{${key}}`),
      pathTemplate
    )
    // Update placeholder to interpolation syntax
    .replace(/{([^}]+)}/g, (_, match) => `\${${match}}`);

  // Query param inputs need to be converted to the upstream key expectations.
  const queryMapping = queryInputs
    .map(({ key, upstreamKey }) =>
      key === upstreamKey ? key : `"${upstreamKey}": ${key}`
    )
    .join(", ");

  // Body inputs need to be converted to the upstream key expectations.
  const bodyMapping = bodyInputs.map(({ key, upstreamKey }) =>
    key === upstreamKey ? key : `"${upstreamKey}": ${key}`
  );

  return (writer) =>
    writer
      .writeLine(`async (context, { connection, ${destructureNames} }) => {`)
      .blankLineIfLastNot()
      .writeLine("const client = createClient(connection);")
      .write("const {data} = await client.")
      .write(verb)
      .write("(`")
      .write(path)
      .write("`")
      .conditionalWrite(
        ["post", "put", "patch"].includes(verb),
        () => `, { ${bodyMapping} }`
      )
      .conditionalWrite(
        !isEmpty(queryMapping),
        () => `, { params: { ${queryMapping} } }`
      )
      .write(");")
      .writeLine("return {data};")
      .writeLine("}");
};

const buildAction = (
  path: string,
  verb: string,
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
  sharedParameters: (
    | OpenAPIV3.ParameterObject
    | OpenAPIV3_1.ParameterObject
  )[] = []
): Action => {
  const operationName = toOperationName(
    operation.operationId || `${verb} ${path}`
  );

  const { pathInputs, queryInputs, bodyInputs } = getInputs(
    operation,
    sharedParameters
  );
  const groupTag = toGroupTag(path);

  // Repackage inputs; need to ensure we camelCase to handle hyphenated identifiers.
  const inputs = [...pathInputs, ...queryInputs, ...bodyInputs].reduce(
    (result, i) => ({ ...result, [camelCase(i.key)]: i }),
    {}
  );

  const action = stripUndefined<Action>({
    key: operationName,
    groupTag,
    display: {
      label: startCase(operationName),
      description:
        operation.summary ?? operation.description ?? "TODO: Description",
    },
    inputs: {
      connection: { label: "Connection", type: "connection", required: true },
      ...inputs,
    },
    perform: buildPerformFunction(
      path,
      verb,
      pathInputs,
      queryInputs,
      bodyInputs
    ),
  });
  return action;
};

// TODO: Derive from openapi-types HttpMethods instead.
const httpVerbs = new Set<string>([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

export const operationsToActions = (
  path: string,
  operations: OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject
): Action[] => {
  // TODO: Figure out how to refine types down to V3+ and also how to
  // filter out Reference types throughout.
  const sharedParameters = operations.parameters as (
    | OpenAPIV3.ParameterObject
    | OpenAPIV3_1.ParameterObject
  )[];
  return Object.entries(operations)
    .filter(([verb]) => httpVerbs.has(verb))
    .map<Action>(([verb, op]) =>
      buildAction(path, verb, op as any, sharedParameters)
    );
};

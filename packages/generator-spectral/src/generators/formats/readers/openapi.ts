import SwaggerParser, { dereference } from "@apidevtools/swagger-parser";
import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { camelCase, isEmpty, startCase, merge } from "lodash";
import {
  Action,
  Component,
  Connection,
  ConnectionInput,
  Input,
  Result,
  stripUndefined,
} from "../utils";
import {
  InputFieldChoice,
  InputFieldType,
  OAuth2Type,
} from "@prismatic-io/spectral";
import { WriterFunction } from "ts-morph";

const toInputType: { [x: string]: { type: InputFieldType; cleanFn: string } } =
  {
    string: {
      type: "string",
      cleanFn: "toString",
    },
    integer: {
      type: "string",
      cleanFn: "toNumber",
    },
    number: {
      type: "string",
      cleanFn: "toNumber",
    },
    boolean: {
      type: "boolean",
      cleanFn: "toBool",
    },
  };

const buildInput = (parameter: OpenAPI.Parameter): Input => {
  if ("$ref" in parameter) {
    throw new Error("$ref nodes are not supported.");
  }

  const schemaType = parameter.schema?.type;
  const { type, cleanFn } = toInputType[schemaType] ?? toInputType["string"];

  const model = getInputModel(parameter.schema);

  const input = stripUndefined<Input>({
    key: parameter.name,
    label: startCase(parameter.name),
    type,
    required: parameter.required,
    comments: parameter.description,
    default: parameter.schema?.default,
    example: parameter.schema?.example,
    model,
    clean: `(value) => util.types.${cleanFn}(value) || undefined`,
  });
  return input;
};

const getProperties = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject> => {
  return merge(
    schema.properties ?? {},
    ...(schema.allOf ?? []).map((v) => (v as any).properties) // FIXME: any usage
  ) as Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject>;
};

const getInputModel = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): InputFieldChoice[] | undefined => {
  if (schema?.type === "boolean") {
    // No point generating model values for boolean
    return undefined;
  }

  if (schema?.enum) {
    return (schema?.enum ?? []).map<InputFieldChoice>((v) => ({
      label: startCase(v),
      value: v,
    }));
  }

  // Some schemas unnecessarily nest inside of an allOf so try to handle those.
  if (schema?.allOf && schema?.allOf?.[0] && !("$ref" in schema?.allOf?.[0])) {
    return (schema?.allOf?.[0]?.enum ?? []).map<InputFieldChoice>((v) => ({
      label: startCase(v),
      value: v,
    }));
  }

  return undefined;
};

const buildBodyInputs = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): Input[] => {
  const requiredKeys = new Set(schema.required ?? []);
  const properties = getProperties(schema);

  return Object.entries(properties).map<Input>(([key, prop]) => {
    const schemaType = prop?.type;
    const { type, cleanFn } =
      toInputType[schemaType as string] ?? toInputType["string"];

    const model = getInputModel(prop);

    return stripUndefined<Input>({
      key,
      label: startCase(key),
      type,
      required: requiredKeys.has(key),
      comments: prop.description,
      default: prop.default,
      example: prop.example,
      model,
      clean: `(value) => util.types.${cleanFn}(value) || undefined`,
    });
  });
};

const buildPerformFunction = (
  pathTemplate: string,
  verb: string,
  pathInputs: Input[],
  queryInputs: Input[],
  bodyInputs: Input[]
): WriterFunction => {
  const destructureNames = [...pathInputs, ...queryInputs, ...bodyInputs]
    .map(({ key }) => camelCase(key))
    .join(", ");

  // Path inputs are handled by matching casing and using string interpolation.
  const path = pathTemplate.replace(
    /{([^}]+)}/g,
    (_, match) => `\${${camelCase(match)}}`
  );

  // Query param inputs need to be converted to the upstream casing expectations.
  const queryMapping = queryInputs
    .map(({ key }) => {
      const camelCased = camelCase(key);
      return key === camelCased ? key : `"${key}": ${camelCased}`;
    })
    .join(", ");

  // Body inputs need to be converted to the upstream casing expectations.
  const bodyMapping = bodyInputs.map(({ key }) => {
    const camelCased = camelCase(key);
    return key === camelCased ? key : `"${key}": ${camelCased}`;
  });

  return (writer) =>
    writer
      .writeLine(`async (context, { connection, ${destructureNames} }) => {`)
      .conditionalWriteLine(
        verb === "post" && !isEmpty(bodyMapping),
        () => `const payload = { ${bodyMapping} };`
      )
      .conditionalWriteLine(
        !isEmpty(queryMapping),
        () => `const params = { ${queryMapping} };`
      )
      .blankLineIfLastNot()
      // FIXME: Apparently type inference doesn't work with inlined inputs!?
      .writeLine("const client = createClient(connection as Connection);")
      .write("const {data} = await client.")
      .write(verb)
      .write("(`")
      .write(path)
      .write("`")
      .conditionalWrite(
        verb === "post",
        () => `, ${!isEmpty(bodyMapping) ? "payload" : "{}"}`
      )
      .conditionalWrite(!isEmpty(queryMapping), () => ", { params }")
      .write(");")
      .writeLine("return {data};")
      .writeLine("}");
};

const getInputs = (
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject
): {
  pathInputs: Input[];
  queryInputs: Input[];
  bodyInputs: Input[];
  payloadContentType: string;
} => {
  if (
    typeof operation.requestBody !== "undefined" &&
    "$ref" in operation.requestBody
  ) {
    throw new Error("All refs should be resolved before computing Inputs.");
  }

  const pathInputs = (operation.parameters ?? [])
    .filter((p) => !("$ref" in p) && p.in === "path")
    .map(buildInput);

  const queryInputs = (operation.parameters ?? [])
    .filter((p) => !("$ref" in p) && p.in === "query")
    .map(buildInput);

  const requestBodySchema =
    operation.requestBody?.content?.["application/json"]?.schema;
  if (typeof requestBodySchema !== "undefined" && "$ref" in requestBodySchema) {
    throw new Error("All refs should be resolved before computing Inputs.");
  }
  const bodyInputs =
    requestBodySchema === undefined ? [] : buildBodyInputs(requestBodySchema);

  return {
    pathInputs,
    queryInputs,
    bodyInputs,
    payloadContentType: "application/json",
  };
};

const buildAction = (
  path: string,
  verb: string,
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject
): Action => {
  if (!operation.operationId) {
    throw new Error("Failed to find operationId");
  }

  const { pathInputs, queryInputs, bodyInputs } = getInputs(operation);
  const [_, groupTag] = path.split("/");

  // Repackage inputs; need to ensure we camelCase to handle hyphenated identifiers.
  const inputs = [...pathInputs, ...queryInputs, ...bodyInputs].reduce(
    (result, i) => ({ ...result, [camelCase(i.key)]: i }),
    {}
  );

  const action = stripUndefined<Action>({
    key: operation.operationId,
    groupTag,
    display: {
      label: startCase(operation.operationId),
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

const operationsToActions = (
  path: string,
  operations: Record<string, OpenAPI.Operation>
): Action[] =>
  Object.entries(operations).map<Action>(([verb, op]) =>
    buildAction(path, verb, op as any)
  );

const buildConnections = (
  key: string,
  scheme: OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject
): Connection[] => {
  if ("$ref" in scheme) {
    throw new Error("$ref nodes are not supported.");
  }

  if (scheme.type === "apiKey") {
    const connection = stripUndefined<Connection>({
      key,
      label: startCase(key),
      comments: scheme.description,
      inputs: {
        apiKey: {
          label: startCase(scheme.name),
          type: "password",
          required: true,
        },
      },
    });
    return [connection];
  }

  if (scheme.type === "oauth2") {
    if ("authorizationCode" in scheme.flows) {
      const authCodeFlow = scheme.flows.authorizationCode;
      const usesScopes =
        authCodeFlow?.scopes && Object.keys(authCodeFlow.scopes).length > 0;
      const connection = stripUndefined<Connection>({
        key,
        label: "OAuth 2.0", // TODO: Apparently OpenAPI lacks a name for this scheme? Ok.
        oauth2Type: OAuth2Type.AuthorizationCode,
        inputs: {
          authorizeUrl: stripUndefined<ConnectionInput>({
            label: "Authorization URL",
            type: "string",
            required: true,
            shown: !authCodeFlow?.authorizationUrl,
            default: authCodeFlow?.authorizationUrl,
            comments: "Authorization URL",
          }),
          tokenUrl: stripUndefined<ConnectionInput>({
            label: "Token URL",
            type: "string",
            required: true,
            shown: !authCodeFlow?.tokenUrl,
            default: authCodeFlow?.tokenUrl,
            comments: "Token URL",
          }),
          scopes: stripUndefined<ConnectionInput>({
            label: "Scopes",
            type: "string",
            required: true,
            shown: usesScopes,
            default: usesScopes ? undefined : "",
            comments: "Space-delimited scopes",
          }),
          clientId: {
            label: "Client ID",
            type: "string",
            required: true,
            shown: true,
            comments: "Client identifier",
          },
          clientSecret: {
            label: "Client Secret",
            type: "password",
            required: true,
            shown: true,
            comments: "Client secret",
          },
        },
      });
      return [connection];
    }

    throw new Error("Did not find supported OAuth 2.0 flow.");
  }

  throw new Error(`Security scheme '${scheme.type}' not supported.`);
};

const getBaseUrl = (api: OpenAPI.Document): string | undefined => {
  if ("basePath" in api) {
    return api?.basePath;
  }

  if ("servers" in api) {
    return api?.servers?.[0]?.url;
  }

  return undefined;
};

const buildComponent = (api: OpenAPI.Document): Component => {
  const component = stripUndefined<Component>({
    display: {
      label: api.info.title,
      description:
        api.info.description ??
        `Generated component for ${api.info.title} ${api.info.version}`,
      iconPath: "icon.png",
    },
  });
  return component;
};

export const read = async (filePath: string): Promise<Result> => {
  // FIXME: https://github.com/APIDevTools/swagger-parser/issues/186
  const api = await dereference.bind(SwaggerParser)(filePath);

  const component = buildComponent(api);

  const actions = Object.entries(api.paths ?? {}).reduce<Action[]>(
    (result, [path, operations]) => [
      ...result,
      ...operationsToActions(path, operations),
    ],
    []
  );

  const connections =
    "components" in api
      ? Object.entries(api.components?.securitySchemes ?? {}).reduce<
          Connection[]
        >(
          (result, [key, scheme]) => [
            ...result,
            ...buildConnections(key, scheme),
          ],
          []
        )
      : [];

  const baseUrl = getBaseUrl(api);
  if (!baseUrl) {
    throw new Error("Failed to identify base path of API.");
  }

  return {
    baseUrl,
    component,
    actions,
    connections,
  };
};

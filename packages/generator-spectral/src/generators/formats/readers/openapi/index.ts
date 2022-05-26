import SwaggerParser, { dereference } from "@apidevtools/swagger-parser";
import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { camelCase, isEmpty, result, startCase } from "lodash";
import { getInputs } from "./inputs";
import {
  Action,
  Component,
  Connection,
  ConnectionInput,
  Input,
  Result,
  stripUndefined,
} from "../../utils";
import { OAuth2Type } from "@prismatic-io/spectral";
import { WriterFunction } from "ts-morph";

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
      // FIXME: Apparently type inference doesn't work with inlined inputs!?
      .writeLine("const client = createClient(connection as Connection);")
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
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject
): Action => {
  if (!operation.operationId) {
    throw new Error("Failed to find operationId");
  }

  const { pathInputs, queryInputs, bodyInputs } = getInputs(operation);
  const groupTag = camelCase(path === "/" ? "root" : path.split("/")[1]);

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
      key: camelCase(key),
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

  if (scheme.type === "http") {
    const connection = stripUndefined<Connection>({
      key: camelCase(key),
      label: startCase(key),
      comments: scheme.description,
      inputs: {
        username: {
          label: "Username",
          type: "string",
          required: true,
        },
        password: {
          label: "Password",
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
        key: camelCase(key),
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

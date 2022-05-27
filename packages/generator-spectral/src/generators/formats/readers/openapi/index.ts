import SwaggerParser, { dereference } from "@apidevtools/swagger-parser";
import { OpenAPI } from "openapi-types";
import {
  Action,
  Component,
  Connection,
  Result,
  stripUndefined,
} from "../../utils";
import { operationsToActions } from "./actions";
import { buildConnections } from "./connections";

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

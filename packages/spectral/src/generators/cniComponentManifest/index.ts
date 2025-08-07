import axios from "axios";
import { DataSourceType } from "../../types";
import {
  ComponentNode,
  InputNode,
  FormattedAction,
  FormattedDataSource,
  FormattedTrigger,
} from "./types";
import { getPrismAccessToken } from "../utils/prism";

// Helper to transform input nodes from GraphQL response to the expected format
function transformInputNodes(inputs: InputNode[]) {
  return inputs.map((node) => ({
    ...node,
    collection: node.collection ? node.collection.toLowerCase() : undefined,
    type: node.type.toLowerCase(),
  }));
}

// This function does not return a complete Component as described in ServerTypes;
// it instead selectively returns only what's needed to generate a manifest.
export const fetchComponentDataForManifest = async ({
  componentKey,
  isPrivate,
}: { componentKey: string; isPrivate: boolean }) => {
  const accessToken = await getPrismAccessToken();
  const prismaticUrl = process.env.PRISMATIC_URL ?? "https://app.prismatic.io";

  const query = `
    query componentQuery($componentKey: String!, $public: Boolean!) {
      components(key: $componentKey, public: $public) {
        nodes {
          id
          label
          description
          signature
          key
          actions {
            nodes {
              isDataSource
              isDetailDataSource
              dataSourceType
              isTrigger
              isCommonTrigger
              key
              label
              description
              inputs {
                nodes {
                  key
                  label
                  type
                  required
                  default
                  collection
                  shown
                  onPremiseControlled
                }
              }
              examplePayload
            }
          }
          connections {
            nodes {
              key
              label
              comments
              inputs {
                nodes {
                  key
                  label
                  type
                  required
                  default
                  collection
                  shown
                  onPremiseControlled
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await axios.post(
    `${prismaticUrl}/api`,
    {
      query,
      variables: {
        componentKey,
        public: !isPrivate,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // @TODO: Is it OK to list spectral here? As opposed to prism
        "Prismatic-Client": "spectral",
      },
    },
  );

  const component: ComponentNode = response.data.data.components.nodes[0];

  if (!component) {
    throw new Error(
      `Could not find a ${
        isPrivate ? "private" : "public"
      } component with the given key: ${componentKey}`,
    );
  }

  const actions: Record<string, FormattedAction> = {};
  const triggers: Record<string, FormattedTrigger> = {};
  const dataSources: Record<string, FormattedDataSource> = {};

  component.actions.nodes.forEach((node) => {
    if (node.isTrigger) {
      triggers[node.key] = {
        key: node.key,
        display: {
          label: node.label,
          description: node.description,
        },
        inputs: transformInputNodes(node.inputs.nodes),
      };
    } else if (node.isDataSource) {
      dataSources[node.key] = {
        key: node.key,
        display: {
          label: node.label,
          description: node.description,
        },
        inputs: transformInputNodes(node.inputs.nodes),
        dataSourceType: (node.dataSourceType ?? "string").toLowerCase() as DataSourceType,
        examplePayload: node.examplePayload ?? {},
      };
    } else {
      actions[node.key] = {
        key: node.key,
        display: {
          label: node.label,
          description: node.description,
        },
        inputs: transformInputNodes(node.inputs.nodes),
      };
    }
  });

  const connections = component.connections.nodes.map((node) => {
    return {
      key: node.key,
      label: node.label,
      comments: node.comments,
      inputs: transformInputNodes(node.inputs.nodes),
    };
  });

  return {
    key: componentKey,
    signature: component.signature,
    public: !isPrivate,
    display: {
      label: component.label,
      description: component.description,
    },
    actions,
    triggers,
    dataSources,
    connections,
  };
};

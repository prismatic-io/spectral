import type { ObjectLiteralExpression } from "ts-morph";
import type { ConfigVarShape } from "./zodSchema";

export type Scope = "instance" | "userLevel";

export interface ClassifiedElement {
  key: string;
  /** Source that reaches the element from the integration file, e.g. `configPages.Page.elements.key`. */
  path: string;
  scope: Scope;
  kind: "connection" | "dataSource" | "value";
  shape: ConfigVarShape;
  /** The element's declaration, when it resolves to an object literal. */
  literal?: ObjectLiteralExpression;
}

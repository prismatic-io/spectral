import { expect, test, vi } from "vitest";
import contract from "./contract.cjs";
import packaged from "./packaged-contract.cjs";

contract.contract({ expect, test, vi });
packaged.packagedContract(
  { expect, test },
  () => import("./node_modules/.cache/callable-fixture/component.mjs"),
);

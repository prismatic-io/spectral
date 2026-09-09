import type { Codemod } from "../codemod";
import integrationConfiguration from "./v10.0.0/integrationConfiguration";

const all: Codemod[] = [integrationConfiguration];

/** Every shipped codemod, keyed by its command-line name. */
export const codemods: ReadonlyMap<string, Codemod> = new Map(all.map((mod) => [mod.name, mod]));

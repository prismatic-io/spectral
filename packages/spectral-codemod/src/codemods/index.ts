import type { Codemod } from "../codemod";
import headlessConfiguration from "./v10.0.0/headlessConfiguration";

const all: Codemod[] = [headlessConfiguration];

/** Every shipped codemod, keyed by its command-line name. */
export const codemods: ReadonlyMap<string, Codemod> = new Map(all.map((mod) => [mod.name, mod]));

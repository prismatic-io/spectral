import { type Codemod, codemodId } from "../codemod";
import publicEntryPoints from "./v10.35.1/publicEntryPoints";
import callableComponentPackaging from "./v10.36.0/callableComponentPackaging";
import integrationConfiguration from "./v10.36.0/integrationConfiguration";

const all: Codemod[] = [publicEntryPoints, integrationConfiguration, callableComponentPackaging];

/** Every shipped codemod, keyed by its versioned name. */
export const codemods: ReadonlyMap<string, Codemod> = new Map(
  all.map((mod) => [codemodId(mod), mod]),
);

const VERSION = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;

interface Version {
  core: [number, number, number];
  prerelease: boolean;
}

const parseVersion = (version: string): Version | undefined => {
  const match = VERSION.exec(version);
  return match
    ? {
        core: [Number(match[1]), Number(match[2]), Number(match[3])],
        prerelease: match[4] !== undefined,
      }
    : undefined;
};

/**
 * True when a codemod for spectral `version` applies to a project on spectral `target`:
 * `version` is at or below it. A prerelease of a version is below that version.
 */
const appliesTo = (version: Version, target: Version): boolean => {
  for (const [index, part] of version.core.entries()) {
    if (part !== target.core[index]) return part < target.core[index];
  }
  return !target.prerelease;
};

/** The version a codemod declares, which must be a plain release such as `10.0.0`. */
const versionOf = (codemod: Codemod): Version => {
  const version = parseVersion(codemod.version);
  if (!version || version.prerelease) {
    throw new Error(`Codemod "${codemod.name}" declares an invalid version: "${codemod.version}".`);
  }
  return version;
};

const compareVersions = (a: Codemod, b: Codemod): number => {
  const [left, right] = [versionOf(a).core, versionOf(b).core];
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
};

/**
 * The codemod `requested` names. A versioned name, such as
 * `v10.36.0/integration-configuration`, names one codemod. A bare name, such as
 * `integration-configuration`, names the latest version of that migration at or below
 * `targetSpectral`, or the newest bundled version when the target is `latest`.
 * Throws when no single codemod is named.
 */
export const resolveCodemod = (
  requested: string,
  targetSpectral: string | undefined,
  available: Iterable<Codemod> = codemods.values(),
): Codemod => {
  const candidates = [...available];
  const versioned = candidates.find((mod) => codemodId(mod) === requested);
  if (versioned || /^v[^/]*\//.test(requested)) {
    if (!versioned) {
      throw new Error(`Unknown codemod "${requested}".`);
    }
    if (targetSpectral !== undefined) {
      throw new Error(
        `"${requested}" names its version, so it takes no --target-spectral. Pass "${versioned.name}" with --target-spectral, or "${requested}" alone.`,
      );
    }
    return versioned;
  }

  const versions = candidates.filter((mod) => mod.name === requested).sort(compareVersions);
  if (versions.length === 0) {
    throw new Error(`Unknown codemod "${requested}".`);
  }
  if (targetSpectral === undefined) {
    throw new Error(
      `"${requested}" does not name a version. Pass a versioned codemod, such as "${codemodId(versions[versions.length - 1])}", or the spectral version to migrate to with --target-spectral <version|latest>.`,
    );
  }
  if (targetSpectral === "latest") {
    return versions[versions.length - 1];
  }
  const target = parseVersion(targetSpectral);
  if (!target) {
    throw new Error(
      `--target-spectral takes a spectral version, such as 10.3.1, or "latest". "${targetSpectral}" is not one.`,
    );
  }
  const applicable = versions.filter((mod) => appliesTo(versionOf(mod), target));
  const latest = applicable[applicable.length - 1];
  if (!latest) {
    throw new Error(
      `No version of "${requested}" applies to spectral ${targetSpectral}. Its versions are ${versions.map((mod) => mod.version).join(", ")}.`,
    );
  }
  return latest;
};

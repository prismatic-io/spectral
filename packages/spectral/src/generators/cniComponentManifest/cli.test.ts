import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { manifestTestInputs } from "../componentManifest/manifestTestInputs";
import { transformInputNodes } from ".";

type CniComponentManifestModule = typeof import(".");

const [cniStructuredObjectInput] = transformInputNodes([
  {
    id: "contact-id",
    parentId: null,
    key: "contact",
    label: "contact",
    type: "STRUCTUREDOBJECT",
    required: false,
    default: undefined,
    collection: "",
    shown: true,
    onPremiseControlled: false,
  },
  {
    id: "first-name-id",
    parentId: "contact-id",
    key: "firstName",
    label: "firstName",
    type: "STRING",
    required: true,
    default: undefined,
    collection: "",
    shown: true,
    onPremiseControlled: false,
  },
  {
    id: "active-id",
    parentId: "contact-id",
    key: "active",
    label: "active",
    type: "BOOLEAN",
    required: false,
    default: undefined,
    collection: "",
    shown: true,
    onPremiseControlled: false,
  },
]);

const cniManifestTestInputs = manifestTestInputs.map((input) =>
  input.key === "contact" ? cniStructuredObjectInput : input,
);

const component: Awaited<ReturnType<CniComponentManifestModule["fetchComponentDataForManifest"]>> =
  {
    key: "acme",
    signature: "acme-signature",
    public: true,
    display: {
      label: "Acme",
      description: "An Acme component",
    },
    actions: {
      doThing: {
        key: "doThing",
        display: {
          label: "Do Thing",
          description: "Does a thing",
        },
        inputs: cniManifestTestInputs,
        examplePayload: {
          data: {
            result: "done",
          },
        },
      },
    },
    triggers: {
      onEvent: {
        key: "onEvent",
        display: {
          label: "On Event",
          description: "Runs when an event occurs",
        },
        inputs: [],
      },
    },
    dataSources: {
      selectItem: {
        key: "selectItem",
        display: {
          label: "Select Item",
          description: "Selects an item",
        },
        inputs: [],
        dataSourceType: "picklist",
        examplePayload: {
          result: [],
        },
      },
    },
    connections: [
      {
        key: "apiKey",
        label: "API Key",
        comments: "Connect with an API key",
        inputs: [],
      },
    ],
  };

const apiMocks = vi.hoisted(() => ({
  fetchComponentDataForManifest:
    vi.fn<CniComponentManifestModule["fetchComponentDataForManifest"]>(),
  fetchConnectionStableKeys: vi.fn<CniComponentManifestModule["fetchConnectionStableKeys"]>(),
  fetchUserActivatedConnectionStableKeys:
    vi.fn<CniComponentManifestModule["fetchUserActivatedConnectionStableKeys"]>(),
}));

vi.mock(import("."), async (importOriginal) => ({
  ...(await importOriginal()),
  ...apiMocks,
}));

import { runMain } from "./cli";

const expectPathNotToExist = async (target: string) => {
  await expect(access(target)).rejects.toMatchObject({ code: "ENOENT" });
};

const snapshotDirectory = async (root: string): Promise<Record<string, string>> => {
  const snapshot: Record<string, string> = {};

  const visit = async (currentDir: string, relativeDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const relativePath = path.join(relativeDir, entry.name);
        const absolutePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          snapshot[`${relativePath}/`] = "directory";
          await visit(absolutePath, relativePath);
          return;
        }

        snapshot[relativePath] = (await readFile(absolutePath)).toString("base64");
      }),
    );
  };

  await visit(root, "");
  return snapshot;
};

describe("cni-component-manifest filesystem behavior", () => {
  let workingDir: string;
  let consoleInfo: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    workingDir = await mkdtemp(path.join(tmpdir(), "spectral-cni-manifest-"));
    apiMocks.fetchComponentDataForManifest.mockResolvedValue(component);
    apiMocks.fetchConnectionStableKeys.mockResolvedValue(["existing-connection"]);
    apiMocks.fetchUserActivatedConnectionStableKeys.mockResolvedValue(["existing-user-connection"]);
    consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    consoleInfo.mockRestore();
    vi.clearAllMocks();
    await rm(workingDir, { recursive: true, force: true });
  });

  const run = async (...args: string[]) => {
    const commandProcess = {
      argv: ["node", "cni-component-manifest", "acme", ...args],
      cwd: () => workingDir,
      exit: vi.fn(),
    } as unknown as NodeJS.Process;

    await runMain(commandProcess);
  };

  test.each([
    "--dry-run",
    "-d",
  ])("preserves an existing manifest during a dry run with %s", async (dryRunFlag) => {
    const destinationDir = path.join(workingDir, "src", "manifests", component.key);
    const sentinel = path.join(destinationDir, "custom.ts");
    await mkdir(destinationDir, { recursive: true });
    await writeFile(sentinel, "custom content", "utf8");
    const before = await snapshotDirectory(workingDir);

    await run(dryRunFlag);

    expect(await snapshotDirectory(workingDir)).toEqual(before);
    expect(await readFile(sentinel, "utf8")).toBe("custom content");
    expect(consoleInfo).toHaveBeenLastCalledWith(
      "Dry run completed successfully for Acme. No files were changed.",
    );
  });

  test.each([
    "--dry-run",
    "-d",
  ])("does not create a destination directory during a dry run with %s", async (dryRunFlag) => {
    const destinationDir = path.join(workingDir, "src", "manifests", component.key);
    const before = await snapshotDirectory(workingDir);

    await run(dryRunFlag);

    expect(await snapshotDirectory(workingDir)).toEqual(before);
    await expectPathNotToExist(destinationDir);
  });

  test("replaces stale files and generates a manifest outside dry-run mode", async () => {
    const destinationDir = path.join(workingDir, "src", "manifests", component.key);
    const staleFile = path.join(destinationDir, "stale.ts");
    await mkdir(destinationDir, { recursive: true });
    await writeFile(staleFile, "stale content", "utf8");

    await run();

    await expectPathNotToExist(staleFile);
    const generatedFiles = new Map([
      ["index.ts", 'key: "acme"'],
      [path.join("actions", "doThing.ts"), "contact?: { firstName: string; active: boolean }"],
      [path.join("triggers", "onEvent.ts"), 'key: "onEvent"'],
      [path.join("connections", "apiKey.ts"), 'key: "apiKey"'],
      [path.join("dataSources", "selectItem.ts"), 'key: "selectItem"'],
      [path.join("connections", "index.ts"), '"existing-connection"'],
    ]);

    await Promise.all(
      Array.from(generatedFiles, async ([relativePath, expectedContent]) => {
        expect(await readFile(path.join(destinationDir, relativePath), "utf8")).toContain(
          expectedContent,
        );
      }),
    );

    const connectionsIndex = await readFile(
      path.join(destinationDir, "connections", "index.ts"),
      "utf8",
    );

    // The two helpers differ by the config var they build, so each is asserted on the
    // dataType it produces rather than on its name alone.
    expect(connectionsIndex).toContain("acmeReusableConnection");
    expect(connectionsIndex).toContain('dataType: "connection"');
    expect(connectionsIndex).toContain("acmeUserActivatedConnection");
    expect(connectionsIndex).toContain('"existing-user-connection"');
    expect(connectionsIndex).toContain('dataType: "userScopedConnection"');

    const action = await readFile(path.join(destinationDir, "actions", "doThing.ts"), "utf8");
    expect(action).toMatchSnapshot();
    expect(action).toContain('inputType: "structuredObject"');
    expect(action).not.toContain('inputType: "structuredobject"');
    expect(action).not.toContain("collection: undefined");
    expect(action).not.toContain("default: undefined");
    expect(action).not.toContain("dynamicSelection");
    expect(action).not.toContain("dynamicField");
  });
});

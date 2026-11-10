import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

const connectionDefinition = join(__dirname, "ConnectionDefinition");
const dir = realpathSync(mkdtempSync(join(tmpdir(), "spectral-connection-dts-")));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Writes declarations for `source` and returns the messages of the errors. */
const declarationErrors = (source: string): string[] => {
  const file = join(dir, "connection.ts");
  writeFileSync(file, source);
  const program = ts.createProgram([file], {
    declaration: true,
    emitDeclarationOnly: true,
    outDir: join(dir, "out"),
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    skipLibCheck: true,
  });
  const sourceFile = program.getSourceFile(file);
  return [
    ...program.getSemanticDiagnostics(sourceFile),
    ...program.getDeclarationDiagnostics(sourceFile),
  ].map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};

describe("templateConnectionInputs", () => {
  // A component that exports a connection built with templateConnectionInputs
  // must be able to write declarations. The inferred type of the connection
  // uses the OAuth 2.0 input interfaces, so spectral must export them.
  it.each([
    [
      "authorization_code",
      "AuthorizationCode",
      ["authorizeUrl", "scopes", "clientId", "clientSecret"],
    ],
    ["client_credentials", "ClientCredentials", ["scopes", "clientId", "clientSecret"]],
  ])("lets a %s connection write declarations", (_name, oauth2Type, inputKeys) => {
    const inputs = inputKeys.map((key) => `${key}: input`).join(", ");
    const errors = declarationErrors(`
import { OAuth2Type, templateConnectionInputs } from ${JSON.stringify(connectionDefinition)};

const input = { label: "Value", type: "string" as const, required: true };

export const inputs = templateConnectionInputs(
  { domain: input, ${inputs} },
  { tokenUrl: { label: "Token URL", type: "template", templateValue: "https://{{#domain}}/token" } },
  OAuth2Type.${oauth2Type},
);
`);
    expect(errors).toEqual([]);
  });
});

import { expectType } from "tsd";
import { createClient, handleErrors, type HttpClient } from "@prismatic-io/spectral/http";
import { createConnection, invoke } from "@prismatic-io/spectral/testing";

// The public subpaths resolve under `moduleResolution: "node"` (via typesVersions) with
// the same types as the deprecated dist/ paths.
expectType<HttpClient>(createClient({ baseUrl: "https://example.com" }));
expectType<typeof import("@prismatic-io/spectral/dist/clients/http").handleErrors>(handleErrors);
expectType<typeof import("@prismatic-io/spectral/dist/testing").invoke>(invoke);
expectType<typeof import("@prismatic-io/spectral/dist/testing").createConnection>(createConnection);

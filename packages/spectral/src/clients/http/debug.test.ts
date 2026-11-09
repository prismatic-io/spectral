import type { AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from ".";

const adapter: AxiosAdapter = async (config) => ({
  data: { ok: true },
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json", "set-cookie": "session=abc123" },
  config,
});

const debugLogs = async (headers: Record<string, string>) => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const client = createClient({ baseUrl: "https://example.com", headers, debug: true });
  client.defaults.adapter = adapter;
  await client.get("/items");
  return log.mock.calls.map(([line]) => JSON.parse(String(line)));
};

describe("createClient debug logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides credential header values in the request log", async () => {
    const [request] = await debugLogs({
      Authorization: "Bearer secret-token",
      "X-API-Key": "secret-key",
      "X-Auth-Token": "secret-auth",
      Accept: "application/json",
    });
    expect(request.type).toBe("request");
    expect(request.headers).toMatchObject({
      Authorization: "[REDACTED]",
      "X-API-Key": "[REDACTED]",
      "X-Auth-Token": "[REDACTED]",
      Accept: "application/json",
    });
    expect(JSON.stringify(request)).not.toContain("secret");
  });

  it("hides cookies in the response log", async () => {
    const [, response] = await debugLogs({});
    expect(response.type).toBe("response");
    expect(response.headers).toEqual({
      "content-type": "application/json",
      "set-cookie": "[REDACTED]",
    });
  });

  it("does not change the headers that the request sends", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = createClient({
      baseUrl: "https://example.com",
      headers: { Authorization: "Bearer secret-token" },
      debug: true,
    });
    const sent = vi.fn(adapter);
    client.defaults.adapter = sent;
    await client.get("/items");
    expect(sent.mock.calls[0][0].headers.Authorization).toBe("Bearer secret-token");
  });
});

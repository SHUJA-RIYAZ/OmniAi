import { describe, expect, it, vi } from "vitest";
import { ExtensionError } from "../types/errors";
import { HttpBridgeClient } from "./bridgeClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpBridgeClient", () => {
  it("reports health", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { ok: true, data: { status: "healthy", version: "0.1.0" } }),
    );
    const client = new HttpBridgeClient("http://127.0.0.1:8765", fetchImpl);
    await expect(client.health()).resolves.toEqual({
      status: "healthy",
      version: "0.1.0",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8765/api/v1/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("fetches latest context", async () => {
    const snapshot = {
      id: "s1",
      createdAt: "2026-01-01T00:00:00.000Z",
      schemaVersion: 2,
      workspace: { name: "demo", rootPath: "/demo", languages: ["ts"], manifests: [] },
      diagnostics: [],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ok: true, data: snapshot }));
    const client = new HttpBridgeClient("http://127.0.0.1:8765", fetchImpl);
    await expect(client.getLatestContext()).resolves.toEqual(snapshot);
  });

  it("throws BRIDGE_OFFLINE when network fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const client = new HttpBridgeClient("http://127.0.0.1:8765", fetchImpl);
    await expect(client.health()).rejects.toMatchObject({
      code: "BRIDGE_OFFLINE",
    } satisfies Partial<ExtensionError>);
  });

  it("throws NO_CONTEXT when latest is missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { ok: false, error: "No context snapshot" }));
    const client = new HttpBridgeClient("http://127.0.0.1:8765", fetchImpl);
    await expect(client.getLatestContext()).rejects.toMatchObject({
      code: "NO_CONTEXT",
    });
  });

  it("fetches snapshot by id", async () => {
    const snapshot = {
      id: "abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      schemaVersion: 2,
      workspace: { name: "demo", rootPath: "/demo", languages: [], manifests: [] },
      diagnostics: [],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ok: true, data: snapshot }));
    const client = new HttpBridgeClient("http://bridge", fetchImpl);
    await expect(client.getSnapshot("abc")).resolves.toEqual(snapshot);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://bridge/api/v1/context/abc");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "./hono.ts";

describe("hono error handling", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts a plain error to a problem details response", async () => {
    const res = await app.request("/error");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({
      status: 500,
      title: "Internal Server Error",
      detail: "The server encountered an unexpected condition.",
    });
  });

  it("converts a Hono HTTPException to a problem details response", async () => {
    const res = await app.request("/hono-error");
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({
      status: 400,
      title: "Error",
      detail: "This is an example of an error from hono",
    });
  });

  it("returns an HttpError as a problem details response with its extensions", async () => {
    const res = await app.request("/http-error");
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({
      status: 400,
      title: "Bad Request",
      detail: "This is an example of an HttpError",
      type: "/errors/http-error",
      instance: "/errors/http-error/instance/123",
      customField: "customValue",
    });
  });

  it("logs the converted error and the request", async () => {
    await app.request("/http-error");
    expect(console.log).toHaveBeenCalledWith("GET", "/http-error");
    expect(console.error).toHaveBeenCalledOnce();
  });
});

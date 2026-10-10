import { describe, expect, it } from "vitest";

import { STATUS_CODE, STATUS_TEXT } from "./status.ts";

describe("status table", () => {
  it("has text for exactly the codes in STATUS_CODE", () => {
    const codes = Object.values(STATUS_CODE).toSorted((a, b) => a - b);
    const textKeys = Object.keys(STATUS_TEXT)
      .map(Number)
      .toSorted((a, b) => a - b);
    expect(textKeys).toEqual(codes);
  });

  it("has unique codes", () => {
    const codes = Object.values(STATUS_CODE);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each([
    ["OK", 200, "OK"],
    ["NotFound", 404, "Not Found"],
    ["Teapot", 418, "I'm a teapot"],
    ["ContentTooLarge", 413, "Content Too Large"],
    ["InternalServerError", 500, "Internal Server Error"],
    ["NetworkAuthenticationRequired", 511, "Network Authentication Required"],
  ] as const)("maps %s to %i and %s", (name, code, text) => {
    expect(STATUS_CODE[name]).toBe(code);
    expect(STATUS_TEXT[code]).toBe(text);
  });
});

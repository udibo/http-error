import { describe, expect, it } from "vitest";

import {
  createHttpErrorClass,
  HttpError,
  type HttpErrorOptions,
  isHttpErrorLike,
} from "./mod.ts";

const DEFAULT_ERROR_NAMES: Readonly<Record<number, string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Auth Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
};

const DEFAULT_EXPOSED_MESSAGES: Readonly<Record<number, string>> = {
  400: "The server cannot process the request due to a client error.",
  401: "Authentication is required to access this resource.",
  402: "Payment is required to access this resource.",
  403: "You do not have permission to access this resource.",
  404: "The requested resource could not be found.",
  405: "The request method is not supported for this resource.",
  406: "The server cannot produce a response matching the acceptable values.",
  407: "Proxy authentication is required.",
  408: "The server timed out waiting for the request.",
  409: "The request conflicts with the current state of the resource.",
  410: "The requested resource is no longer available.",
  411: "The request requires a Content-Length header.",
  412: "A precondition in the request headers was not met.",
  413: "The request body is larger than the server is willing to process.",
  414: "The request URI is longer than the server is willing to process.",
  415: "The request uses a media type that is not supported.",
  416: "The requested range cannot be satisfied.",
  417: "The expectation in the Expect header cannot be met.",
  418: "The server refuses to brew coffee because it is a teapot.",
  421: "The request was directed at a server unable to produce a response.",
  422: "The request was well-formed but contained semantic errors.",
  423: "The requested resource is locked.",
  424: "The request failed due to a previous request failure.",
  425: "The server is unwilling to process a request that might be replayed.",
  426: "The client must upgrade to a different protocol.",
  428: "The request must be conditional.",
  429: "Too many requests have been sent in a given amount of time.",
  431: "The request headers are too large.",
  451: "The resource is unavailable for legal reasons.",
  500: "The server encountered an unexpected condition.",
  501: "The server does not support the functionality required.",
  502: "The server received an invalid response from an upstream server.",
  503: "The server is currently unavailable.",
  504: "The server did not receive a timely response from an upstream server.",
  505: "The HTTP version used in the request is not supported.",
  506: "The server has an internal configuration error.",
  507: "The server has insufficient storage to complete the request.",
  508: "The server detected an infinite loop while processing the request.",
  510: "Further extensions to the request are required.",
  511: "Network authentication is required to access this resource.",
};

function defaultErrorName(status: number): string {
  return (
    DEFAULT_ERROR_NAMES[status] ??
    (status < 500 ? "Unknown Client Error" : "Unknown Server Error")
  );
}

function defaultExposedMessage(status: number): string {
  return (
    DEFAULT_EXPOSED_MESSAGES[status] ??
    (status < 500 ? "A client error occurred." : "A server error occurred.")
  );
}

const statusRange = Array.from({ length: 200 }, (_, index) => 400 + index);

describe("HttpError", () => {
  it("defaults to a non-exposed 500 error without args", () => {
    const error = new HttpError();
    expect(error.toString()).toBe("Internal Server Error");
    expect(error.name).toBe("Internal Server Error");
    expect(error.message).toBe("");
    expect(error.status).toBe(500);
    expect(error.expose).toBe(false);
    expect(error.cause).toBeUndefined();
    expect(error.extensions).toEqual({});
    expect(error.statusText).toBeUndefined();
    expect(error.type).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.exposedMessage).toBe(
      "The server encountered an unexpected condition.",
    );
  });

  it("is an Error whose name is not enumerable", () => {
    const error = new HttpError(404, "missing");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(Object.keys(error)).not.toContain("name");
  });

  it.each([
    ["status", () => new HttpError(400)],
    ["options", () => new HttpError({ status: 400 })],
    [
      "undefined message and options",
      () => new HttpError(undefined, { status: 400 }),
    ],
  ])("accepts a status through %s", (_label, create) => {
    const error = create();
    expect(error.status).toBe(400);
    expect(error.expose).toBe(true);
  });

  it.each([
    ["message", () => new HttpError("something went wrong")],
    ["options", () => new HttpError({ message: "something went wrong" })],
    [
      "undefined status and message",
      () => new HttpError(undefined, "something went wrong"),
    ],
    [
      "undefined status and options",
      () => new HttpError(undefined, { message: "something went wrong" }),
    ],
  ])("accepts a message through %s", (_label, create) => {
    const error = create();
    expect(error.toString()).toBe(
      "Internal Server Error: something went wrong",
    );
    expect(error.message).toBe("something went wrong");
    expect(error.exposedMessage).toBe(
      "The server encountered an unexpected condition.",
    );
  });

  describe("status and message arguments take priority over options", () => {
    const options = { message: "failed", status: 502 };

    it.each([
      {
        label: "status, message, options",
        create: () => new HttpError(400, "something went wrong", options),
        status: 400,
        name: "Bad Request",
        message: "something went wrong",
      },
      {
        label: "status, options",
        create: () => new HttpError(400, options),
        status: 400,
        name: "Bad Request",
        message: "failed",
      },
      {
        label: "message, options",
        create: () => new HttpError("something went wrong", options),
        status: 502,
        name: "Bad Gateway",
        message: "something went wrong",
      },
      {
        label: "options",
        create: () => new HttpError(options),
        status: 502,
        name: "Bad Gateway",
        message: "failed",
      },
    ])("$label", ({ create, status, name, message }) => {
      const error = create();
      expect(error.toString()).toBe(`${name}: ${message}`);
      expect(error.name).toBe(name);
      expect(error.message).toBe(message);
      expect(error.status).toBe(status);
      expect(error.expose).toBe(status < 500);
    });
  });

  it.each([
    ["options", (cause: Error) => new HttpError({ cause })],
    ["status undefined", (cause: Error) => new HttpError(undefined, { cause })],
    [
      "status and message undefined",
      (cause: Error) => new HttpError(undefined, undefined, { cause }),
    ],
  ])("keeps the cause passed through %s", (_label, create) => {
    const cause = new Error("fail");
    expect(create(cause).cause).toBe(cause);
  });

  it("keeps a falsy cause", () => {
    expect(new HttpError({ cause: 0 }).cause).toBe(0);
    expect(new HttpError({ cause: null }).cause).toBeNull();
  });

  it.each([-500, 0, 399, 600, 1000])(
    "throws a RangeError for the invalid status %i",
    (status) => {
      expect(() => new HttpError(status)).toThrow(
        new RangeError("invalid error status"),
      );
      expect(() => new HttpError(status)).toThrow(RangeError);
    },
  );

  it("accepts the boundary statuses 400 and 599", () => {
    expect(new HttpError(400).status).toBe(400);
    expect(new HttpError(599).status).toBe(599);
  });

  it("derives the default name from the status for every error status", () => {
    const message = "something went wrong";
    for (const status of statusRange) {
      const name = defaultErrorName(status);
      const error = new HttpError(status, message);
      expect([
        error.status,
        error.name,
        error.message,
        error.toString(),
      ]).toEqual([status, name, message, `${name}: ${message}`]);
    }
  });

  it("names unknown statuses by class of error", () => {
    expect(new HttpError(499).name).toBe("Unknown Client Error");
    expect(new HttpError(599).name).toBe("Unknown Server Error");
  });

  it("overrides the name for every error status", () => {
    const message = "something went wrong";
    for (const status of statusRange) {
      const error = new HttpError(status, message, { name: "CustomError" });
      expect([error.status, error.name, error.toString()]).toEqual([
        status,
        "CustomError",
        `CustomError: ${message}`,
      ]);
    }
  });

  it("exposes only client errors by default", () => {
    for (const status of statusRange) {
      expect(new HttpError(status).expose).toBe(status < 500);
    }
  });

  it("lets expose be overridden for every error status", () => {
    for (const status of statusRange) {
      const expose = status >= 500;
      expect(new HttpError(status, { expose }).expose).toBe(expose);
    }
  });

  describe("with all options", () => {
    const cause = new Error("fail");
    const extensions = { key: "value" };

    function allOptions(): HttpErrorOptions<typeof extensions> {
      const headers = new Headers({ "X-Custom-Header": "TestValue" });
      headers.set("content-type", "application/custom+json");
      return {
        name: "CustomErrorName",
        message: "A very specific error occurred.",
        status: 418,
        statusText: "I'm a teapot",
        expose: false,
        cause,
        type: "/errors/custom-operation-failed",
        instance: "/errors/custom-operation-failed/instance/123xyz",
        extensions,
        headers,
      };
    }

    it.each([
      {
        signature: "status, message, options",
        create: (options: HttpErrorOptions<typeof extensions>) =>
          new HttpError(418, "A very specific error occurred.", options),
      },
      {
        signature: "status, options",
        create: (options: HttpErrorOptions<typeof extensions>) =>
          new HttpError(418, options),
      },
      {
        signature: "message, options",
        create: ({
          message,
          ...options
        }: HttpErrorOptions<typeof extensions>) =>
          new HttpError(message, { ...options, status: 418 }),
      },
      {
        signature: "options",
        create: (options: HttpErrorOptions<typeof extensions>) =>
          new HttpError(options),
      },
    ])("constructor with $signature signature", ({ create }) => {
      const error = create(allOptions());
      expect(error.name).toBe("CustomErrorName");
      expect(error.message).toBe("A very specific error occurred.");
      expect(error.status).toBe(418);
      expect(error.statusText).toBe("I'm a teapot");
      expect(error.expose).toBe(false);
      expect(error.cause).toBe(cause);
      expect(error.type).toBe("/errors/custom-operation-failed");
      expect(error.instance).toBe(
        "/errors/custom-operation-failed/instance/123xyz",
      );
      expect(error.extensions).toEqual(extensions);
      expect(error.headers.get("X-Custom-Header")).toBe("TestValue");
      expect(error.headers.get("content-type")).toBe("application/custom+json");
      expect(error.toString()).toBe(
        "CustomErrorName: A very specific error occurred.",
      );
    });
  });

  describe("headers", () => {
    it("accepts a plain object and defaults the content type", () => {
      const error = new HttpError({
        headers: {
          "X-Custom-Test": "Value",
          "X-Another-Header": "AnotherValue",
        },
      });
      expect(error.headers.get("X-Custom-Test")).toBe("Value");
      expect(error.headers.get("X-Another-Header")).toBe("AnotherValue");
      expect(error.headers.get("content-type")).toBe(
        "application/problem+json",
      );
    });

    it("keeps a content type given in a plain object", () => {
      const error = new HttpError({
        headers: {
          "X-Custom-Test": "Value",
          "content-type": "application/custom+json",
        },
      });
      expect(error.headers.get("X-Custom-Test")).toBe("Value");
      expect(error.headers.get("content-type")).toBe("application/custom+json");
    });

    it("uses a Headers instance as given", () => {
      const headers = new Headers({ "X-Custom-Test": "Value" });
      const error = new HttpError({ headers });
      expect(error.headers === headers).toBe(true);
      expect(headers.get("content-type")).toBe("application/problem+json");
    });

    it("defaults the content type to problem+json", () => {
      expect(new HttpError().headers.get("content-type")).toBe(
        "application/problem+json",
      );
    });
  });

  it("keeps other data in extensions", () => {
    const cause = new Error("fail");
    const data = { x: 2, y: 3 };
    const errors = [
      new HttpError<typeof data>(400, "something went wrong", {
        name: "CustomError",
        expose: false,
        cause,
        extensions: data,
      }),
      new HttpError<typeof data>(400, {
        name: "CustomError",
        message: "something went wrong",
        expose: false,
        cause,
        extensions: data,
      }),
      new HttpError<typeof data>("something went wrong", {
        name: "CustomError",
        status: 400,
        expose: false,
        cause,
        extensions: data,
      }),
      new HttpError<typeof data>({
        name: "CustomError",
        message: "something went wrong",
        status: 400,
        expose: false,
        cause,
        extensions: data,
      }),
    ];
    for (const error of errors) {
      expect(error.toString()).toBe("CustomError: something went wrong");
      expect(error.name).toBe("CustomError");
      expect(error.message).toBe("something went wrong");
      expect(error.status).toBe(400);
      expect(error.expose).toBe(false);
      expect(error.cause).toBe(cause);
      expect(error.extensions).toEqual(data);
    }
  });

  describe("exposedMessage", () => {
    it("uses the message when the error is exposed", () => {
      const error = new HttpError(400, "Invalid email format");
      expect(error.message).toBe("Invalid email format");
      expect(error.exposedMessage).toBe("Invalid email format");
      expect(error.toJSON().detail).toBe("Invalid email format");
    });

    it("uses the status default when an exposed error has no message", () => {
      expect(new HttpError(404).exposedMessage).toBe(
        "The requested resource could not be found.",
      );
    });

    it("uses the status default when the error is not exposed", () => {
      const error = new HttpError(500, "SQL syntax error near 'DROP TABLE'");
      expect(error.exposedMessage).toBe(
        "The server encountered an unexpected condition.",
      );
      expect(error.toJSON().detail).toBe(
        "The server encountered an unexpected condition.",
      );
    });

    it("uses the status default for a client error with expose false", () => {
      const error = new HttpError(400, "private detail", { expose: false });
      expect(error.exposedMessage).toBe(
        "The server cannot process the request due to a client error.",
      );
    });

    it("exposes the message of a server error with expose true", () => {
      const error = new HttpError(503, "Down for maintenance", {
        expose: true,
      });
      expect(error.exposedMessage).toBe("Down for maintenance");
    });

    it("has a default message for every known error status", () => {
      for (const status of statusRange) {
        expect(new HttpError(status).exposedMessage).toBe(
          defaultExposedMessage(status),
        );
      }
    });

    it("falls back to a generic message for unknown statuses", () => {
      expect(new HttpError(499).exposedMessage).toBe(
        "A client error occurred.",
      );
      expect(new HttpError(599).exposedMessage).toBe(
        "A server error occurred.",
      );
    });

    it("prefers an explicit exposedMessage regardless of expose", () => {
      const exposed = new HttpError(400, "Internal validation details", {
        exposedMessage: "Please check your input.",
      });
      expect(exposed.exposedMessage).toBe("Please check your input.");
      expect(exposed.toJSON().detail).toBe("Please check your input.");

      const hidden = new HttpError(500, "Database connection refused", {
        exposedMessage: "Service temporarily unavailable.",
      });
      expect(hidden.exposedMessage).toBe("Service temporarily unavailable.");
      expect(hidden.toJSON().detail).toBe("Service temporarily unavailable.");
    });
  });

  describe("toJSON", () => {
    it("hides the message of an error converted from a plain Error", () => {
      expect(HttpError.from(new Error("fail")).toJSON()).toEqual({
        title: "Internal Server Error",
        status: 500,
        detail: "The server encountered an unexpected condition.",
      });
    });

    it("exposes a client error with extensions", () => {
      const data = { x: 2, y: 3 };
      const error = new HttpError<typeof data>(400, "something went wrong", {
        name: "CustomError",
        cause: new Error("fail"),
        extensions: data,
      });
      expect(error.toJSON()).toEqual({
        ...data,
        title: "CustomError",
        detail: "something went wrong",
        status: 400,
      });
    });

    it("hides the message of a server error with extensions", () => {
      const data = { x: 2, y: 3 };
      const error = new HttpError<typeof data>(500, "something went wrong", {
        name: "CustomError",
        cause: new Error("fail"),
        extensions: data,
      });
      expect(error.toJSON()).toEqual({
        ...data,
        title: "CustomError",
        status: 500,
        detail: "The server encountered an unexpected condition.",
      });
    });

    it("hides the message of a client error that is explicitly not exposed", () => {
      const data = { x: 2, y: 3 };
      const error = new HttpError<typeof data>(400, "something went wrong", {
        name: "CustomError",
        expose: false,
        cause: new Error("fail"),
        extensions: data,
      });
      expect(error.toJSON()).toEqual({
        ...data,
        title: "CustomError",
        status: 400,
        detail: "The server cannot process the request due to a client error.",
      });
    });

    it("omits type and instance when they are not set", () => {
      const json = new HttpError(404, "missing").toJSON();
      expect(Object.keys(json).toSorted()).toEqual([
        "detail",
        "status",
        "title",
      ]);
    });

    it("includes type and instance when they are set", () => {
      const json = new HttpError(404, "missing", {
        type: "/errors/missing",
        instance: "/things/1",
      }).toJSON();
      expect(json).toEqual({
        status: 404,
        title: "Not Found",
        detail: "missing",
        type: "/errors/missing",
        instance: "/things/1",
      });
    });

    it("lets the standard members override same-named extensions", () => {
      const error = new HttpError(400, "real detail", {
        extensions: { status: 200, title: "spoofed", detail: "spoofed" },
      });
      expect(error.toJSON()).toEqual({
        status: 400,
        title: "Bad Request",
        detail: "real detail",
      });
    });

    it("is used by JSON.stringify", () => {
      const error = new HttpError(409, "conflict", { extensions: { id: 7 } });
      expect(JSON.parse(JSON.stringify(error))).toEqual({
        id: 7,
        status: 409,
        title: "Conflict",
        detail: "conflict",
      });
    });
  });

  describe("getResponse", () => {
    it("builds a response for an exposed client error with extensions, type, and instance", async () => {
      const extensions = { extra: "data1" };
      const error = new HttpError<typeof extensions>(400, "Client Issue", {
        name: "MyClientError",
        extensions,
        type: "/err/client",
        instance: "/err/client/1",
      });
      const response = error.getResponse();
      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toBe(
        "application/problem+json",
      );
      expect(await response.json()).toEqual({
        ...extensions,
        status: 400,
        title: "MyClientError",
        detail: "Client Issue",
        type: "/err/client",
        instance: "/err/client/1",
      });
    });

    it("builds a response for a hidden server error with custom statusText and headers", async () => {
      const extensions = { extra: "data2" };
      const headers = new Headers({ "X-RateLimit-Limit": "100" });
      headers.set("content-type", "application/vnd.api+json");
      const error = new HttpError<typeof extensions>(503, "Server Down", {
        name: "CustomServerErr",
        statusText: "Service Really Unavailable",
        expose: false,
        extensions,
        headers,
      });
      const response = error.getResponse();
      expect(response.status).toBe(503);
      expect(response.statusText).toBe("Service Really Unavailable");
      expect(response.headers.get("content-type")).toBe(
        "application/vnd.api+json",
      );
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(await response.json()).toEqual({
        ...extensions,
        status: 503,
        title: "CustomServerErr",
        detail: "The server is currently unavailable.",
      });
    });

    it("defaults the content type and omits extensions", async () => {
      const response = new HttpError(404, "Not Found").getResponse();
      expect(response.headers.get("content-type")).toBe(
        "application/problem+json",
      );
      expect(await response.json()).toEqual({
        status: 404,
        title: "Not Found",
        detail: "Not Found",
      });
    });

    it("leaves the response statusText empty when none is set", () => {
      expect(new HttpError(404).getResponse().statusText).toBe("");
    });

    it("round-trips through HttpError.from", async () => {
      const error = new HttpError(422, "bad field", {
        type: "/errors/validation",
        instance: "/forms/1",
        extensions: { field: "email" },
      });
      const roundTripped = await HttpError.from(error.getResponse());
      expect(roundTripped.status).toBe(422);
      expect(roundTripped.name).toBe("Unprocessable Entity");
      expect(roundTripped.message).toBe("bad field");
      expect(roundTripped.type).toBe("/errors/validation");
      expect(roundTripped.instance).toBe("/forms/1");
      expect(roundTripped.extensions).toEqual({ field: "email" });
    });
  });

  describe("from", () => {
    it("wraps a plain Error in a 500 HttpError with the error as cause", () => {
      const cause = new Error("fail");
      const error = HttpError.from(cause);
      expect(error.toString()).toBe("Internal Server Error: fail");
      expect(error.name).toBe("Internal Server Error");
      expect(error.message).toBe("fail");
      expect(error.status).toBe(500);
      expect(error.expose).toBe(false);
      expect(error.cause).toBe(cause);
      expect(error.exposedMessage).toBe(
        "The server encountered an unexpected condition.",
      );
    });

    it("converts an Error with a status, keeping its name", () => {
      const original = Object.assign(new Error("fail"), { status: 400 });
      const error = HttpError.from(original);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.toString()).toBe("Error: fail");
      expect(error.name).toBe("Error");
      expect(error.message).toBe("fail");
      expect(error.status).toBe(400);
      expect(error.expose).toBe(true);
      expect(error.cause).toBeUndefined();
    });

    it("converts the old status-text-plus-Error name to the human-readable name", () => {
      const original = Object.assign(new Error("gone"), {
        name: "NotFoundError",
        status: 404,
      });
      expect(HttpError.from(original).name).toBe("Not Found");
    });

    it("keeps a custom name that does not match the old format for its status", () => {
      const original = Object.assign(new Error("gone"), {
        name: "NotFoundError",
        status: 410,
      });
      expect(HttpError.from(original).name).toBe("NotFoundError");
    });

    it("keeps an empty Error name as is", () => {
      const original = Object.assign(new Error("odd"), {
        name: "",
        status: 404,
      });
      expect(HttpError.from(original).name).toBe("");
    });

    it("keeps a name for a status without status text", () => {
      const original = Object.assign(new Error("odd"), {
        name: "Error",
        status: 499,
      });
      expect(HttpError.from(original).name).toBe("Error");
    });

    it("carries over the HttpError-like fields of an Error with a status", () => {
      const cause = new Error("root");
      const original = Object.assign(new Error("fail"), {
        status: 429,
        expose: false,
        cause,
        type: "/errors/rate-limit",
        instance: "/limits/1",
        extensions: { retryAfter: 30 },
        exposedMessage: "Slow down.",
        headers: new Headers({ "Retry-After": "30" }),
      });
      const error = HttpError.from(original);
      expect(error.status).toBe(429);
      expect(error.expose).toBe(false);
      expect(error.cause).toBe(cause);
      expect(error.type).toBe("/errors/rate-limit");
      expect(error.instance).toBe("/limits/1");
      expect(error.extensions).toEqual({ retryAfter: 30 });
      expect(error.exposedMessage).toBe("Slow down.");
      expect(error.headers.get("Retry-After")).toBe("30");
    });

    it("returns an HttpError instance as is", () => {
      const original = new HttpError({
        name: "CustomError",
        message: "something went wrong",
        cause: new Error("fail"),
        extensions: { x: 2, y: 3 },
      });
      expect(HttpError.from(original) === original).toBe(true);
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a number", 12345],
      ["a boolean", true],
      ["a string", "boom"],
      ["a symbol", Symbol("test-symbol")],
      ["an unrelated object", { completely: "unrelated object" }],
      ["a function", () => {}],
      ["an empty object", {}],
    ])("wraps %s as an unexpected error type", (_label, input) => {
      const error = HttpError.from(input);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(500);
      expect(error.message).toBe("unexpected error type");
      expect(error.cause).toBe(input);
    });

    it("converts a ProblemDetails object", () => {
      const problemDetails = {
        status: 404,
        title: "ResourceNotFound",
        detail: "The requested resource was not found.",
        type: "/errors/not-found",
        instance: "/items/123",
        anotherKey: "anotherValue",
      };
      const error = HttpError.from<{ anotherKey: string }>(problemDetails);
      expect(error.status).toBe(404);
      expect(error.name).toBe("ResourceNotFound");
      expect(error.message).toBe("The requested resource was not found.");
      expect(error.type).toBe("/errors/not-found");
      expect(error.instance).toBe("/items/123");
      expect(error.extensions).toEqual({ anotherKey: "anotherValue" });
      expect(error.expose).toBe(true);
    });

    it("recognizes a ProblemDetails object that only has a title or type", () => {
      expect(HttpError.from({ title: "Only Title", status: 400 }).name).toBe(
        "Only Title",
      );
      const byType = HttpError.from({ type: "/errors/only-type", status: 400 });
      expect(byType.type).toBe("/errors/only-type");
    });

    describe("Response", () => {
      it("converts a ProblemDetails body", async () => {
        const problemDetails = {
          status: 403,
          title: "ForbiddenError",
          detail: "Access denied",
          type: "/errors/forbidden",
          instance: "/errors/forbidden/123",
          customField: "customValue",
        };
        const response = new Response(JSON.stringify(problemDetails), {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        });
        const error = await HttpError.from(response);
        expect(error.status).toBe(403);
        expect(error.name).toBe("ForbiddenError");
        expect(error.message).toBe("Access denied");
        expect(error.type).toBe("/errors/forbidden");
        expect(error.instance).toBe("/errors/forbidden/123");
        expect(error.extensions).toEqual({ customField: "customValue" });
        expect(error.expose).toBe(true);
      });

      it("prefers the status in the body over the response status", async () => {
        const response = new Response(
          JSON.stringify({
            status: 403,
            title: "ForbiddenError",
            detail: "Access denied",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/problem+json" },
          },
        );
        const error = await HttpError.from(response);
        expect(error.status).toBe(403);
        expect(error.name).toBe("ForbiddenError");
        expect(error.message).toBe("Access denied");
      });

      it("uses the response status when the body has none", async () => {
        const response = new Response(
          JSON.stringify({ title: "BadRequest", detail: "Bad input" }),
          {
            status: 400,
            headers: { "Content-Type": "application/problem+json" },
          },
        );
        const error = await HttpError.from(response);
        expect(error.status).toBe(400);
        expect(error.name).toBe("BadRequest");
        expect(error.message).toBe("Bad input");
      });

      it("reports a body that is not valid JSON", async () => {
        const response = new Response("not json {{{{", { status: 500 });
        const error = await HttpError.from(response);
        expect(error.status).toBe(500);
        expect(error.message).toBe("could not parse problem details response");
        expect(error.cause).toBeInstanceOf(SyntaxError);
      });

      it("reports a body that was already consumed", async () => {
        const response = new Response("{}", { status: 500 });
        await response.text();
        const error = await HttpError.from(response);
        expect(error.status).toBe(500);
        expect(error.message).toBe("could not parse problem details response");
        expect(error.cause).toBeInstanceOf(TypeError);
      });

      it("reports JSON that is not ProblemDetails", async () => {
        const payload = { data: "some other structure" };
        const response = new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
        const error = await HttpError.from(response);
        expect(error.status).toBe(500);
        expect(error.message).toBe("invalid problem details response");
        expect(error.cause).toEqual(payload);
      });

      it("reports a JSON body that is not an object", async () => {
        const error = await HttpError.from(
          new Response("null", { status: 502 }),
        );
        expect(error.status).toBe(500);
        expect(error.message).toBe("invalid problem details response");
        expect(error.cause).toBeNull();
      });
    });
  });
});

describe("createHttpErrorClass", () => {
  it("creates a basic custom error class without default options", () => {
    const BasicError = createHttpErrorClass();
    const error = new BasicError(400, "test message");
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(BasicError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("test message");
    expect(error.name).toBe("Bad Request");

    const defaults = new BasicError();
    expect(defaults.status).toBe(500);
    expect(defaults.message).toBe("");
    expect(defaults.name).toBe("Internal Server Error");
  });

  it("creates a custom error class with default name and status", () => {
    const DefaultNameStatusError = createHttpErrorClass({
      name: "MyTestError",
      status: 499,
    });

    const byMessage = new DefaultNameStatusError("A message");
    expect(byMessage.status).toBe(499);
    expect(byMessage.name).toBe("MyTestError");
    expect(byMessage.message).toBe("A message");

    const byStatus = new DefaultNameStatusError(498, "Override status");
    expect(byStatus.status).toBe(498);
    expect(byStatus.name).toBe("MyTestError");
    expect(byStatus.message).toBe("Override status");

    const byOptions = new DefaultNameStatusError({
      message: "Via options",
      name: "OverriddenName",
    });
    expect(byOptions.status).toBe(499);
    expect(byOptions.name).toBe("OverriddenName");
    expect(byOptions.message).toBe("Via options");

    const byStatusOption = new DefaultNameStatusError({ status: 497 });
    expect(byStatusOption.status).toBe(497);
    expect(byStatusOption.name).toBe("MyTestError");
    expect(byStatusOption.message).toBe("");
  });

  it("merges default extensions with instance extensions", () => {
    interface MyExt {
      defaultKey: string;
      anotherKey?: number;
      yetAnotherKey?: string;
    }
    const ExtError = createHttpErrorClass<MyExt>({
      extensions: { defaultKey: "defaultValue", yetAnotherKey: "stillHere" },
    });

    const defaults = new ExtError("msg");
    expect(defaults.extensions.defaultKey).toBe("defaultValue");
    expect(defaults.extensions.yetAnotherKey).toBe("stillHere");
    expect(defaults.extensions.anotherKey).toBeUndefined();

    const merged = new ExtError("msg", {
      extensions: { defaultKey: "override", anotherKey: 123 },
    });
    expect(merged.extensions.defaultKey).toBe("override");
    expect(merged.extensions.anotherKey).toBe(123);
    expect((merged.extensions as MyExt).yetAnotherKey).toBe("stillHere");

    const byOptions = new ExtError({
      extensions: {
        anotherKey: 456,
        defaultKey: "defaultValue",
        yetAnotherKey: "stillHere",
      },
    });
    expect(byOptions.extensions.defaultKey).toBe("defaultValue");
    expect(byOptions.extensions.anotherKey).toBe(456);
    expect(byOptions.extensions.yetAnotherKey).toBe("stillHere");
    expect(byOptions.message).toBe("");
    expect(byOptions.status).toBe(500);

    const WithStatus = createHttpErrorClass<MyExt>({
      status: 420,
      extensions: { defaultKey: "val" },
    });
    const withStatus = new WithStatus();
    expect(withStatus.status).toBe(420);
    expect(withStatus.extensions.defaultKey).toBe("val");
  });

  it("does not share default extensions between instances", () => {
    const SharedDefaults = createHttpErrorClass<{
      list: string[];
      id?: string;
    }>({
      extensions: { list: [] },
    });
    const first = new SharedDefaults({ extensions: { list: [], id: "a" } });
    const second = new SharedDefaults();
    expect(second.extensions.id).toBeUndefined();
    expect(first.extensions).not.toBe(second.extensions);
  });

  describe("with all possible default options", () => {
    interface AllExt {
      id: string;
      type?: string;
      newProp?: string;
    }
    const defaultHeaders = new Headers({ "X-Default": "true" });
    const defaultCause = new Error("Default cause");

    const AllDefaultsError = createHttpErrorClass<AllExt>({
      name: "AllDefaultsErrorName",
      status: 488,
      message: "Default message for error",
      expose: true,
      statusText: "Default Status Text Here",
      type: "/errors/all-defaults-type",
      instance: "/errors/all-defaults-instance/0",
      extensions: { id: "default-id", type: "default-ext-type" },
      headers: defaultHeaders,
      cause: defaultCause,
      exposedMessage: "Default exposed message",
    });

    it("applies every default when instantiated without arguments", () => {
      const error = new AllDefaultsError();
      expect(error.name).toBe("AllDefaultsErrorName");
      expect(error.status).toBe(488);
      expect(error.message).toBe("Default message for error");
      expect(error.expose).toBe(true);
      expect(error.statusText).toBe("Default Status Text Here");
      expect(error.type).toBe("/errors/all-defaults-type");
      expect(error.instance).toBe("/errors/all-defaults-instance/0");
      expect(error.extensions.id).toBe("default-id");
      expect(error.extensions.type).toBe("default-ext-type");
      expect(error.headers.get("X-Default")).toBe("true");
      expect(error.cause).toBe(defaultCause);
      expect(error.exposedMessage).toBe("Default exposed message");
    });

    it("lets status and message arguments override the defaults", () => {
      const error = new AllDefaultsError(489, "New message from args");
      expect(error.status).toBe(489);
      expect(error.message).toBe("New message from args");
      expect(error.name).toBe("AllDefaultsErrorName");
      expect(error.extensions.id).toBe("default-id");
    });

    it("lets an options object override some defaults and keep the rest", () => {
      const instanceHeaders = new Headers({ "X-Instance": "live" });
      const instanceCause = new Error("Instance cause here");
      const error = new AllDefaultsError({
        name: "InstanceNameOverride",
        message: "Instance message in options",
        expose: false,
        extensions: { id: "instance-id-override", newProp: "instanceValue" },
        headers: instanceHeaders,
        cause: instanceCause,
        type: "/errors/instance-type-override",
        exposedMessage: "Instance exposed message",
      });
      expect(error.name).toBe("InstanceNameOverride");
      expect(error.status).toBe(488);
      expect(error.message).toBe("Instance message in options");
      expect(error.expose).toBe(false);
      expect(error.statusText).toBe("Default Status Text Here");
      expect(error.type).toBe("/errors/instance-type-override");
      expect(error.instance).toBe("/errors/all-defaults-instance/0");
      expect(error.extensions.id).toBe("instance-id-override");
      expect((error.extensions as AllExt).type).toBe("default-ext-type");
      expect(error.extensions.newProp).toBe("instanceValue");
      expect(error.headers.get("X-Instance")).toBe("live");
      expect(error.headers.has("X-Default")).toBe(false);
      expect(error.cause).toBe(instanceCause);
      expect(error.exposedMessage).toBe("Instance exposed message");
    });

    it("lets an instance override the default instance", () => {
      const error = new AllDefaultsError({ instance: "/instances/9" });
      expect(error.instance).toBe("/instances/9");
    });

    describe("statusText overrides", () => {
      it("uses statusText from the options", () => {
        const error = new AllDefaultsError({
          statusText: "Overridden Status Text Via Options",
        });
        expect(error.statusText).toBe("Overridden Status Text Via Options");
        expect(error.status).toBe(488);
        expect(error.name).toBe("AllDefaultsErrorName");
      });

      it("uses statusText from the options when a status argument is present", () => {
        const error = new AllDefaultsError(490, {
          statusText: "Custom StatusText with Status Arg",
        });
        expect(error.status).toBe(490);
        expect(error.statusText).toBe("Custom StatusText with Status Arg");
      });

      it("uses statusText from the options when a message argument is present", () => {
        const error = new AllDefaultsError("A message", {
          statusText: "Custom StatusText with Message Arg",
        });
        expect(error.message).toBe("A message");
        expect(error.statusText).toBe("Custom StatusText with Message Arg");
        expect(error.status).toBe(488);
      });

      it("uses statusText from the options when status and message arguments are present", () => {
        const error = new AllDefaultsError(491, "A full message", {
          statusText: "Custom StatusText with Full Args",
        });
        expect(error.status).toBe(491);
        expect(error.message).toBe("A full message");
        expect(error.statusText).toBe("Custom StatusText with Full Args");
      });

      it("keeps the class default statusText when the options have none", () => {
        const error = new AllDefaultsError({
          message: "Message without status text override",
        });
        expect(error.statusText).toBe("Default Status Text Here");
        expect(new AllDefaultsError().statusText).toBe(
          "Default Status Text Here",
        );
      });
    });
  });

  it("creates instances that behave like HttpError for toJSON and getResponse", async () => {
    interface RespExt {
      code: number;
      field?: string;
      defaultInfo?: string;
    }
    const RespError = createHttpErrorClass<RespExt>({
      name: "RespTestError",
      status: 422,
      extensions: { code: 100, defaultInfo: "from_default" },
      expose: true,
    });

    const error = new RespError("Validation failed", {
      extensions: { code: 101, field: "email" },
      type: "/errors/validation",
      instance: "/user/123/email",
    });

    const json = error.toJSON();
    expect(json).toEqual({
      status: 422,
      title: "RespTestError",
      detail: "Validation failed",
      type: "/errors/validation",
      instance: "/user/123/email",
      code: 101,
      field: "email",
      defaultInfo: "from_default",
    });

    const response = error.getResponse();
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(await response.json()).toEqual(json);

    const NonExposedError = createHttpErrorClass({
      name: "SecretError",
      status: 500,
      expose: false,
    });
    const secretError = new NonExposedError("This is a secret detail", {
      extensions: { secretCode: "xyz" },
    });
    const secretJson = secretError.toJSON();
    expect(secretJson).toEqual({
      status: 500,
      title: "SecretError",
      detail: "The server encountered an unexpected condition.",
      secretCode: "xyz",
    });
    expect(await secretError.getResponse().json()).toEqual(secretJson);
  });

  it("produces classes that can be extended", () => {
    const BaseError = createHttpErrorClass({ status: 409, name: "BaseError" });
    class ConflictError extends BaseError {}
    const error = new ConflictError("clash");
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(409);
    expect(error.toString()).toBe("BaseError: clash");
  });
});

describe("isHttpErrorLike", () => {
  it("is true for HttpError instances", () => {
    expect(isHttpErrorLike(new HttpError(400, "Bad Request"))).toBe(true);
  });

  it("is true for an Error with a numeric status", () => {
    const error = new Error("Bad Request");
    expect(isHttpErrorLike(error)).toBe(false);
    Object.assign(error, { status: 400 });
    expect(isHttpErrorLike(error)).toBe(true);
  });

  it("is true for an Error subclass with a numeric status", () => {
    class CustomHttpError extends Error {
      status = 400;
    }
    expect(isHttpErrorLike(new CustomHttpError("bad request"))).toBe(true);
  });

  it("is false for an Error without a numeric status", () => {
    expect(isHttpErrorLike(new Error("Bad Request"))).toBe(false);
    expect(
      isHttpErrorLike(Object.assign(new Error("x"), { status: "400" })),
    ).toBe(false);
  });

  it.each([
    ["a plain object with a status", { status: 400, message: "Bad Request" }],
    ["null", null],
    ["undefined", undefined],
    ["a string", "error"],
    ["a number", 400],
  ])("is false for %s", (_label, value) => {
    expect(isHttpErrorLike(value)).toBe(false);
  });
});

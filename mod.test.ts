import { STATUS_TEXT, type StatusCode } from "@std/http/status";
import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
  createHttpErrorClass,
  HttpError,
  type HttpErrorOptions,
} from "./mod.ts";

const httpErrorTests = describe("HttpError");

it(httpErrorTests, "without args", () => {
  const error = new HttpError();
  assertEquals(error.toString(), "Internal Server Error");
  assertEquals(error.name, "Internal Server Error");
  assertEquals(error.message, "");
  assertEquals(error.status, 500);
  assertEquals(error.expose, false);
  assertEquals(error.cause, undefined);
  assertEquals(
    error.exposedMessage,
    "The server encountered an unexpected condition.",
  );
});

it(httpErrorTests, "with status", () => {
  function assertWithStatus(error: HttpError): void {
    assertEquals(error.status, 400);
    assertEquals(error.expose, true);
  }
  assertWithStatus(new HttpError(400));
  assertWithStatus(new HttpError({ status: 400 }));
  assertWithStatus(new HttpError(undefined, { status: 400 }));
});

it(httpErrorTests, "with message", () => {
  function assertWithMessage(error: HttpError): void {
    assertEquals(
      error.toString(),
      "Internal Server Error: something went wrong",
    );
    assertEquals(error.message, "something went wrong");
    // expose is false for 500 errors, so exposedMessage uses default
    assertEquals(
      error.exposedMessage,
      "The server encountered an unexpected condition.",
    );
  }
  assertWithMessage(new HttpError("something went wrong"));
  assertWithMessage(new HttpError({ message: "something went wrong" }));
  assertWithMessage(new HttpError(undefined, "something went wrong"));
  assertWithMessage(
    new HttpError(undefined, { message: "something went wrong" }),
  );
});

it(
  httpErrorTests,
  "prefer status/message args over status/messagee options",
  () => {
    const names = ["Bad Request", "Bad Gateway"];
    const messages = ["something went wrong", "failed"];
    const statuses = [400, 502];
    const options = { message: messages[1], status: statuses[1] };

    function assertPreferArgs(
      error: HttpError,
      expectedStatus: number,
      expectedMessage: string,
    ): void {
      const expectedName = names[expectedStatus === statuses[0] ? 0 : 1];
      assertEquals(error.toString(), `${expectedName}: ${expectedMessage}`);
      assertEquals(error.name, expectedName);
      assertEquals(error.message, expectedMessage);
      assertEquals(error.status, expectedStatus);
      assertEquals(error.expose, expectedStatus < 500);
    }
    assertPreferArgs(
      new HttpError(statuses[0], messages[0], options),
      statuses[0],
      messages[0],
    );
    assertPreferArgs(
      new HttpError(statuses[0], options),
      statuses[0],
      messages[1],
    );
    assertPreferArgs(
      new HttpError(messages[0], options),
      statuses[1],
      messages[0],
    );
    assertPreferArgs(new HttpError(options), statuses[1], messages[1]);
  },
);

it(httpErrorTests, "with cause", () => {
  const cause = new Error("fail");
  function assertWithCause(error: HttpError): void {
    assertEquals(error.cause, cause);
  }
  assertWithCause(new HttpError({ cause }));
  assertWithCause(new HttpError(undefined, { cause }));
  assertWithCause(new HttpError(undefined, undefined, { cause }));
});

it(httpErrorTests, "invalid status", () => {
  assertThrows(
    () => new HttpError(-500),
    RangeError,
    "invalid error status",
  );
  assertThrows(() => new HttpError(0), RangeError, "invalid error status");
  assertThrows(
    () => new HttpError(399),
    RangeError,
    "invalid error status",
  );
  assertThrows(
    () => new HttpError(600),
    RangeError,
    "invalid error status",
  );
});

function expectedDefaultErrorName(status: number): string {
  if (STATUS_TEXT[status as StatusCode]) {
    return STATUS_TEXT[status as StatusCode];
  }
  return status < 500 ? "Unknown Client Error" : "Unknown Server Error";
}

function assertName(
  error: HttpError,
  expectedStatus: number,
  expectedMessage: string,
  expectedName?: string,
): void {
  if (!expectedName) expectedName = expectedDefaultErrorName(expectedStatus);
  assertEquals(
    [
      error.status,
      error.name,
      error.message,
      error.toString(),
    ],
    [
      expectedStatus,
      expectedName,
      expectedMessage,
      `${expectedName}: ${expectedMessage}`,
    ],
  );
}

it(httpErrorTests, "default name", () => {
  const message = "something went wrong";
  for (let status = 400; status < 600; status++) {
    assertName(new HttpError(status, message), status, message);
  }
});

it(httpErrorTests, "override name", () => {
  const message = "something went wrong";
  for (let status = 400; status < 600; status++) {
    assertName(
      new HttpError(status, message, { name: "CustomError" }),
      status,
      message,
      "CustomError",
    );
  }
});

function assertExpose(
  error: HttpError,
  expectedStatus: number,
  expectedExpose?: boolean,
): void {
  assertEquals(
    [
      error.status,
      error.expose,
    ],
    [
      expectedStatus,
      expectedExpose ?? (expectedStatus < 500),
    ],
  );
}

it(httpErrorTests, "default expose", () => {
  for (let status = 400; status < 600; status++) {
    assertExpose(new HttpError(status), status);
  }
});

it(httpErrorTests, "override expose", () => {
  for (let status = 400; status < 600; status++) {
    const expose = status >= 500;
    assertExpose(new HttpError(status, { expose }), status, expose);
  }
});

const withAllOptionsTests = describe(httpErrorTests, "with all options");

it(
  withAllOptionsTests,
  "constructor with status, message, options signature",
  () => {
    const cause = new Error("fail");
    const extensionsData = { key: "value" };
    const customHeaders = new Headers({ "X-Custom-Header": "TestValue" });
    customHeaders.set("content-type", "application/custom+json");

    function assertAllOptions(error: HttpError<typeof extensionsData>) {
      assertEquals(error.name, "CustomErrorName");
      assertEquals(error.message, "A very specific error occurred.");
      assertEquals(error.status, 418);
      assertEquals(error.statusText, "I'm a teapot");
      assertEquals(error.expose, false);
      assertEquals(error.cause, cause);
      assertEquals(error.type, "/errors/custom-operation-failed");
      assertEquals(
        error.instance,
        "/errors/custom-operation-failed/instance/123xyz",
      );
      assertEquals(error.extensions, extensionsData);
      assertEquals(error.headers.get("X-Custom-Header"), "TestValue");
      assertEquals(
        error.headers.get("content-type"),
        "application/custom+json",
      );
      assertEquals(
        error.toString(),
        "CustomErrorName: A very specific error occurred.",
      );
    }

    const allOpts: HttpErrorOptions<typeof extensionsData> = {
      name: "CustomErrorName",
      message: "A very specific error occurred.",
      status: 418,
      statusText: "I'm a teapot",
      expose: false,
      cause,
      type: "/errors/custom-operation-failed",
      instance: "/errors/custom-operation-failed/instance/123xyz",
      extensions: extensionsData,
      headers: customHeaders,
    };

    assertAllOptions(
      new HttpError<typeof extensionsData>(
        418,
        "A very specific error occurred.",
        allOpts,
      ),
    );
  },
);

it(withAllOptionsTests, "constructor with status, options signature", () => {
  const cause = new Error("fail");
  const extensionsData = { key: "value" };
  const customHeaders = new Headers({ "X-Custom-Header": "TestValue" });
  customHeaders.set("content-type", "application/custom+json");

  function assertAllOptions(error: HttpError<typeof extensionsData>) {
    assertEquals(error.name, "CustomErrorName");
    assertEquals(error.message, "A very specific error occurred.");
    assertEquals(error.status, 418);
    assertEquals(error.statusText, "I'm a teapot");
    assertEquals(error.expose, false);
    assertEquals(error.cause, cause);
    assertEquals(error.type, "/errors/custom-operation-failed");
    assertEquals(
      error.instance,
      "/errors/custom-operation-failed/instance/123xyz",
    );
    assertEquals(error.extensions, extensionsData);
    assertEquals(error.headers.get("X-Custom-Header"), "TestValue");
    assertEquals(error.headers.get("content-type"), "application/custom+json");
    assertEquals(
      error.toString(),
      "CustomErrorName: A very specific error occurred.",
    );
  }

  const allOpts: HttpErrorOptions<typeof extensionsData> = {
    name: "CustomErrorName",
    message: "A very specific error occurred.",
    status: 418,
    statusText: "I'm a teapot",
    expose: false,
    cause,
    type: "/errors/custom-operation-failed",
    instance: "/errors/custom-operation-failed/instance/123xyz",
    extensions: extensionsData,
    headers: customHeaders,
  };
  assertAllOptions(new HttpError<typeof extensionsData>(418, allOpts));
});

it(withAllOptionsTests, "constructor with message, options signature", () => {
  const cause = new Error("fail");
  const extensionsData = { key: "value" };
  const customHeaders = new Headers({ "X-Custom-Header": "TestValue" });
  customHeaders.set("content-type", "application/custom+json");

  function assertAllOptions(error: HttpError<typeof extensionsData>) {
    assertEquals(error.name, "CustomErrorName");
    assertEquals(error.message, "A very specific error occurred.");
    assertEquals(error.status, 418);
    assertEquals(error.statusText, "I'm a teapot");
    assertEquals(error.expose, false);
    assertEquals(error.cause, cause);
    assertEquals(error.type, "/errors/custom-operation-failed");
    assertEquals(
      error.instance,
      "/errors/custom-operation-failed/instance/123xyz",
    );
    assertEquals(error.extensions, extensionsData);
    assertEquals(error.headers.get("X-Custom-Header"), "TestValue");
    assertEquals(error.headers.get("content-type"), "application/custom+json");
    assertEquals(
      error.toString(),
      "CustomErrorName: A very specific error occurred.",
    );
  }
  const allOpts: HttpErrorOptions<typeof extensionsData> = {
    name: "CustomErrorName",
    message: "A very specific error occurred.",
    status: 418,
    statusText: "I'm a teapot",
    expose: false,
    cause,
    type: "/errors/custom-operation-failed",
    instance: "/errors/custom-operation-failed/instance/123xyz",
    extensions: extensionsData,
    headers: customHeaders,
  };

  const optsForMessageFirst = { ...allOpts };
  delete optsForMessageFirst.message;
  assertAllOptions(
    new HttpError<typeof extensionsData>("A very specific error occurred.", {
      ...optsForMessageFirst,
      status: 418,
    }),
  );
});

it(withAllOptionsTests, "constructor with options signature", () => {
  const cause = new Error("fail");
  const extensionsData = { key: "value" };
  const customHeaders = new Headers({ "X-Custom-Header": "TestValue" });
  customHeaders.set("content-type", "application/custom+json");

  function assertAllOptions(error: HttpError<typeof extensionsData>) {
    assertEquals(error.name, "CustomErrorName");
    assertEquals(error.message, "A very specific error occurred.");
    assertEquals(error.status, 418);
    assertEquals(error.statusText, "I'm a teapot");
    assertEquals(error.expose, false);
    assertEquals(error.cause, cause);
    assertEquals(error.type, "/errors/custom-operation-failed");
    assertEquals(
      error.instance,
      "/errors/custom-operation-failed/instance/123xyz",
    );
    assertEquals(error.extensions, extensionsData);
    assertEquals(error.headers.get("X-Custom-Header"), "TestValue");
    assertEquals(error.headers.get("content-type"), "application/custom+json");
    assertEquals(
      error.toString(),
      "CustomErrorName: A very specific error occurred.",
    );
  }
  const allOpts: HttpErrorOptions<typeof extensionsData> = {
    name: "CustomErrorName",
    message: "A very specific error occurred.",
    status: 418,
    statusText: "I'm a teapot",
    expose: false,
    cause,
    type: "/errors/custom-operation-failed",
    instance: "/errors/custom-operation-failed/instance/123xyz",
    extensions: extensionsData,
    headers: customHeaders,
  };
  assertAllOptions(new HttpError<typeof extensionsData>(allOpts));
});

it(httpErrorTests, "with headers as object literal", () => {
  const error = new HttpError({
    headers: {
      "X-Custom-Test": "Value",
      "X-Another-Header": "AnotherValue",
    },
  });
  assertEquals(error.headers.get("X-Custom-Test"), "Value");
  assertEquals(error.headers.get("X-Another-Header"), "AnotherValue");
  assertEquals(
    error.headers.get("content-type"),
    "application/problem+json",
  );

  const errorWithContentType = new HttpError({
    headers: {
      "X-Custom-Test": "Value",
      "content-type": "application/custom+json",
    },
  });
  assertEquals(errorWithContentType.headers.get("X-Custom-Test"), "Value");
  assertEquals(
    errorWithContentType.headers.get("content-type"),
    "application/custom+json",
  );
});

it(httpErrorTests, "with other data", () => {
  const cause = new Error("fail");
  const data = { x: 2, y: 3 };
  function assertAllOptions(error: HttpError<typeof data>) {
    assertEquals(error.toString(), "CustomError: something went wrong");
    assertEquals(error.name, "CustomError");
    assertEquals(error.message, "something went wrong");
    assertEquals(error.status, 400);
    assertEquals(error.expose, false);
    assertEquals(error.cause, cause);
    assertEquals(error.extensions, data);
  }
  assertAllOptions(
    new HttpError<typeof data>(400, "something went wrong", {
      name: "CustomError",
      expose: false,
      cause,
      extensions: data,
    }),
  );
  assertAllOptions(
    new HttpError<typeof data>(400, {
      name: "CustomError",
      message: "something went wrong",
      expose: false,
      cause,
      extensions: data,
    }),
  );
  assertAllOptions(
    new HttpError<typeof data>("something went wrong", {
      name: "CustomError",
      status: 400,
      expose: false,
      cause,
      extensions: data,
    }),
  );
  assertAllOptions(
    new HttpError<typeof data>({
      name: "CustomError",
      message: "something went wrong",
      status: 400,
      expose: false,
      cause,
      extensions: data,
    }),
  );
});

const jsonTests = describe(httpErrorTests, "json");

it(jsonTests, "HttpError.from(Error).toJSON()", () => {
  const cause = new Error("fail");
  const errorFromCause = HttpError.from(cause);
  assertEquals(
    errorFromCause.toJSON(),
    {
      title: "Internal Server Error",
      status: 500,
      detail: "The server encountered an unexpected condition.",
    },
  );
});

it(jsonTests, "Exposed client error with extensions toJSON()", () => {
  const cause = new Error("fail");
  const data = { x: 2, y: 3 };
  const clientErrorWithOptions = new HttpError<typeof data>(
    400,
    "something went wrong",
    {
      name: "CustomError",
      cause,
      extensions: data,
    },
  );
  assertEquals(
    clientErrorWithOptions.toJSON(),
    {
      ...data,
      title: "CustomError",
      detail: "something went wrong",
      status: 400,
    },
  );
});

it(jsonTests, "Non-exposed server error with extensions toJSON()", () => {
  const cause = new Error("fail");
  const data = { x: 2, y: 3 };
  const serverErrorWithOptions = new HttpError<typeof data>(
    500,
    "something went wrong",
    {
      name: "CustomError",
      cause,
      extensions: data,
    },
  );
  assertEquals(
    serverErrorWithOptions.toJSON(),
    {
      ...data,
      title: "CustomError",
      status: 500,
      detail: "The server encountered an unexpected condition.",
    },
  );
});

it(
  jsonTests,
  "Client error, explicitly not exposed, with extensions toJSON()",
  () => {
    const cause = new Error("fail");
    const data = { x: 2, y: 3 };
    const clientErrorNotExposed = new HttpError<typeof data>(
      400,
      "something went wrong",
      {
        name: "CustomError",
        expose: false,
        cause,
        extensions: data,
      },
    );
    assertEquals(
      clientErrorNotExposed.toJSON(),
      {
        ...data,
        title: "CustomError",
        status: 400,
        detail: "The server cannot process the request due to a client error.",
      },
    );
  },
);

it(jsonTests, "exposedMessage with expose=true uses message", () => {
  const error = new HttpError(400, "Invalid email format");
  assertEquals(error.message, "Invalid email format");
  assertEquals(error.exposedMessage, "Invalid email format");
  assertEquals(error.toJSON().detail, "Invalid email format");
});

it(jsonTests, "exposedMessage with expose=false uses default", () => {
  const error = new HttpError(500, "SQL syntax error near 'DROP TABLE'");
  assertEquals(
    error.exposedMessage,
    "The server encountered an unexpected condition.",
  );
  assertEquals(
    error.toJSON().detail,
    "The server encountered an unexpected condition.",
  );
});

it(jsonTests, "explicit exposedMessage takes priority", () => {
  // Even with expose=true, explicit exposedMessage is used
  const error1 = new HttpError(400, "Internal validation details", {
    exposedMessage: "Please check your input.",
  });
  assertEquals(error1.exposedMessage, "Please check your input.");
  assertEquals(error1.toJSON().detail, "Please check your input.");

  // With expose=false, explicit exposedMessage is also used
  const error2 = new HttpError(500, "Database connection refused", {
    exposedMessage: "Service temporarily unavailable.",
  });
  assertEquals(error2.exposedMessage, "Service temporarily unavailable.");
  assertEquals(error2.toJSON().detail, "Service temporarily unavailable.");
});

const getResponseTests = describe(httpErrorTests, "getResponse");

it(
  getResponseTests,
  "Client error, exposed, with extensions and custom type/instance",
  async () => {
    const error1Extensions = { extra: "data1" };
    const error1 = new HttpError<typeof error1Extensions>(400, "Client Issue", {
      name: "MyClientError",
      extensions: error1Extensions,
      type: "/err/client",
      instance: "/err/client/1",
    });
    const response1 = error1.getResponse();
    assertEquals(response1.status, 400);
    assertEquals(
      response1.headers.get("content-type"),
      "application/problem+json",
    );
    const body1 = await response1.json();
    assertEquals(body1, {
      ...error1Extensions,
      status: 400,
      title: "MyClientError",
      detail: "Client Issue",
      type: "/err/client",
      instance: "/err/client/1",
    });
  },
);

it(
  getResponseTests,
  "Server error, not exposed, with custom statusText and headers",
  async () => {
    const error2Extensions = { extra: "data2" };
    const customHeaders = new Headers({ "X-RateLimit-Limit": "100" });
    customHeaders.set("content-type", "application/vnd.api+json");

    const error2 = new HttpError<typeof error2Extensions>(503, "Server Down", {
      name: "CustomServerErr",
      statusText: "Service Really Unavailable",
      expose: false,
      extensions: error2Extensions,
      headers: customHeaders,
    });
    const response2 = error2.getResponse();
    assertEquals(response2.status, 503);
    if (response2.statusText === "Service Really Unavailable") {
      assertEquals(response2.statusText, "Service Really Unavailable");
    }
    assertEquals(
      response2.headers.get("content-type"),
      "application/vnd.api+json",
    );
    assertEquals(response2.headers.get("X-RateLimit-Limit"), "100");
    const body2 = await response2.json();
    assertEquals(body2, {
      ...error2Extensions,
      status: 503,
      title: "CustomServerErr",
      detail: "The server is currently unavailable.",
    });
  },
);

it(
  getResponseTests,
  "Default headers (content-type) - No extensions",
  async () => {
    const error3 = new HttpError(404, "Not Found");
    const response3 = error3.getResponse();
    assertEquals(
      response3.headers.get("content-type"),
      "application/problem+json",
    );
    const body3 = await response3.json();
    assertEquals(body3, {
      status: 404,
      title: "Not Found",
      detail: "Not Found",
    });
  },
);

const fromTests = describe(httpErrorTests, "from");

it(fromTests, "non HttpError", () => {
  const cause = new Error("fail");
  const error = HttpError.from(cause);
  assertEquals(error.toString(), "Internal Server Error: fail");
  assertEquals(error.name, "Internal Server Error");
  assertEquals(error.message, "fail");
  assertEquals(error.status, 500);
  assertEquals(error.expose, false);
  assertEquals(error.cause, cause);
  assertEquals(
    error.exposedMessage,
    "The server encountered an unexpected condition.",
  );
});

it(fromTests, "Error with status", () => {
  const originalError = new Error("fail");
  (originalError as HttpError).status = 400;
  const error = HttpError.from(originalError);
  assertEquals(error.toString(), "Error: fail");
  assertEquals(error.name, "Error");
  assertEquals(error.message, "fail");
  assertEquals(error.status, 400);
  assertEquals(error.expose, true);
  assertEquals(error.cause, undefined);
});

it(fromTests, "passthrough HttpError instances", () => {
  const cause = new Error("fail");
  const originalError = new HttpError({
    name: "CustomError",
    message: "something went wrong",
    cause,
    extensions: { x: 2, y: 3 },
  });
  const error = HttpError.from(originalError);
  assertStrictEquals(error, originalError);
});

it(fromTests, "with various unexpected input types", () => {
  const testInputs: unknown[] = [
    null,
    undefined,
    12345,
    true,
    Symbol("test-symbol"),
    { completely: "unrelated object" },
    () => {},
  ];

  for (const inputValue of testInputs) {
    const error = HttpError.from(inputValue);
    assert(
      error instanceof HttpError,
      `Expected HttpError for input: ${String(inputValue)}`,
    );
    assertEquals(error.status, 500, `Status for input: ${String(inputValue)}`);
    assertEquals(
      error.message,
      "unexpected error type",
      `Message for input: ${String(inputValue)}`,
    );
    assertStrictEquals(
      error.cause,
      inputValue,
      `Cause for input: ${String(inputValue)}`,
    );
  }
});

it(fromTests, "empty object", () => {
  const emptyObjError = HttpError.from({});
  assert(emptyObjError instanceof HttpError);
  assertEquals(emptyObjError.status, 500);
  assertEquals(emptyObjError.message, "unexpected error type");
  assertEquals(emptyObjError.cause, {});
});

const fromResponseTests = describe(fromTests, "Response");

it(fromResponseTests, "with ProblemDetails JSON", async () => {
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
  assertEquals(error.status, 403);
  assertEquals(error.name, "ForbiddenError");
  assertEquals(error.message, "Access denied");
  assertEquals(error.type, "/errors/forbidden");
  assertEquals(error.instance, "/errors/forbidden/123");
  assertEquals(error.extensions, { customField: "customValue" });
  assertEquals(error.expose, true);
});

it(
  fromResponseTests,
  "with status in JSON preferred over response status",
  async () => {
    const problemDetails = {
      status: 403,
      title: "ForbiddenError",
      detail: "Access denied",
    };
    const response = new Response(JSON.stringify(problemDetails), {
      status: 400,
      headers: { "Content-Type": "application/problem+json" },
    });
    const error = await HttpError.from(response);
    assertEquals(error.status, 403);
    assertEquals(error.name, "ForbiddenError");
    assertEquals(error.message, "Access denied");
  },
);

it(
  fromResponseTests,
  "without status in JSON uses response status",
  async () => {
    const problemDetails = {
      title: "BadRequest",
      detail: "Bad input",
    };
    const response = new Response(JSON.stringify(problemDetails), {
      status: 400,
      headers: { "Content-Type": "application/problem+json" },
    });
    const error = await HttpError.from(response);
    assertEquals(error.status, 400);
    assertEquals(error.name, "BadRequest");
    assertEquals(error.message, "Bad input");
  },
);

it(fromResponseTests, "with invalid JSON", async () => {
  const response = new Response("not json {{{{", { status: 500 });
  const error = await HttpError.from(response);
  assertEquals(error.status, 500);
  assertEquals(error.message, "could not parse problem details response");
  assert(error.cause instanceof SyntaxError);
  assertEquals(
    error.cause.message,
    `Unexpected token 'o', "not json {{{{" is not valid JSON`,
  );
});

it(
  fromResponseTests,
  "with valid JSON that is not ProblemDetails",
  async () => {
    const nonProblemDetailsPayload = { data: "some other structure" };
    const response = new Response(JSON.stringify(nonProblemDetailsPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const error = await HttpError.from(response);
    assertEquals(error.status, 500);
    assertEquals(error.message, "invalid problem details response");
    assert(error.cause, "Cause should be defined");
    assertEquals(error.cause, nonProblemDetailsPayload);
  },
);

it(fromTests, "from ProblemDetails object", () => {
  const problemDetails = {
    status: 404,
    title: "ResourceNotFound",
    detail: "The requested resource was not found.",
    type: "/errors/not-found",
    instance: "/items/123",
    anotherKey: "anotherValue",
  };
  type MyExt = { anotherKey: string };
  const error = HttpError.from<MyExt>(problemDetails);
  assertEquals(error.status, 404);
  assertEquals(error.name, "ResourceNotFound");
  assertEquals(error.message, "The requested resource was not found.");
  assertEquals(error.type, "/errors/not-found");
  assertEquals(error.instance, "/items/123");
  assertEquals(error.extensions, { anotherKey: "anotherValue" });
  assertEquals(error.expose, true);
});

const createHttpErrorClassTests = describe("createHttpErrorClass");

it(
  createHttpErrorClassTests,
  "creates a basic custom error class without default options",
  () => {
    const BasicError = createHttpErrorClass();
    const error = new BasicError(400, "test message");
    assert(error instanceof HttpError, "Should be instance of HttpError");
    assert(error instanceof BasicError, "Should be instance of BasicError");
    assertEquals(error.status, 400);
    assertEquals(error.message, "test message");
    assertEquals(error.name, "Bad Request");

    const error2 = new BasicError();
    assertEquals(error2.status, 500);
    assertEquals(error2.message, "");
    assertEquals(error2.name, "Internal Server Error");
  },
);

it(
  createHttpErrorClassTests,
  "creates a custom error class with default name and status",
  () => {
    const DefaultNameStatusError = createHttpErrorClass({
      name: "MyTestError",
      status: 499,
    });

    const error1 = new DefaultNameStatusError("A message");
    assertEquals(error1.status, 499);
    assertEquals(error1.name, "MyTestError");
    assertEquals(error1.message, "A message");

    const error2 = new DefaultNameStatusError(498, "Override status");
    assertEquals(error2.status, 498);
    assertEquals(error2.name, "MyTestError");
    assertEquals(error2.message, "Override status");

    const error3 = new DefaultNameStatusError({
      message: "Via options",
      name: "OverriddenName",
    });
    assertEquals(error3.status, 499);
    assertEquals(error3.name, "OverriddenName");
    assertEquals(error3.message, "Via options");

    const error4 = new DefaultNameStatusError({ status: 497 });
    assertEquals(error4.status, 497);
    assertEquals(error4.name, "MyTestError");
    assertEquals(error4.message, "");
  },
);

it(
  createHttpErrorClassTests,
  "creates a custom error class with default extensions",
  () => {
    interface MyExt {
      defaultKey: string;
      anotherKey?: number;
      yetAnotherKey?: string;
    }
    const ExtError = createHttpErrorClass<MyExt>({
      extensions: { defaultKey: "defaultValue", yetAnotherKey: "stillHere" },
    });

    const error1 = new ExtError("msg");
    assertEquals(error1.extensions.defaultKey, "defaultValue");
    assertEquals(error1.extensions.yetAnotherKey, "stillHere");
    assertEquals(error1.extensions.anotherKey, undefined);

    const error2 = new ExtError("msg", {
      extensions: { defaultKey: "override", anotherKey: 123 },
    });
    assertEquals(error2.extensions.defaultKey, "override");
    assertEquals(error2.extensions.anotherKey, 123);
    assertEquals((error2.extensions as MyExt).yetAnotherKey, "stillHere");

    const error3 = new ExtError({
      extensions: {
        anotherKey: 456,
        defaultKey: "defaultValue",
        yetAnotherKey: "stillHere",
      },
    });
    assertEquals(error3.extensions.defaultKey, "defaultValue");
    assertEquals(error3.extensions.anotherKey, 456);
    assertEquals(error3.extensions.yetAnotherKey, "stillHere");
    assertEquals(error3.message, "");
    assertEquals(error3.status, 500);

    const ErrorWithDefaultStatus = createHttpErrorClass<MyExt>({
      status: 420,
      extensions: { defaultKey: "val" },
    });
    const error4 = new ErrorWithDefaultStatus();
    assertEquals(error4.status, 420);
    assertEquals((error4.extensions as MyExt).defaultKey, "val");
  },
);

const allDefaultsAndOverridesTests = describe(
  createHttpErrorClassTests,
  "custom error class with all possible default options and allows overrides",
);

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
});

it(
  allDefaultsAndOverridesTests,
  "instantiates with no overrides, checking all defaults",
  () => {
    const error1 = new AllDefaultsError();
    assertEquals(error1.name, "AllDefaultsErrorName");
    assertEquals(error1.status, 488);
    assertEquals(error1.message, "Default message for error");
    assertEquals(error1.expose, true);
    assertEquals(error1.statusText, "Default Status Text Here");
    assertEquals(error1.type, "/errors/all-defaults-type");
    assertEquals(error1.instance, "/errors/all-defaults-instance/0");
    assertEquals(error1.extensions.id, "default-id");
    assertEquals(error1.extensions.type, "default-ext-type");
    assertEquals(error1.headers.get("X-Default"), "true");
    assertEquals(error1.cause, defaultCause);
  },
);

it(
  allDefaultsAndOverridesTests,
  "instantiates with status and message args overriding defaults",
  () => {
    const error2all = new AllDefaultsError(489, "New message from args");
    assertEquals(error2all.status, 489);
    assertEquals(error2all.message, "New message from args");
    assertEquals(error2all.name, "AllDefaultsErrorName");
    assertEquals((error2all.extensions as AllExt).id, "default-id");
  },
);

it(
  allDefaultsAndOverridesTests,
  "instantiates with options object overriding some defaults",
  () => {
    const instanceHeaders = new Headers({ "X-Instance": "live" });
    const instanceCause = new Error("Instance cause here");
    const error3all = new AllDefaultsError({
      name: "InstanceNameOverride",
      message: "Instance message in options",
      expose: false,
      extensions: { id: "instance-id-override", newProp: "instanceValue" },
      headers: instanceHeaders,
      cause: instanceCause,
      type: "/errors/instance-type-override",
    });
    assertEquals(error3all.name, "InstanceNameOverride");
    assertEquals(error3all.status, 488);
    assertEquals(error3all.message, "Instance message in options");
    assertEquals(error3all.expose, false);
    assertEquals(error3all.statusText, "Default Status Text Here");
    assertEquals(error3all.type, "/errors/instance-type-override");
    assertEquals(error3all.instance, "/errors/all-defaults-instance/0");
    assertEquals(error3all.extensions.id, "instance-id-override");
    assertEquals((error3all.extensions as AllExt).type, "default-ext-type");
    assertEquals(error3all.extensions.newProp, "instanceValue");
    assertEquals(error3all.headers.get("X-Instance"), "live");
    assertEquals(error3all.headers.has("X-Default"), false);
    assertEquals(error3all.cause, instanceCause);
  },
);

const statusTextOverridesTests = describe(
  allDefaultsAndOverridesTests,
  "statusText specific overrides",
);

it(
  statusTextOverridesTests,
  "prioritizes statusText in constructor options",
  () => {
    const errorWithStatusTextInOptions = new AllDefaultsError({
      statusText: "Overridden Status Text Via Options",
    });
    assertEquals(
      errorWithStatusTextInOptions.statusText,
      "Overridden Status Text Via Options",
    );
    assertEquals(errorWithStatusTextInOptions.status, 488);
    assertEquals(errorWithStatusTextInOptions.name, "AllDefaultsErrorName");
  },
);

it(
  statusTextOverridesTests,
  "prioritizes statusText in options when status arg is present",
  () => {
    const errorWithStatusTextAndStatusArg = new AllDefaultsError(490, {
      statusText: "Custom StatusText with Status Arg",
    });
    assertEquals(errorWithStatusTextAndStatusArg.status, 490);
    assertEquals(
      errorWithStatusTextAndStatusArg.statusText,
      "Custom StatusText with Status Arg",
    );
  },
);

it(
  statusTextOverridesTests,
  "prioritizes statusText in options when message arg is present",
  () => {
    const errorWithStatusTextAndMessageArg = new AllDefaultsError("A message", {
      statusText: "Custom StatusText with Message Arg",
    });
    assertEquals(errorWithStatusTextAndMessageArg.message, "A message");
    assertEquals(
      errorWithStatusTextAndMessageArg.statusText,
      "Custom StatusText with Message Arg",
    );
    assertEquals(errorWithStatusTextAndMessageArg.status, 488);
  },
);

it(
  statusTextOverridesTests,
  "prioritizes statusText in options when status and message args are present",
  () => {
    const errorWithStatusTextAndFullArgs = new AllDefaultsError(
      491,
      "A full message",
      { statusText: "Custom StatusText with Full Args" },
    );
    assertEquals(errorWithStatusTextAndFullArgs.status, 491);
    assertEquals(errorWithStatusTextAndFullArgs.message, "A full message");
    assertEquals(
      errorWithStatusTextAndFullArgs.statusText,
      "Custom StatusText with Full Args",
    );
  },
);

it(
  statusTextOverridesTests,
  "uses class default statusText if not in constructor options",
  () => {
    const errorUsingDefaultStatusText = new AllDefaultsError({
      message: "Message without status text override",
    });
    assertEquals(
      errorUsingDefaultStatusText.statusText,
      "Default Status Text Here",
    );
    const error1 = new AllDefaultsError();
    assertEquals(error1.statusText, "Default Status Text Here");
  },
);

it(
  createHttpErrorClassTests,
  "custom error class instances behave like HttpError (toJSON, getResponse)",
  async () => {
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
    assertEquals(json, {
      status: 422,
      title: "RespTestError",
      detail: "Validation failed",
      type: "/errors/validation",
      instance: "/user/123/email",
      ...error.extensions,
    });

    const response = error.getResponse();
    assertEquals(response.status, 422);
    assertEquals(
      response.headers.get("content-type"),
      "application/problem+json",
    );
    const body = await response.json();
    assertEquals(body, json);

    const NonExposedError = createHttpErrorClass({
      name: "SecretError",
      status: 500,
      expose: false,
    });
    const secretError = new NonExposedError("This is a secret detail", {
      extensions: { secretCode: "xyz" },
    });
    const secretJson = secretError.toJSON();
    assertEquals(secretJson, {
      status: 500,
      title: "SecretError",
      detail: "The server encountered an unexpected condition.",
      ...secretError.extensions,
    });

    const secretResponse = secretError.getResponse();
    const secretBody = await secretResponse.json();
    assertEquals(secretBody, secretJson);
  },
);

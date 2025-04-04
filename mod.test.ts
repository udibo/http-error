import { STATUS_CODE, type StatusCode } from "@std/http/status";
import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
  ErrorResponse,
  HttpError,
  type HttpErrorOptions,
  isErrorResponse,
  isHttpError,
  optionsFromArgs,
} from "./mod.ts";

const httpErrorTests = describe("HttpError");

it(httpErrorTests, "without args", () => {
  const error = new HttpError();
  assertEquals(error.toString(), "InternalServerError");
  assertEquals(error.name, "InternalServerError");
  assertEquals(error.message, "");
  assertEquals(error.status, 500);
  assertEquals(error.expose, false);
  assertEquals(error.cause, undefined);
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
    assertEquals(error.toString(), "InternalServerError: something went wrong");
    assertEquals(error.message, "something went wrong");
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
    const names = ["BadRequestError", "BadGatewayError"];
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

const DEFAULT_ERROR_NAMES = new Map<StatusCode, string>(([
  [STATUS_CODE.BadRequest, "BadRequest"],
  [STATUS_CODE.Unauthorized, "Unauthorized"],
  [STATUS_CODE.PaymentRequired, "PaymentRequired"],
  [STATUS_CODE.Forbidden, "Forbidden"],
  [STATUS_CODE.NotFound, "NotFound"],
  [STATUS_CODE.MethodNotAllowed, "MethodNotAllowed"],
  [STATUS_CODE.NotAcceptable, "NotAcceptable"],
  [STATUS_CODE.ProxyAuthRequired, "ProxyAuthRequired"],
  [STATUS_CODE.RequestTimeout, "RequestTimeout"],
  [STATUS_CODE.Conflict, "Conflict"],
  [STATUS_CODE.Gone, "Gone"],
  [STATUS_CODE.LengthRequired, "LengthRequired"],
  [STATUS_CODE.PreconditionFailed, "PreconditionFailed"],
  [STATUS_CODE.ContentTooLarge, "ContentTooLarge"],
  [STATUS_CODE.URITooLong, "URITooLong"],
  [STATUS_CODE.UnsupportedMediaType, "UnsupportedMediaType"],
  [STATUS_CODE.RangeNotSatisfiable, "RangeNotSatisfiable"],
  [STATUS_CODE.ExpectationFailed, "ExpectationFailed"],
  [STATUS_CODE.Teapot, "Teapot"],
  [STATUS_CODE.MisdirectedRequest, "MisdirectedRequest"],
  [STATUS_CODE.UnprocessableEntity, "UnprocessableEntity"],
  [STATUS_CODE.Locked, "Locked"],
  [STATUS_CODE.FailedDependency, "FailedDependency"],
  [STATUS_CODE.TooEarly, "TooEarly"],
  [STATUS_CODE.UpgradeRequired, "UpgradeRequired"],
  [STATUS_CODE.PreconditionRequired, "PreconditionRequired"],
  [STATUS_CODE.TooManyRequests, "TooManyRequests"],
  [STATUS_CODE.RequestHeaderFieldsTooLarge, "RequestHeaderFieldsTooLarge"],
  [STATUS_CODE.UnavailableForLegalReasons, "UnavailableForLegalReasons"],
  [STATUS_CODE.InternalServerError, "InternalServer"],
  [STATUS_CODE.NotImplemented, "NotImplemented"],
  [STATUS_CODE.BadGateway, "BadGateway"],
  [STATUS_CODE.ServiceUnavailable, "ServiceUnavailable"],
  [STATUS_CODE.GatewayTimeout, "GatewayTimeout"],
  [STATUS_CODE.HTTPVersionNotSupported, "HTTPVersionNotSupported"],
  [STATUS_CODE.VariantAlsoNegotiates, "VariantAlsoNegotiates"],
  [STATUS_CODE.InsufficientStorage, "InsufficientStorage"],
  [STATUS_CODE.LoopDetected, "LoopDetected"],
  [STATUS_CODE.NotExtended, "NotExtended"],
  [STATUS_CODE.NetworkAuthenticationRequired, "NetworkAuthenticationRequired"],
] as [StatusCode, string][]).map(([status, name]) => [status, `${name}Error`]));

function expectedDefaultErrorName(status: number): string {
  return DEFAULT_ERROR_NAMES.has(status as StatusCode)
    ? DEFAULT_ERROR_NAMES.get(status as StatusCode)!
    : `Unknown${status < 500 ? "Client" : "Server"}Error`;
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

it(httpErrorTests, "with all options", () => {
  const cause = new Error("fail");
  function assertAllOptions(error: HttpError) {
    assertEquals(error.toString(), "CustomError: something went wrong");
    assertEquals(error.name, "CustomError");
    assertEquals(error.message, "something went wrong");
    assertEquals(error.status, 400);
    assertEquals(error.expose, false);
    assertEquals(error.cause, cause);
  }
  assertAllOptions(
    new HttpError(400, "something went wrong", {
      name: "CustomError",
      expose: false,
      cause,
    }),
  );
  assertAllOptions(
    new HttpError(400, {
      name: "CustomError",
      message: "something went wrong",
      expose: false,
      cause,
    }),
  );
  assertAllOptions(
    new HttpError("something went wrong", {
      name: "CustomError",
      status: 400,
      expose: false,
      cause,
    }),
  );
  assertAllOptions(
    new HttpError({
      name: "CustomError",
      message: "something went wrong",
      status: 400,
      expose: false,
      cause,
    }),
  );
});

it(httpErrorTests, "with other data", () => {
  const cause = new Error("fail");
  const data = { x: 2, y: 3 };
  function assertAllOptions(error: HttpError) {
    assertEquals(error.toString(), "CustomError: something went wrong");
    assertEquals(error.name, "CustomError");
    assertEquals(error.message, "something went wrong");
    assertEquals(error.status, 400);
    assertEquals(error.expose, false);
    assertEquals(error.cause, cause);
    assertEquals(error.data, data);
  }
  assertAllOptions(
    new HttpError(400, "something went wrong", {
      name: "CustomError",
      expose: false,
      cause,
      ...data,
    }),
  );
  assertAllOptions(
    new HttpError(400, {
      name: "CustomError",
      message: "something went wrong",
      expose: false,
      cause,
      ...data,
    }),
  );
  assertAllOptions(
    new HttpError("something went wrong", {
      name: "CustomError",
      status: 400,
      expose: false,
      cause,
      ...data,
    }),
  );
  assertAllOptions(
    new HttpError({
      name: "CustomError",
      message: "something went wrong",
      status: 400,
      expose: false,
      cause,
      ...data,
    }),
  );
});

it(httpErrorTests, "json", () => {
  const cause = new Error("fail");
  const data = { x: 2, y: 3 };
  assertEquals(
    HttpError.json(cause),
    {
      name: "InternalServerError",
      status: 500,
    },
  );
  assertEquals(
    HttpError.json(
      new HttpError<typeof data>(400, "something went wrong", {
        name: "CustomError",
        cause,
        ...data,
      }),
    ),
    {
      name: "CustomError",
      message: "something went wrong",
      status: 400,
      ...data,
    },
  );
  assertEquals(
    HttpError.json(
      new HttpError<typeof data>(500, "something went wrong", {
        name: "CustomError",
        cause,
        ...data,
      }),
    ),
    {
      name: "CustomError",
      status: 500,
      ...data,
    },
  );
  assertEquals(
    HttpError.json(
      new HttpError<typeof data>(400, "something went wrong", {
        name: "CustomError",
        expose: false,
        cause,
        ...data,
      }),
    ),
    {
      name: "CustomError",
      status: 400,
      ...data,
    },
  );
});

const fromTests = describe(httpErrorTests, "from");

it(fromTests, "non HttpError", () => {
  const cause = new Error("fail");
  const error = HttpError.from(cause);
  assertEquals(error.toString(), "InternalServerError: fail");
  assertEquals(error.name, "InternalServerError");
  assertEquals(error.message, "fail");
  assertEquals(error.status, 500);
  assertEquals(error.expose, false);
  assertEquals(error.cause, cause);
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
    x: 2,
    y: 3,
  });
  const error = HttpError.from(originalError);
  assertStrictEquals(error, originalError);
});

it("isHttpError", () => {
  assertEquals(isHttpError(new Error()), false);
  assertEquals(isHttpError(new HttpError()), true);
  assertEquals(isHttpError(new HttpError(400, "something went wrong")), true);
  class CustomError extends HttpError {
    constructor(message: string) {
      super(420, message, { name: "CustomError" });
    }
  }
  assertEquals(isHttpError(new CustomError("too high")), true);
  class OtherError extends Error {
    constructor(message: string) {
      super(message);
    }
  }
  assertEquals(isHttpError(new OtherError("failed")), false);
  class OtherHttpError extends Error {
    status: number;
    expose: boolean;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.expose = status < 500;
    }
  }
  assertEquals(isHttpError(new OtherHttpError(400, "failed")), true);
});

const optionsFromArgsTests = describe("optionsFromArgs");

it(
  optionsFromArgsTests,
  "prefer status/message args over status/messagee options",
  () => {
    const messages = ["something went wrong", "failed"];
    const statuses = [400, 502];
    const options = { message: messages[1], status: statuses[1] };

    function assertPreferArgs(
      options: HttpErrorOptions,
      expectedStatus: number,
      expectedMessage: string,
    ): void {
      assertEquals(options, {
        status: expectedStatus,
        message: expectedMessage,
      });
    }
    assertPreferArgs(
      optionsFromArgs(statuses[0], messages[0], options),
      statuses[0],
      messages[0],
    );
    assertPreferArgs(
      optionsFromArgs(statuses[0], options),
      statuses[0],
      messages[1],
    );
    assertPreferArgs(
      optionsFromArgs(messages[0], options),
      statuses[1],
      messages[0],
    );
    assertPreferArgs(optionsFromArgs(options), statuses[1], messages[1]);
  },
);

it(
  optionsFromArgsTests,
  "supports extended options",
  () => {
    const status = 400;
    const message = "something went wrong";
    const options = { code: "invalid_request", uri: "https://example.com" };
    interface ExtendedErrorOptions extends HttpErrorOptions {
      code?: string;
      uri?: string;
    }
    const expectedOptions: ExtendedErrorOptions = {
      status,
      message,
      ...options,
    };
    function assertExtendedInit(options: ExtendedErrorOptions): void {
      assertEquals(options, expectedOptions);
    }

    assertExtendedInit(
      optionsFromArgs<ExtendedErrorOptions>(status, message, options),
    );
    assertExtendedInit(
      optionsFromArgs<ExtendedErrorOptions>(status, { message, ...options }),
    );
    assertExtendedInit(
      optionsFromArgs<ExtendedErrorOptions>(message, { status, ...options }),
    );
    assertExtendedInit(
      optionsFromArgs<ExtendedErrorOptions>({ status, message, ...options }),
    );
  },
);

const ErrorResponseTests = describe("ErrorResponse");

it(ErrorResponseTests, "from non Error", () => {
  const errorResponse = new ErrorResponse("oops");
  const expected = {
    name: "InternalServerError",
    status: 500,
  };
  assertEquals(errorResponse.error, expected);
  assertEquals(
    JSON.stringify(errorResponse),
    JSON.stringify({ error: expected }),
  );
});

it(ErrorResponseTests, "from Error", () => {
  const errorResponse = new ErrorResponse(new Error("oops"));
  const expected = {
    name: "InternalServerError",
    status: 500,
  };
  assertEquals(errorResponse.error, expected);
  assertEquals(
    JSON.stringify(errorResponse),
    JSON.stringify({ error: expected }),
  );
});

it(ErrorResponseTests, "from internal HttpError", () => {
  const errorResponse = new ErrorResponse(new HttpError("oops"));
  const expected = {
    name: "InternalServerError",
    status: 500,
  };
  assertEquals(errorResponse.error, expected);
  assertEquals(
    JSON.stringify(errorResponse),
    JSON.stringify({ error: expected }),
  );
});

it(ErrorResponseTests, "from external HttpError", () => {
  const errorResponse = new ErrorResponse(new HttpError(400, "oops"));
  const expected = {
    name: "BadRequestError",
    status: 400,
    message: "oops",
  };
  assertEquals(errorResponse.error, expected);
  assertEquals(
    JSON.stringify(errorResponse),
    JSON.stringify({ error: expected }),
  );
});

const toErrorTests = describe(ErrorResponseTests, "toError");

it(toErrorTests, "with text response", async () => {
  const response = new Response("oops", { status: 400 });
  const error = await ErrorResponse.toError(response);
  assertEquals(error.toString(), "BadRequestError");
  assertEquals(error.name, "BadRequestError");
  assertEquals(error.message, "");
  assertEquals(error.status, 400);
  assertEquals(error.expose, true);
  assertEquals(error.cause, undefined);
});

it(toErrorTests, "with error response", async () => {
  const response = new Response(
    JSON.stringify({ error: { status: 400, message: "oops", custom: "data" } }),
    { status: 400 },
  );
  const error = await ErrorResponse.toError(response);
  assertEquals(error.toString(), "BadRequestError: oops");
  assertEquals(error.name, "BadRequestError");
  assertEquals(error.message, "oops");
  assertEquals(error.status, 400);
  assertEquals(error.expose, true);
  assertEquals(error.cause, undefined);
  assertEquals(error.data, { custom: "data" });
});

it(toErrorTests, "with json response", async () => {
  const response = new Response(JSON.stringify({ message: "oops" }), {
    status: 400,
  });
  const error = await ErrorResponse.toError(response);
  assertEquals(error.toString(), "BadRequestError: oops");
  assertEquals(error.name, "BadRequestError");
  assertEquals(error.message, "oops");
  assertEquals(error.status, 400);
  assertEquals(error.expose, true);
  assertEquals(error.cause, undefined);
});

it(toErrorTests, "with internal ErrorResponse", () => {
  const errorResponse = new ErrorResponse(new HttpError("oops"));
  const error = ErrorResponse.toError(errorResponse);
  assertEquals(error.toString(), "InternalServerError");
  assertEquals(error.name, "InternalServerError");
  assertEquals(error.message, "");
  assertEquals(error.status, 500);
  assertEquals(error.expose, false);
  assertEquals(error.cause, undefined);
});

it(toErrorTests, "with external ErrorResponse", () => {
  const errorResponse = new ErrorResponse(new HttpError(400, "oops"));
  const error = ErrorResponse.toError(errorResponse);
  assertEquals(error.toString(), "BadRequestError: oops");
  assertEquals(error.name, "BadRequestError");
  assertEquals(error.message, "oops");
  assertEquals(error.status, 400);
  assertEquals(error.expose, true);
  assertEquals(error.cause, undefined);
});

it(toErrorTests, "with ErrorResponse JSON", () => {
  const errorResponse = {
    error: {
      name: "BadRequestError",
      message: "oops",
      status: 400,
    },
  };
  const error = ErrorResponse.toError(errorResponse);
  assertEquals(error.toString(), "BadRequestError: oops");
  assertEquals(error.name, "BadRequestError");
  assertEquals(error.message, "oops");
  assertEquals(error.status, 400);
  assertEquals(error.expose, true);
  assertEquals(error.cause, undefined);
});

it("isErrorResponse", () => {
  assertEquals(isErrorResponse({}), false);
  assertEquals(isErrorResponse({ success: true }), false);
  assertEquals(isErrorResponse({ error: {} }), true);
  assertEquals(
    isErrorResponse({
      error: { status: 400, message: "something went wrong" },
    }),
    true,
  );
  assertEquals(
    isErrorResponse({
      error: {
        status: 400,
        name: "CustomError",
        message: "something went wrong",
      },
    }),
    true,
  );
});

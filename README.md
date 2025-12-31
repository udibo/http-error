# Http Error

[![JSR](https://jsr.io/badges/@udibo/http-error)](https://jsr.io/@udibo/http-error)
[![JSR Score](https://jsr.io/badges/@udibo/http-error/score)](https://jsr.io/@udibo/http-error)
[![CI](https://github.com/udibo/http-error/workflows/CI/badge.svg)](https://github.com/udibo/http-error/actions?query=workflow%3ACI)
[![codecov](https://codecov.io/gh/udibo/http-error/branch/main/graph/badge.svg?token=8Q7TSUFWUY)](https://codecov.io/gh/udibo/http-error)
[![license](https://img.shields.io/github/license/udibo/http-error)](https://github.com/udibo/http-error/blob/master/LICENSE)

Utilities for creating and working with Http Errors.

This package was inspired by
[http-errors](https://www.npmjs.com/package/http-errors) for Node.js.

## Features

- Framework agnostic
- RFC 9457 Problem Details compliant error responses

## Usage

Below are some examples of how to use this module.

### HttpError

This class can be used on its own to create any `HttpError`. It has a few
different call signatures you can use. The 4 examples below would throw the same
error.

```ts
import { HttpError } from "@udibo/http-error";

throw new HttpError(404, "file not found");
throw new HttpError(404, { message: "file not found" });
throw new HttpError("file not found", { status: 404 });
throw new HttpError({ status: 404, message: "file not found" });
```

You can also include a `cause` in the optional options argument for it like you
can with regular errors. Additional `HttpErrorOptions` include `statusText`,
`type` (a URI for the problem type), `instance` (a URI for this specific error
occurrence), `extensions` (an object for additional details), and `headers` (to
customize response headers).

```ts
import { HttpError, type HttpErrorOptions } from "@udibo/http-error";

const cause = new Error("Underlying issue");
throw new HttpError(400, "Invalid input", {
  cause,
  type: "/errors/validation-error",
  instance: "/requests/123/user-field",
  extensions: { field: "username", reason: "must be alphanumeric" },
  headers: { "X-Custom-Error-ID": "err-987" },
});
```

All `HttpError` objects have a `status` associated with them. If a status is not
provided it will default to 500. The `expose` property will default to `true`
for client error statuses (4xx) and `false` for server error statuses (5xx). You
can override the default behavior by setting the `expose` property on the
options argument.

For all known HTTP error status codes, a `name` will be generated (e.g.,
`Not Found` for 404). If the name is not known, it will default to
`Unknown Client Error` or `Unknown Server Error`.

```ts
import { HttpError } from "@udibo/http-error";

const error = new HttpError(404, "file not found");
console.log(error.toString()); // Not Found: file not found
console.log(error.status); // 404
console.log(error.expose); // true
```

If you would like to extend the `HttpError` class, you can pass your own error
name in the options.

```ts
import { HttpError, type HttpErrorOptions } from "@udibo/http-error";

class CustomError extends HttpError {
  constructor(
    message?: string,
    options?: HttpErrorOptions,
  ) {
    super(message, { name: "CustomError", status: 420, ...options });
  }
}
```

#### `HttpError.from()`

This static method intelligently converts various error-like inputs into an
`HttpError` instance.

- If an `HttpError` is passed, it's returned directly.
- If an `Error` is passed, it's wrapped in a new `HttpError` (usually 500
  status), with the original error as the `cause`.
- If a `Response` object is passed, it attempts to parse the body as RFC 9457
  Problem Details. If successful, it creates an `HttpError` from those details.
  If parsing fails or the body isn't Problem Details, it creates a generic
  `HttpError` based on the response status. This method is asynchronous and
  returns a `Promise<HttpError>`.
- If a `ProblemDetails` object is passed, it creates an `HttpError` from it.
- For other unknown inputs, it creates a generic `HttpError` with a 500 status.

```ts
import { HttpError } from "@udibo/http-error";

// From a standard Error
const plainError = new Error("Something went wrong");
const httpErrorFromError = HttpError.from(plainError);
console.log(httpErrorFromError.status); // 500
console.log(httpErrorFromError.message); // "Something went wrong"
console.log(httpErrorFromError.cause === plainError); // true

// From a Response (example)
async function handleErrorResponse(response: Response) {
  if (!response.ok) {
    const error = await HttpError.from(response);
    // Now 'error' is an HttpError instance
    throw error;
  }
  return response.json();
}

// From a ProblemDetails object
const problemDetails = {
  status: 403,
  title: "ForbiddenAccess",
  detail: "You do not have permission.",
  type: "/errors/forbidden",
};
const httpErrorFromDetails = HttpError.from(problemDetails);
console.log(httpErrorFromDetails.status); // 403
console.log(httpErrorFromDetails.name); // ForbiddenAccess
```

#### `HttpError.toJSON()`

This method returns a plain JavaScript object representing the error in the RFC
9457 Problem Details format. This is useful for serializing the error to a JSON
response body. The `detail` property is set to `exposedMessage`, which provides
a safe message for clients (see `exposedMessage` section below).

```ts
import { HttpError } from "@udibo/http-error";

const error = new HttpError(400, "Invalid input", {
  type: "/errors/validation",
  instance: "/form/user",
  extensions: { field: "email" },
});

const problemDetails = error.toJSON();
console.log(problemDetails);
// Outputs:
// {
//   field: "email",
//   status: 400,
//   title: "Bad Request",
//   detail: "Invalid input",
//   type: "/errors/validation",
//   instance: "/form/user"
// }

// For server errors (expose=false), detail uses a safe default message
const serverError = new HttpError(500, "SQL syntax error near 'users'");
console.log(serverError.toJSON());
// Outputs:
// {
//   status: 500,
//   title: "Internal Server Error",
//   detail: "The server encountered an unexpected condition."
// }
```

#### `HttpError.getResponse()`

This method returns a `Response` object, ready to be sent to the client. The
response body will be the JSON string of the Problem Details object (from
`toJSON()`), and headers (including `Content-Type: application/problem+json`)
will be set. The response status and status text will match the error's
properties.

```ts
import { HttpError } from "@udibo/http-error";

const error = new HttpError(401, "Authentication required");
const response = error.getResponse();

console.log(response.status); // 401
console.log(response.headers.get("Content-Type")); // application/problem+json
// response.body can be read to get the JSON string
```

#### `exposedMessage`

The `exposedMessage` property provides a safe, user-friendly message that can be
exposed to clients. This prevents internal error details (like SQL errors, file
paths, or stack traces) from leaking to users.

**How it works:**

- If `exposedMessage` is explicitly provided in options, that value is used
- If `expose` is `true` and `message` exists, `exposedMessage` defaults to
  `message`
- Otherwise, `exposedMessage` defaults to a generic message for the status code
  (e.g., "The server encountered an unexpected condition." for 500)

```ts
import { HttpError } from "@udibo/http-error";

// Client error (expose=true by default) - message is used as exposedMessage
const clientError = new HttpError(400, "Invalid email format");
console.log(clientError.exposedMessage); // "Invalid email format"

// Server error (expose=false by default) - safe default is used
const serverError = new HttpError(500, "Database connection refused");
console.log(serverError.exposedMessage); // "The server encountered an unexpected condition."
console.log(serverError.message); // "Database connection refused" (internal use only)

// Custom exposedMessage - always takes priority
const customError = new HttpError(500, "SQL syntax error", {
  exposedMessage: "An error occurred while processing your request.",
});
console.log(customError.exposedMessage); // "An error occurred while processing your request."
```

### Server-Side Rendering Best Practices

When rendering error messages in server-side templates or responses, always use
`error.exposedMessage` instead of `error.message` to prevent leaking internal
implementation details to users.

**Why this matters:**

- `error.message` may contain sensitive information (SQL errors, file paths,
  stack traces)
- `error.exposedMessage` provides a safe, user-friendly message by default
- For server errors (5xx), the default `exposedMessage` is generic and safe
- For client errors (4xx), `exposedMessage` defaults to `message` since those
  are typically user-facing

**Example in a template:**

```ts
// BAD - may expose internal details
<p>Error: ${error.message}</p>  // "SQLSTATE[42S02]: Table 'users' doesn't exist"

// GOOD - safe for users
<p>Error: ${error.exposedMessage}</p>  // "The server encountered an unexpected condition."
```

**Example in error handling middleware:**

```ts
app.onError((cause, c) => {
  const error = HttpError.from(cause);

  // Log the full internal message for debugging
  console.error(`[${error.status}] ${error.message}`, error.cause);

  // Return safe message to client (via toJSON which uses exposedMessage)
  return error.getResponse();
});
```

### `createHttpErrorClass()`

This factory function allows you to create custom error classes that extend
`HttpError`. You can provide default options (like `status`, `name`, `message`,
`extensions`, etc.) for your custom error class.

```ts
import { createHttpErrorClass, type HttpErrorOptions } from "@udibo/http-error";

interface MyApiErrorExtensions {
  errorCode: string;
  requestId?: string;
}

const MyApiError = createHttpErrorClass<MyApiErrorExtensions>({
  name: "MyApiError", // Default name
  status: 452, // Default status
  extensions: {
    errorCode: "API_GENERAL_FAILURE", // Default extension value
  },
});

try {
  throw new MyApiError("Specific operation failed.", {
    extensions: {
      errorCode: "API_OP_X_FAILED", // Override default extension
      requestId: "req-123", // Add instance-specific extension
    },
  });
} catch (e) {
  if (e instanceof MyApiError) {
    console.log(e.name); // "MyApiError"
    console.log(e.status); // 452
    console.log(e.message); // "Specific operation failed."
    console.log(e.extensions.errorCode); // "API_OP_X_FAILED"
    console.log(e.extensions.requestId); // "req-123"
    // console.log(e.toJSON());
  }
}

// Instance with overridden status
const anotherError = new MyApiError(453, "Another failure");
console.log(anotherError.status); // 453
console.log(anotherError.extensions.errorCode); // "API_GENERAL_FAILURE" (from default)
```

### Framework Integration

#### Hono

Here's an example of how to use `HttpError` with Hono, utilizing its
`app.onError` handler to return Problem Details JSON responses.

```ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception"; // For comparison
import { HttpError } from "@udibo/http-error";

const app = new Hono();

app.get("/error", () => {
  throw new Error("This is an example of a plain Error");
});

app.get("/hono-error", () => {
  // Hono's native error, for comparison
  throw new HTTPException(400, {
    message: "This is an example of an error from hono",
  });
});

app.get("/http-error", () => {
  throw new HttpError(400, "This is an example of an HttpError", {
    type: "/errors/http-error",
    instance: "/errors/http-error/instance/123",
    extensions: {
      customField: "customValue",
    },
  });
});

// Global error handler
app.onError(async (cause, c) => { // c is Hono's context
  console.log("Hono onError caught:", cause);

  // Converts non-HttpError instances to HttpError instances
  // For Response objects (e.g. from fetch), HttpError.from is async
  const error = cause instanceof Response
    ? await HttpError.from(cause)
    : HttpError.from(cause);

  console.error(error); // Log the full HttpError

  return error.getResponse(); // Return a Response object directly
});

console.log("Hono server running on http://localhost:8000");
Deno.serve(app.fetch);
```

#### Oak

Here is an example of how an Oak server could have middleware that converts any
thrown error into an `HttpError` and returns a Problem Details JSON response.

```ts
import { Application, Router } from "@oak/oak";
import { HttpError } from "@udibo/http-error";

const app = new Application();

// Error handling middleware
app.use(async (context, next) => {
  try {
    await next();
  } catch (cause) {
    // Converts non-HttpError instances to HttpError instances
    // For Response objects (e.g. from fetch), HttpError.from is async
    const error = cause instanceof Response
      ? await HttpError.from(cause)
      : HttpError.from(cause);

    console.error(error); // Log the full error

    const { response } = context;
    response.status = error.status;
    error.headers.forEach((value, key) => { // Set custom headers from HttpError
      response.headers.set(key, value);
    });
    // Set Content-Type if not already set by error.headers
    if (!response.headers.has("Content-Type")) {
      response.headers.set("Content-Type", "application/problem+json");
    }
    response.body = error.toJSON(); // Send Problem Details as JSON
  }
});

const router = new Router();
router.get("/test-error", () => {
  // Will be caught and transformed by the middleware
  throw new Error("A generic error occurred!");
});
router.get("/test-http-error", () => {
  throw new HttpError(400, "This is a specific HttpError.", {
    type: "/errors/my-custom-error",
    extensions: { info: "some detail" },
  });
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("Oak server running on http://localhost:8000");
await app.listen({ port: 8000 });
```

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

## Usage

Below are some examples of how to use this module.

### HttpError

This class can be used on its own to create any HttpError. It has a few
different call signatures you can use. The 4 examples below would throw the same
error.

```ts
import { HttpError } from "@udibo/http-error";

throw new HttpError(404, "file not found");
throw new HttpError(404, { message: "file not found" });
throw new HttpError("file not found", { status: 404 });
throw new HttpError({ status: 404, message: "file not found" });
```

You can also include a cause in the optional options argument for it like you
can with regular errors.

```ts
import { HttpError } from "@udibo/http-error";

throw new HttpError(404, "file not found", { cause: error });
```

All HttpError objects have a status associated with them. If a status is not
provided it will default to 500. The expose property will default to true for
client error status and false for server error status. You can override the
default behavior by setting the expose property on the options argument.

For all known HTTP error status codes, a name will be generated for them. For
example, the name of an HttpError with the 404 status would be NotFoundError. If
the name is not known for an HTTP error status code, it will default to
UnknownClientError or UnknownServerError.

```ts
import { HttpError } from "@udibo/http-error";

const error = new HttpError(404, "file not found");
console.log(error.toString()); // NotFoundError: file not found
```

If you would like to extend the HttpError class, you can pass your own error
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

If you'd like the arguments to match the parent HttpError classes call
signature, you can make use of the optionsFromArgs function. It will prioritize
the status / message arguments over status / message options.

```ts
import {
  HttpError,
  type HttpErrorOptions,
  optionsFromArgs,
} from "@udibo/http-error";

class CustomError extends HttpError {
  constructor(
    status?: number,
    message?: string,
    options?: HttpErrorOptions,
  );
  constructor(status?: number, options?: HttpErrorOptions);
  constructor(message?: string, options?: HttpErrorOptions);
  constructor(options?: HttpErrorOptions);
  constructor(
    statusOrMessageOrOptions?: number | string | HttpErrorOptions,
    messageOrOptions?: string | HttpErrorOptions,
    options?: HttpErrorOptions,
  ) {
    const init = optionsFromArgs(
      statusOrMessageOrOptions,
      messageOrOptions,
      options,
    );
    super({ name: "CustomError", status: 420, ...init });
  }
}
```

### isHttpError

This function can be used to determine if a value is an HttpError object. It
will also return true for Error objects that have status and expose properties
with matching types.

```ts
import { HttpError, isHttpError } from "@udibo/http-error";

let error = new Error("file not found");
console.log(isHttpError(error)); // false
error = new HttpError(404, "file not found");
console.log(isHttpError(error)); // true
```

### ErrorResponse

This class can be used to transform an HttpError into a JSON format that can be
converted back into an HttpError. This makes it easy for the server to share
HttpError's with the client. This will work with any value that is thrown.

Here is an example of how an oak server could have middleware that converts an
error into into a JSON format.

```ts
import { Application } from "@oak/oak/application";
import { ErrorResponse, HttpError } from "@udibo/http-error";

const app = new Application();

app.use(async (context, next) => {
  try {
    await next();
  } catch (error) {
    const { response } = context;
    response.status = isHttpError(error) ? error.status : 500;
    response.body = new ErrorResponse(error);
  }
});

app.use(() => {
  // Will throw a 500 on every request.
  throw new HttpError(500);
});

await app.listen({ port: 80 });
```

When `JSON.stringify` is used on the ErrorResponse object, the ErrorResponse
becomes a JSON representation of an HttpError.

If the server were to have the following error in the next() function call from
that example, the response to the request would have it's status match the error
and the body be a JSON representation of the error.

```ts
import { HttpError } from "@udibo/http-error";

throw new HttpError(400, "Invalid input");
```

Then the response would have a 400 status and it's body would look like this:

```json
{
  "error": {
    "name": "BadRequestError",
    "status": 400,
    "message": "Invalid input"
  }
}
```

#### ErrorResponse.toError

This function gives a client the ability to convert the error response JSON into
an HttpError.

In the following example, if getMovies is called and API endpoint returned an
ErrorResponse, it would be converted into an HttpError object and be thrown.

```ts
import { ErrorResponse, HttpError, isErrorResponse } from "@udibo/http-error";

async function getMovies() {
  const response = await fetch("https://example.com/movies.json");
  const movies = await response.json();
  if (isErrorResponse(movies)) throw new ErrorResponse.toError(movies);
  if (response.status >= 400) {
    throw new HttpError(response.status, "Invalid response");
  }
  return movies;
}
```

If the request returned the following error response, it would be converted into
an HttpError by the `ErrorResponse.toError(movies)` call.

```json
{
  "error": {
    "name": "BadRequestError",
    "status": 400,
    "message": "Invalid input"
  }
}
```

The error that `getMovies` would throw would be equivalent to throwing the
following HttpError.

```ts
import { HttpError } from "@udibo/http-error";

new HttpError(400, "Invalid input");
```

### isErrrorResponse

This function gives you the ability to determine if an API's response body is in
the format of an ErrorResponse. It's useful for knowing when a response should
be converted into an HttpError.

In the following example, you can see that if the request's body is in the
format of an ErrorResponse, it will be converted into an HttpError and be
thrown. But if it isn't in that format and doesn't have an error status, the
response body will be returned as the assumed movies.

```ts
import { HttpError, isErrorResponse } from "@udibo/http-error";

async function getMovies() {
  const response = await fetch("https://example.com/movies.json");
  const movies = await response.json();
  if (isErrorResponse(movies)) throw new ErrorResponse.toError(movies);
  if (response.status >= 400) {
    throw new HttpError(response.status, "Invalid response");
  }
  return movies;
}
```

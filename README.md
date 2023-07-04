# Http Error

[![version](https://img.shields.io/badge/release-0.7.0-success)](https://deno.land/x/http_error@0.7.0)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/http_error@0.7.0/mod.ts)
[![CI](https://github.com/udibo/http_error/workflows/CI/badge.svg)](https://github.com/udibo/http_error/actions?query=workflow%3ACI)
[![codecov](https://codecov.io/gh/udibo/http_error/branch/main/graph/badge.svg?token=8Q7TSUFWUY)](https://codecov.io/gh/udibo/http_error)
[![license](https://img.shields.io/github/license/udibo/http_error)](https://github.com/udibo/http_error/blob/master/LICENSE)

An error class for HTTP requests.

This module was inspired by
[http-errors](https://www.npmjs.com/package/http-errors) for Node.js.

## Features

- Framework agnostic

## Installation

This is an ES Module written in TypeScript and can be used in Deno projects. ES
Modules are the official standard format to package JavaScript code for reuse. A
JavaScript bundle is provided with each release so that it can be used in
Node.js packages or web browsers.

### Deno

To include it in a Deno project, you can import directly from the TS files. This
module is available in Deno's third part module registry but can also be
imported directly from GitHub using raw content URLs.

```ts
// Import from Deno's third party module registry
import { HttpError, isHttpError } from "https://deno.land/x/http_error@0.7.0/mod.ts";
// Import from GitHub
import { HttpError, isHttpError } "https://raw.githubusercontent.com/udibo/http_error/0.7.0/mod.ts";
```

### Node.js

Node.js fully supports ES Modules.

If a Node.js package has the type "module" specified in its package.json file,
the JavaScript bundle can be imported as a `.js` file.

```js
import { HttpError, isHttpError } from "./http_error_0.7.0.js";
```

The default type for Node.js packages is "commonjs". To import the bundle into a
commonjs package, the file extension of the JavaScript bundle must be changed
from `.js` to `.mjs`.

```js
import { HttpError, isHttpError } from "./http_error_0.7.0.mjs";
```

See [Node.js Documentation](https://nodejs.org/api/esm.html) for more
information.

### Browser

Most modern browsers support ES Modules.

The JavaScript bundle can be imported into ES modules. Script tags for ES
modules must have the type attribute set to "module".

```html
<script type="module" src="main.js"></script>
```

```js
// main.js
import { HttpError, isHttpError } from "./http_error_0.7.0.js";
```

You can also embed a module script directly into an HTML file by placing the
JavaScript code within the body of the script tag.

```html
<script type="module">
  import { HttpError, isHttpError } from "./http_error_0.7.0.js";
</script>
```

See
[MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
for more information.

## Usage

Below are some examples of how to use this module.

### HttpError

This class can be used on its own to create any HttpError. It has a few
different call signatures you can use. The 4 examples below would throw the same
error.

```ts
throw new HttpError(404, "file not found");
throw new HttpError(404, { message: "file not found" });
throw new HttpError("file not found", { status: 404 });
throw new HttpError({ status: 404, message: "file not found" });
```

You can also include a cause in the optional options argument for it like you
can with regular errors.

```ts
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
const error = new HttpError(404, "file not found");
console.log(error.toString()); // NotFoundError: file not found
```

If you would like to extend the HttpError class, you can pass your own error
name in the options.

```ts
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
let error = new Error("file not found");
console.log(isHttpError(error)); // false
error = new HttpError(404, "file not found");
console.log(isHttpError(error)); // true
```

### ErrorResponse

This object can be used to transform an HttpError into a JSON format that can be
converted back into an HttpError. This makes it easy for the server to share
HttpError's with the client. This will work with any value that is thrown.

Here is an example of how an oak server could have middleware that convert an
error into into a JSON format.

```ts
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    response.status = isHttpError(error) ? error.status : 500;
    response.body = new ErrorResponse(error);
  }
});
```

When `JSON.stringify` is used on the ErrorResponse object, the ErrorResponse
becomes a JSON representation of an HttpError.

If the server were to have the following error in the next() function call from
that example, the response to the request would have it's status match the error
and the body be a JSON representation of the error.

```ts
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

If the format of your error responses is different than this, you can look at
the source code in [mod.ts](/mod.ts) to see how you could create your own
ErrorResponse object that can be used to convert your error responses into
HttpErrors.

#### ErrorResponse.toError

This function gives a client the ability to convert the error response JSON into
an HttpError.

In the following example, if getMovies is called and API endpoint returned an
ErrorResponse, it would be converted into an HttpError object and be thrown.

```ts
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

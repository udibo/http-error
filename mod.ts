import { STATUS_CODE, STATUS_TEXT, type StatusCode } from "@std/http/status";

/** Options for initializing an HttpError. */
export interface HttpErrorOptions extends ErrorOptions {
  /** The name of the error. Default based on error status. */
  name?: string;
  message?: string;
  /** The HTTP status associated with the error. Defaults to 500. */
  status?: number;
  /**
   * Determines if the error should be exposed in the response.
   * Defaults to true for client error statuses and false for server error statuses.
   */
  expose?: boolean;
  /**
   * The cause of the error.
   */
  cause?: unknown;
  /**
   * Other data associated with the error.
   */
  [key: string]: unknown;
}

/**
 * Converts HttpError arguments to an options object.
 * Prioritizing status and message arguments over status and message options.
 *
 * This function is useful for creating custom error classes that extend HttpError.
 *
 * ```ts
 * import {
 *   HttpError,
 *   type HttpErrorOptions,
 *   optionsFromArgs,
 * } from "@udibo/http-error";
 *
 * class CustomError extends HttpError {
 *   constructor(
 *     status?: number,
 *     message?: string,
 *     options?: HttpErrorOptions,
 *   );
 *   constructor(status?: number, options?: HttpErrorOptions);
 *   constructor(message?: string, options?: HttpErrorOptions);
 *   constructor(options?: HttpErrorOptions);
 *   constructor(
 *     statusOrMessageOrOptions?: number | string | HttpErrorOptions,
 *     messageOrOptions?: string | HttpErrorOptions,
 *     options?: HttpErrorOptions,
 *   ) {
 *     const init = optionsFromArgs(
 *       statusOrMessageOrOptions,
 *       messageOrOptions,
 *       options,
 *     );
 *     super({ name: "CustomError", status: 420, ...init });
 *   }
 * }
 * ```
 *
 * @param statusOrMessageOrOptions - The status, message, or options.
 * @param messageOrOptions - The message or options.
 * @param options - The options.
 * @returns The options object.
 */
export function optionsFromArgs<
  Init extends HttpErrorOptions = HttpErrorOptions,
>(
  statusOrMessageOrOptions?: number | string | Init,
  messageOrOptions?: string | Init,
  options?: Init,
): Init {
  let status: number | undefined = undefined;
  let message: string | undefined = undefined;
  let init: Init | undefined = options;

  if (typeof statusOrMessageOrOptions === "number") {
    status = statusOrMessageOrOptions;
    if (typeof messageOrOptions === "string") {
      message = messageOrOptions;
    } else if (messageOrOptions) {
      init = messageOrOptions;
      message = init?.message;
    }
  } else if (typeof statusOrMessageOrOptions === "string") {
    message = statusOrMessageOrOptions;
    init = messageOrOptions as (Init | undefined);
    status = init?.status ?? status;
  } else if (typeof messageOrOptions === "string") {
    message = messageOrOptions;
  } else if (!init) {
    init = messageOrOptions ? messageOrOptions : statusOrMessageOrOptions;
    status = init?.status ?? status;
    message = init?.message;
  }

  return { ...init, status, message } as Init;
}

function errorNameForStatus(status: number): string {
  let name: string;
  if (STATUS_TEXT[status as StatusCode]) {
    name = status === STATUS_CODE.Teapot
      ? "Teapot"
      : STATUS_TEXT[status as StatusCode].replace(/\W/g, "");
    if (status !== STATUS_CODE.InternalServerError) name += "Error";
  } else {
    name = `Unknown${status < 500 ? "Client" : "Server"}Error`;
  }
  return name;
}

/**
 * An error for an HTTP request.
 *
 * This class can be used on its own to create any HttpError. It has a few
 * different call signatures you can use. The 4 examples below would throw the same
 * error.
 *
 * ```ts
 * import { HttpError } from "@udibo/http-error";
 *
 * throw new HttpError(404, "file not found");
 * throw new HttpError(404, { message: "file not found" });
 * throw new HttpError("file not found", { status: 404 });
 * throw new HttpError({ status: 404, message: "file not found" });
 * ```
 *
 * You can also include a cause in the optional options argument for it like you
 * can with regular errors.
 *
 * ```ts
 * import { HttpError } from "@udibo/http-error";
 *
 * throw new HttpError(404, "file not found", { cause: error });
 * ```
 *
 * All HttpError objects have a status associated with them. If a status is not
 * provided it will default to 500. The expose property will default to true for
 * client error status and false for server error status. You can override the
 * default behavior by setting the expose property on the options argument.
 *
 * For all known HTTP error status codes, a name will be generated for them. For
 * example, the name of an HttpError with the 404 status would be NotFoundError. If
 * the name is not known for an HTTP error status code, it will default to
 * UnknownClientError or UnknownServerError.
 *
 * ```ts
 * import { HttpError } from "@udibo/http-error";
 *
 * const error = new HttpError(404, "file not found");
 * console.log(error.toString()); // NotFoundError: file not found
 * ```
 *
 * If you would like to extend the HttpError class, you can pass your own error
 * name in the options.
 *
 * ```ts
 * import { HttpError, type HttpErrorOptions } from "@udibo/http-error";
 *
 * class CustomError extends HttpError {
 *   constructor(
 *     message?: string,
 *     options?: HttpErrorOptions,
 *   ) {
 *     super(message, { name: "CustomError", status: 420, ...options });
 *   }
 * }
 * ```
 *
 * If you'd like the arguments to match the parent HttpError classes call
 * signature, you can make use of the optionsFromArgs function. It will prioritize
 * the status / message arguments over status / message options.
 *
 * ```ts
 * import {
 *   HttpError,
 *   type HttpErrorOptions,
 *   optionsFromArgs,
 * } from "@udibo/http-error";
 *
 * class CustomError extends HttpError {
 *   constructor(
 *     status?: number,
 *     message?: string,
 *     options?: HttpErrorOptions,
 *   );
 *   constructor(status?: number, options?: HttpErrorOptions);
 *   constructor(message?: string, options?: HttpErrorOptions);
 *   constructor(options?: HttpErrorOptions);
 *   constructor(
 *     statusOrMessageOrOptions?: number | string | HttpErrorOptions,
 *     messageOrOptions?: string | HttpErrorOptions,
 *     options?: HttpErrorOptions,
 *   ) {
 *     const init = optionsFromArgs(
 *       statusOrMessageOrOptions,
 *       messageOrOptions,
 *       options,
 *     );
 *     super({ name: "CustomError", status: 420, ...init });
 *   }
 * }
 * ```
 *
 * @param T - The type of data associated with the error.
 * @param status - The HTTP status associated with the error.
 * @param message - The message associated with the error.
 * @param options - Other data associated with the error.
 * @returns An HttpError object.
 */
export class HttpError<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  /**
   * The HTTP status associated with the error.
   * Must be a client or server error status. Defaults to 500.
   */
  status: number;
  /**
   * Determines if the error should be exposed in the response.
   * Defaults to true for client error statuses and false for server error statuses.
   */
  expose: boolean;
  /**
   * Other data associated with the error.
   */
  data: T;

  constructor(
    status?: number,
    message?: string,
    options?: HttpErrorOptions & T,
  );
  constructor(status?: number, options?: HttpErrorOptions & T);
  constructor(message?: string, options?: HttpErrorOptions & T);
  constructor(options?: HttpErrorOptions & T);
  constructor(
    statusOrMessageOrOptions?: number | string | (HttpErrorOptions & T),
    messageOrOptions?: string | (HttpErrorOptions & T),
    options?: HttpErrorOptions & T,
  ) {
    const init = optionsFromArgs(
      statusOrMessageOrOptions,
      messageOrOptions,
      options,
    );
    const { message, name, expose, status: _status, cause, ...data } = init;
    const status = init.status ?? STATUS_CODE.InternalServerError;

    if (status < 400 || status >= 600) {
      throw new RangeError("invalid error status");
    }

    const errorOptions = {} as ErrorOptions;
    if (typeof cause !== "undefined") errorOptions.cause = cause;
    super(message, errorOptions);

    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      value: name ?? errorNameForStatus(status),
      writable: true,
    });
    this.status = status;
    this.expose = expose ?? (status < 500);
    this.data = data as T;
  }

  /**
   * Converts any HttpError like objects into an HttpError.
   * If the object is already an instance of HttpError, it will be returned as is.
   *
   * ```ts
   * import { HttpError } from "@udibo/http-error";
   *
   * try {
   *   throw new Error("something went wrong");
   * } catch (cause) {
   *   // Converts any non HttpError objects into an HttpError before re-throwing.
   *   throw HttpError.from(cause);
   * }
   * ```
   *
   * @param error - The error to convert.
   * @returns An HttpError object.
   */
  static from<T extends Record<string, unknown> = Record<string, unknown>>(
    error: HttpError<T> | Error | unknown,
  ): HttpError<T> {
    if (error instanceof HttpError) {
      return error;
    } else if (isHttpError(error)) {
      const { name, message, status, expose, cause, data } = error;
      const options = {
        ...data,
        name,
        message,
        status,
        expose,
        cause,
      } as HttpErrorOptions & T;
      return new HttpError<T>(options);
    } else if (error instanceof Error) {
      return new HttpError(500, error.message, {
        cause: error,
      }) as unknown as HttpError<T>;
    } else {
      return new HttpError(500, { cause: error }) as unknown as HttpError<T>;
    }
  }

  /**
   * Converts an HttpError to an options object that can be used to re-create it.
   * The message will only be included if the error should be exposed.
   *
   * ```ts
   * import { HttpError } from "@udibo/http-error";
   *
   * const error = new HttpError(400, "Invalid id");
   * const options = HttpError.json(error);
   * const copy = new HttpError(options);
   * ```
   *
   * @param error - The error to convert.
   * @returns The options object.
   */
  static json<T extends Record<string, unknown> = Record<string, unknown>>(
    error: HttpError<T> | Error | unknown,
  ): HttpErrorOptions & T {
    const { name, message, status, expose, data } = isHttpError(error)
      ? error
      : HttpError.from(error);
    const json = {
      name,
      status,
      ...data,
    } as (HttpErrorOptions & T);
    if (expose && message) {
      json.message = message;
    }
    return json;
  }
}

/**
 * This function can be used to determine if a value is an HttpError object. It
 * will also return true for Error objects that have status and expose properties
 * with matching types.
 *
 * ```ts
 * import { HttpError, isHttpError } from "@udibo/http-error";
 *
 * let error = new Error("file not found");
 * console.log(isHttpError(error)); // false
 * error = new HttpError(404, "file not found");
 * console.log(isHttpError(error)); // true
 * ```
 *
 * @param value - The value to check.
 * @returns True if the value is an HttpError.
 */
export function isHttpError<
  T extends Record<string, unknown> = Record<string, unknown>,
>(value: unknown): value is HttpError<T> {
  return !!value && typeof value === "object" &&
    (value instanceof HttpError ||
      (value instanceof Error &&
        typeof (value as HttpError).status === "number"));
}

/**
 * A format for sharing errors with the browser.
 * With a consistent format for error responses,
 * the client can convert them back into an HttpErrors.
 */
export interface ErrorResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  error: HttpErrorOptions & T;
}

/**
 * This class can be used to transform an HttpError into a JSON format that can be
 * converted back into an HttpError. This makes it easy for the server to share
 * HttpError's with the client. This will work with any value that is thrown.
 *
 * Here is an example of how an oak server could have middleware that converts an
 * error into into a JSON format.
 *
 * ```ts
 * import { Application } from "@oak/oak/application";
 * import { ErrorResponse, HttpError } from "@udibo/http-error";
 *
 * const app = new Application();
 *
 * app.use(async (context, next) => {
 *   try {
 *     await next();
 *   } catch (error) {
 *     const { response } = context;
 *     response.status = isHttpError(error) ? error.status : 500;
 *     response.body = new ErrorResponse(error);
 *   }
 * });
 *
 * app.use(() => {
 *   // Will throw a 500 on every request.
 *   throw new HttpError(500);
 * });
 *
 * await app.listen({ port: 80 });
 * ```
 *
 * When `JSON.stringify` is used on the ErrorResponse object, the ErrorResponse
 * becomes a JSON representation of an HttpError.
 *
 * If the server were to have the following error in the next() function call from
 * that example, the response to the request would have it's status match the error
 * and the body be a JSON representation of the error.
 *
 * ```ts
 * import { HttpError } from "@udibo/http-error";
 *
 * throw new HttpError(400, "Invalid input");
 * ```
 *
 * Then the response would have a 400 status and it's body would look like this:
 *
 * ```json
 * {
 *   "error": {
 *     "name": "BadRequestError",
 *     "status": 400,
 *     "message": "Invalid input"
 *   }
 * }
 * ```
 *
 * @param T - The type of data associated with the error.
 * @param error - The error to convert.
 * @returns An ErrorResponse object.
 */
export class ErrorResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
> implements ErrorResponse<T> {
  error: HttpErrorOptions & T;

  constructor(error: unknown) {
    this.error = HttpError.json<T>(error);
  }

  /**
   * This function gives a client the ability to convert the error response into
   * an HttpError.
   *
   * The easiest way to convert an error response into an HttpError is to directly
   * pass the response to the `ErrorResponse.toError` function.
   *
   * In the following example, if getMovies is called and API endpoint returned an
   * ErrorResponse, it would be converted into an HttpError object and be thrown.
   *
   * ```ts
   * import { ErrorResponse, HttpError, isErrorResponse } from "@udibo/http-error";
   *
   * async function getMovies() {
   *   const response = await fetch("https://example.com/movies.json");
   *   if (!response.ok) throw new ErrorResponse.toError(response);
   *   return await response.json();
   * }
   * ```
   *
   * This function also supports converting error response JSON into an HttpError.
   * However, it is recommended to use the first approach in the previous example as
   * it will produce an HttpError based on the status code in the case that the
   * response doesn't have valid JSON.
   *
   * ```ts
   * import { ErrorResponse, HttpError, isErrorResponse } from "@udibo/http-error";
   *
   * async function getMovies() {
   *   const response = await fetch("https://example.com/movies.json");
   *   const movies = await response.json();
   *   if (isErrorResponse(movies)) throw new ErrorResponse.toError(movies);
   *   if (response.status >= 400) {
   *     throw new HttpError(response.status, "Invalid response");
   *   }
   *   return movies;
   * }
   * ```
   *
   * If the request returned the following error response, it would be converted into
   * an HttpError by the `ErrorResponse.toError(movies)` call.
   *
   * ```json
   * {
   *   "error": {
   *     "name": "BadRequestError",
   *     "status": 400,
   *     "message": "Invalid input"
   *   }
   * }
   * ```
   *
   * The error that `getMovies` would throw would be equivalent to throwing the
   * following HttpError.
   *
   * @param response - The error response to convert.
   * @returns An HttpError object.
   */
  static toError<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    response: ErrorResponse<T>,
  ): HttpError<T>;
  static toError<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    response: Response,
  ): Promise<HttpError<T>>;
  static toError<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    response: ErrorResponse<T> | Response,
  ): HttpError<T> | Promise<HttpError<T>> {
    if (isErrorResponse(response)) {
      return new HttpError(response.error);
    } else {
      return response.json().then((json) => {
        return isErrorResponse<T>(json)
          ? new HttpError(response.status, json.error)
          : new HttpError<T>(response.status, json.message);
      }).catch(() => {
        return new HttpError<T>(response.status);
      });
    }
  }
}

/**
 * This function gives you the ability to determine if an API's response body is in
 * the format of an ErrorResponse. It's useful for knowing when a response should
 * be converted into an HttpError.

 * In the following example, you can see that if the request's body is in the
 * format of an ErrorResponse, it will be converted into an HttpError and be
 * thrown. But if it isn't in that format and doesn't have an error status, the
 * response body will be returned as the assumed movies.

 * ```ts
 * import { HttpError, isErrorResponse } from "@udibo/http-error";

 * async function getMovies() {
 *   const response = await fetch("https://example.com/movies.json");
 *   const movies = await response.json();
 *   if (isErrorResponse(movies)) throw new ErrorResponse.toError(movies);
 *   if (response.status >= 400) {
 *     throw new HttpError(response.status, "Invalid response");
 *   }
 *   return movies;
 * }
 * ```
 */
export function isErrorResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
>(response: unknown): response is ErrorResponse<T> {
  return typeof response === "object" &&
    typeof (response as ErrorResponse<T>)?.error === "object";
}

import { STATUS_CODE, STATUS_TEXT, type StatusCode } from "@std/http/status";

/** Options for initializing an HttpError. */
export interface HttpErrorOptions<
  Extensions extends object = Record<string, unknown>,
> extends ErrorOptions {
  /** The name of the error. The default value is based on error status. This will be the default value for the `title` property in the response body. */
  name?: string;
  /** The message of the error. This will be the default value for the `detail` property in the response body. */
  message?: string;
  /** The HTTP status associated with the error. Defaults to 500. */
  status?: number;
  /** The HTTP status text associated with the error. */
  statusText?: string;
  /**
   * Determines if the error detail should be exposed in the response.
   * Defaults to true for client error statuses and false for server error statuses.
   */
  expose?: boolean;
  /**
   * The cause of the error. This is never exposed in the response.
   */
  cause?: unknown;
  /**
   * The type of the error is a URI reference that identifies the problem type.
   */
  type?: string;
  /**
   * The instance of the error is a URI reference that identifies the specific occurrence of the problem.
   */
  instance?: string;
  /**
   * Additional data to send in the response.
   */
  extensions?: Extensions;
  /**
   * The headers to send in the response. The content-type will default to application/problem+json unless otherwise specified in the headers.
   */
  headers?: Headers | Record<string, string>;
}

interface ProblemDetailsBase {
  type?: string;
  status?: number;
  title?: string;
  detail?: string;
  instance?: string;
}

export type ProblemDetails<
  Extensions extends object = Record<string, unknown>,
> = ProblemDetailsBase & Extensions;

function isProblemDetails<
  Extensions extends object = Record<string, unknown>,
>(value: unknown): value is ProblemDetails<Extensions> {
  return typeof value === "object" && value !== null && (
    "status" in value ||
    "title" in value ||
    "type" in value
  );
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
function optionsFromArgs<
  Extensions extends object = Record<string, unknown>,
>(
  statusOrMessageOrOptions?: number | string | (HttpErrorOptions<Extensions>),
  messageOrOptions?: string | (HttpErrorOptions<Extensions>),
  options?: HttpErrorOptions<Extensions>,
): HttpErrorOptions<Extensions> {
  let status: number | undefined = undefined;
  let message: string | undefined = undefined;
  let init: HttpErrorOptions<Extensions> | undefined = options;

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
    init = messageOrOptions as HttpErrorOptions<Extensions> | undefined;
    status = init?.status ?? status;
  } else if (typeof messageOrOptions === "string") {
    message = messageOrOptions;
  } else if (!init) {
    init = messageOrOptions ? messageOrOptions : statusOrMessageOrOptions;
    status = init?.status ?? status;
    message = init?.message;
  }

  return { ...init, status, message } as HttpErrorOptions<Extensions>;
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
 * The HttpError class also provides `toJSON()` and `getResponse()` methods to
 * convert errors into RFC 9457 Problem Details objects or Response objects,
 * respectively. This makes it easy to return standardized error responses from
 * your HTTP APIs.
 *
 * ```ts
 * import { HttpError } from "@udibo/http-error";
 *
 * const error = new HttpError(403, "Access denied", {
 *   type: "/errors/forbidden",
 *   instance: "/docs/123/edit",
 *   extensions: { accountId: "user-abc" },
 * });
 *
 * // Get Problem Details object
 * const problemDetails = error.toJSON();
 * console.log(problemDetails);
 * // Output:
 * // {
 * //   accountId: "user-abc",
 * //   status: 403,
 * //   title: "ForbiddenError",
 * //   detail: "Access denied",
 * //   type: "/errors/forbidden",
 * //   instance: "/docs/123/edit"
 * // }
 *
 * // Get a Response object
 * const response = error.getResponse();
 * console.log(response.status); // 403
 * response.json().then(body => console.log(body)); // Same as problemDetails
 * ```
 *
 * @typeparam Extensions - Other data associated with the error that will be included in the error response.
 * @param status - The HTTP status associated with the error.
 * @param message - The message associated with the error.
 * @param options - Other data associated with the error.
 * @returns An HttpError object.
 */
export class HttpError<
  Extensions extends object = Record<string, unknown>,
> extends Error {
  /**
   * The HTTP status associated with the error.
   * Must be a client or server error status. Defaults to 500.
   */
  status: number;
  /** The HTTP status text associated with the error. */
  statusText?: string;
  /**
   * Determines if the error detail should be exposed in the response.
   * Defaults to true for client error statuses and false for server error statuses.
   */
  expose?: boolean;
  /**
   * The type of the error is a URI reference that identifies the problem type.
   */
  type?: string;
  /**
   * The instance of the error is a URI reference that identifies the specific occurrence of the problem.
   */
  instance?: string;
  /**
   * Other data associated with the error that will be included in the error response.
   */
  extensions: Extensions;
  /**
   * The headers to send in the response. The content-type will default to application/problem+json unless otherwise specified in the headers.
   */
  headers: Headers;

  constructor(
    status?: number,
    message?: string,
    options?: HttpErrorOptions<Extensions>,
  );
  constructor(status?: number, options?: HttpErrorOptions<Extensions>);
  constructor(message?: string, options?: HttpErrorOptions<Extensions>);
  constructor(options?: HttpErrorOptions<Extensions>);
  constructor(
    statusOrMessageOrOptions?: number | string | HttpErrorOptions<Extensions>,
    messageOrOptions?: string | HttpErrorOptions<Extensions>,
    options?: HttpErrorOptions<Extensions>,
  ) {
    const init = optionsFromArgs(
      statusOrMessageOrOptions,
      messageOrOptions,
      options,
    );
    const {
      message,
      name,
      expose,
      status: _status,
      statusText,
      cause,
      type,
      instance,
      extensions,
      headers,
    } = init;
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
    if (statusText) this.statusText = statusText;
    if (type) this.type = type;
    if (instance) this.instance = instance;
    this.expose = expose ?? (status < 500);
    this.extensions = extensions ?? {} as Extensions;
    this.headers = headers instanceof Headers
      ? headers
      : new Headers(headers ?? {});
    if (!this.headers.has("content-type")) {
      this.headers.set("content-type", "application/problem+json");
    }
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
  static from<
    Extensions extends object = Record<string, unknown>,
  >(
    error: HttpError<Extensions> | ProblemDetails<Extensions>,
  ): HttpError<Extensions>;
  static from<
    Extensions extends object = Record<string, unknown>,
  >(
    error: Response,
  ): Promise<HttpError<Extensions>>;
  static from(
    error: Error,
  ): HttpError;
  static from<
    Extensions extends object = Record<string, unknown>,
  >(
    error: unknown,
  ): HttpError<Extensions>;
  static from<
    Extensions extends object = Record<string, unknown>,
  >(
    error:
      | HttpError<Extensions>
      | Error
      | ProblemDetails<Extensions>
      | Response
      | unknown,
  ): HttpError<Extensions> | Promise<HttpError<Extensions>> {
    if (error instanceof HttpError) {
      return error;
    } else if (isHttpErrorLike(error)) {
      const {
        name,
        message,
        status,
        expose,
        cause,
        type,
        instance,
        extensions,
        headers,
      } = error as HttpError<Extensions>;
      const options = {
        name,
        message,
        status,
        expose,
        cause,
        type,
        instance,
        extensions,
        headers,
      } as HttpErrorOptions<Extensions>;
      return new HttpError<Extensions>(options);
    } else if (error instanceof Error) {
      return new HttpError(500, error.message, {
        cause: error,
      }) as unknown as HttpError<Extensions>;
    } else if (error instanceof Response) {
      return error.json()
        .then((json: unknown) => {
          if (!isProblemDetails<Extensions>(json)) {
            return new HttpError<Extensions>(
              500,
              "invalid problem details response",
              {
                cause: json,
              },
            );
          }
          const { status, title, detail, type, instance, ...extensions } = json;
          const options: HttpErrorOptions<Extensions> = {
            status: status || error.status,
            name: title,
            message: detail,
            type,
            instance,
            extensions: extensions as Extensions,
          };
          return new HttpError(options);
        })
        .catch((parseError: unknown) => {
          return new HttpError<Extensions>(
            500,
            "could not parse problem details response",
            { cause: parseError },
          );
        });
    } else if (isProblemDetails(error)) {
      const { status, title, detail, type, instance, ...extensions } = error;
      const options: HttpErrorOptions<Extensions> = {
        status,
        name: title,
        message: detail,
        type,
        instance,
        extensions: extensions as Extensions,
      };
      return new HttpError(options);
    } else {
      return new HttpError<Extensions>(500, "unexpected error type", {
        cause: error,
      });
    }
  }

  /**
   * Converts the HttpError to a ProblemDetails object that matches the RFC 9457
   * Problem Details for HTTP APIs specification. This object is suitable for
   * direct serialization into a JSON response body.
   *
   * @returns A ProblemDetails object representing the error, compliant with RFC 9457.
   */
  toJSON(): ProblemDetails<Extensions> {
    const json: ProblemDetails<Extensions> = {
      ...this.extensions,
      status: this.status,
      title: this.name,
    };
    if (this.expose && this.message) {
      json.detail = this.message;
    }
    if (this.type) {
      json.type = this.type;
    }
    if (this.instance) {
      json.instance = this.instance;
    }
    return json;
  }

  /**
   * Converts the HttpError to a Response object that matches the RFC 9457
   * Problem Details for HTTP APIs specification. The body of the response will
   * be a JSON string representing the ProblemDetails object.
   *
   * @returns A Response object suitable for returning from an HTTP handler, compliant with RFC 9457.
   */
  getResponse(): Response {
    const options: ResponseInit = {
      status: this.status,
      headers: this.headers,
    };
    if (this.statusText) options.statusText = this.statusText;
    return new Response(JSON.stringify(this.toJSON()), options);
  }
}

/**
 * This function can be used to determine if a value is an HttpError object. It
 * will also return true for Error objects that have a `status` property of type number.
 *
 * ```ts
 * import { HttpError, isHttpErrorLike } from "@udibo/http-error";
 *
 * let error = new Error("file not found");
 * console.log(isHttpErrorLike(error)); // false
 * error = new HttpError(404, "file not found");
 * console.log(isHttpErrorLike(error)); // true
 * ```
 *
 * @param value - The value to check.
 * @returns True if the value is an HttpError.
 */
function isHttpErrorLike<
  Extensions extends object = Record<string, unknown>,
>(value: unknown): value is HttpError<Extensions> | Error {
  return typeof value === "object" && value !== null &&
    (value instanceof HttpError ||
      (value instanceof Error &&
        typeof (value as HttpError).status === "number"));
}

/**
 * Creates a new class that extends HttpError, allowing for predefined default
 * options and a specific default type for extensions.
 *
 * This factory is useful for creating custom HttpError types tailored to specific
 * kinds of errors in an application, each with its own default status, name,
 * or custom extension fields.
 *
 * @example
 * ```ts
 * // Define a type for default extensions
 * interface MyApiErrorExtensions {
 *   errorCode: string;
 *   requestId?: string;
 * }
 *
 * // Create a custom error class with defaults
 * const MyApiError = createHttpErrorClass<MyApiErrorExtensions>({
 *   name: "MyApiError",
 *   status: 452, // Custom default status
 *   extensions: {
 *     errorCode: "API_GENERAL_FAILURE", // Default extension value
 *   },
 * });
 *
 * // Usage of the custom error class
 * try {
 *   // Simulate an error condition
 *   throw new MyApiError("A specific API operation failed.", {
 *     extensions: {
 *       errorCode: "API_OPERATION_X_FAILED", // Override default extension
 *       requestId: "req-12345", // Add instance-specific extension
 *     },
 *   });
 * } catch (e) {
 *   if (e instanceof MyApiError) {
 *     console.log(e.name);        // "MyApiError"
 *     console.log(e.status);      // 452
 *     console.log(e.message);     // "A specific API operation failed."
 *     console.log(e.extensions.errorCode); // "API_OPERATION_X_FAILED"
 *     console.log(e.extensions.requestId); // "req-12345"
 *     // console.log(e.toJSON());
 *   }
 * }
 *
 * // Example with a different status code at instantiation
 * const anotherError = new MyApiError(453, "Another failure");
 * console.log(anotherError.status) // 453
 * console.log(anotherError.extensions.errorCode) // "API_GENERAL_FAILURE"
 * ```
 *
 * @typeparam DefaultExtensions The type for the default `extensions` object. Defaults to `Record<string, unknown>`.
 * @param defaultOptionsForClass Optional default HttpErrorOptions to apply to the new error class.
 * @returns A new class that extends `HttpError`.
 */
export function createHttpErrorClass<
  DefaultExtensions extends object = Record<string, unknown>,
>(
  defaultOptionsForClass?: HttpErrorOptions<DefaultExtensions>,
): {
  new <Extensions extends DefaultExtensions = DefaultExtensions>(
    status?: number,
    message?: string,
    options?: HttpErrorOptions<Extensions>,
  ): HttpError<Extensions>;
  new <Extensions extends DefaultExtensions = DefaultExtensions>(
    status?: number,
    options?: HttpErrorOptions<Extensions>,
  ): HttpError<Extensions>;
  new <Extensions extends DefaultExtensions = DefaultExtensions>(
    message?: string,
    options?: HttpErrorOptions<Extensions>,
  ): HttpError<Extensions>;
  new <Extensions extends DefaultExtensions = DefaultExtensions>(
    options?: HttpErrorOptions<Extensions>,
  ): HttpError<Extensions>;
  prototype: HttpError<DefaultExtensions>;
} {
  return class CustomHttpError<
    Extensions extends DefaultExtensions = DefaultExtensions,
  > extends HttpError<Extensions> {
    constructor(
      status?: number,
      message?: string,
      options?: HttpErrorOptions<Extensions>,
    );
    constructor(status?: number, options?: HttpErrorOptions<Extensions>);
    constructor(message?: string, options?: HttpErrorOptions<Extensions>);
    constructor(options?: HttpErrorOptions<Extensions>);
    constructor(
      statusOrMessageOrOptions?: number | string | HttpErrorOptions<Extensions>,
      messageOrOptions?: string | HttpErrorOptions<Extensions>,
      optionsArgument?: HttpErrorOptions<Extensions>,
    ) {
      const constructorTimeOptions = optionsFromArgs<Extensions>(
        statusOrMessageOrOptions,
        messageOrOptions,
        optionsArgument,
      );

      const dfo = defaultOptionsForClass;

      const finalOptions: HttpErrorOptions<Extensions> = {};

      finalOptions.status = constructorTimeOptions.status !== undefined
        ? constructorTimeOptions.status
        : dfo?.status;

      finalOptions.message = constructorTimeOptions.message !== undefined
        ? constructorTimeOptions.message
        : dfo?.message;

      finalOptions.name = constructorTimeOptions.name !== undefined
        ? constructorTimeOptions.name
        : dfo?.name;

      finalOptions.expose = constructorTimeOptions.expose !== undefined
        ? constructorTimeOptions.expose
        : dfo?.expose;

      finalOptions.cause = constructorTimeOptions.cause !== undefined
        ? constructorTimeOptions.cause
        : dfo?.cause;

      finalOptions.type = constructorTimeOptions.type !== undefined
        ? constructorTimeOptions.type
        : dfo?.type;

      finalOptions.instance = constructorTimeOptions.instance !== undefined
        ? constructorTimeOptions.instance
        : dfo?.instance;

      finalOptions.headers = constructorTimeOptions.headers !== undefined
        ? constructorTimeOptions.headers
        : dfo?.headers;

      finalOptions.statusText = constructorTimeOptions.statusText !== undefined
        ? constructorTimeOptions.statusText
        : dfo?.statusText;

      finalOptions.extensions = {
        ...(dfo?.extensions),
        ...(constructorTimeOptions.extensions),
      } as Extensions;

      super(finalOptions);
    }
  };
}

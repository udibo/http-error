import { Status, STATUS_TEXT } from "./deps.ts";

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
   * Other data associated with the error.
   */
  [key: string]: unknown;
}

/**
 * Converts HttpError arguments to an options object.
 * Prioritizing status and message arguments over status and message options.
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
  if (STATUS_TEXT[status as Status]) {
    name = status === Status.Teapot
      ? "Teapot"
      : STATUS_TEXT[status as Status]!.replace(/\W/g, "");
    if (status !== Status.InternalServerError) name += "Error";
  } else {
    name = `Unknown${status < 500 ? "Client" : "Server"}Error`;
  }
  return name;
}

/** An error for an HTTP request. */
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
    const status = init.status ?? Status.InternalServerError;

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
   */
  static from<T extends Record<string, unknown> = Record<string, unknown>>(
    error: HttpError<T> | Error | unknown,
  ): HttpError<T> {
    if (error instanceof HttpError) {
      return error;
    } else if (isHttpError(error)) {
      const { name, message, status, expose, cause, data } = error;
      const options = {
        ...(data),
        name,
        message,
        status,
        expose,
        cause,
      } as HttpErrorOptions & T;
      return new HttpError<T>(options);
    } else {
      return new HttpError(500, { cause: error }) as unknown as HttpError<T>;
    }
  }

  /**
   * Converts an HttpError to an options object that can be used to re-create it.
   * The message will only be included if the error should be exposed.
   *
   * ```ts
   * const error = new HttpError(400, "Invalid id");
   * const options = HttpError.json(error);
   * const copy = new HttpError(options);
   * ```
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

/** Checks if the value as an HttpError. */
export function isHttpError(value: unknown): value is HttpError {
  return !!value && typeof value === "object" &&
    (value instanceof HttpError ||
      (value instanceof Error &&
        typeof (value as HttpError).status === "number"));
}

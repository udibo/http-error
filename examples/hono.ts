import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpError } from "@udibo/http-error";

const app = new Hono();

app.use(async (context, next) => {
  const { req } = context;
  console.log(req.method, req.path);
  await next();
});

app.get("/error", () => {
  throw new Error("This is an example of a plain Error");
});

app.get("/hono-error", () => {
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

app.onError((cause) => {
  // Converts non HttpError instances to HttpError instances
  const error = HttpError.from(cause);
  console.error(error);
  return error.getResponse();
});

Deno.serve(app.fetch);

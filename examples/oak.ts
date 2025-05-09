import { Application, Router } from "@oak/oak";
import { HttpError } from "@udibo/http-error";

const router = new Router();

router.get("/error", () => {
  throw new Error("This is an example of a plain Error");
});

router.get("/http-error", () => {
  throw new HttpError(400, "This is an example of an HttpError", {
    type: "/errors/http-error",
    instance: "/errors/http-error/instance/123",
    extensions: {
      customField: "customValue",
    },
  });
});

router.get("/oak-error", (context) => {
  context.throw(400, "This is an example of an error from oak");
});

const app = new Application();
app.use(async (context, next) => {
  const { request, response } = context;
  try {
    console.log(request.method, request.url.pathname);
    await next();
  } catch (cause) {
    // Converts non HttpError instances to HttpError instances
    const error = HttpError.from(cause);
    console.error(error);
    response.status = error.status;
    error.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.body = error.toJSON();
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", ({ port }) => {
  console.log(`Listening on http://localhost:${port}/`);
});

app.addEventListener("error", (event) => {
  console.error("event.error", event.error);
});

try {
  await app.listen({ port: 8000 });
} catch (error) {
  console.error(error);
}

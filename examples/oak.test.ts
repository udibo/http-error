import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import { mergeReadableStreams, TextLineStream } from "@std/streams";

describe("oak error handling", () => {
  let server: Deno.ChildProcess;

  beforeAll(async () => {
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        resolve(import.meta.dirname!, "./oak.ts"),
      ],
      stdout: "piped",
      stderr: "piped",
    });
    server = command.spawn();
    const stdout = mergeReadableStreams(server.stdout, server.stderr)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());

    for await (const line of stdout.values({ preventCancel: true })) {
      if (line.includes("Listening on") && line.includes(":8000")) {
        break;
      }
    }
  });

  afterAll(async () => {
    server.kill();
    await server.status;
  });

  it("plain error converted to http error response", async () => {
    const res = await fetch("http://localhost:8000/error");
    assertEquals(res.status, 500);
    assertEquals(res.headers.get("content-type"), "application/problem+json");
    assertEquals(await res.json(), {
      status: 500,
      title: "Internal Server Error",
      detail: "The server encountered an unexpected condition.",
    });
  });

  it("oak error converted to http error response", async () => {
    const res = await fetch("http://localhost:8000/oak-error");
    assertEquals(res.status, 400);
    assertEquals(res.headers.get("content-type"), "application/problem+json");
    assertEquals(await res.json(), {
      status: 400,
      title: "Bad Request",
      detail: "This is an example of an error from oak",
    });
  });

  it("http error response", async () => {
    const res = await fetch("http://localhost:8000/http-error");
    assertEquals(res.status, 400);
    assertEquals(res.headers.get("content-type"), "application/problem+json");
    assertEquals(await res.json(), {
      status: 400,
      title: "Bad Request",
      detail: "This is an example of an HttpError",
      type: "/errors/http-error",
      instance: "/errors/http-error/instance/123",
      customField: "customValue",
    });
  });
});

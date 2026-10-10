/**
 * Consumes the packed npm artifact the way an adopter would: packs the
 * package, installs the tarball into an empty project, type-checks a consumer
 * under NodeNext resolution, and runs it on Node.
 *
 * Run `pnpm build` first, then `pnpm smoke`.
 */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("../", import.meta.url));
const tscPath = join(packageDir, "node_modules", "typescript", "bin", "tsc");
const isWindows = process.platform === "win32";

function fail(message: string): never {
  console.error(`npm smoke: ${message}`);
  process.exit(1);
}

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: isWindows && command !== process.execPath,
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, npm_config_ignore_scripts: "true" },
  });
}

function main(): void {
  const workDir = mkdtempSync(join(tmpdir(), "http-error-smoke-"));
  try {
    const packDir = join(workDir, "pack");
    const consumerDir = join(workDir, "consumer");
    mkdirSync(packDir);
    mkdirSync(consumerDir);

    run("pnpm", ["pack", "--pack-destination", packDir], packageDir);
    const tarballs = readdirTarballs(packDir);
    if (tarballs.length !== 1)
      fail(`expected one tarball, found ${tarballs.length}`);
    const tarball = join(packDir, tarballs[0]!);

    writeFileSync(
      join(consumerDir, "package.json"),
      JSON.stringify({
        name: "http-error-smoke-consumer",
        private: true,
        type: "module",
      }),
    );
    run(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--offline",
        tarball,
      ],
      consumerDir,
    );

    const installedDir = join(
      consumerDir,
      "node_modules",
      "@udibo",
      "http-error",
    );
    const listing = readdirSync(installedDir, { recursive: true })
      .map(String)
      .map((entry) => entry.replaceAll("\\", "/"));
    for (const required of [
      "dist/mod.js",
      "dist/mod.d.ts",
      "README.md",
      "LICENSE",
      "package.json",
    ]) {
      if (!listing.includes(required))
        fail(`the tarball is missing ${required}`);
    }
    const unexpected = listing.filter(
      (entry) => entry.includes(".test.") || entry.startsWith("src/"),
    );
    if (unexpected.length > 0)
      fail(`the tarball contains ${unexpected.join(", ")}`);

    const installed = JSON.parse(
      readFileSync(join(installedDir, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    if (
      installed.dependencies &&
      Object.keys(installed.dependencies).length > 0
    ) {
      fail("the package must have no runtime dependencies");
    }

    writeFileSync(
      join(consumerDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2023", "DOM"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          types: [],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        include: ["main.ts"],
      }),
    );
    writeFileSync(join(consumerDir, "main.ts"), CONSUMER_SOURCE);
    run(process.execPath, [tscPath, "-p", "."], consumerDir);

    const output = run(process.execPath, ["main.ts"], consumerDir);
    if (!output.includes("npm smoke consumer ok"))
      fail(`unexpected output: ${output}`);
    console.log(
      `npm smoke: ${tarballs[0]} type-checked and ran on Node ${process.version}`,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function readdirTarballs(directory: string): string[] {
  return readdirSync(directory).filter((name) => name.endsWith(".tgz"));
}

const CONSUMER_SOURCE = `import {
  createHttpErrorClass,
  HttpError,
  isHttpErrorLike,
  type HttpErrorOptions,
  type ProblemDetails,
} from "@udibo/http-error";

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error("expected " + String(expected) + ", received " + String(actual));
  }
}

function ok(value: unknown): void {
  if (!value) throw new Error("expected a truthy value");
}

const options: HttpErrorOptions<{ field: string }> = { extensions: { field: "email" } };
const error = new HttpError(422, "bad field", options);
const details: ProblemDetails<{ field: string }> = error.toJSON();
equal(details.status, 422);
equal(details.title, "Unprocessable Entity");
equal(details.field, "email");
ok(isHttpErrorLike(error));

const NotFound = createHttpErrorClass({ status: 404, name: "MissingError" });
const missing = new NotFound("gone");
ok(missing instanceof HttpError);
equal(missing.name, "MissingError");

const response = error.getResponse();
equal(response.status, 422);
equal(response.headers.get("content-type"), "application/problem+json");
const roundTripped = await HttpError.from(response);
equal(roundTripped.message, "bad field");

console.log("npm smoke consumer ok");
`;

main();

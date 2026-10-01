// Dev-only Node ESM loader for the Phase 20 purchase-flow probe.
//
// Solves exactly two runtime gaps so the probe can exercise the REAL
// production modules in-process (same functions the routes/actions call),
// without touching a single production file or adding a dependency:
//
//   1. The `@/` path alias (tsconfig paths) is not understood by bare Node.
//      -> rewritten to a real relative path under ./src.
//
//   2. `import "server-only"` resolves to a module that THROWS outside a
//      React-server context (see node_modules/next/dist/compiled/server-only).
//      Inside the Next server runtime that guard is inert; in a plain node
//      process we resolve it to Next's own empty react-server shim so the
//      guard is satisfied exactly as it is in production.
//
// This file is tooling for `scripts/verify-purchase-flow.mjs` only. It never
// runs in the app, never ships to the client, and changes no behavior.

import { pathToFileURL } from "node:url";
import { resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";

const ROOT = pathResolve(fileURLToPath(import.meta.url), "..", "..");

const SERVER_ONLY_EMPTY = pathResolve(
  ROOT,
  "node_modules/next/dist/compiled/server-only/empty.js"
);

// Mirrors tsconfig's "allowImportingTsExtensions" world: a bare alias target
// may be `foo.ts`, `foo.js`, or a directory holding `index.ts`. Applies to
// `@/`-aliased specifiers AND to extensionless relative specifiers (`./sms`),
// which the app's bundler resolves but bare Node does not.
const EXTENSIONS = [".ts", ".js", ".mjs", ".cjs"];

function resolveAliasedTarget(target) {
  if (existsSync(target) && statSync(target).isFile()) return target;
  for (const ext of EXTENSIONS) {
    if (existsSync(`${target}${ext}`)) return `${target}${ext}`;
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const index = pathResolve(target, `index${ext}`);
      if (existsSync(index)) return index;
    }
  }
  return null;
}

function hasExtension(specifier) {
  const base = specifier.split("/").pop() ?? "";
  return base.includes(".");
}

export function resolve(specifier, context, nextResolve) {
  // (2) Neutralise the `server-only` guard the same way the Next server
  //     runtime does — point it at the empty shim.
  if (specifier === "server-only") {
    return {
      url: pathToFileURL(SERVER_ONLY_EMPTY).href,
      shortCircuit: true,
    };
  }

  // (1) Rewrite the `@/` alias (everything after the alias is a real path).
  if (specifier.startsWith("@/")) {
    const target = resolveAliasedTarget(pathResolve(ROOT, "src", specifier.slice(2)));
    if (target) {
      return {
        url: pathToFileURL(target).href,
        shortCircuit: true,
      };
    }
  }

  // (3) Extensionless RELATIVE specifiers — resolve like a bundler would.
  //     (Package specifiers such as `@prisma/client` and `next/headers`
  //      do not start with `./` or `../` and fall through untouched.)
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !hasExtension(specifier) &&
    context.parentURL
  ) {
    const dir = pathResolve(fileURLToPath(context.parentURL), "..");
    const target = resolveAliasedTarget(pathResolve(dir, specifier));
    if (target) {
      return {
        url: pathToFileURL(target).href,
        shortCircuit: true,
      };
    }
  }

  // (4) `next/*` subpath imports. The `next` package ships no exports map,
  //     so bare Node legacy-resolution needs the real file name
  //     (`next/headers` → `next/headers.js`) that the bundler would find.
  if (specifier.startsWith("next/") && !hasExtension(specifier)) {
    const target = resolveAliasedTarget(pathResolve(ROOT, "node_modules", specifier));
    if (target) {
      return {
        url: pathToFileURL(target).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}

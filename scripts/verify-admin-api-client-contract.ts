import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api } from "../apps/admin/src/admin-api-client.js";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-api-client.ts");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

const calls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function installFetch(responseFactory: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return responseFactory(input, init);
  }) as typeof fetch;
}

async function capturesErrorMessage(action: () => Promise<unknown>) {
  try {
    await action();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

try {
  installFetch(() => Response.json({ success: true, data: { ok: 1 } }));
  const successPayload = await api<{ ok: number }>("/api/admin/summary", { method: "POST" });

  installFetch(() => Response.json({ success: false, error: "NO_ACCESS" }, { status: 200 }));
  const successFalseError = await capturesErrorMessage(() => api("/api/admin/summary"));

  installFetch(() => Response.json({ ok: false, error: "UPSTREAM_FAIL" }, { status: 200 }));
  const okFalseError = await capturesErrorMessage(() => api("/api/admin/summary"));

  installFetch(() => Response.json({ error: "BAD_REQUEST" }, { status: 400 }));
  const httpError = await capturesErrorMessage(() => api("/api/admin/summary"));

  installFetch(() => new Response(null, { status: 204 }));
  const emptyPayload = await api<Record<string, unknown>>("/api/admin/empty");

  const checks = [
    {
      name: "admin api client module exists",
      pass: existsSync(modulePath),
    },
    {
      name: "main imports admin api client",
      pass: mainSource.includes('from "./admin-api-client"') || mainSource.includes('from "./admin-api-client.js"'),
    },
    {
      name: "main no longer inlines api helper",
      pass: !/async\s+function\s+api\s*</.test(mainSource),
    },
    {
      name: "api returns payload data and sends same-origin credentials",
      pass:
        successPayload.ok === 1 &&
        calls[0]?.input === "/api/admin/empty" &&
        calls[0]?.init?.credentials === "same-origin",
    },
    {
      name: "api throws payload error for success false",
      pass: successFalseError === "NO_ACCESS",
    },
    {
      name: "api throws payload error for ok false",
      pass: okFalseError === "UPSTREAM_FAIL",
    },
    {
      name: "api throws payload error for http failure",
      pass: httpError === "BAD_REQUEST",
    },
    {
      name: "api returns undefined data for empty successful response",
      pass: emptyPayload === undefined,
    },
  ];

  const failed = checks.filter((check) => !check.pass);

  if (failed.length) {
    console.error("Admin API client contract verification failed:");
    for (const check of failed) {
      console.error(`- ${check.name}`);
    }
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}

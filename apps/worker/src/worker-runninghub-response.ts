interface RunningHubPollParseFailure extends Record<string, unknown> {
  failureCategory: "upstream_poll_gateway_failed";
  providerDiagnostic: string;
  upstreamHttpStatus: number;
  upstreamResponseSnippet: string;
}

type RunningHubPollParseResult =
  | { ok: true; raw: Record<string, unknown> }
  | {
      ok: false;
      errorMessage: string;
      resultPatch: RunningHubPollParseFailure;
    };

const INVALID_RUNNINGHUB_POLL_JSON_MESSAGE = "RunningHub 轮询返回非法 JSON";

export function parseRunningHubPollJsonResponse(
  responseText: string,
  status: number,
): RunningHubPollParseResult {
  const snippet = responseText.slice(0, 500);
  if (!responseText.trim()) {
    return buildInvalidPollJsonFailure(status, snippet);
  }
  try {
    const raw = JSON.parse(responseText);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return buildInvalidPollJsonFailure(status, snippet);
    }
    return {
      ok: true,
      raw: raw as Record<string, unknown>,
    };
  } catch {
    return buildInvalidPollJsonFailure(status, snippet);
  }
}

function buildInvalidPollJsonFailure(
  status: number,
  snippet: string,
): RunningHubPollParseResult {
  return {
    ok: false,
    errorMessage: INVALID_RUNNINGHUB_POLL_JSON_MESSAGE,
    resultPatch: {
      failureCategory: "upstream_poll_gateway_failed",
      providerDiagnostic: INVALID_RUNNINGHUB_POLL_JSON_MESSAGE,
      upstreamHttpStatus: status,
      upstreamResponseSnippet: snippet,
    },
  };
}

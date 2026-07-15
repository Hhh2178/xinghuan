const baseUrl = String(process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200").replace(/\/$/, "");
const requestOrigin = new URL(baseUrl).origin;
const adminEmail = String(process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "").trim();
const testAccountOverride = process.argv.includes("--test-account-override");
const expectedModelMinimum = numberArgument("min-models", 1);
const expectedRhMinimum = numberArgument("min-rh", 1);
const expectedResourceMinimum = numberArgument("min-resources", 1);

if (!adminEmail || !adminPassword) throw new Error("ADMIN_VERIFY_CREDENTIALS_NOT_CONFIGURED");

const adminSession = await login(adminEmail, adminPassword);
const users = await requestJson("/api/admin/users", {}, adminSession.cookie);
const members = Array.isArray(users.data)
  ? users.data.filter((user) => user?.role === "member" && !user?.disabled && user?.email && user?.password)
  : [];
const ungrouped = members.find((user) => !user.groupId);
const grouped = members.find((user) => Boolean(user.groupId));
if (!ungrouped || !grouped) throw new Error("MEMBER_ACCEPTANCE_PRINCIPALS_NOT_AVAILABLE");

const scenarios = [
  await verifyMember("ungrouped", ungrouped),
  await verifyMember("grouped", grouped),
];
let accountOverride = null;
if (testAccountOverride) {
  accountOverride = await verifyAccountOverride(grouped, adminSession.cookie);
}

const failures = scenarios.flatMap((scenario) => scenario.failures);
if (accountOverride && !accountOverride.ok) failures.push("account-override");
console.log(JSON.stringify({
  ok: failures.length === 0,
  environment: "gray-member-catalog",
  scenarios,
  accountOverride,
  failures,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;

async function verifyMember(label, user) {
  const session = await login(user.email, user.password);
  const [models, rh, resources, permissions] = await Promise.all([
    requestJson("/api/models", {}, session.cookie),
    requestJson("/api/runninghub/catalog", {}, session.cookie),
    requestJson("/api/shared-resources/items", {}, session.cookie),
    requestJson("/api/me/permissions", {}, session.cookie),
  ]);
  const counts = {
    models: Array.isArray(models.data?.all) ? models.data.all.length : 0,
    imageModels: Array.isArray(models.data?.imageModels) ? models.data.imageModels.length : 0,
    videoModels: Array.isArray(models.data?.videoModels) ? models.data.videoModels.length : 0,
    rh: Array.isArray(rh.data?.items) ? rh.data.items.length : 0,
    resources: Array.isArray(resources.data) ? resources.data.length : 0,
    deniedNodeTypes: Array.isArray(permissions.data?.deny?.nodeTypes) ? permissions.data.deny.nodeTypes.length : 0,
  };
  const failures = [];
  if (counts.models < expectedModelMinimum) failures.push(`${label}:models`);
  if (counts.imageModels < 1) failures.push(`${label}:image-models`);
  if (counts.videoModels < 1) failures.push(`${label}:video-models`);
  if (counts.rh < expectedRhMinimum) failures.push(`${label}:rh`);
  if (counts.resources < expectedResourceMinimum) failures.push(`${label}:resources`);
  return {
    label,
    groupState: user.groupId ? "named" : "ungrouped",
    counts,
    failures,
  };
}

async function verifyAccountOverride(user, adminCookie) {
  const state = await requestJson("/api/admin/permission-subjects", {}, adminCookie);
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  const rules = Array.isArray(state.data?.rules) ? state.data.rules : [];
  const modelSubject = subjects.find((subject) => (
    subject.domain === "provider" &&
    subject.subjectType === "model" &&
    subject.exposureState === "published" &&
    rules.some((rule) => rule.principalType === "group" && rule.principalId === user.groupId && rule.subjectKey === subject.subjectKey && rule.action === "view" && rule.effect === "allow") &&
    !rules.some((rule) => rule.principalType === "user" && rule.principalId === user.id && rule.subjectKey === subject.subjectKey && rule.action === "view")
  ));
  if (!modelSubject) return { ok: false, reason: "NO_SAFE_MODEL_SUBJECT" };

  const memberSession = await login(user.email, user.password);
  const before = await requestJson("/api/models", {}, memberSession.cookie);
  const beforeIds = modelIds(before);
  const modelRecordId = String(modelSubject.subjectKey).slice("provider.model/".length);
  if (!beforeIds.has(modelRecordId)) return { ok: false, reason: "MODEL_NOT_VISIBLE_BEFORE_OVERRIDE" };
  const groupRule = rules.find((rule) => rule.principalType === "group" && rule.principalId === user.groupId && rule.subjectKey === modelSubject.subjectKey && rule.action === "view");
  if (!groupRule) return { ok: false, reason: "GROUP_ALLOW_RULE_NOT_AVAILABLE" };

  let accountRule = null;
  let denyOverAllow = false;
  try {
    accountRule = await upsertRule(adminCookie, {
      principalType: "user",
      principalId: user.id,
      subjectKey: modelSubject.subjectKey,
      action: "view",
      effect: "deny",
      reason: "灰度账号 deny 覆盖组 allow 验收",
    });
    const after = await requestJson("/api/models", {}, memberSession.cookie);
    const afterIds = modelIds(after);
    denyOverAllow = !afterIds.has(modelRecordId) && afterIds.size === Math.max(0, beforeIds.size - 1);
  } finally {
    if (accountRule?.id) await deleteRule(adminCookie, accountRule, "灰度账号 deny 覆盖验收回滚");
  }

  const restoredAfterDeny = modelIds(await requestJson("/api/models", {}, memberSession.cookie)).has(modelRecordId);
  let deniedGroupRule = null;
  let allowRule = null;
  let allowOverDeny = false;
  let groupDenyWithoutOverride = false;
  let operationError = null;
  let cleanupError = null;
  try {
    deniedGroupRule = await upsertRule(adminCookie, {
      principalType: "group",
      principalId: user.groupId,
      subjectKey: modelSubject.subjectKey,
      action: "view",
      effect: "deny",
      reason: "灰度账号 allow 覆盖组 deny 验收",
      revision: groupRule.revision,
    });
    allowRule = await upsertRule(adminCookie, {
      principalType: "user",
      principalId: user.id,
      subjectKey: modelSubject.subjectKey,
      action: "view",
      effect: "allow",
      reason: "灰度账号 allow 覆盖组 deny 验收",
    });
    allowOverDeny = modelIds(await requestJson("/api/models", {}, memberSession.cookie)).has(modelRecordId);
    await deleteRule(adminCookie, allowRule, "灰度账号 allow 覆盖验收回滚");
    allowRule = null;
    groupDenyWithoutOverride = !modelIds(await requestJson("/api/models", {}, memberSession.cookie)).has(modelRecordId);
  } catch (error) {
    operationError = error;
  } finally {
    if (allowRule?.id) {
      try {
        await deleteRule(adminCookie, allowRule, "灰度账号 allow 覆盖异常回滚");
      } catch (error) {
        cleanupError = error;
      }
    }
    if (deniedGroupRule?.id) {
      try {
        await upsertRule(adminCookie, {
          principalType: "group",
          principalId: user.groupId,
          subjectKey: modelSubject.subjectKey,
          action: "view",
          effect: groupRule.effect,
          reason: "灰度组权限基线回滚",
          revision: deniedGroupRule.revision,
        });
      } catch (error) {
        cleanupError ||= error;
      }
    }
  }
  if (operationError || cleanupError) {
    throw new AggregateError(
      [operationError, cleanupError].filter(Boolean),
      "ACCOUNT_OVERRIDE_VERIFY_OR_ROLLBACK_FAILED",
    );
  }

  const restoredAfterAllow = modelIds(await requestJson("/api/models", {}, memberSession.cookie)).has(modelRecordId);
  return {
    ok: denyOverAllow && restoredAfterDeny && allowOverDeny && groupDenyWithoutOverride && restoredAfterAllow,
    denyOverAllow,
    allowOverDeny,
    groupDenyWithoutOverride,
    restoredAfterDeny,
    restoredAfterAllow,
    beforeCount: beforeIds.size,
  };
}

async function upsertRule(adminCookie, input) {
  const response = await requestJson("/api/admin/permission-rules", {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify(input),
  }, adminCookie);
  return response.data;
}

async function deleteRule(adminCookie, rule, reason) {
  await requestJson(`/api/admin/permission-rules/${encodeURIComponent(rule.id)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ revision: rule.revision, reason }),
  }, adminCookie);
}

function modelIds(response) {
  return new Set((response.data?.all || []).map((model) => model.id));
}

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.data?.authenticated !== true) throw new Error(`LOGIN_FAILED:${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] || "";
  if (!cookie) throw new Error("LOGIN_COOKIE_MISSING");
  return { cookie };
}

async function requestJson(pathname, options = {}, cookie = "") {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { origin: requestOrigin, ...(options.headers || {}), ...(cookie ? { cookie } : {}) },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${pathname}:${response.status}:${payload?.error || "request failed"}`);
  return payload;
}

function numberArgument(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  const value = Number(match ? match.slice(prefix.length) : fallback);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

import assert from "node:assert/strict";
import {
  buildAdminUsageSummary,
  type AdminUsageTaskRecord,
} from "../apps/api/src/admin-usage-analytics.js";

const tasks: AdminUsageTaskRecord[] = [
  {
    id: "task-model-1",
    status: "succeeded",
    ownerId: "user-1",
    ownerEmail: "alice@example.com",
    ownerName: "Alice",
    ownerRemark: "核心测试账号",
    ownerGroupId: "group-a",
    ownerGroupName: "A组",
    providerId: "openai",
    providerName: "OpenAI",
    modelId: "gpt-4.1",
    modelRecordId: "model-gpt-41",
    modelDisplayName: "GPT 4.1",
    payload: { taskCapability: "chat" },
    result: {},
    createdAt: 1_000,
  },
  {
    id: "task-model-2",
    status: "succeeded",
    ownerId: "user-1",
    ownerEmail: "alice@example.com",
    ownerName: "Alice",
    ownerRemark: "核心测试账号",
    ownerGroupId: "group-a",
    ownerGroupName: "A组",
    providerId: "openai",
    providerName: "OpenAI",
    modelId: "gpt-4.1",
    modelRecordId: "model-gpt-41",
    modelDisplayName: "GPT 4.1",
    payload: { taskCapability: "chat" },
    result: {},
    createdAt: 2_000,
  },
  {
    id: "task-rh-1",
    status: "succeeded",
    ownerId: "user-1",
    ownerEmail: "alice@example.com",
    ownerName: "Alice",
    ownerRemark: "核心测试账号",
    ownerGroupId: "group-a",
    ownerGroupName: "A组",
    providerId: "runninghub",
    providerName: "RunningHub",
    payload: {
      protocol: "runninghub",
      targetType: "workflow",
      rhCatalogId: "rh-flow-1",
      rhCatalogTitle: "批量生图工作流",
      workflowId: "run-target-1",
    },
    result: {},
    createdAt: 3_000,
  },
  {
    id: "task-other-user",
    status: "succeeded",
    ownerId: "user-2",
    ownerEmail: "bob@example.com",
    ownerName: "Bob",
    ownerGroupId: "group-b",
    ownerGroupName: "B组",
    providerId: "openai",
    providerName: "OpenAI",
    modelId: "gpt-4o-mini",
    modelRecordId: "model-gpt-4o-mini",
    modelDisplayName: "GPT 4o mini",
    payload: { taskCapability: "chat" },
    result: {},
    createdAt: 4_000,
  },
];

const summary = buildAdminUsageSummary({
  tasks,
  filters: { from: 0, to: 9_999, userId: "user-1" },
  groupMemberCounts: new Map([
    ["group-a", 3],
    ["group-b", 2],
  ]),
  runningHubResolver: {
    byCatalogId: () => null,
    byTarget: () => null,
  },
});

assert.ok(summary.selectedUser, "usage summary should expose selectedUser details");
assert.equal(summary.totals.successful, 4);
assert.equal(summary.users.length, 2);
assert.equal(summary.selectedUser?.userId, "user-1");
assert.equal(summary.selectedUser?.email, "alice@example.com");
assert.equal(summary.selectedUser?.successful, 3);
assert.equal(summary.selectedUser?.lastSucceededAt, 3_000);
assert.equal(summary.selectedUser?.modelBreakdown.length, 1);
assert.equal(summary.selectedUser?.modelBreakdown[0]?.displayName, "GPT 4.1");
assert.equal(summary.selectedUser?.modelBreakdown[0]?.total, 2);
assert.equal(summary.selectedUser?.modelBreakdown[0]?.lastUsedAt, 2_000);
assert.equal(summary.selectedUser?.runningHubBreakdown.length, 1);
assert.equal(summary.selectedUser?.runningHubBreakdown[0]?.catalogId, "rh-flow-1");
assert.equal(summary.selectedUser?.runningHubBreakdown[0]?.total, 1);
assert.equal(summary.selectedUser?.runningHubBreakdown[0]?.lastUsedAt, 3_000);

console.log(JSON.stringify({ ok: true }, null, 2));

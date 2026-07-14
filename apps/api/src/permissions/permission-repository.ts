import type {
  PermissionAction,
  PermissionEffect,
  PermissionPrincipalType,
  PermissionRule,
  PermissionSubject,
} from "@xinghuan/shared";

export interface PermissionSubjectRecord extends Omit<
  PermissionSubject,
  "parentKeys"
> {
  parentKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PermissionRuleRecord extends PermissionRule {
  reason: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PermissionFallbackAuthDb {
  permissionSubjects?: PermissionSubjectRecord[];
  permissionRules?: PermissionRuleRecord[];
  [key: string]: unknown;
}

export interface PermissionRepositoryDeps {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<{
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[] }>;
  }>;
  readAuthDb?: () => Promise<PermissionFallbackAuthDb>;
  writeAuthDb?: (db: PermissionFallbackAuthDb) => Promise<void>;
  now: () => number;
}

export interface PermissionRuleInput extends PermissionRule {
  reason?: string;
  createdBy?: string;
}

export function createPermissionRepository(deps: PermissionRepositoryDeps) {
  return {
    listSubjects,
    upsertSubject,
    retireSubject,
    listRules,
    upsertRule,
    deleteRule,
    readAuthorizationState,
  };

  async function listSubjects(): Promise<PermissionSubject[]> {
    const records = deps.usePostgresRepository()
      ? await listSubjectRecordsPostgres()
      : readSubjectRecords(await readFileDb());
    return toPermissionSubjects(records);
  }

  async function upsertSubject(
    input: PermissionSubject,
  ): Promise<PermissionSubject> {
    const now = deps.now();
    const record: PermissionSubjectRecord = {
      subjectKey: input.subjectKey,
      domain: input.domain,
      subjectType: input.subjectType,
      parentKey: input.parentKeys[0] || undefined,
      sourceId: input.sourceId,
      exposureState: input.exposureState,
      displayName: input.displayName,
      metadata: plainObject(input.metadata),
      revision: positiveInteger(input.revision, 1),
      createdAt: now,
      updatedAt: now,
    };
    if (deps.usePostgresRepository()) {
      await upsertSubjectPostgres(record);
      return toPermissionSubjects([record])[0];
    }
    const db = await readFileDb();
    const existing = readSubjectRecords(db).find(
      (item) => item.subjectKey === record.subjectKey,
    );
    const next = { ...record, createdAt: existing?.createdAt || now };
    await writeFileDb({
      ...db,
      permissionSubjects: replaceByKey(
        readSubjectRecords(db),
        next,
        "subjectKey",
      ),
    });
    return toPermissionSubjects([next])[0];
  }

  async function retireSubject(subjectKey: string): Promise<void> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        "update xh_permission_subjects set exposure_state = 'retired', revision = revision + 1, updated_at = $2 where subject_key = $1",
        [subjectKey, new Date(deps.now())],
      );
      return;
    }
    const db = await readFileDb();
    const subjects = readSubjectRecords(db);
    if (!subjects.some((item) => item.subjectKey === subjectKey))
      throw new Error("PERMISSION_SUBJECT_NOT_FOUND");
    await writeFileDb({
      ...db,
      permissionSubjects: subjects.map((item) =>
        item.subjectKey === subjectKey
          ? {
              ...item,
              exposureState: "retired",
              revision: item.revision + 1,
              updatedAt: deps.now(),
            }
          : item,
      ),
    });
  }

  async function listRules(): Promise<PermissionRuleRecord[]> {
    if (!deps.usePostgresRepository())
      return readRuleRecords(await readFileDb());
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      "select id, principal_type, principal_id, subject_key, action, effect, reason, created_by, revision, created_at, updated_at from xh_permission_rules order by updated_at desc, id asc",
    );
    return result.rows.map(toPermissionRuleRecord);
  }

  async function upsertRule(
    input: PermissionRuleInput,
  ): Promise<PermissionRuleRecord> {
    const now = deps.now();
    const record: PermissionRuleRecord = {
      id: input.id,
      principalType: input.principalType,
      principalId: input.principalId,
      subjectKey: input.subjectKey,
      action: input.action,
      effect: input.effect,
      reason: input.reason || "",
      createdBy: input.createdBy || undefined,
      revision: positiveInteger(input.revision, 1),
      createdAt: now,
      updatedAt: now,
    };
    if (deps.usePostgresRepository()) {
      await upsertRulePostgres(record);
      return record;
    }
    const db = await readFileDb();
    const existing = readRuleRecords(db).find((item) =>
      sameRuleIdentity(item, record),
    );
    const next = {
      ...record,
      id: existing?.id || record.id,
      createdAt: existing?.createdAt || now,
    };
    await writeFileDb({
      ...db,
      permissionRules: replaceRule(readRuleRecords(db), next),
    });
    return next;
  }

  async function deleteRule(id: string): Promise<void> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query("delete from xh_permission_rules where id = $1", [id]);
      return;
    }
    const db = await readFileDb();
    await writeFileDb({
      ...db,
      permissionRules: readRuleRecords(db).filter((item) => item.id !== id),
    });
  }

  async function readAuthorizationState(): Promise<{
    subjects: PermissionSubject[];
    rules: PermissionRuleRecord[];
  }> {
    if (deps.usePostgresRepository()) {
      const [subjects, rules] = await Promise.all([
        listSubjects(),
        listRules(),
      ]);
      return { subjects, rules };
    }
    const db = await readFileDb();
    return {
      subjects: toPermissionSubjects(readSubjectRecords(db)),
      rules: readRuleRecords(db),
    };
  }

  async function listSubjectRecordsPostgres(): Promise<
    PermissionSubjectRecord[]
  > {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      "select subject_key, domain, subject_type, parent_key, source_id, exposure_state, display_name, metadata, revision, created_at, updated_at from xh_permission_subjects order by domain asc, subject_key asc",
    );
    return result.rows.map(toPermissionSubjectRecord);
  }

  async function upsertSubjectPostgres(
    record: PermissionSubjectRecord,
  ): Promise<void> {
    const pool = await deps.getPostgresPool();
    await pool.query(
      `insert into xh_permission_subjects (subject_key, domain, subject_type, parent_key, source_id, exposure_state, display_name, metadata, revision, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
       on conflict (subject_key) do update set
         domain = excluded.domain, subject_type = excluded.subject_type, parent_key = excluded.parent_key, source_id = excluded.source_id,
         exposure_state = excluded.exposure_state, display_name = excluded.display_name, metadata = excluded.metadata,
         revision = excluded.revision, updated_at = excluded.updated_at`,
      [
        record.subjectKey,
        record.domain,
        record.subjectType,
        record.parentKey || null,
        record.sourceId,
        record.exposureState,
        record.displayName,
        JSON.stringify(record.metadata),
        record.revision,
        new Date(record.createdAt),
        new Date(record.updatedAt),
      ],
    );
  }

  async function upsertRulePostgres(
    record: PermissionRuleRecord,
  ): Promise<void> {
    const pool = await deps.getPostgresPool();
    await pool.query(
      `insert into xh_permission_rules (id, principal_type, principal_id, subject_key, action, effect, reason, created_by, revision, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (principal_type, principal_id, subject_key, action) do update set
         effect = excluded.effect, reason = excluded.reason, created_by = excluded.created_by,
         revision = excluded.revision, updated_at = excluded.updated_at`,
      [
        record.id,
        record.principalType,
        record.principalId,
        record.subjectKey,
        record.action,
        record.effect,
        record.reason,
        record.createdBy || null,
        record.revision,
        new Date(record.createdAt),
        new Date(record.updatedAt),
      ],
    );
  }

  async function readFileDb(): Promise<PermissionFallbackAuthDb> {
    if (!deps.readAuthDb)
      throw new Error("PERMISSION_FILE_REPOSITORY_NOT_CONFIGURED");
    return deps.readAuthDb();
  }

  async function writeFileDb(db: PermissionFallbackAuthDb): Promise<void> {
    if (!deps.writeAuthDb)
      throw new Error("PERMISSION_FILE_REPOSITORY_NOT_CONFIGURED");
    await deps.writeAuthDb(db);
  }
}

function toPermissionSubjects(
  records: PermissionSubjectRecord[],
): PermissionSubject[] {
  const byKey = new Map(records.map((record) => [record.subjectKey, record]));
  return records.map((record) => ({
    subjectKey: record.subjectKey,
    domain: record.domain,
    subjectType: record.subjectType,
    parentKeys: collectParentKeys(record.parentKey, byKey),
    sourceId: record.sourceId,
    exposureState: record.exposureState,
    displayName: record.displayName,
    metadata: plainObject(record.metadata),
    revision: positiveInteger(record.revision, 1),
  }));
}

function collectParentKeys(
  parentKey: string | undefined,
  byKey: Map<string, PermissionSubjectRecord>,
) {
  const keys: string[] = [];
  const seen = new Set<string>();
  let current = parentKey || "";
  while (current && !seen.has(current)) {
    keys.push(current);
    seen.add(current);
    current = byKey.get(current)?.parentKey || "";
  }
  return keys;
}

function toPermissionSubjectRecord(
  row: Record<string, unknown>,
): PermissionSubjectRecord {
  return {
    subjectKey: text(row.subject_key),
    domain: text(row.domain),
    subjectType: text(row.subject_type),
    parentKey: text(row.parent_key) || undefined,
    sourceId: text(row.source_id),
    exposureState: exposureState(row.exposure_state),
    displayName: text(row.display_name),
    metadata: plainObject(row.metadata),
    revision: positiveInteger(row.revision, 1),
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
  };
}

function toPermissionRuleRecord(
  row: Record<string, unknown>,
): PermissionRuleRecord {
  return {
    id: text(row.id),
    principalType: principalType(row.principal_type),
    principalId: text(row.principal_id),
    subjectKey: text(row.subject_key),
    action: action(row.action),
    effect: effect(row.effect),
    reason: text(row.reason),
    createdBy: text(row.created_by) || undefined,
    revision: positiveInteger(row.revision, 1),
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
  };
}

function readSubjectRecords(
  db: PermissionFallbackAuthDb,
): PermissionSubjectRecord[] {
  return Array.isArray(db.permissionSubjects)
    ? db.permissionSubjects.map(normalizeSubjectRecord)
    : [];
}

function readRuleRecords(db: PermissionFallbackAuthDb): PermissionRuleRecord[] {
  return Array.isArray(db.permissionRules)
    ? db.permissionRules.map(normalizeRuleRecord)
    : [];
}

function normalizeSubjectRecord(
  value: PermissionSubjectRecord,
): PermissionSubjectRecord {
  return {
    subjectKey: text(value.subjectKey),
    domain: text(value.domain),
    subjectType: text(value.subjectType),
    parentKey: text(value.parentKey) || undefined,
    sourceId: text(value.sourceId),
    exposureState: exposureState(value.exposureState),
    displayName: text(value.displayName),
    metadata: plainObject(value.metadata),
    revision: positiveInteger(value.revision, 1),
    createdAt: toMillis(value.createdAt),
    updatedAt: toMillis(value.updatedAt),
  };
}

function normalizeRuleRecord(
  value: PermissionRuleRecord,
): PermissionRuleRecord {
  return {
    id: text(value.id),
    principalType: principalType(value.principalType),
    principalId: text(value.principalId),
    subjectKey: text(value.subjectKey),
    action: action(value.action),
    effect: effect(value.effect),
    reason: text(value.reason),
    createdBy: text(value.createdBy) || undefined,
    revision: positiveInteger(value.revision, 1),
    createdAt: toMillis(value.createdAt),
    updatedAt: toMillis(value.updatedAt),
  };
}

function replaceByKey<T extends Record<string, unknown>>(
  items: T[],
  next: T,
  key: keyof T,
): T[] {
  return items.some((item) => item[key] === next[key])
    ? items.map((item) => (item[key] === next[key] ? next : item))
    : [...items, next];
}

function replaceRule(
  items: PermissionRuleRecord[],
  next: PermissionRuleRecord,
): PermissionRuleRecord[] {
  return items.some((item) => sameRuleIdentity(item, next))
    ? items.map((item) => (sameRuleIdentity(item, next) ? next : item))
    : [...items, next];
}

function sameRuleIdentity(
  left: PermissionRuleRecord,
  right: PermissionRuleRecord,
) {
  return (
    left.principalType === right.principalType &&
    left.principalId === right.principalId &&
    left.subjectKey === right.subjectKey &&
    left.action === right.action
  );
}

function plainObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return plainObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function positiveInteger(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? Math.floor(Number(value))
    : fallback;
}

function toMillis(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function exposureState(value: unknown): PermissionSubject["exposureState"] {
  return value === "published" || value === "retired" ? value : "restricted";
}
function principalType(value: unknown): PermissionPrincipalType {
  return value === "user" ? "user" : "group";
}
function action(value: unknown): PermissionAction {
  return value === "use" ||
    value === "execute" ||
    value === "manage" ||
    value === "export"
    ? value
    : "view";
}
function effect(value: unknown): PermissionEffect {
  return value === "deny" ? "deny" : "allow";
}

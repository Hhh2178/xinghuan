import type { Pool } from "pg";

import type { GroupPermissionPolicy } from "./group-permission-policy.js";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  passwordHash: string;
  passwordCipher?: string;
  groupId?: string;
  remark?: string;
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserGroupRecord {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt?: number;
  ip?: string;
  userAgent?: string;
  revokedAt?: number;
}

export type LoginAttemptScope = "member" | "admin";

export interface LoginAttemptRecord {
  key: string;
  scope: LoginAttemptScope;
  email: string;
  ip: string;
  failureCount: number;
  firstFailedAt: number;
  lastFailedAt: number;
  blockedUntil?: number;
  updatedAt: number;
}

export interface AuthDb {
  userGroups: UserGroupRecord[];
  groupPermissionPolicies: GroupPermissionPolicy[];
  users: UserRecord[];
  sessions: SessionRecord[];
  loginAttempts: LoginAttemptRecord[];
}

export interface CurrentAuthUserLookup {
  session: SessionRecord;
  user: UserRecord;
}

export interface AuthCurrentUserRepositoryDeps {
  usePostgresRepository: () => boolean;
  readAuthDb: () => Promise<AuthDb>;
  getPostgresPool: () => Promise<Pool>;
  dateToMillis: (value: unknown) => number;
  safeText: (value: unknown) => string;
  safeEmail: (value: unknown) => string;
}

export function createAuthCurrentUserRepository(deps: AuthCurrentUserRepositoryDeps) {
  return {
    findCurrentUserBySessionId,
    findEnabledUserByEmail,
  };

  async function findCurrentUserBySessionId(sessionId: string, now: number): Promise<CurrentAuthUserLookup | null> {
    const normalizedSessionId = deps.safeText(sessionId);
    if (!normalizedSessionId) return null;
    if (deps.usePostgresRepository()) return findCurrentUserBySessionIdPostgres(normalizedSessionId, now);
    const db = await deps.readAuthDb();
    const session = db.sessions.find((item) => item.id === normalizedSessionId && item.expiresAt > now && !item.revokedAt);
    if (!session) return null;
    const user = db.users.find((item) => item.id === session.userId && !item.disabled);
    return user ? { session, user } : null;
  }

  async function findCurrentUserBySessionIdPostgres(sessionId: string, now: number): Promise<CurrentAuthUserLookup | null> {
    const pool = await deps.getPostgresPool();
    const sessionResult = await pool.query(
      `select id, user_id, created_at, expires_at, last_seen_at, ip, user_agent, revoked_at
       from xh_sessions
       where id = $1
         and expires_at > $2
         and revoked_at is null
       limit 1`,
      [sessionId, new Date(now)],
    );
    const sessionRow = sessionResult.rows[0];
    if (!sessionRow) return null;
    const session = toSessionRecord(sessionRow);
    const userResult = await pool.query(
      `select id, email, name, role, password_hash, password_cipher, group_id, remark, disabled, created_at, updated_at
       from xh_users
       where id = $1
         and disabled = false
       limit 1`,
      [session.userId],
    );
    const userRow = userResult.rows[0];
    if (!userRow) return null;
    return { session, user: toUserRecord(userRow) };
  }

  async function findEnabledUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = deps.safeEmail(email);
    if (!normalizedEmail) return null;
    if (deps.usePostgresRepository()) return findEnabledUserByEmailPostgres(normalizedEmail);
    const db = await deps.readAuthDb();
    return db.users.find((item) => item.email.toLowerCase() === normalizedEmail && !item.disabled) || null;
  }

  async function findEnabledUserByEmailPostgres(email: string): Promise<UserRecord | null> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, email, name, role, password_hash, password_cipher, group_id, remark, disabled, created_at, updated_at
       from xh_users
       where lower(email) = lower($1)
         and disabled = false
       limit 1`,
      [email],
    );
    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  }

  function toSessionRecord(row: Record<string, unknown>): SessionRecord {
    const createdAt = deps.dateToMillis(row.created_at);
    return {
      id: deps.safeText(row.id),
      userId: deps.safeText(row.user_id),
      createdAt,
      expiresAt: deps.dateToMillis(row.expires_at),
      lastSeenAt: row.last_seen_at ? deps.dateToMillis(row.last_seen_at) : createdAt,
      ip: deps.safeText(row.ip),
      userAgent: deps.safeText(row.user_agent),
      revokedAt: row.revoked_at ? deps.dateToMillis(row.revoked_at) : undefined,
    };
  }

  function toUserRecord(row: Record<string, unknown>): UserRecord {
    return {
      id: deps.safeText(row.id),
      email: deps.safeEmail(row.email),
      name: deps.safeText(row.name),
      role: row.role === "admin" ? "admin" : "member",
      passwordHash: deps.safeText(row.password_hash),
      passwordCipher: deps.safeText(row.password_cipher) || undefined,
      groupId: deps.safeText(row.group_id) || undefined,
      remark: deps.safeText(row.remark),
      disabled: Boolean(row.disabled),
      createdAt: deps.dateToMillis(row.created_at),
      updatedAt: deps.dateToMillis(row.updated_at),
    };
  }
}

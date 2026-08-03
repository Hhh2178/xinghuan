import { describe, expect, it, vi } from "vitest";

import { createAuthCurrentUserRepository, type AuthDb } from "./auth-repository.js";

const activeSession = {
  id: "session-1",
  userId: "user-1",
  createdAt: 1000,
  expiresAt: 10_000,
  lastSeenAt: 1500,
};

const activeUser = {
  id: "user-1",
  email: "user@example.test",
  name: "User One",
  role: "member" as const,
  passwordHash: "hash",
  groupId: "group-1",
  createdAt: 1000,
  updatedAt: 1000,
};

function authDb(overrides: Partial<AuthDb> = {}): AuthDb {
  return {
    userGroups: [],
    groupPermissionPolicies: [],
    users: [activeUser],
    sessions: [activeSession],
    loginAttempts: [],
    ...overrides,
  };
}

describe("auth current user repository", () => {
  it("finds a file-backed current user from an active session", async () => {
    const repo = createAuthCurrentUserRepository({
      usePostgresRepository: () => false,
      readAuthDb: async () => authDb(),
      getPostgresPool: async () => {
        throw new Error("postgres should not be used");
      },
      dateToMillis: (value: unknown) => Number(value) || 0,
      safeText: (value: unknown) => String(value ?? "").trim(),
      safeEmail: (value: unknown) => String(value ?? "").trim().toLowerCase(),
    });

    await expect(repo.findCurrentUserBySessionId("session-1", 5000)).resolves.toEqual({
      session: activeSession,
      user: activeUser,
    });
  });

  it("normalizes administrator tiers from postgres rows", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from xh_sessions")) {
        return { rows: [{ ...activeSession, user_id: activeSession.userId, created_at: 1000, expires_at: 10_000 }] };
      }
      return {
        rows: [{
          ...activeUser,
          role: "admin",
          administrator_tier: "operator",
          password_hash: "hash",
          created_at: 1000,
          updated_at: 1000,
        }],
      };
    });
    const repo = createAuthCurrentUserRepository({
      usePostgresRepository: () => true,
      readAuthDb: async () => authDb(),
      getPostgresPool: async () => ({ query } as any),
      dateToMillis: (value: unknown) => Number(value) || 0,
      safeText: (value: unknown) => String(value ?? "").trim(),
      safeEmail: (value: unknown) => String(value ?? "").trim().toLowerCase(),
    });

    await expect(repo.findCurrentUserBySessionId("session-1", 5000)).resolves.toMatchObject({
      user: { role: "admin", administratorTier: "operator" },
    });
  });

  it("rejects expired, revoked, and disabled file-backed sessions", async () => {
    const baseDeps = {
      usePostgresRepository: () => false,
      getPostgresPool: async () => {
        throw new Error("postgres should not be used");
      },
      dateToMillis: (value: unknown) => Number(value) || 0,
      safeText: (value: unknown) => String(value ?? "").trim(),
      safeEmail: (value: unknown) => String(value ?? "").trim().toLowerCase(),
    };

    await expect(createAuthCurrentUserRepository({
      ...baseDeps,
      readAuthDb: async () => authDb({ sessions: [{ ...activeSession, expiresAt: 4000 }] }),
    }).findCurrentUserBySessionId("session-1", 5000)).resolves.toBeNull();

    await expect(createAuthCurrentUserRepository({
      ...baseDeps,
      readAuthDb: async () => authDb({ sessions: [{ ...activeSession, revokedAt: 4500 }] }),
    }).findCurrentUserBySessionId("session-1", 5000)).resolves.toBeNull();

    await expect(createAuthCurrentUserRepository({
      ...baseDeps,
      readAuthDb: async () => authDb({ users: [{ ...activeUser, disabled: true }] }),
    }).findCurrentUserBySessionId("session-1", 5000)).resolves.toBeNull();
  });

  it("uses targeted session and user postgres queries for current user lookup", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("from xh_sessions")) {
        expect(sql).toContain("where id = $1");
        expect(sql).toContain("expires_at > $2");
        expect(sql).toContain("revoked_at is null");
        expect(params[0]).toBe("session-1");
        return {
          rows: [{
            id: "session-1",
            user_id: "user-1",
            created_at: 1000,
            expires_at: 10_000,
            last_seen_at: 1500,
            ip: "127.0.0.1",
            user_agent: "browser",
            revoked_at: null,
          }],
        };
      }
      if (sql.includes("from xh_users")) {
        expect(sql).toContain("where id = $1");
        expect(sql).toContain("disabled = false");
        expect(params).toEqual(["user-1"]);
        return {
          rows: [{
            id: "user-1",
            email: "USER@EXAMPLE.TEST",
            name: "User One",
            role: "member",
            password_hash: "hash",
            password_cipher: null,
            group_id: "group-1",
            remark: "",
            disabled: false,
            created_at: 1000,
            updated_at: 1000,
          }],
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repo = createAuthCurrentUserRepository({
      usePostgresRepository: () => true,
      readAuthDb: async () => {
        throw new Error("full auth db should not be read");
      },
      getPostgresPool: async () => ({ query } as any),
      dateToMillis: (value: unknown) => Number(value) || 0,
      safeText: (value: unknown) => String(value ?? "").trim(),
      safeEmail: (value: unknown) => String(value ?? "").trim().toLowerCase(),
    });

    await expect(repo.findCurrentUserBySessionId("session-1", 5000)).resolves.toEqual({
      session: expect.objectContaining({ id: "session-1", userId: "user-1" }),
      user: expect.objectContaining({
        id: "user-1",
        email: "user@example.test",
        groupId: "group-1",
      }),
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("uses a targeted postgres user email query for login lookup", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain("from xh_users");
      expect(sql).toContain("lower(email) = lower($1)");
      expect(sql).toContain("disabled = false");
      expect(sql).not.toContain("xh_sessions");
      expect(sql).not.toContain("xh_login_attempts");
      expect(sql).not.toContain("xh_user_groups");
      expect(params).toEqual(["user@example.test"]);
      return {
        rows: [{
          id: "user-1",
          email: "USER@EXAMPLE.TEST",
          name: "User One",
          role: "member",
          password_hash: "hash",
          password_cipher: null,
          group_id: "group-1",
          remark: "",
          disabled: false,
          created_at: 1000,
          updated_at: 1000,
        }],
      };
    });
    const repo = createAuthCurrentUserRepository({
      usePostgresRepository: () => true,
      readAuthDb: async () => {
        throw new Error("full auth db should not be read");
      },
      getPostgresPool: async () => ({ query } as any),
      dateToMillis: (value: unknown) => Number(value) || 0,
      safeText: (value: unknown) => String(value ?? "").trim(),
      safeEmail: (value: unknown) => String(value ?? "").trim().toLowerCase(),
    });

    await expect(repo.findEnabledUserByEmail("USER@EXAMPLE.TEST")).resolves.toEqual(expect.objectContaining({
      id: "user-1",
      email: "user@example.test",
      groupId: "group-1",
    }));
    expect(query).toHaveBeenCalledTimes(1);
  });
});

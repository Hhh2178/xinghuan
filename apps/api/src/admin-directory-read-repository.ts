export interface DirectoryReadDeps {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<any>;
  readAuthDb: () => Promise<any>;
  dateToMillis: (value: unknown) => number;
  normalizeAdministratorTier: (role: "admin" | "member", tier: unknown) => string | undefined;
  safeText: (value: unknown, fallback?: string) => string;
}

export function createAdminDirectoryReadRepository(deps: DirectoryReadDeps) {
  async function readUsers() {
    if (!deps.usePostgresRepository()) return (await deps.readAuthDb()).users || [];
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, email, name, role, administrator_tier, password_hash, password_cipher,
              group_id, remark, disabled, created_at, updated_at
         from xh_users
        order by created_at asc, id asc`,
    );
    return result.rows.map((row: any) => {
      const role = row.role === "admin" ? "admin" : "member";
      return {
        id: deps.safeText(row.id),
        email: deps.safeText(row.email),
        name: deps.safeText(row.name),
        role,
        administratorTier: deps.normalizeAdministratorTier(role, row.administrator_tier),
        passwordHash: deps.safeText(row.password_hash),
        passwordCipher: deps.safeText(row.password_cipher) || undefined,
        groupId: deps.safeText(row.group_id) || undefined,
        remark: deps.safeText(row.remark),
        disabled: Boolean(row.disabled),
        createdAt: deps.dateToMillis(row.created_at),
        updatedAt: deps.dateToMillis(row.updated_at),
      };
    });
  }

  async function readUserGroups() {
    if (!deps.usePostgresRepository()) return (await deps.readAuthDb()).userGroups || [];
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, name, description, sort_order, created_at, updated_at
         from xh_user_groups
        order by sort_order asc, created_at asc, id asc`,
    );
    return result.rows.map((row: any) => ({
      id: deps.safeText(row.id),
      name: deps.safeText(row.name),
      description: deps.safeText(row.description),
      sortOrder: Number.isFinite(Number(row.sort_order)) ? Math.floor(Number(row.sort_order)) : 0,
      createdAt: deps.dateToMillis(row.created_at),
      updatedAt: deps.dateToMillis(row.updated_at),
    }));
  }

  async function readSessions(currentSessionId = "", limit = 300) {
    if (!deps.usePostgresRepository()) return (await deps.readAuthDb()).sessions || [];
    const pool = await deps.getPostgresPool();
    const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const result = await pool.query(
      `select s.id, s.user_id, s.created_at, s.expires_at, s.last_seen_at, s.ip, s.user_agent, s.revoked_at,
              u.email as user_email, u.name as user_name, u.role as user_role, u.administrator_tier
         from xh_sessions s
         join xh_users u on u.id = s.user_id
        where s.expires_at > now()
        order by s.created_at desc
        limit $1`,
      [boundedLimit],
    );
    return result.rows.map((row: any) => ({
      session: {
        id: deps.safeText(row.id),
        userId: deps.safeText(row.user_id),
        createdAt: deps.dateToMillis(row.created_at),
        expiresAt: deps.dateToMillis(row.expires_at),
        lastSeenAt: row.last_seen_at ? deps.dateToMillis(row.last_seen_at) : deps.dateToMillis(row.created_at),
        ip: deps.safeText(row.ip),
        userAgent: deps.safeText(row.user_agent),
        revokedAt: row.revoked_at ? deps.dateToMillis(row.revoked_at) : undefined,
      },
      user: {
        id: deps.safeText(row.user_id),
        email: deps.safeText(row.user_email),
        name: deps.safeText(row.user_name),
        role: row.user_role === "admin" ? "admin" : "member",
        administratorTier: deps.normalizeAdministratorTier(row.user_role === "admin" ? "admin" : "member", row.administrator_tier),
      },
      current: deps.safeText(row.id) === currentSessionId,
    }));
  }

  return { readUsers, readUserGroups, readSessions };
}

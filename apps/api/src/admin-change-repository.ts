export type AdminChangeDomain = "shell" | "providers" | "models" | "directory" | "permissions" | "runninghub" | "comfyui" | "shared-resources" | "tasks" | "content" | "analytics" | "system";
export interface AdminChangeRepository {
  touch(domains: AdminChangeDomain[], updatedBy?: string): Promise<void>;
  snapshot(): Promise<Array<{ domain: string; revision: number; updatedAt: number }>>;
}

export function createAdminChangeRepository(deps: { getPostgresPool: () => Promise<import("pg").Pool> }): AdminChangeRepository {
  return {
    async touch(domains: AdminChangeDomain[], updatedBy?: string) {
      if (!domains.length) return;
      const pool = await deps.getPostgresPool();
      await pool.query(
        `insert into xh_admin_change_revisions(domain, revision, updated_at, updated_by)
         select domain, 1, now(), $2 from unnest($1::text[]) as domain
         on conflict (domain) do update set revision = xh_admin_change_revisions.revision + 1, updated_at = now(), updated_by = excluded.updated_by`,
        [Array.from(new Set(domains)), updatedBy || null],
      );
    },
    async snapshot() {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<{ domain: string; revision: string; updated_at: Date }>("select domain, revision, updated_at from xh_admin_change_revisions order by domain");
      return result.rows.map((row) => ({ domain: row.domain, revision: Number(row.revision), updatedAt: row.updated_at.getTime() }));
    },
  };
}

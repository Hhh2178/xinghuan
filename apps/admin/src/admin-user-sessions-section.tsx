import { AdminTable, StatusPill } from "./admin-common-components";
import type { AdminSessionRecord } from "./admin-types";

type AdminMutate = (
  path: string,
  payload: Record<string, unknown>,
  method?: string,
  options?: { suppressGlobalError?: boolean; rethrow?: boolean },
) => Promise<void> | void;

export function AdminUserSessionsSection({
  sessions,
  mutate,
}: {
  sessions: AdminSessionRecord[];
  mutate: AdminMutate;
}) {
  const activeSessionCount = sessions.filter((session) => !session.revokedAt).length;
  const revokedSessionCount = sessions.filter((session) => session.revokedAt).length;

  return (
    <div className="users-tab-stack">
      <div className="api-card users-subhero">
        <div>
          <strong>当前会话</strong>
          <p>支持快速核对账号登录状态、来源设备与强制下线动作。</p>
        </div>
        <div className="users-subhero__chips">
          <StatusPill tone="success">{activeSessionCount} 个活跃</StatusPill>
          <StatusPill tone="muted">{revokedSessionCount} 个已撤销</StatusPill>
        </div>
      </div>

      <AdminTable title="活跃会话">
        <thead>
          <tr>
            <th>账号</th>
            <th>角色</th>
            <th>登录时间</th>
            <th>最近活跃</th>
            <th>到期时间</th>
            <th>来源 IP</th>
            <th>客户端</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <div className="user-password-cell">
                  <strong>{session.userEmail}</strong>
                  <span>{session.userName}</span>
                </div>
              </td>
              <td>{session.userRole === "admin" ? "管理员" : "成员"}</td>
              <td>{new Date(session.createdAt).toLocaleString()}</td>
              <td>{new Date(session.lastSeenAt).toLocaleString()}</td>
              <td>{new Date(session.expiresAt).toLocaleString()}</td>
              <td><code>{session.ip || "-"}</code></td>
              <td title={session.userAgent || "-"}>{session.userAgent || "-"}</td>
              <td>
                <StatusPill tone={session.revokedAt ? "danger" : session.current ? "warning" : "success"}>
                  {session.revokedAt ? "已撤销" : session.current ? "当前会话" : "活跃"}
                </StatusPill>
              </td>
              <td>
                <button
                  type="button"
                  disabled={session.current || Boolean(session.revokedAt)}
                  onClick={() => mutate(`/api/admin/sessions/${session.id}/revoke`, {}, "POST")}
                >
                  {session.revokedAt ? "已撤销" : session.current ? "当前会话" : "强制下线"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </div>
  );
}

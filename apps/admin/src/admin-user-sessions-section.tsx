import { Activity, ShieldCheck, TimerReset } from "lucide-react";
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
  const currentSessionCount = sessions.filter((session) => session.current && !session.revokedAt).length;
  const remoteSessionCount = sessions.filter((session) => !session.current && !session.revokedAt).length;

  return (
    <div className="users-sessions-workbench users-sessions-workbench--starlight">
      <div className="api-card users-subhero">
        <div>
          <strong>会话治理工作台</strong>
          <p>快速核对在线状态、来源设备、会话生命周期，并安全执行强制下线。</p>
        </div>
        <div className="users-subhero__chips">
          <StatusPill tone="success">{activeSessionCount} 个活跃</StatusPill>
          <StatusPill tone="warning">{currentSessionCount} 个当前会话</StatusPill>
          <StatusPill tone="muted">{revokedSessionCount} 个已撤销</StatusPill>
        </div>
      </div>

      <div className="users-sessions-summary" aria-label="会话治理概览">
        <div>
          <span>活跃会话</span>
          <strong>{activeSessionCount}</strong>
        </div>
        <div>
          <span>当前会话</span>
          <strong>{currentSessionCount}</strong>
        </div>
        <div>
          <span>远端会话</span>
          <strong>{remoteSessionCount}</strong>
        </div>
        <div>
          <span>已撤销</span>
          <strong>{revokedSessionCount}</strong>
        </div>
      </div>

      <div className="users-session-card-grid">
        <div className="users-session-card">
          <div className="users-session-card__head">
            <div>
              <strong>在线状态概览</strong>
              <p>优先看远端活跃会话，通常是最需要核查来源设备和使用时间的对象。</p>
            </div>
            <Activity aria-hidden="true" />
          </div>
          <div className="users-session-card__chips">
            <span>活跃 {activeSessionCount}</span>
            <span>远端 {remoteSessionCount}</span>
            <span>已撤销 {revokedSessionCount}</span>
          </div>
        </div>
        <div className="users-session-card">
          <div className="users-session-card__head">
            <div>
              <strong>治理动作提示</strong>
              <p>当前会话不能直接下线，远端活跃会话才允许执行撤销动作，避免误伤自己的管理入口。</p>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          <div className="users-session-card__chips">
            <span>当前会话 {currentSessionCount}</span>
            <span>可下线 {remoteSessionCount}</span>
            <span>已完成撤销 {revokedSessionCount}</span>
          </div>
        </div>
      </div>

      <AdminTable
        title="活跃会话"
        tableWrapClassName="users-sessions-table-panel"
        toolbar={(
          <div className="users-session-table-toolbar">
            <div>
              <strong>会话检查重点</strong>
              <span>优先核对来源 IP、客户端和最近活跃时间，再决定是否执行强制下线。</span>
            </div>
            <div className="permission-row__chips">
              <span><Activity aria-hidden="true" /> 活跃状态</span>
              <span><TimerReset aria-hidden="true" /> 生命周期</span>
              <span><ShieldCheck aria-hidden="true" /> 下线控制</span>
            </div>
          </div>
        )}
      >
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

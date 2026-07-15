import {
  Ban,
  Check,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AdminUser, AdminUserGroup } from "../admin-types";
import { permissionPlatformApi } from "./api";
import type {
  PermissionAction,
  PermissionDecision,
  PermissionEffect,
  PermissionHealth,
  PermissionPlatformState,
  PermissionPrincipalType,
  PermissionRule,
  PermissionSubject,
} from "./types";
import "./permission-platform.css";

const ACTIONS: Array<{ id: PermissionAction; label: string }> = [
  { id: "view", label: "查看" },
  { id: "use", label: "使用" },
  { id: "execute", label: "执行" },
  { id: "manage", label: "管理" },
  { id: "export", label: "导出" },
];

const DOMAIN_LABELS: Record<string, string> = {
  canvas: "画布节点",
  provider: "模型能力",
  runninghub: "RH 应用与工作流",
  resource: "公共资源",
};

type RuleDraftValue = "inherit" | PermissionEffect;

export function PermissionPlatformPanel({
  users,
  userGroups,
}: {
  users: AdminUser[];
  userGroups: AdminUserGroup[];
}) {
  const [state, setState] = useState<PermissionPlatformState>({ subjects: [], rules: [] });
  const [health, setHealth] = useState<PermissionHealth | null>(null);
  const [principalType, setPrincipalType] = useState<PermissionPrincipalType>("group");
  const [principalId, setPrincipalId] = useState("ungrouped");
  const [domain, setDomain] = useState("all");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("后台权限治理");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(80);
  const [effectiveDecisions, setEffectiveDecisions] = useState<Record<string, PermissionDecision>>({});

  const memberUsers = useMemo(
    () => users.filter((user) => user.role !== "admin" && !user.disabled),
    [users],
  );
  const groupOptions = useMemo(
    () => [
      { id: "ungrouped", name: "未分组" },
      ...userGroups.map((group) => ({ id: group.id, name: group.name })),
    ],
    [userGroups],
  );
  const principalOptions = useMemo(
    () => principalType === "group"
      ? groupOptions.map((item) => ({ id: item.id, label: item.name }))
      : memberUsers.map((item) => ({ id: item.id, label: item.email })),
    [groupOptions, memberUsers, principalType],
  );
  const selectedUser = principalType === "user"
    ? memberUsers.find((user) => user.id === principalId)
    : undefined;
  const fallbackGroupId = selectedUser?.groupId || "ungrouped";

  const visibleSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...state.subjects]
      .filter((subject) => domain === "all" || subject.domain === domain)
      .filter((subject) => !normalizedQuery || [
        subject.displayName,
        subject.subjectKey,
        subject.sourceId,
        subject.subjectType,
      ].join(" ").toLowerCase().includes(normalizedQuery))
      .sort((left, right) => (
        left.domain.localeCompare(right.domain) ||
        Number(Boolean(right.metadata.parent)) - Number(Boolean(left.metadata.parent)) ||
        left.displayName.localeCompare(right.displayName, "zh-CN")
      ));
  }, [domain, query, state.subjects]);
  const renderedSubjects = useMemo(
    () => visibleSubjects.slice(0, visibleLimit),
    [visibleSubjects, visibleLimit],
  );

  useEffect(() => {
    setVisibleLimit(80);
  }, [domain, query]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextState, nextHealth] = await Promise.all([
        permissionPlatformApi.readState(),
        permissionPlatformApi.readHealth(),
      ]);
      setState(nextState);
      setHealth(nextHealth);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!principalOptions.some((item) => item.id === principalId)) {
      setPrincipalId(principalOptions[0]?.id || "");
    }
  }, [principalId, principalOptions]);

  useEffect(() => {
    if (!principalId || renderedSubjects.length === 0) {
      setEffectiveDecisions({});
      return;
    }
    let cancelled = false;
    const checks = renderedSubjects.flatMap((subject) => (
      supportedActions(subject).map((action) => ({ subjectKey: subject.subjectKey, action }))
    ));
    const user = principalType === "user"
      ? { id: principalId, role: "member" as const, groupId: fallbackGroupId === "ungrouped" ? undefined : fallbackGroupId }
      : { id: `group-preview:${principalId}`, role: "member" as const, groupId: principalId === "ungrouped" ? undefined : principalId };
    permissionPlatformApi.explain({ user, checks })
      .then(({ decisions }) => {
        if (cancelled) return;
        setEffectiveDecisions(Object.fromEntries(
          decisions.map((decision) => [decisionKey(decision.subjectKey, decision.action), decision]),
        ));
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : String(nextError));
      });
    return () => {
      cancelled = true;
    };
  }, [principalType, principalId, fallbackGroupId, state.subjects, state.rules, renderedSubjects]);

  async function updateSubject(subject: PermissionSubject) {
    if (!reason.trim()) {
      setError("请填写变更原因");
      return;
    }
    const nextState = subject.exposureState === "published" ? "restricted" : "published";
    setSavingKey(`subject:${subject.subjectKey}`);
    setError("");
    try {
      const updated = await permissionPlatformApi.updateSubject(subject, nextState, reason.trim());
      setState((current) => ({
        ...current,
        subjects: current.subjects.map((item) => item.subjectKey === updated.subjectKey ? updated : item),
      }));
      setHealth(await permissionPlatformApi.readHealth());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSavingKey("");
    }
  }

  async function updateRule(subject: PermissionSubject, action: PermissionAction, value: RuleDraftValue) {
    if (!principalId) return;
    if (!reason.trim()) {
      setError("请填写变更原因");
      return;
    }
    const direct = directRule(state.rules, principalType, principalId, subject.subjectKey, action);
    const key = `${subject.subjectKey}:${action}`;
    setSavingKey(key);
    setError("");
    try {
      if (value === "inherit") {
        if (direct) await permissionPlatformApi.deleteRule(direct.id, direct.revision, reason.trim());
        setState((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== direct?.id) }));
      } else {
        const saved = await permissionPlatformApi.upsertRule({
          principalType,
          principalId,
          subjectKey: subject.subjectKey,
          action,
          effect: value,
          reason: reason.trim(),
          revision: direct?.revision,
        });
        setState((current) => ({
          ...current,
          rules: [...current.rules.filter((rule) => rule.id !== direct?.id), saved],
        }));
      }
      setHealth(await permissionPlatformApi.readHealth());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSavingKey("");
    }
  }

  const domains = ["all", ...new Set(state.subjects.map((subject) => subject.domain))];

  return (
    <section className="permission-platform" aria-label="统一权限平台">
      <div className="permission-platform__health">
        <div>
          <span>运行模式</span>
          <strong>{modeLabel(health?.mode)}</strong>
        </div>
        <div>
          <span>就绪状态</span>
          <strong className={health?.readiness.ready ? "is-ready" : "is-blocked"}>
            {health?.readiness.ready ? "可切换" : "未就绪"}
          </strong>
        </div>
        <div>
          <span>权限对象</span>
          <strong>{health?.readiness.metrics.subjectCount ?? state.subjects.length}</strong>
        </div>
        <div>
          <span>已发布</span>
          <strong>{health?.readiness.metrics.publishedSubjectCount ?? 0}</strong>
        </div>
        <div>
          <span>规则</span>
          <strong>{health?.readiness.metrics.ruleCount ?? state.rules.length}</strong>
        </div>
        <button type="button" className="permission-platform__icon-button" onClick={() => void load()} title="刷新权限状态">
          <RefreshCw aria-hidden="true" className={loading ? "spin" : ""} />
        </button>
      </div>

      {health && !health.readiness.ready ? (
        <div className="permission-platform__failures" role="status">
          <Ban aria-hidden="true" />
          <div>
            <strong>统一权限尚未满足强制启用条件</strong>
            <span>{health.readiness.failures.map((item) => `${item.code} (${item.count})`).join(" · ")}</span>
          </div>
        </div>
      ) : null}

      {error ? <div className="inline-error">{error}</div> : null}

      <div className="permission-platform__workspace">
        <aside className="permission-platform__principal">
          <div className="permission-platform__segmented" role="tablist" aria-label="授权主体类型">
            <button type="button" className={principalType === "group" ? "active" : ""} onClick={() => setPrincipalType("group")}>
              <UsersRound aria-hidden="true" /> 用户组
            </button>
            <button type="button" className={principalType === "user" ? "active" : ""} onClick={() => setPrincipalType("user")}>
              <UserRound aria-hidden="true" /> 单账号
            </button>
          </div>

          <label>
            <span>{principalType === "group" ? "选择用户组" : "选择账号"}</span>
            <select value={principalId} onChange={(event) => setPrincipalId(event.target.value)}>
              {principalOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>变更原因</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={160} />
          </label>

          <div className="permission-platform__principal-note">
            <ShieldCheck aria-hidden="true" />
            <span>{principalType === "user" ? `账号规则优先于 ${fallbackGroupId} 用户组规则。` : "用户组规则作用于组内所有普通成员。"}</span>
          </div>
        </aside>

        <div className="permission-platform__content">
          <div className="permission-platform__toolbar">
            <div className="permission-platform__domains" role="tablist" aria-label="权限域">
              {domains.map((item) => (
                <button key={item} type="button" className={domain === item ? "active" : ""} onClick={() => setDomain(item)}>
                  {item === "all" ? "全部" : DOMAIN_LABELS[item] || item}
                </button>
              ))}
            </div>
            <label className="permission-platform__search">
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或 ID" />
            </label>
          </div>

          <div className="permission-platform__list">
            {renderedSubjects.map((subject) => (
              <PermissionSubjectRow
                key={subject.subjectKey}
                subject={subject}
                rules={state.rules}
                principalType={principalType}
                principalId={principalId}
                fallbackGroupId={fallbackGroupId}
                effectiveDecisions={effectiveDecisions}
                savingKey={savingKey}
                onUpdateSubject={updateSubject}
                onUpdateRule={updateRule}
              />
            ))}
            {renderedSubjects.length < visibleSubjects.length ? (
              <button type="button" className="permission-platform__load-more" onClick={() => setVisibleLimit((current) => current + 80)}>
                显示更多（剩余 {visibleSubjects.length - renderedSubjects.length}）
              </button>
            ) : null}
            {!loading && visibleSubjects.length === 0 ? <div className="empty-state">没有符合条件的权限对象</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PermissionSubjectRow({
  subject,
  rules,
  principalType,
  principalId,
  fallbackGroupId,
  effectiveDecisions,
  savingKey,
  onUpdateSubject,
  onUpdateRule,
}: {
  subject: PermissionSubject;
  rules: PermissionRule[];
  principalType: PermissionPrincipalType;
  principalId: string;
  fallbackGroupId: string;
  effectiveDecisions: Record<string, PermissionDecision>;
  savingKey: string;
  onUpdateSubject: (subject: PermissionSubject) => Promise<void>;
  onUpdateRule: (subject: PermissionSubject, action: PermissionAction, value: RuleDraftValue) => Promise<void>;
}) {
  return (
    <article className="permission-subject-row">
      <div className="permission-subject-row__identity">
        <div>
          <strong>{subject.displayName || subject.sourceId}</strong>
          <span>{DOMAIN_LABELS[subject.domain] || subject.domain} · {subject.subjectType}</span>
        </div>
        <code title={subject.subjectKey}>{subject.subjectKey}</code>
      </div>

      <button
        type="button"
        className={`permission-subject-row__exposure is-${subject.exposureState}`}
        onClick={() => void onUpdateSubject(subject)}
        disabled={subject.exposureState === "retired" || savingKey === `subject:${subject.subjectKey}`}
        title={subject.exposureState === "published" ? "限制普通成员访问" : "发布权限对象"}
      >
        {subject.exposureState === "published" ? <Check aria-hidden="true" /> : <Ban aria-hidden="true" />}
        {exposureLabel(subject.exposureState)}
      </button>

      <div className="permission-subject-row__actions">
        {ACTIONS.filter((action) => supportedActions(subject).includes(action.id)).map((action) => {
          const direct = directRule(rules, principalType, principalId, subject.subjectKey, action.id);
          const inherited = inheritedRule(
            rules,
            principalType,
            principalId,
            fallbackGroupId,
            subject,
            action.id,
          );
          const decision = effectiveDecisions[decisionKey(subject.subjectKey, action.id)];
          const effective = decision?.ruleId
            ? rules.find((rule) => rule.id === decision.ruleId)
            : undefined;
          return (
            <label key={action.id} title={decision ? `${decision.reason}${effective ? ` · ${effective.principalType}:${effective.principalId}` : ""}` : "正在读取最终权限"}>
              <span>{action.label}</span>
              <select
                value={direct?.effect || "inherit"}
                className={decision ? `is-${decision.allowed ? "allow" : "deny"}` : "is-inherit"}
                disabled={!principalId || savingKey === `${subject.subjectKey}:${action.id}`}
                onChange={(event) => void onUpdateRule(subject, action.id, event.target.value as RuleDraftValue)}
              >
                <option value="inherit">继承{inherited ? ` · ${inherited.effect === "allow" ? "允许" : "禁止"}` : ""}</option>
                <option value="allow">允许</option>
                <option value="deny">禁止</option>
              </select>
            </label>
          );
        })}
      </div>
    </article>
  );
}

function directRule(
  rules: PermissionRule[],
  principalType: PermissionPrincipalType,
  principalId: string,
  subjectKey: string,
  action: PermissionAction,
) {
  return rules.find((rule) => (
    rule.principalType === principalType &&
    rule.principalId === principalId &&
    rule.subjectKey === subjectKey &&
    rule.action === action
  ));
}

function decisionKey(subjectKey: string, action: PermissionAction) {
  return `${subjectKey}\u0000${action}`;
}

function inheritedRule(
  rules: PermissionRule[],
  principalType: PermissionPrincipalType,
  principalId: string,
  fallbackGroupId: string,
  subject: PermissionSubject,
  action: PermissionAction,
) {
  const principalCandidates = principalType === "user"
    ? [{ type: "user" as const, id: principalId }, { type: "group" as const, id: fallbackGroupId }]
    : [{ type: "group" as const, id: principalId }];
  const subjectCandidates = [subject.subjectKey, ...subject.parentKeys];
  for (const principal of principalCandidates) {
    for (const subjectKey of subjectCandidates) {
      const match = rules.find((rule) => (
        rule.principalType === principal.type &&
        rule.principalId === principal.id &&
        rule.subjectKey === subjectKey &&
        rule.action === action
      ));
      if (match) return match;
    }
  }
  return undefined;
}

function modeLabel(mode?: PermissionHealth["mode"]) {
  if (mode === "enforced") return "统一权限生效";
  if (mode === "shadow") return "影子比对";
  return "旧权限兼容";
}

function exposureLabel(state: PermissionSubject["exposureState"]) {
  if (state === "published") return "已发布";
  if (state === "retired") return "已退役";
  return "受限";
}

function supportedActions(subject: PermissionSubject): PermissionAction[] {
  if (subject.domain === "provider") return ["view", "execute"];
  if (subject.domain === "runninghub") return ["view", "execute"];
  if (subject.domain === "canvas") return ["view", "use"];
  if (subject.domain === "resource" && subject.subjectType.includes("category")) return ["view"];
  if (subject.domain === "resource") return ["view", "use"];
  return ["view"];
}

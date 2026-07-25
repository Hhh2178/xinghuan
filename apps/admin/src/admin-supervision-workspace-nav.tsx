import {
  Activity,
  Bot,
  GitBranch,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type SupervisionWorkspaceKey =
  | "overview"
  | "environment"
  | "planner"
  | "routing"
  | "quality"
  | "recovery";

export interface SupervisionWorkspaceState {
  active: SupervisionWorkspaceKey;
  pending: SupervisionWorkspaceKey | null;
  dirty: boolean;
}

interface SupervisionWorkspaceDefinition {
  key: SupervisionWorkspaceKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface SupervisionWorkspaceItem extends SupervisionWorkspaceDefinition {
  selected: boolean;
}

const workspaceDefinitions: SupervisionWorkspaceDefinition[] = [
  { key: "overview", label: "运行总览", description: "状态与执行权威", icon: Activity },
  { key: "environment", label: "环境控制", description: "开关与允许范围", icon: SlidersHorizontal },
  { key: "planner", label: "规划 Agent", description: "分析用途与预算", icon: Bot },
  { key: "routing", label: "模型路由", description: "候选、回退与版本", icon: GitBranch },
  { key: "quality", label: "质量门", description: "评分与候选策略", icon: ShieldCheck },
  { key: "recovery", label: "失败恢复", description: "恢复策略与账本", icon: RotateCcw },
];

const workspaceAliases: Record<string, SupervisionWorkspaceKey> = {
  overview: "overview",
  environment: "environment",
  controls: "environment",
  planner: "planner",
  roles: "planner",
  routing: "routing",
  "llm-routes": "routing",
  quality: "quality",
  recovery: "recovery",
};

export function resolveSupervisionWorkspaceKey(value?: string | null): SupervisionWorkspaceKey {
  if (!value) return "overview";
  const queryValue = value.match(/[?&#]workspace=([^&#]+)/i)?.[1];
  const segment = decodeURIComponent(queryValue || value.split(/[/?#]/).filter(Boolean).at(-1) || "").toLowerCase();
  return workspaceAliases[segment] || "overview";
}

export function createSupervisionWorkspaceState(value?: string | null): SupervisionWorkspaceState {
  return { active: resolveSupervisionWorkspaceKey(value), pending: null, dirty: false };
}

export function supervisionWorkspaceItems(active: SupervisionWorkspaceKey): SupervisionWorkspaceItem[] {
  return workspaceDefinitions.map((item) => ({ ...item, selected: item.key === active }));
}

export function updateSupervisionWorkspaceDirty(
  state: SupervisionWorkspaceState,
  dirty: boolean,
): SupervisionWorkspaceState {
  if (state.dirty === dirty) return state;
  return { ...state, dirty };
}

export function requestSupervisionWorkspace(
  state: SupervisionWorkspaceState,
  target: SupervisionWorkspaceKey,
): SupervisionWorkspaceState {
  if (target === state.active) return { ...state, pending: null };
  if (state.dirty) return { ...state, pending: target };
  return { active: target, pending: null, dirty: false };
}

export function stayInSupervisionWorkspace(state: SupervisionWorkspaceState): SupervisionWorkspaceState {
  return { ...state, pending: null };
}

export function discardSupervisionWorkspaceDraft(state: SupervisionWorkspaceState): SupervisionWorkspaceState {
  return state.pending
    ? { active: state.pending, pending: null, dirty: false }
    : state;
}

export function AdminSupervisionWorkspaceNav({
  active,
  onSelect,
}: {
  active: SupervisionWorkspaceKey;
  onSelect: (key: SupervisionWorkspaceKey) => void;
}) {
  return (
    <nav className="supervision-workspace-nav" aria-label="AI 托管治理任务">
      <div className="supervision-workspace-nav__label">治理任务</div>
      <div className="supervision-workspace-nav__items" role="tablist" aria-orientation="vertical">
        {supervisionWorkspaceItems(active).map(({ key, label, description, icon: Icon, selected }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? "active" : ""}
            onClick={() => onSelect(key)}
          >
            <Icon aria-hidden="true" />
            <span><strong>{label}</strong><small>{description}</small></span>
          </button>
        ))}
      </div>
    </nav>
  );
}

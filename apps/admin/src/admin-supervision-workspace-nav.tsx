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
  { key: "overview", label: "托管总览", description: "状态、异常与安全边界", icon: Activity },
  { key: "environment", label: "托管强度", description: "Gray / Production 生效模式", icon: SlidersHorizontal },
  { key: "planner", label: "规划策略", description: "分析用途、提示词与预算", icon: Bot },
  { key: "routing", label: "模型路由", description: "主模型、候选与故障回退", icon: GitBranch },
  { key: "quality", label: "候选与质量", description: "评分、置信度与转人工", icon: ShieldCheck },
  { key: "recovery", label: "失败恢复", description: "重试、改写与审批策略", icon: RotateCcw },
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

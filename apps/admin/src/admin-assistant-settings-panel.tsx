import { Bot, MonitorCog, Network, RotateCcw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AssistantSettings } from "./admin-types";


function cloneAssistantSettings(settings: AssistantSettings): AssistantSettings {
  return JSON.parse(JSON.stringify(settings)) as AssistantSettings;
}

export function AdminAssistantSettingsPanel({
  settings,
  saving,
  onSave,
}: {
  settings: AssistantSettings;
  saving: boolean;
  onSave: (next: AssistantSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => cloneAssistantSettings(settings));

  useEffect(() => {
    setDraft(cloneAssistantSettings(settings));
  }, [settings]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  function updateFrontend<K extends keyof AssistantSettings["frontend"]>(
    key: K,
    value: AssistantSettings["frontend"][K],
  ) {
    setDraft((current) => ({
      ...current,
      frontend: {
        ...current.frontend,
        [key]: value,
      },
      updatedAt: Date.now(),
    }));
  }

  function updateBackend<K extends keyof AssistantSettings["backend"]>(
    key: K,
    value: AssistantSettings["backend"][K],
  ) {
    setDraft((current) => ({
      ...current,
      backend: {
        ...current.backend,
        [key]: value,
      },
      updatedAt: Date.now(),
    }));
  }

  function updateIntegration<K extends keyof AssistantSettings["integration"]>(
    key: K,
    value: AssistantSettings["integration"][K],
  ) {
    setDraft((current) => ({
      ...current,
      integration: {
        ...current.integration,
        [key]: value,
      },
      updatedAt: Date.now(),
    }));
  }

  function resetDraft() {
    window.setTimeout(() => {
      setDraft(cloneAssistantSettings(settings));
    }, 0);
  }

  return (
    <div className="assistant-settings-page">
      <section className="assistant-settings-hero">
        <div className="assistant-settings-hero__copy">
          <span className="assistant-settings-hero__kicker">AI 助手工作台</span>
          <h2>统一管理后台与创作侧的会话、上下文和接入策略</h2>
          <p>这里负责控制入口文案、可挂载上下文、内部 Agent 角色和严格模式等运行参数。</p>
        </div>
        <div className="assistant-settings-hero__chips">
          <MetricChip label="运行内核" value="项目内 Agent" />
          <MetricChip label="知识配置" value={draft.integration.knowledgeProfile || "未填写"} />
          <MetricChip label="记忆策略" value={draft.integration.persistMemory ? "持久化" : "非持久化"} />
          <MetricChip label="最近更新" value={new Date(settings.updatedAt).toLocaleString()} />
        </div>
      </section>

      <div className="assistant-settings-actions">
        <div className="assistant-settings-meta">
          {dirty ? "有未保存修改" : saving ? "保存中..." : "当前配置已同步到后台存储"}
        </div>
        <div className="assistant-settings-actions__buttons">
          <button
            type="button"
            className="ghost-action"
            onClick={resetDraft}
            disabled={saving || !dirty}
          >
            <RotateCcw aria-hidden="true" />
            重置未保存修改
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => void onSave({ ...draft, updatedAt: Date.now() })}
            disabled={saving || !dirty}
          >
            <Save aria-hidden="true" />
            保存 AI 助手配置
          </button>
        </div>
      </div>

      <div className="assistant-settings-grid">
        <AssistantSettingsCard
          title="创作侧助手"
          description="控制画布内的助手入口、文案和可发送上下文范围。"
          icon={Bot}
        >
          <SettingsSection title="基础文案" description="这些内容会直接出现在前端画布助手里。">
            <FieldRow
              label="助手标题"
              description="显示在前端 AI 助手头部。"
              control={(
                <input
                  value={draft.frontend.title}
                  onChange={(event) => updateFrontend("title", event.target.value)}
                />
              )}
            />
            <FieldRow
              label="欢迎提示"
              description="用于简短说明助手的用途。"
              control={(
                <textarea
                  value={draft.frontend.hint}
                  onChange={(event) => updateFrontend("hint", event.target.value)}
                />
              )}
            />
            <FieldRow
              label="输入占位"
              description="显示在输入框中，引导管理员或创作者如何提问。"
              control={(
                <input
                  value={draft.frontend.placeholder}
                  onChange={(event) => updateFrontend("placeholder", event.target.value)}
                />
              )}
            />
          </SettingsSection>
          <SettingsSection title="上下文权限" description="限定前端助手可附带的画布上下文。">
            <ToggleRow
              label="启用创作侧入口"
              description="关闭后，画布内不再展示 AI 助手入口。"
              checked={draft.frontend.enabled}
              onChange={(checked) => updateFrontend("enabled", checked)}
            />
            <ToggleRow
              label="允许发送选中工作流"
              description="把节点集合和连线关系摘要挂入对话。"
              checked={draft.frontend.allowWorkflowAttachment}
              onChange={(checked) => updateFrontend("allowWorkflowAttachment", checked)}
            />
            <ToggleRow
              label="允许发送当前节点"
              description="把当前单节点结构信息挂入对话。"
              checked={draft.frontend.allowNodeAttachment}
              onChange={(checked) => updateFrontend("allowNodeAttachment", checked)}
            />
            <ToggleRow
              label="允许发送媒体上下文"
              description="允许把图片、视频、音频素材挂入当前会话。"
              checked={draft.frontend.allowMediaAttachment}
              onChange={(checked) => updateFrontend("allowMediaAttachment", checked)}
            />
          </SettingsSection>
          <SettingsSection title="会话策略" description="创作侧保持轻量对话，不在本地持久落记忆。">
            <StaticInfo
              icon={ShieldCheck}
              title="创作侧固定为非持久化记忆模式"
              body="前端会话以即时协作为主，避免把画布临时问题误沉淀为长期记忆。"
            />
          </SettingsSection>
        </AssistantSettingsCard>

        <AssistantSettingsCard
          title="后台审计助手"
          description="控制后台右侧助手的展示方式、默认打开状态和上下文读取能力。"
          icon={MonitorCog}
        >
          <SettingsSection title="基础文案" description="这些内容会出现在后台右侧固定对话区。">
            <FieldRow
              label="助手标题"
              description="显示在后台助手头部。"
              control={(
                <input
                  value={draft.backend.title}
                  onChange={(event) => updateBackend("title", event.target.value)}
                />
              )}
            />
            <FieldRow
              label="欢迎提示"
              description="用于说明后台助手可协助的事项。"
              control={(
                <textarea
                  value={draft.backend.hint}
                  onChange={(event) => updateBackend("hint", event.target.value)}
                />
              )}
            />
            <FieldRow
              label="输入占位"
              description="引导管理员在后台中直接发起问题。"
              control={(
                <input
                  value={draft.backend.placeholder}
                  onChange={(event) => updateBackend("placeholder", event.target.value)}
                />
              )}
            />
          </SettingsSection>
          <SettingsSection title="行为开关" description="控制后台助手默认如何出现在工作界面中。">
            <ToggleRow
              label="启用后台助手"
              description="关闭后，不展示后台右侧固定助手。"
              checked={draft.backend.enabled}
              onChange={(checked) => updateBackend("enabled", checked)}
            />
            <ToggleRow
              label="后台默认展开"
              description="管理员进入后台时，默认以展开态显示。"
              checked={draft.backend.defaultOpen}
              onChange={(checked) => updateBackend("defaultOpen", checked)}
            />
          </SettingsSection>
          <SettingsSection title="可读取上下文" description="勾选后，后台助手可从对应后台页面挂载对象摘要。">
            <ToggleRow
              label="允许 Provider 上下文"
              description="读取当前服务商草稿、状态和地址信息。"
              checked={draft.backend.allowProviderContext}
              onChange={(checked) => updateBackend("allowProviderContext", checked)}
            />
            <ToggleRow
              label="允许模型上下文"
              description="读取模型能力、参数 schema 和输入能力。"
              checked={draft.backend.allowModelContext}
              onChange={(checked) => updateBackend("allowModelContext", checked)}
            />
            <ToggleRow
              label="允许任务上下文"
              description="读取任务状态、模型、Provider 和更新时间。"
              checked={draft.backend.allowTaskContext}
              onChange={(checked) => updateBackend("allowTaskContext", checked)}
            />
            <ToggleRow
              label="允许用户上下文"
              description="读取当前用户角色、禁用状态和更新时间。"
              checked={draft.backend.allowUserContext}
              onChange={(checked) => updateBackend("allowUserContext", checked)}
            />
            <ToggleRow
              label="允许审计上下文"
              description="读取最近审计动作，用于排查后台配置变更。"
              checked={draft.backend.allowAuditContext}
              onChange={(checked) => updateBackend("allowAuditContext", checked)}
            />
          </SettingsSection>
        </AssistantSettingsCard>

        <AssistantSettingsCard
          title="内部 Agent 接入"
          description="管理项目内 Agent 角色、知识配置和安全策略。"
          icon={Network}
          spanTwo
        >
          <div className="assistant-settings-integration-grid">
            <SettingsSection title="运行内核" description="决定后台和前端助手的回复来源。">
              <FieldRow
                label="接入内核"
                description="助手统一由项目内 Agent Runtime 执行，未发布路由时使用受限兜底回复。"
                control={(
                  <input value="项目内 Agent Runtime" disabled />
                )}
              />
              <FieldRow
                label="对话 Agent"
                description="悬浮助手和后台对话使用的 Agent 定义 key。"
                control={(
                  <input
                    value={draft.integration.assistantAgentKey}
                    onChange={(event) => updateIntegration("assistantAgentKey", event.target.value)}
                    placeholder="服务器内地址已隐藏；如需改接入可手动填写"
                  />
                )}
              />
              <FieldRow
                label="Provider 分析 Agent"
                description="用于区分灰度、测试或正式环境会话。"
                control={(
                  <input
                    value={draft.integration.providerAnalysisAgentKey}
                    onChange={(event) => updateIntegration("providerAnalysisAgentKey", event.target.value)}
                  />
                )}
              />
            </SettingsSection>
            <SettingsSection title="知识与安全策略" description="决定知识配置、LLM 路由归属和安全边界。">
              <FieldRow
                label="知识配置"
                description="公开产品知识和节点能力知识使用的配置标识。"
                control={(
                  <input
                    value={draft.integration.knowledgeProfile}
                    onChange={(event) => updateIntegration("knowledgeProfile", event.target.value)}
                  />
                )}
              />
              <FieldRow
                label="模型选择"
                description="具体 LLM 由角色对应的已发布路由池决定。"
                control={(
                  <input
                    value="由 LLM 路由池按角色决定"
                    disabled
                  />
                )}
              />
              <ToggleRow
                label="严格模式"
                description="启用后，助手会尽量避免给出高风险操作建议。"
                checked={draft.integration.strictMode}
                onChange={(checked) => updateIntegration("strictMode", checked)}
              />
              <ToggleRow
                label="持久化记忆"
                description="仅在后台场景确实需要长会话记忆时开启。"
                checked={false}
                onChange={() => undefined}
              />
            </SettingsSection>
          </div>
          <div className="assistant-settings-note">
            后台助手与创作侧助手共享接入层，但前后端可以采用不同的上下文和记忆策略。
          </div>
        </AssistantSettingsCard>
      </div>
    </div>
  );
}

function AssistantSettingsCard({
  title,
  description,
  icon: Icon,
  children,
  spanTwo = false,
}: {
  title: string;
  description: string;
  icon: typeof Bot;
  children: ReactNode;
  spanTwo?: boolean;
}) {
  return (
    <section className={`assistant-settings-card${spanTwo ? " assistant-settings-card--span-2" : ""}`}>
      <header className="assistant-settings-card__header">
        <div className="assistant-settings-card__icon">
          <Icon aria-hidden="true" />
        </div>
        <div className="assistant-settings-card__copy">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </header>
      <div className="assistant-settings-card__body">{children}</div>
    </section>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="assistant-settings-section">
      <div className="assistant-settings-section__head">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="assistant-settings-list">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="assistant-settings-item">
      <div className="assistant-settings-item__copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <div className="assistant-settings-item__control">{control}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="assistant-settings-item assistant-settings-item--toggle">
      <div className="assistant-settings-item__copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <label className={`assistant-switch${checked ? " active" : ""}`}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="assistant-switch__track" aria-hidden="true">
          <span className="assistant-switch__thumb" />
        </span>
      </label>
    </div>
  );
}

function StaticInfo({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="assistant-static-info">
      <div className="assistant-static-info__icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="assistant-static-info__copy">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="assistant-metric-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { useApiKeysStore, FIXED_ZHENZHEN_BASE, RH_BASE } from '../stores/apiKeys';
import { useThemeStore } from '../stores/theme';
import type { AdvancedProviderConfig, ApiSettings, CloudUploadTargetConfig } from '../types/canvas';
import { getRawSettings, testAdvancedProvider, testCloudUploadTarget } from '../services/api';
import {
  advancedProviderSummary as summarizeAdvancedProviderForm,
} from '../utils/advancedProviders';
import {
  ALL_FIELDS,
  buildSettingsBackupPayload,
  emptyMap,
  emptyShow,
  normalizeImportedSettings,
  summarizeCloudUploadForm,
  type AdvancedProviderComfyDraft,
  type KeyField,
} from './apiSettingsHelpers';
import ApiSettingsAdvancedProviderDetailPanel from './ApiSettingsAdvancedProviderDetailPanel';
import ApiSettingsAdvancedProvidersSection from './ApiSettingsAdvancedProvidersSection';
import ApiSettingsCloudTargetDetailPanel from './ApiSettingsCloudTargetDetailPanel';
import ApiSettingsCloudUploadSection from './ApiSettingsCloudUploadSection';
import ApiSettingsFooterActions from './ApiSettingsFooterActions';
import ApiSettingsKeySections from './ApiSettingsKeySections';
import ApiSettingsLocalPathsSection from './ApiSettingsLocalPathsSection';

interface ApiSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ApiSettingsModal({ open, onClose }: ApiSettingsModalProps) {
  const { theme, style } = useThemeStore();
  const { settings, loading, error, load, save, loaded } = useApiKeysStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';

  const [inputs, setInputs] = useState<Record<KeyField, string>>(emptyMap());
  const [shows, setShows] = useState<Record<KeyField, boolean>>(emptyShow());
  const [saved, setSaved] = useState(false);
  // v1.2.10.2: 文件自动保存路径输入
  const [fileSavePathInput, setFileSavePathInput] = useState<string>('');
  // v1.3.1: 画布自动保存路径输入
  const [canvasAutoSavePathInput, setCanvasAutoSavePathInput] = useState<string>('');
  // v1.3.4: 资源库路径输入
  const [resourceLibraryPathInput, setResourceLibraryPathInput] = useState<string>('');
  // v1.3.6: 主题模板路径输入
  const [themeTemplatePathInput, setThemeTemplatePathInput] = useState<string>('');
  // 本地 Eagle API 地址
  const [eagleApiBaseInput, setEagleApiBaseInput] = useState<string>('');
  // 分类独立 Key 区块折叠状态（新手友好：默认折叠，点击展开）
  const [classifiedOpen, setClassifiedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedProvidersInput, setAdvancedProvidersInput] = useState<AdvancedProviderConfig[]>([]);
  const [activeAdvancedProviderId, setActiveAdvancedProviderId] = useState<string>('');
  const [advancedDirty, setAdvancedDirty] = useState(false);
  const [advancedTestStatus, setAdvancedTestStatus] = useState<Record<string, { loading?: boolean; ok?: boolean; message?: string }>>({});
  const [advancedComfyDrafts, setAdvancedComfyDrafts] = useState<Record<string, AdvancedProviderComfyDraft>>({});
  const [cloudUploadOpen, setCloudUploadOpen] = useState(false);
  const [cloudUploadTargetsInput, setCloudUploadTargetsInput] = useState<CloudUploadTargetConfig[]>([]);
  const [activeCloudTargetId, setActiveCloudTargetId] = useState<string>('');
  const [cloudUploadDirty, setCloudUploadDirty] = useState(false);
  const [cloudTestStatus, setCloudTestStatus] = useState<Record<string, { loading?: boolean; ok?: boolean; message?: string }>>({});
  const [backupMessage, setBackupMessage] = useState<string>('');
  // 眼睛预览拉取的明文（仅缓存，不提交）
  const revealedRef = useRef<Partial<Record<KeyField, string>>>({});

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  // 重置表单(脱敏 Key 不直接填充,留空则保持后端原值)
  useEffect(() => {
    if (open) {
      setInputs(emptyMap());
      setShows(emptyShow());
      revealedRef.current = {};
      setSaved(false);
      setBackupMessage('');
      setClassifiedOpen(false);
      setAdvancedOpen(false);
      const providers = Array.isArray((settings as any)?.advancedProviders)
        ? ((settings as any).advancedProviders as AdvancedProviderConfig[])
        : [];
      setAdvancedProvidersInput(providers);
      setActiveAdvancedProviderId(providers[0]?.id || '');
      setAdvancedDirty(false);
      setAdvancedTestStatus({});
      setAdvancedComfyDrafts({});
      setCloudUploadOpen(false);
      const cloudTargets = Array.isArray((settings as any)?.cloudUploadTargets)
        ? ((settings as any).cloudUploadTargets as CloudUploadTargetConfig[])
        : [];
      setCloudUploadTargetsInput(cloudTargets);
      setActiveCloudTargetId(cloudTargets[0]?.id || '');
      setCloudUploadDirty(false);
      setCloudTestStatus({});
      // 回填文件自动保存路径(明文字段，不脱敏)
      setFileSavePathInput((settings as any)?.fileSavePath || '');
      setCanvasAutoSavePathInput((settings as any)?.canvasAutoSavePath || '');
      setResourceLibraryPathInput((settings as any)?.resourceLibraryPath || '');
      setThemeTemplatePathInput((settings as any)?.themeTemplatePath || '');
      setEagleApiBaseInput((settings as any)?.eagleApiBase || '');
    }
  }, [open, settings]);

  if (!open) return null;

  const setInputAt = (f: KeyField, v: string) => {
    setInputs((prev) => ({ ...prev, [f]: v }));
  };

  const getCurrentEditableSettings = (): Partial<ApiSettings> => ({
    zhenzhenApiKey: inputs.zhenzhenApiKey.trim(),
    rhApiKey: inputs.rhApiKey.trim(),
    llmApiKey: inputs.llmApiKey.trim(),
    gptImageApiKey: inputs.gptImageApiKey.trim(),
    nanoBananaApiKey: inputs.nanoBananaApiKey.trim(),
    mjApiKey: inputs.mjApiKey.trim(),
    veoApiKey: inputs.veoApiKey.trim(),
    grokApiKey: inputs.grokApiKey.trim(),
    seedanceApiKey: inputs.seedanceApiKey.trim(),
    sunoApiKey: inputs.sunoApiKey.trim(),
    fileSavePath: fileSavePathInput.trim(),
    canvasAutoSavePath: canvasAutoSavePathInput.trim(),
    resourceLibraryPath: resourceLibraryPathInput.trim(),
    themeTemplatePath: themeTemplatePathInput.trim(),
    eagleApiBase: eagleApiBaseInput.trim(),
    ...(advancedDirty ? { advancedProviders: advancedProvidersInput } : {}),
    ...(cloudUploadDirty ? { cloudUploadTargets: cloudUploadTargetsInput } : {}),
  });

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportSettings = async () => {
    try {
      let raw: ApiSettings | null = null;
      try {
        raw = await getRawSettings();
      } catch {
        raw = null;
      }
      const payload = buildSettingsBackupPayload({
        raw,
        editable: getCurrentEditableSettings(),
        fixedZhenzhenBaseUrl: FIXED_ZHENZHEN_BASE,
        runningHubBaseUrl: RH_BASE,
      });
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadJson(`t8-settings-backup-${date}.json`, payload);
      setBackupMessage('已导出设置备份。注意：文件包含明文 API Key，请妥善保管。');
    } catch (e: any) {
      setBackupMessage(e?.message || '导出设置失败');
    }
  };

  const applyImportedSettings = (patch: Partial<ApiSettings>) => {
    setInputs((prev) => {
      const nextInputs = { ...prev };
      for (const field of ALL_FIELDS) {
        const value = (patch as any)[field];
        if (typeof value === 'string' && value.trim()) nextInputs[field] = value.trim();
      }
      return nextInputs;
    });
    setShows(emptyShow());
    revealedRef.current = {};
    if (typeof patch.fileSavePath === 'string') setFileSavePathInput(patch.fileSavePath);
    if (typeof patch.canvasAutoSavePath === 'string') setCanvasAutoSavePathInput(patch.canvasAutoSavePath);
    if (typeof patch.resourceLibraryPath === 'string') setResourceLibraryPathInput(patch.resourceLibraryPath);
    if (typeof patch.themeTemplatePath === 'string') setThemeTemplatePathInput(patch.themeTemplatePath);
    if (typeof patch.eagleApiBase === 'string') setEagleApiBaseInput(patch.eagleApiBase);
    if (Array.isArray(patch.advancedProviders)) {
      setAdvancedProvidersInput(patch.advancedProviders);
      setActiveAdvancedProviderId(patch.advancedProviders[0]?.id || '');
      setAdvancedDirty(true);
      setAdvancedOpen(true);
    }
    if (Array.isArray((patch as any).cloudUploadTargets)) {
      const targets = (patch as any).cloudUploadTargets as CloudUploadTargetConfig[];
      setCloudUploadTargetsInput(targets);
      setActiveCloudTargetId(targets[0]?.id || '');
      setCloudUploadDirty(true);
      setCloudUploadOpen(true);
    }
    setClassifiedOpen(true);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const patch = normalizeImportedSettings(parsed);
      if (Object.keys(patch).length === 0) {
        setBackupMessage('未读取到可导入的设置，已跳过空值和脱敏 Key。');
        return;
      }
      applyImportedSettings(patch);
      setBackupMessage('已导入到表单，请检查后点击“保存”生效。');
    } catch (e: any) {
      setBackupMessage(e?.message || '导入设置失败，请确认 JSON 文件格式。');
    } finally {
      // file input now lives inside ApiSettingsFooterActions
    }
  };

  // 眼睛点击: 如果要切为“显示”且当前 input 为空但后端已存在 key,
  // 调 /api/settings/raw 拿明文填充。
  const handleToggleShow = async (f: KeyField) => {
    const newShow = !shows[f];
    if (newShow && !inputs[f].trim() && (settings as any)[f]) {
      try {
        if (!revealedRef.current || Object.keys(revealedRef.current).length === 0) {
          const raw = await getRawSettings();
          revealedRef.current = raw as any;
        }
      } catch {
        // 忽略拉取失败
      }
      const plain = (revealedRef.current as any)?.[f];
      if (plain) setInputAt(f, String(plain));
    }
    setShows((prev) => ({ ...prev, [f]: newShow }));
  };

  const handleSave = async () => {
    const patch: Partial<ApiSettings> = {};
    for (const f of ALL_FIELDS) {
      const v = inputs[f].trim();
      if (!v) continue;
      // 眼睛拉出明文未修改 → 跳过，不走一道上行请求
      const revealed = (revealedRef.current as any)?.[f];
      if (revealed && v === String(revealed)) continue;
      (patch as any)[f] = v;
    }
    // v1.2.10.2: 文件自动保存路径变动才上行
    const newPath = (fileSavePathInput || '').trim();
    const oldPath = (settings as any)?.fileSavePath || '';
    if (newPath && newPath !== oldPath) {
      (patch as any).fileSavePath = newPath;
    }
    const newCanvasPath = (canvasAutoSavePathInput || '').trim();
    const oldCanvasPath = (settings as any)?.canvasAutoSavePath || '';
    if (newCanvasPath && newCanvasPath !== oldCanvasPath) {
      (patch as any).canvasAutoSavePath = newCanvasPath;
    }
    const newResourcePath = (resourceLibraryPathInput || '').trim();
    const oldResourcePath = (settings as any)?.resourceLibraryPath || '';
    if (newResourcePath && newResourcePath !== oldResourcePath) {
      (patch as any).resourceLibraryPath = newResourcePath;
    }
    const newThemeTemplatePath = (themeTemplatePathInput || '').trim();
    const oldThemeTemplatePath = (settings as any)?.themeTemplatePath || '';
    if (newThemeTemplatePath && newThemeTemplatePath !== oldThemeTemplatePath) {
      (patch as any).themeTemplatePath = newThemeTemplatePath;
    }
    const newEagleApiBase = (eagleApiBaseInput || '').trim();
    const oldEagleApiBase = (settings as any)?.eagleApiBase || '';
    if (newEagleApiBase && newEagleApiBase !== oldEagleApiBase) {
      (patch as any).eagleApiBase = newEagleApiBase;
    }
    if (advancedDirty) {
      (patch as any).advancedProviders = advancedProvidersInput;
    }
    if (cloudUploadDirty) {
      (patch as any).cloudUploadTargets = cloudUploadTargetsInput;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    await save(patch);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const inputCls = isPixel
    ? 't8-api-settings-input flex-1 px-3 py-2 rounded-[10px] text-sm outline-none px-input'
    : 't8-api-settings-input flex-1 px-3 py-2 rounded-md text-sm outline-none border';

  const labelCls = 't8-api-settings-label';
  const hintCls = 't8-api-settings-hint';
  const eyeBtnCls = isPixel
    ? 't8-api-settings-icon-btn px-btn px-btn--icon px-btn--ghost'
    : 't8-api-settings-icon-btn p-2 rounded-md';

  // 获取 APIKey 外部链接按钮样式（双主题）
  const linkBtnCls = isPixel
    ? 't8-api-settings-action-btn px-btn px-btn--mint flex items-center gap-1 text-[11px] px-2 py-1'
    : 't8-api-settings-action-btn flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition border';
  const linkBtnAltCls = isPixel
    ? 't8-api-settings-action-btn px-btn flex items-center gap-1 text-[11px] px-2 py-1'
    : 't8-api-settings-action-btn flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition border';

  const openExternal = (url: string) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // 志忘
    }
  };

  const advancedSummary = summarizeAdvancedProviderForm(advancedProvidersInput);
  const activeAdvancedProvider = advancedProvidersInput.find((provider) => provider.id === activeAdvancedProviderId)
    || advancedProvidersInput[0]
    || null;
  const cloudSummary = summarizeCloudUploadForm(cloudUploadTargetsInput);
  const activeCloudTarget = cloudUploadTargetsInput.find((target) => target.id === activeCloudTargetId)
    || cloudUploadTargetsInput[0]
    || null;

  const updateAdvancedProvider = (id: string, patch: Partial<AdvancedProviderConfig>) => {
    setAdvancedProvidersInput((prev) => prev.map((provider) => (
      provider.id === id ? { ...provider, ...patch } : provider
    )));
    setAdvancedDirty(true);
  };

  const updateAdvancedProviderNested = (
    id: string,
    key: 'modelscopeConfig' | 'volcengineConfig' | 'comfyuiConfig' | 'jimengConfig',
    patch: Record<string, any>,
  ) => {
    setAdvancedProvidersInput((prev) => prev.map((provider) => (
      provider.id === id
        ? { ...provider, [key]: { ...(provider as any)[key], ...patch } }
        : provider
    )));
    setAdvancedDirty(true);
  };

  const handleTestAdvancedProvider = async (provider: AdvancedProviderConfig) => {
    setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { loading: true } }));
    try {
      const result = await testAdvancedProvider({ provider, dryRun: false });
      setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: {
          ok: result.ok,
          message: result.ok ? (result.message || '连接可用') : (result.error || '测试失败'),
        },
      }));
    } catch (e: any) {
      setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: e?.message || '测试失败' },
      }));
    }
  };

  const setAdvancedProviderTestStatus = (
    providerId: string,
    next: { loading?: boolean; ok?: boolean; message?: string },
  ) => {
    setAdvancedTestStatus((prev) => ({ ...prev, [providerId]: next }));
  };

  const setAdvancedProviderComfyDraft = (providerId: string, patch: AdvancedProviderComfyDraft) => {
    setAdvancedComfyDrafts((prev) => ({ ...prev, [providerId]: { ...(prev[providerId] || {}), ...patch } }));
  };

  const updateCloudTarget = (id: string, patch: Partial<CloudUploadTargetConfig>) => {
    setCloudUploadTargetsInput((prev) => prev.map((target) => (
      target.id === id ? { ...target, ...patch } : target
    )));
    setCloudUploadDirty(true);
  };

  const updateCloudTargetNested = (
    id: string,
    key: 'tencentCos' | 'aliyunOss' | 'baiduNetdisk' | 'quarkNetdisk',
    patch: Record<string, any>,
  ) => {
    setCloudUploadTargetsInput((prev) => prev.map((target) => (
      target.id === id
        ? { ...target, [key]: { ...(target as any)[key], ...patch } }
        : target
    )));
    setCloudUploadDirty(true);
  };

  const markCloudDefault = (id: string) => {
    setCloudUploadTargetsInput((prev) => prev.map((target) => ({ ...target, isDefault: target.id === id })));
    setCloudUploadDirty(true);
  };

  const handleTestCloudTarget = async (target: CloudUploadTargetConfig) => {
    setCloudTestStatus((prev) => ({ ...prev, [target.id]: { loading: true } }));
    try {
      const result = await testCloudUploadTarget({ target });
      setCloudTestStatus((prev) => ({
        ...prev,
        [target.id]: {
          ok: result.success ? result.data.ok : false,
          message: result.success
            ? (result.data.message || '配置可用')
            : (result.error || '配置检查失败'),
        },
      }));
    } catch (e: any) {
      setCloudTestStatus((prev) => ({
        ...prev,
        [target.id]: { ok: false, message: e?.message || '配置检查失败' },
      }));
    }
  };

  const renderCloudTargetForm = (target: CloudUploadTargetConfig) => {
    return (
      <ApiSettingsCloudTargetDetailPanel
        target={target}
        isPixel={isPixel}
        inputClassName={inputCls}
        labelClassName={labelCls}
        hintClassName={hintCls}
        testStatus={cloudTestStatus[target.id]}
        onUpdateTarget={updateCloudTarget}
        onUpdateTargetNested={updateCloudTargetNested}
        onMarkDefault={markCloudDefault}
        onTestTarget={handleTestCloudTarget}
      />
    );
  };

  const renderAdvancedProviderForm = (provider: AdvancedProviderConfig) => {
    return (
      <ApiSettingsAdvancedProviderDetailPanel
        provider={provider}
        isPixel={isPixel}
        inputClassName={inputCls}
        labelClassName={labelCls}
        hintClassName={hintCls}
        linkButtonClassName={linkBtnCls}
        linkAltButtonClassName={linkBtnAltCls}
        testStatus={advancedTestStatus[provider.id]}
        comfyDraft={advancedComfyDrafts[provider.id]}
        onUpdateProvider={updateAdvancedProvider}
        onUpdateProviderNested={updateAdvancedProviderNested}
        onTestProvider={handleTestAdvancedProvider}
        onOpenExternal={openExternal}
        onSetComfyDraft={setAdvancedProviderComfyDraft}
        onSetProviderTestStatus={setAdvancedProviderTestStatus}
      />
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${
        isPixel ? 'px-modal-mask' : 'bg-black/60'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          isPixel
            ? `t8-api-settings-modal w-full ${advancedOpen || cloudUploadOpen ? 'max-w-4xl' : 'max-w-2xl'} mx-4 px-card overflow-hidden flex flex-col max-h-[90vh]`
            : `t8-api-settings-modal w-full ${advancedOpen || cloudUploadOpen ? 'max-w-4xl' : 'max-w-2xl'} mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border`
        }
      >
        {/* 头部 */}
        <div
          className={`t8-api-settings-header flex items-center gap-3 px-5 py-4 border-b shrink-0 ${
            isPixel
              ? 'border-[var(--px-ink)]'
              : ''
          }`}
        >
          <KeyRound size={18} className="t8-api-settings-icon" />
          <div className="flex-1">
            <h2
              className={`t8-api-settings-title text-base font-semibold ${isPixel ? 'px-title' : ''}`}
            >
              API Key 设置 (通用 + 分类独立)
            </h2>
            <p className={`text-xs mt-0.5 ${hintCls}`}>
              留空表示保持后端已存的 Key 不变 · 输入新值即覆盖 · 点眼睛可预览明文。
            </p>
          </div>
          <button
            onClick={onClose}
            className={
              isPixel
                ? 't8-api-settings-icon-btn px-btn px-btn--icon px-btn--ghost'
                : 't8-api-settings-icon-btn p-1.5 rounded-md'
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <div className="t8-api-settings-body p-5 space-y-5 overflow-y-auto">
          <ApiSettingsKeySections
            settings={ALL_FIELDS.reduce((acc, field) => {
              acc[field] = (settings as any)?.[field] as string | undefined;
              return acc;
            }, {} as Partial<Record<KeyField, string | undefined>>)}
            inputs={inputs}
            shows={shows}
            classifiedOpen={classifiedOpen}
            isPixel={isPixel}
            labelClassName={labelCls}
            hintClassName={hintCls}
            inputClassName={inputCls}
            eyeButtonClassName={eyeBtnCls}
            linkButtonClassName={linkBtnCls}
            altLinkButtonClassName={linkBtnAltCls}
            onChange={setInputAt}
            onToggleShow={handleToggleShow}
            onOpenExternal={openExternal}
            onToggleClassified={() => setClassifiedOpen((v) => !v)}
          />

          <ApiSettingsAdvancedProvidersSection
            open={advancedOpen}
            isPixel={isPixel}
            hintClassName={hintCls}
            providers={advancedProvidersInput}
            activeProviderId={activeAdvancedProvider?.id}
            summary={advancedSummary}
            detailPanel={activeAdvancedProvider ? renderAdvancedProviderForm(activeAdvancedProvider) : null}
            onToggle={() => setAdvancedOpen((v) => !v)}
            onSelectProvider={setActiveAdvancedProviderId}
          />

          <ApiSettingsCloudUploadSection
            open={cloudUploadOpen}
            isPixel={isPixel}
            hintClassName={hintCls}
            targets={cloudUploadTargetsInput}
            activeTargetId={activeCloudTarget?.id}
            summary={cloudSummary}
            detailPanel={activeCloudTarget ? renderCloudTargetForm(activeCloudTarget) : null}
            onToggle={() => setCloudUploadOpen((v) => !v)}
            onSelectTarget={setActiveCloudTargetId}
          />

          <ApiSettingsLocalPathsSection
            fileSavePathInput={fileSavePathInput}
            canvasAutoSavePathInput={canvasAutoSavePathInput}
            resourceLibraryPathInput={resourceLibraryPathInput}
            themeTemplatePathInput={themeTemplatePathInput}
            eagleApiBaseInput={eagleApiBaseInput}
            labelClassName={labelCls}
            hintClassName={hintCls}
            inputClassName={inputCls}
            isDark={isDark}
            isPixel={isPixel}
            error={error || undefined}
            backupMessage={backupMessage || undefined}
            onFileSavePathChange={setFileSavePathInput}
            onCanvasAutoSavePathChange={setCanvasAutoSavePathInput}
            onResourceLibraryPathChange={setResourceLibraryPathInput}
            onThemeTemplatePathChange={setThemeTemplatePathInput}
            onEagleApiBaseChange={setEagleApiBaseInput}
          />
        </div>

        <ApiSettingsFooterActions
          loading={loading}
          saved={saved}
          isPixel={isPixel}
          onImportFile={handleImportFile}
          onExportSettings={handleExportSettings}
          onClose={onClose}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}


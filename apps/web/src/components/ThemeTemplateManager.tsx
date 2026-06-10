import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Palette,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BUILT_IN_THEME_TEMPLATES,
  getTemplateMode,
  resolveThemeTemplate,
} from '../theme/defaultTemplates';
import { getThemeContrastWarnings } from '../theme/validateTheme';
import type {
  LegacyThemeStyle,
  ThemeMode,
  ThemeTemplate,
  ThemeTokens,
  ThemeVisuals,
} from '../theme/types';
import { useThemeStore } from '../stores/theme';

interface ThemeTemplateManagerProps {
  open: boolean;
  onClose: () => void;
}

const COLOR_FIELDS: Array<[keyof ThemeTokens, string]> = [
  ['appBg', '应用背景'],
  ['canvasBg', '画布背景'],
  ['panelBg', '面板'],
  ['panelBgElevated', '浮层'],
  ['panelBgMuted', '弱背景'],
  ['nodeBg', '节点'],
  ['nodeHeaderBg', '节点标题'],
  ['textMain', '主文字'],
  ['textMuted', '次文字'],
  ['textDim', '弱文字'],
  ['border', '边框'],
  ['borderStrong', '强边框'],
  ['accent', '主色'],
  ['accentHover', '主色悬停'],
  ['accentText', '主按钮文字'],
  ['secondary', '副色'],
  ['warning', '警告'],
  ['danger', '危险'],
  ['success', '成功'],
  ['gridDot', '网格点'],
  ['edge', '连线'],
  ['edgeSelected', '选中连线'],
  ['portText', '文本端口'],
  ['portImage', '图片端口'],
  ['portVideo', '视频端口'],
  ['portAudio', '音频端口'],
];

const TEXT_FIELDS: Array<[keyof ThemeTokens, string]> = [
  ['shadowPanel', '面板阴影'],
  ['shadowButton', '按钮阴影'],
  ['shadowStrong', '强阴影'],
  ['radiusPanel', '面板圆角'],
  ['radiusButton', '按钮圆角'],
  ['radiusNode', '节点圆角'],
  ['fontFamily', '正文字体'],
  ['displayFont', '标题字体'],
];

const VISUAL_STYLE_OPTIONS = [
  { value: 'plain', label: '基础语义' },
  { value: 'tech', label: '科技视觉' },
  { value: 'pixel', label: '像素糖果' },
  { value: 'op', label: 'OP 航海' },
  { value: 'rh', label: 'RH 工作台' },
  { value: 'naruto', label: '火影忍者' },
  { value: 'eva', label: 'EVA 指挥' },
  { value: 'yyh', label: '幽游白书' },
  { value: 'slamdunk', label: '灌篮高手' },
  { value: 'soccer-hero', label: '足球小将' },
] as const;

const VISUAL_INTENSITY_OPTIONS = [
  { value: 'subtle', label: '轻量' },
  { value: 'medium', label: '标准' },
  { value: 'strong', label: '强识别' },
] as const;

function fallbackVisuals(legacyStyle: LegacyThemeStyle): ThemeVisuals {
  return {
    style: legacyStyle === 'tech' ? 'tech' : 'pixel',
    intensity: 'medium',
    iconPack: 'default',
    canvasPattern: legacyStyle === 'tech' ? 'circuit' : 'dots',
    nodeFrame: legacyStyle === 'tech' ? 'glass' : 'sticker',
    headerMark: '',
  };
}

function visualDefaultsFor(style: ThemeVisuals['style'], legacyStyle: LegacyThemeStyle, prev?: ThemeVisuals): ThemeVisuals {
  if (style === 'op') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'op',
      canvasPattern: 'map',
      nodeFrame: 'wanted',
      headerMark: prev?.headerMark || 'ONE PIECE',
    };
  }
  if (style === 'rh') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'default',
      canvasPattern: 'hub',
      nodeFrame: 'hub-card',
      headerMark: prev?.headerMark || 'RH',
    };
  }
  if (style === 'naruto') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'naruto',
      canvasPattern: 'chakra',
      nodeFrame: 'shinobi-scroll',
      headerMark: prev?.headerMark || 'KONOHA',
    };
  }
  if (style === 'eva') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'eva',
      canvasPattern: 'eva-grid',
      nodeFrame: 'eva-panel',
      headerMark: prev?.headerMark || 'EVA',
    };
  }
  if (style === 'yyh') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'yyh',
      canvasPattern: 'spirit-map',
      nodeFrame: 'spirit-case',
      headerMark: prev?.headerMark || 'REI GUN',
    };
  }
  if (style === 'slamdunk') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'slamdunk',
      canvasPattern: 'court',
      nodeFrame: 'scoreboard-card',
      headerMark: prev?.headerMark || 'BUZZER BEATER',
    };
  }
  if (style === 'soccer-hero') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'soccer',
      canvasPattern: 'pitch',
      nodeFrame: 'match-card',
      headerMark: prev?.headerMark || 'GOLDEN GOAL',
    };
  }
  if (style === 'tech') {
    return {
      ...fallbackVisuals(legacyStyle),
      ...(prev || {}),
      style,
      iconPack: 'default',
      canvasPattern: 'circuit',
      nodeFrame: 'glass',
    };
  }
  return {
    ...fallbackVisuals(legacyStyle),
    ...(prev || {}),
    style,
    iconPack: 'default',
    canvasPattern: style === 'plain' ? 'none' : 'dots',
    nodeFrame: style === 'plain' ? 'plain' : 'sticker',
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function cleanId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function makeCustomCopy(template: ThemeTemplate): ThemeTemplate {
  const id = cleanId(`${template.id}-custom-${Date.now().toString(36)}`);
  return {
    ...deepClone(template),
    id,
    name: `${template.name} 副本`,
    builtIn: false,
    author: template.author || 'T8',
  };
}

function downloadJson(template: ThemeTemplate) {
  const blob = new Blob([JSON.stringify({ ...template, builtIn: false }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.id || 't8-theme'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function makePreviewStyle(tokens: ThemeTokens): CSSProperties {
  return {
    '--t8-bg-app': tokens.appBg,
    '--t8-bg-canvas': tokens.canvasBg,
    '--t8-bg-panel': tokens.panelBg,
    '--t8-bg-panel-elevated': tokens.panelBgElevated,
    '--t8-bg-panel-muted': tokens.panelBgMuted,
    '--t8-bg-node': tokens.nodeBg,
    '--t8-bg-node-header': tokens.nodeHeaderBg,
    '--t8-text-main': tokens.textMain,
    '--t8-text-muted': tokens.textMuted,
    '--t8-text-dim': tokens.textDim,
    '--t8-border': tokens.border,
    '--t8-border-strong': tokens.borderStrong,
    '--t8-accent': tokens.accent,
    '--t8-accent-hover': tokens.accentHover,
    '--t8-accent-text': tokens.accentText,
    '--t8-secondary': tokens.secondary,
    '--t8-warning': tokens.warning,
    '--t8-danger': tokens.danger,
    '--t8-success': tokens.success,
    '--t8-grid-dot': tokens.gridDot,
    '--t8-edge': tokens.edge,
    '--t8-edge-selected': tokens.edgeSelected,
    '--t8-port-text': tokens.portText,
    '--t8-port-image': tokens.portImage,
    '--t8-port-video': tokens.portVideo,
    '--t8-port-audio': tokens.portAudio,
    '--t8-shadow-panel': tokens.shadowPanel,
    '--t8-shadow-button': tokens.shadowButton,
    '--t8-shadow-strong': tokens.shadowStrong,
    '--t8-radius-panel': tokens.radiusPanel,
    '--t8-radius-button': tokens.radiusButton,
    '--t8-radius-node': tokens.radiusNode,
    '--t8-font-family': tokens.fontFamily,
    '--t8-display-font': tokens.displayFont,
  } as CSSProperties;
}

export default function ThemeTemplateManager({ open, onClose }: ThemeTemplateManagerProps) {
  const {
    theme,
    templateId,
    customTemplates,
    templatesPath,
    templatesError,
    setTemplate,
    setTheme,
    loadCustomTemplates,
    importTemplate,
    saveCustomTemplate,
    deleteCustomTemplate,
  } = useThemeStore();
  const allTemplates = useMemo(() => [...BUILT_IN_THEME_TEMPLATES, ...customTemplates], [customTemplates]);
  const activeTemplate = resolveThemeTemplate(templateId, customTemplates);
  const [mode, setMode] = useState<ThemeMode>(theme);
  const [selectedId, setSelectedId] = useState(activeTemplate.id);
  const [editor, setEditor] = useState<ThemeTemplate>(() => deepClone(activeTemplate));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    loadCustomTemplates();
  }, [open, loadCustomTemplates]);

  useEffect(() => {
    if (!open) return;
    const tpl = allTemplates.find((item) => item.id === selectedId);
    if (!tpl) return;
    setEditor(deepClone(tpl));
    setMode(theme);
  }, [open, selectedId, allTemplates, theme]);

  if (!open) return null;

  const selectedBuiltIn = !!editor.builtIn || BUILT_IN_THEME_TEMPLATES.some((tpl) => tpl.id === editor.id);
  const tokens = getTemplateMode(editor, mode).tokens;
  const visuals = editor.visuals || fallbackVisuals(editor.legacyStyle);
  const warnings = getThemeContrastWarnings(editor, mode);
  const currentModeActive = activeTemplate.id === editor.id && theme === mode;

  const setToken = (key: keyof ThemeTokens, value: string) => {
    setEditor((prev) => ({
      ...prev,
      modes: {
        ...prev.modes,
        [mode]: {
          tokens: {
            ...prev.modes[mode].tokens,
            [key]: value,
          },
        },
      },
    }));
  };

  const setVisual = <K extends keyof ThemeVisuals>(key: K, value: ThemeVisuals[K]) => {
    setEditor((prev) => ({
      ...prev,
      visuals: {
        ...fallbackVisuals(prev.legacyStyle),
        ...(prev.visuals || {}),
        [key]: value,
      },
    }));
  };

  const handleApply = () => {
    setTemplate(editor.id, mode);
    setTheme(mode);
    setMessage('已应用主题');
    window.setTimeout(() => setMessage(''), 1200);
  };

  const handleDuplicate = () => {
    const copy = makeCustomCopy(editor);
    setEditor(copy);
    setSelectedId(copy.id);
    setMessage('已复制为自定义模板，保存后生效');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const withVisuals = { ...editor, visuals: editor.visuals || fallbackVisuals(editor.legacyStyle) };
      const payload = selectedBuiltIn ? makeCustomCopy(withVisuals) : { ...withVisuals, builtIn: false };
      const saved = await saveCustomTemplate(payload);
      setSelectedId(saved.id);
      setEditor(deepClone(saved));
      setMessage('主题已保存');
    } catch (e: any) {
      setError(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedBuiltIn) return;
    if (!window.confirm(`删除自定义主题「${editor.name}」？`)) return;
    setSaving(true);
    setError('');
    try {
      await deleteCustomTemplate(editor.id);
      setSelectedId(activeTemplate.id === editor.id ? BUILT_IN_THEME_TEMPLATES[1].id : activeTemplate.id);
      setMessage('主题已删除');
    } catch (e: any) {
      setError(e?.message || '删除失败');
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const raw = JSON.parse(await file.text());
      const saved = await importTemplate(raw);
      setSelectedId(saved.id);
      setEditor(deepClone(saved));
      setMessage('主题已导入并应用');
    } catch (e: any) {
      setError(e?.message || '导入失败');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-modal-mask"
      style={{ zIndex: 10000 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(1120px,94vw)] h-[min(760px,92vh)] t8-panel overflow-hidden flex flex-col">
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--t8-border)' }}>
          <Palette size={18} />
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold">主题模板</div>
            <div className="text-[11px]" style={{ color: 'var(--t8-text-muted)' }}>
              {templatesPath || 'D:\\zhenzhen\\theme-templates'}
            </div>
          </div>
          {message && (
            <span className="t8-chip px-2 py-1 text-[11px]">
              <Check size={12} /> {message}
            </span>
          )}
          <button className="t8-btn px-2 py-2" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[250px_1fr_310px]">
          <aside className="border-r p-3 overflow-y-auto" style={{ borderColor: 'var(--t8-border)' }}>
            <div className="text-[11px] font-bold mb-2" style={{ color: 'var(--t8-text-muted)' }}>内置模板</div>
            {BUILT_IN_THEME_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                className={`w-full text-left px-3 py-2 mb-2 t8-card ${selectedId === tpl.id ? 'ring-2' : ''}`}
                style={{ borderColor: selectedId === tpl.id ? 'var(--t8-border-strong)' : undefined }}
                onClick={() => setSelectedId(tpl.id)}
              >
                <div className="text-sm font-bold">{tpl.name}</div>
                <div className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--t8-text-muted)' }}>{tpl.description}</div>
              </button>
            ))}
            <div className="text-[11px] font-bold mt-4 mb-2" style={{ color: 'var(--t8-text-muted)' }}>自定义模板</div>
            {customTemplates.length === 0 && (
              <div className="text-[11px] px-3 py-2 rounded" style={{ color: 'var(--t8-text-dim)', background: 'var(--t8-bg-panel-muted)' }}>
                暂无自定义模板
              </div>
            )}
            {customTemplates.map((tpl) => (
              <button
                key={tpl.id}
                className={`w-full text-left px-3 py-2 mb-2 t8-card ${selectedId === tpl.id ? 'ring-2' : ''}`}
                style={{ borderColor: selectedId === tpl.id ? 'var(--t8-border-strong)' : undefined }}
                onClick={() => setSelectedId(tpl.id)}
              >
                <div className="text-sm font-bold">{tpl.name}</div>
                <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--t8-text-muted)' }}>{tpl.id}</div>
              </button>
            ))}
          </aside>

          <main className="p-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">
                模板名称
                <input
                  className="t8-input mt-1 w-full px-3 py-2 text-sm"
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="text-xs font-bold">
                兼容风格
                <select
                  className="t8-select mt-1 w-full px-3 py-2 text-sm"
                  value={editor.legacyStyle}
                  onChange={(e) => {
                    const legacyStyle = e.target.value === 'tech' ? 'tech' : 'pixel';
                    setEditor((prev) => ({
                      ...prev,
                      legacyStyle,
                    }));
                  }}
                >
                  <option value="tech">科技风组件兼容</option>
                  <option value="pixel">像素风组件兼容</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                视觉语言
                <select
                  className="t8-select mt-1 w-full px-3 py-2 text-sm"
                  value={visuals.style}
                  onChange={(e) => {
                    const style = e.target.value as ThemeVisuals['style'];
                    setEditor((prev) => {
                      const nextVisuals = visualDefaultsFor(style, prev.legacyStyle, prev.visuals);
                      return {
                        ...prev,
                        visuals: nextVisuals,
                      };
                    });
                  }}
                >
                  {VISUAL_STYLE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                装饰强度
                <select
                  className="t8-select mt-1 w-full px-3 py-2 text-sm"
                  value={visuals.intensity || 'medium'}
                  onChange={(e) => setVisual('intensity', e.target.value as ThemeVisuals['intensity'])}
                >
                  {VISUAL_INTENSITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold col-span-2">
                描述
                <input
                  className="t8-input mt-1 w-full px-3 py-2 text-sm"
                  value={editor.description || ''}
                  onChange={(e) => setEditor((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
            </div>

            <div className="flex items-center gap-2 mt-4">
              {(['light', 'dark'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  className={`t8-btn px-3 py-1.5 text-xs ${mode === m ? 't8-btn-primary' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'light' ? '白天模式' : '黑夜模式'}
                </button>
              ))}
              {currentModeActive && <span className="t8-chip px-2 py-1 text-[11px]">当前应用中</span>}
            </div>

            {warnings.length > 0 && (
              <div className="mt-4 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--t8-warning)', background: 'var(--t8-bg-panel-muted)' }}>
                <div className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={13} /> 可读性提醒</div>
                {warnings.map((w) => <div key={w} style={{ color: 'var(--t8-text-muted)' }}>{w}</div>)}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map(([key, label]) => (
                <label key={key} className="text-[11px] font-bold">
                  {label}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={String(tokens[key]).startsWith('#') ? String(tokens[key]) : '#000000'}
                      onChange={(e) => setToken(key, e.target.value)}
                      className="w-9 h-9 rounded overflow-hidden border"
                      style={{ borderColor: 'var(--t8-border)' }}
                    />
                    <input
                      className="t8-input flex-1 px-2 py-2 text-xs font-mono"
                      value={String(tokens[key])}
                      onChange={(e) => setToken(key, e.target.value)}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {TEXT_FIELDS.map(([key, label]) => (
                <label key={key} className="text-[11px] font-bold">
                  {label}
                  <input
                    className="t8-input mt-1 w-full px-2 py-2 text-xs font-mono"
                    value={String(tokens[key])}
                    onChange={(e) => setToken(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </main>

          <aside className="border-l p-4 overflow-y-auto" style={{ borderColor: 'var(--t8-border)' }}>
            <div className="text-xs font-bold mb-3">预览</div>
            <div
              className="t8-theme-preview t8-card p-3"
              data-theme-style={editor.legacyStyle}
              data-theme-mode={mode}
              data-theme-visual={visuals.style}
              data-theme-intensity={visuals.intensity || 'medium'}
              data-theme-node-frame={visuals.nodeFrame || 'plain'}
              style={{ ...makePreviewStyle(tokens), background: tokens.canvasBg }}
            >
              <div className="t8-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{editor.name}</span>
                  <span className="t8-chip px-2 py-1 text-[10px]">{mode === 'light' ? '白天' : '黑夜'}</span>
                </div>
                <div className="mt-3 t8-node overflow-hidden">
                  <div className="t8-node-header px-3 py-2 text-xs font-bold">示例节点</div>
                  <div className="p-3 space-y-2">
                    <input className="t8-input w-full px-2 py-2 text-xs" placeholder="输入框文字" />
                    <div className="flex gap-2">
                      <button className="t8-btn t8-btn-primary px-3 py-1.5 text-xs">运行</button>
                      <button className="t8-btn px-3 py-1.5 text-xs">取消</button>
                    </div>
                    <div className="flex gap-2">
                      {[
                        ['image', tokens.portImage],
                        ['video', tokens.portVideo],
                        ['audio', tokens.portAudio],
                      ].map(([label, color]) => (
                        <span key={label} className="t8-chip px-2 py-1 text-[10px]" style={{ background: color as string }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
            {templatesError && <div className="mt-3 text-xs text-amber-400">{templatesError}</div>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="t8-btn t8-btn-primary px-3 py-2 text-xs" onClick={handleApply}>
                <Check size={14} /> 应用
              </button>
              <button className="t8-btn px-3 py-2 text-xs" onClick={handleDuplicate}>
                <Copy size={14} /> 复制
              </button>
              <button className="t8-btn px-3 py-2 text-xs" onClick={handleSave} disabled={saving}>
                <Save size={14} /> 保存
              </button>
              <button className="t8-btn px-3 py-2 text-xs" onClick={() => downloadJson({ ...editor, visuals })}>
                <Download size={14} /> 导出
              </button>
              <button className="t8-btn px-3 py-2 text-xs" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> 导入
              </button>
              <button
                className="t8-btn px-3 py-2 text-xs"
                onClick={handleDelete}
                disabled={selectedBuiltIn || saving}
                title={selectedBuiltIn ? '内置模板不可删除' : '删除自定义模板'}
              >
                <Trash2 size={14} /> 删除
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImportFile(e.target.files?.[0])}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

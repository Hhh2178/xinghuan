import { THEME_TEMPLATE_VERSION } from './types';
import type { ThemeMode, ThemeTemplate, ThemeTokens } from './types';

export const DEFAULT_THEME_TEMPLATE_ID = 'tech-default';
export const TECH_TEMPLATE_ID = 'tech-default';

const techDark: ThemeTokens = {
  appBg: '#09090b',
  canvasBg: '#0a0a0b',
  panelBg: '#18181b',
  panelBgElevated: '#27272a',
  panelBgMuted: '#111113',
  nodeBg: 'rgba(24,24,27,0.94)',
  nodeHeaderBg: 'rgba(14,165,233,0.12)',
  textMain: '#f4f4f5',
  textMuted: '#d4d4d8',
  textDim: '#a1a1aa',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(125,211,252,0.45)',
  accent: '#38bdf8',
  accentHover: '#0ea5e9',
  accentText: '#031522',
  secondary: '#a78bfa',
  warning: '#f59e0b',
  danger: '#f87171',
  success: '#34d399',
  shadowPanel: '0 18px 50px rgba(0,0,0,0.42)',
  shadowButton: '0 0 18px rgba(56,189,248,0.18)',
  shadowStrong: '0 24px 70px rgba(0,0,0,0.55)',
  radiusPanel: '14px',
  radiusButton: '8px',
  radiusNode: '12px',
  gridDot: '#27272a',
  edge: '#71717a',
  edgeSelected: '#fb923c',
  selectionBg: 'rgba(14,165,233,0.16)',
  selectionBorder: '#38bdf8',
  portText: '#7dd3fc',
  portImage: '#fcd34d',
  portVideo: '#fda4af',
  portAudio: '#c4b5fd',
  fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  displayFont: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const techLight: ThemeTokens = {
  ...techDark,
  appBg: '#fafafa',
  canvasBg: '#fafafa',
  panelBg: '#ffffff',
  panelBgElevated: '#f4f4f5',
  panelBgMuted: '#f8fafc',
  nodeBg: 'rgba(255,255,255,0.96)',
  nodeHeaderBg: 'rgba(14,165,233,0.10)',
  textMain: '#18181b',
  textMuted: '#3f3f46',
  textDim: '#71717a',
  border: 'rgba(0,0,0,0.10)',
  borderStrong: 'rgba(2,132,199,0.40)',
  accent: '#0284c7',
  accentHover: '#0369a1',
  accentText: '#ffffff',
  secondary: '#7c3aed',
  warning: '#d97706',
  danger: '#dc2626',
  success: '#059669',
  shadowPanel: '0 18px 45px rgba(15,23,42,0.12)',
  shadowButton: '0 8px 18px rgba(2,132,199,0.18)',
  shadowStrong: '0 24px 70px rgba(15,23,42,0.18)',
  gridDot: '#d4d4d8',
  edge: '#a1a1aa',
  edgeSelected: '#ea580c',
  selectionBg: 'rgba(14,165,233,0.12)',
  selectionBorder: '#0284c7',
};

export const BUILT_IN_THEME_TEMPLATES: ThemeTemplate[] = [
  {
    schema: 't8-theme-template',
    version: THEME_TEMPLATE_VERSION,
    id: TECH_TEMPLATE_ID,
    name: '科技风',
    description: '玻璃拟态、细边框、冷色发光的默认科技视觉。',
    author: 'T8',
    builtIn: true,
    legacyStyle: 'tech',
    visuals: {
      style: 'tech',
      intensity: 'medium',
      iconPack: 'default',
      canvasPattern: 'circuit',
      nodeFrame: 'glass',
      headerMark: '科技',
    },
    modes: { dark: { tokens: techDark }, light: { tokens: techLight } },
  },
];

export function resolveThemeTemplate(
  templateId?: string,
  customTemplates: ThemeTemplate[] = [],
): ThemeTemplate {
  return (
    customTemplates.find((tpl) => tpl.id === templateId) ||
    BUILT_IN_THEME_TEMPLATES.find((tpl) => tpl.id === templateId) ||
    BUILT_IN_THEME_TEMPLATES.find((tpl) => tpl.id === DEFAULT_THEME_TEMPLATE_ID) ||
    BUILT_IN_THEME_TEMPLATES[0]
  );
}

export function getTemplateMode(template: ThemeTemplate, mode: ThemeMode) {
  return template.modes[mode] || template.modes.light || template.modes.dark;
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BUILT_IN_THEME_TEMPLATES,
  DEFAULT_THEME_TEMPLATE_ID,
  TECH_TEMPLATE_ID,
  resolveThemeTemplate,
} from '../theme/defaultTemplates';
import type { LegacyThemeStyle, ThemeMode, ThemeTemplate } from '../theme/types';

export type CanvasTheme = ThemeMode;
export type ThemeStyle = LegacyThemeStyle;

interface ThemeState {
  theme: CanvasTheme;
  style: ThemeStyle;
  templateId: string;
  customTemplates: ThemeTemplate[];
  toggleTheme: () => void;
  setTheme: (theme: CanvasTheme) => void;
  setTemplate: (templateId: string, mode?: CanvasTheme) => void;
}

/**
 * 主题状态管理。
 * - theme: dark | light 明暗模式
 * - style: 仅保留 tech 兼容字段
 * - templateId: 当前模板 ID，新主题体系的主入口
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      style: 'tech',
      templateId: DEFAULT_THEME_TEMPLATE_ID,
      customTemplates: [],
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
      setTemplate: (templateId, mode) => {
        const tpl = resolveThemeTemplate(templateId);
        set({ templateId: tpl.id, style: tpl.legacyStyle, ...(mode ? { theme: mode } : {}) });
      },
    }),
    {
      name: 'xinghuan-canvas-theme-tech-v1',
      partialize: (state) => ({
        theme: state.theme,
        style: state.style,
        templateId: state.templateId,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<ThemeState>;
        const templateId = p.templateId || TECH_TEMPLATE_ID;
        const tpl = BUILT_IN_THEME_TEMPLATES.find((item) => item.id === templateId);
        return {
          ...current,
          ...p,
          templateId,
          style: tpl?.legacyStyle || 'tech',
          theme: p.theme === 'light' ? 'light' : 'dark',
        };
      },
    }
  )
);

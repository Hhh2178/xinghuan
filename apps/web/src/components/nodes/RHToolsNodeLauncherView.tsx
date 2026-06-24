import { type CSSProperties, type ChangeEvent, type RefObject } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Download, Pencil, Plus, Search, Sparkles, Upload } from 'lucide-react';

import ResizableCorners from './ResizableCorners';
import RHToolEditorModal from './RHToolEditorModal';
import type { RHTool } from '../../services/api';

interface RHToolsNodeLauncherViewProps {
  selected: boolean;
  size: { w: number; h: number };
  accent: string;
  accentSoft: string;
  ringColor: string;
  bg: string;
  surface: string;
  surfaceHover: string;
  text: string;
  subText: string;
  border: string;
  isLight: boolean;
  activeCategoryId: string;
  searchQuery: string;
  searchVisible: boolean;
  transferMsg: string;
  categories: Array<{ id: string; name: string }>;
  tools: RHTool[];
  filteredTools: RHTool[];
  hoveredId: string | null;
  previewApp?: RHTool;
  showEditor: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  onResize: (_event: any, payload: { width: number; height: number }) => void;
  onToggleSearch: () => void;
  onSearchChange: (value: string) => void;
  onOpenEditor: () => void;
  onExportBackup: () => void;
  onTriggerImport: () => void;
  onImportBackup: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectTool: (toolId: string) => void;
  onHoverTool: (toolId: string | null) => void;
  onCloseEditor: () => void;
}

const handleStyle: CSSProperties = { zIndex: 10 };

export default function RHToolsNodeLauncherView({
  selected,
  size,
  accent,
  accentSoft,
  ringColor,
  bg,
  surface,
  surfaceHover,
  text,
  subText,
  border,
  isLight,
  activeCategoryId,
  searchQuery,
  searchVisible,
  transferMsg,
  categories,
  tools,
  filteredTools,
  hoveredId,
  previewApp,
  showEditor,
  searchInputRef,
  importInputRef,
  onResize,
  onToggleSearch,
  onSearchChange,
  onOpenEditor,
  onExportBackup,
  onTriggerImport,
  onImportBackup,
  onSelectCategory,
  onSelectTool,
  onHoverTool,
  onCloseEditor,
}: RHToolsNodeLauncherViewProps) {
  return (
    <div
      className="t8-rh-tools-node relative rounded-xl flex flex-col shadow-lg"
      style={{
        background: bg,
        color: text,
        width: size.w,
        height: size.h,
        minWidth: 280,
        minHeight: 320,
        boxSizing: 'border-box',
        border: `2px solid ${selected ? accent : ringColor}`,
        overflow: 'visible',
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-400 !border-0" style={handleStyle} />
      <Handle type="source" position={Position.Right} className="!bg-cyan-400 !border-0" style={handleStyle} />

      <ResizableCorners
        selected={selected}
        minWidth={280}
        minHeight={320}
        accent={accent}
        onResize={onResize}
      />

      <div className="flex-1 flex flex-col rounded-xl overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <div
            className="flex items-center justify-center"
            style={{ width: 24, height: 24, borderRadius: 6, background: accentSoft, color: accent }}
          >
            <Sparkles size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">RH 超市</div>
            <div className="text-[10px] truncate" style={{ color: subText }}>RunningHub 应用启动器</div>
          </div>
          <button
            onClick={onToggleSearch}
            onMouseDown={(event) => event.stopPropagation()}
            className="p-1 rounded hover:opacity-80 nodrag"
            title="搜索"
            style={{ color: searchVisible ? accent : subText }}
          >
            <Search size={14} />
          </button>
        </div>

        {searchVisible && (
          <div className="px-3 py-2 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
            <input
              ref={searchInputRef}
              className="nodrag nowheel"
              placeholder="搜索（支持中文/拼音首字母，如 hy）"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                width: '100%',
                background: surface,
                color: text,
                border: `1px solid ${border}`,
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                outline: 'none',
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 px-3 pt-2 shrink-0">
          <button
            onClick={onOpenEditor}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex-1 py-1.5 rounded text-xs nodrag flex items-center justify-center gap-1"
            style={{ background: surface, color: text, border: `1px solid ${border}` }}
            onMouseEnter={(event) => (event.currentTarget.style.background = surfaceHover)}
            onMouseLeave={(event) => (event.currentTarget.style.background = surface)}
          >
            <Plus size={11} /> 增加
          </button>
          <button
            onClick={onOpenEditor}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex-1 py-1.5 rounded text-xs nodrag flex items-center justify-center gap-1"
            style={{ background: surface, color: text, border: `1px solid ${border}` }}
            onMouseEnter={(event) => (event.currentTarget.style.background = surfaceHover)}
            onMouseLeave={(event) => (event.currentTarget.style.background = surface)}
          >
            <Pencil size={11} /> 编辑
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 px-3 py-2 shrink-0">
          <button
            onClick={onExportBackup}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex-1 py-1.5 rounded text-xs nodrag flex items-center justify-center gap-1"
            style={{ background: surface, color: text, border: `1px solid ${border}` }}
            title="导出 RH 超市 JSON"
            onMouseEnter={(event) => (event.currentTarget.style.background = surfaceHover)}
            onMouseLeave={(event) => (event.currentTarget.style.background = surface)}
          >
            <Download size={11} /> 导出
          </button>
          <button
            onClick={onTriggerImport}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex-1 py-1.5 rounded text-xs nodrag flex items-center justify-center gap-1"
            style={{ background: accent, color: '#fff', border: `1px solid ${accent}` }}
            title="导入 RH 超市 JSON，会先提示确认"
          >
            <Upload size={11} /> 导入
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportBackup}
          />
        </div>

        {transferMsg && (
          <div className="px-3 pb-2 shrink-0">
            <div
              className="text-[10px] px-2 py-1 rounded truncate"
              title={transferMsg}
              style={{
                background: surface,
                color: transferMsg.includes('失败') ? '#ef4444' : accent,
                border: `1px solid ${border}`,
              }}
            >
              {transferMsg}
            </div>
          </div>
        )}

        <div
          className="flex gap-1 px-3 pb-2 overflow-x-auto shrink-0 nodrag nowheel"
          style={{ scrollbarWidth: 'thin' }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {categories.map((category) => {
            const active = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className="px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap nodrag"
                style={{
                  background: active ? accent : surface,
                  color: active ? '#fff' : subText,
                  border: `1px solid ${active ? accent : border}`,
                }}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        <div
          className="flex-1 overflow-y-auto px-3 pb-2 nodrag nowheel"
          style={{ minHeight: 0 }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {tools.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[11px] text-center" style={{ color: subText }}>
              暂无应用
              <br />
              点击「+ 增加」开始添加
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[11px]" style={{ color: subText }}>
              无匹配结果
            </div>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {filteredTools.map((tool) => {
                const isHover = hoveredId === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => onSelectTool(tool.id)}
                    onMouseEnter={() => onHoverTool(tool.id)}
                    onMouseLeave={() => onHoverTool(null)}
                    title={tool.description || tool.title}
                    className="rounded text-xs px-2 py-1.5 text-center truncate nodrag"
                    style={{
                      background: isHover ? accent : surface,
                      color: isHover ? '#fff' : text,
                      border: `1px solid ${isHover ? accent : border}`,
                      transition: 'background 0.15s',
                    }}
                  >
                    {tool.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="px-3 py-2 shrink-0"
          style={{ borderTop: `1px solid ${border}`, minHeight: 44, background: surface }}
        >
          {previewApp ? (
            <div>
              <div className="text-[11px] font-medium truncate" style={{ color: accent }}>
                ⚡ {previewApp.title}
              </div>
              <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: subText, lineHeight: 1.3 }}>
                {previewApp.description || `webappId: ${previewApp.webappId}`}
              </div>
            </div>
          ) : (
            <div className="text-[10px]" style={{ color: subText }}>
              悬停应用查看简介，点击启动 · 共 {tools.length} 个应用 / {categories.length} 个分类
            </div>
          )}
        </div>
      </div>

      <RHToolEditorModal
        isOpen={showEditor}
        onClose={onCloseEditor}
        isLight={isLight}
        defaultCategoryId={activeCategoryId}
      />
    </div>
  );
}

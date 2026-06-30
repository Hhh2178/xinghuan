import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowDownAZ, Ban, Play, Repeat, ToggleLeft, ToggleRight, Workflow } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import { resolveThemeTemplate } from '../../theme/defaultTemplates';
import { useGroupBusStore } from '../../stores/groupBus';
import { useUpdateNodeData } from './useUpdateNodeData';
import type { GroupExecutionManagerData } from '../canvas/groupExecutionManager';

interface ManagerItem {
  groupId: string;
  groupName: string;
  skipped: boolean;
}

const GroupExecutionManagerNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme, style, templateId } = useThemeStore();
  const currentTemplate = useMemo(
    () => resolveThemeTemplate(templateId),
    [templateId],
  );
  const visualStyle = currentTemplate.visuals?.style || style;
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const d = data as Partial<GroupExecutionManagerData> & { groups?: ManagerItem[] };
  const groups = Array.isArray(d.groups) ? d.groups : [];
  const title = typeof d.title === 'string' && d.title.trim() ? d.title : '全局组执行管理';
  const note = typeof d.note === 'string' ? d.note : '';
  const groupOrder = Array.isArray(d.groupOrder) ? d.groupOrder : [];
  const skippedGroupIds = new Set(Array.isArray(d.skippedGroupIds) ? d.skippedGroupIds : []);
  const enabled = d.enabled !== false;
  const executionCount = Number.isFinite(Number(d.executionCount)) ? Math.max(1, Math.floor(Number(d.executionCount))) : 1;
  const requestRunAll = useGroupBusStore((state) => state.requestRunAll);

  const normalizedGroups = useMemo(() => {
    const mapped = new Map<string, ManagerItem>();
    groups.forEach((group) => {
      if (!group?.groupId) return;
      mapped.set(group.groupId, {
        groupId: group.groupId,
        groupName: group.groupName || group.groupId,
        skipped: skippedGroupIds.has(group.groupId),
      });
    });
    return groupOrder.map((groupId) => mapped.get(groupId)).filter(Boolean) as ManagerItem[];
  }, [groupOrder, groups, skippedGroupIds]);

  const patchGroupOrder = (nextGroups: ManagerItem[]) => {
    update({
      groupOrder: nextGroups.map((group) => group.groupId),
      skippedGroupIds: nextGroups.filter((group) => group.skipped).map((group) => group.groupId),
      groups: nextGroups,
    });
  };

  const moveGroup = (index: number, delta: number) => {
    const next = [...normalizedGroups];
    const target = next[index];
    if (!target) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= next.length) return;
    const swap = next[nextIndex];
    next[nextIndex] = target;
    next[index] = swap;
    patchGroupOrder(next);
  };

  const toggleGroup = (groupId: string) => {
    patchGroupOrder(
      normalizedGroups.map((group) =>
        group.groupId === groupId ? { ...group, skipped: !group.skipped } : group,
      ),
    );
  };

  return (
    <div
      className="t8-group-execution-manager-node rounded-xl border-2 overflow-hidden"
      data-theme-visual={visualStyle}
      data-selected={selected ? 'true' : 'false'}
      style={{
        minWidth: 340,
        maxWidth: 420,
        background: isPixel ? '#ffffff' : isDark ? 'rgba(20,20,22,.92)' : 'rgba(255,255,255,.94)',
        borderColor: selected ? '#38bdf8' : isPixel ? '#1A1410' : isDark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)',
        boxShadow: isPixel ? '4px 4px 0 #1A1410' : selected ? '0 0 0 2px rgba(56,189,248,.2), 0 18px 44px rgba(0,0,0,.18)' : '0 18px 44px rgba(0,0,0,.12)',
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        id="manager-out"
        className="!border-0"
        style={{
          background: '#38bdf8',
          width: 12,
          height: 12,
          minWidth: 12,
          minHeight: 12,
          top: '50%',
          right: -6,
          transform: 'translateY(-50%)',
          zIndex: 12,
          pointerEvents: 'all',
        }}
        title="管理器输出"
      />
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          borderColor: isPixel ? '#1A1410' : isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
          background: isPixel ? '#A8E6C9' : isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
        }}
      >
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#38bdf822', color: '#38bdf8' }}>
          <Workflow size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="text-[10px] opacity-70 truncate">全局控制组执行顺序 / 跳过 / 轮次</div>
        </div>
        <div className="text-[10px] opacity-70 flex items-center gap-1">
          <ArrowDownAZ size={12} />
          <span>{normalizedGroups.length}</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <label className="block">
          <div className="text-[10px] font-semibold opacity-70 mb-1">节点标题</div>
          <input
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            className="w-full rounded px-2 py-1.5 text-xs outline-none border"
            style={{
              background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
              color: isDark ? '#fff' : '#111',
              borderColor: isPixel ? '#1A1410' : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)',
            }}
          />
        </label>
        <label className="block">
          <div className="text-[10px] font-semibold opacity-70 mb-1">说明</div>
          <textarea
            value={note}
            onChange={(e) => update({ note: e.target.value })}
            rows={2}
            className="w-full rounded px-2 py-1.5 text-xs outline-none border resize-none"
            style={{
              background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
              color: isDark ? '#fff' : '#111',
              borderColor: isPixel ? '#1A1410' : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)',
            }}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-[10px] font-semibold opacity-70 mb-1">持续开关</div>
            <button
              type="button"
              onClick={() => update({ enabled: !enabled })}
              className="w-full rounded px-2 py-1.5 text-xs border flex items-center justify-between gap-2"
              style={{
                background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
                color: isDark ? '#fff' : '#111',
                borderColor: isPixel ? '#1A1410' : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)',
              }}
            >
              <span>{enabled ? '启用' : '停用'}</span>
              {enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>
          </label>
          <label className="block">
            <div className="text-[10px] font-semibold opacity-70 mb-1">执行次数</div>
            <div className="relative">
              <Repeat size={12} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
              <input
                type="number"
                min={1}
                max={99}
                value={executionCount}
                onChange={(e) => update({ executionCount: Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))) })}
                className="w-full rounded pl-7 pr-2 py-1.5 text-xs outline-none border"
                style={{
                  background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
                  color: isDark ? '#fff' : '#111',
                  borderColor: isPixel ? '#1A1410' : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)',
                }}
              />
            </div>
          </label>
        </div>
        <button
          type="button"
          onClick={() => requestRunAll()}
          className="w-full rounded px-3 py-2 text-xs font-semibold border flex items-center justify-center gap-2"
          style={{
            background: '#38bdf822',
            color: '#38bdf8',
            borderColor: '#38bdf855',
          }}
        >
          <Play size={13} fill="currentColor" />
          <span>开始执行</span>
        </button>

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold opacity-70">组顺序</div>
          {normalizedGroups.length === 0 ? (
            <div className="rounded px-2 py-2 text-[11px] opacity-60" style={{ background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)' }}>
              先在画布里创建组，再回到这里编排顺序
            </div>
          ) : (
            normalizedGroups.map((group, index) => (
              <div
                key={group.groupId}
                className="flex items-center gap-2 rounded px-2 py-1.5"
                style={{
                  background: group.skipped ? 'rgba(248,113,113,.08)' : isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
                  border: `1px solid ${group.skipped ? 'rgba(248,113,113,.28)' : 'transparent'}`,
                }}
              >
                <button type="button" className="text-[10px] px-1.5 py-0.5 rounded border" onClick={() => moveGroup(index, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button type="button" className="text-[10px] px-1.5 py-0.5 rounded border" onClick={() => moveGroup(index, 1)} disabled={index === normalizedGroups.length - 1}>
                  ↓
                </button>
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => toggleGroup(group.groupId)}
                >
                  <div className="text-[11px] font-semibold truncate">{group.groupName}</div>
                  <div className="text-[10px] opacity-60 truncate">{group.groupId}</div>
                </button>
                <button type="button" className="text-[10px] px-1.5 py-0.5 rounded border" onClick={() => toggleGroup(group.groupId)}>
                  {group.skipped ? <Ban size={11} /> : '执行'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(GroupExecutionManagerNode);

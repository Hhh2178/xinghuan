import { Workflow } from 'lucide-react';
import type { ResourceItem } from '../../services/api';
import { summarizeWorkflowResource } from '../../utils/workflowResource';

type WorkflowPreview = NonNullable<ResourceItem['workflowPreview']>;

function workflowNodeColor(type: string) {
  if (type === 'image' || type === 'edit') return '#fbbf24';
  if (type === 'video' || type === 'seedance') return '#fb7185';
  if (type === 'audio') return '#a78bfa';
  if (type === 'llm') return '#86efac';
  if (type === 'output') return '#f97316';
  if (type === 'upload' || type === 'material-set') return '#2dd4bf';
  if (type === 'pose-master' || type === 'portrait-master') return '#38bdf8';
  return '#f8fafc';
}

function workflowNodeShortLabel(type: string, label: string) {
  if (type === 'image') return '图';
  if (type === 'video') return '视';
  if (type === 'seedance') return 'SD';
  if (type === 'audio') return '音';
  if (type === 'llm') return 'AI';
  if (type === 'output') return '出';
  if (type === 'upload') return '入';
  if (type === 'material-set') return '集';
  if (type === 'pose-master') return '姿';
  if (type === 'portrait-master') return '肖';
  return Array.from(label || type || '?').slice(0, 2).join('');
}

export function WorkflowTopologyCard({ item, accent }: { item: ResourceItem; accent: string }) {
  const preview = item.workflowPreview as WorkflowPreview | undefined;
  const markerId = `workflow-arrow-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  if (item.thumbUrl) {
    return <img src={item.thumbUrl} alt={item.title} className="h-full w-full object-cover" draggable={false} />;
  }
  if (!preview?.nodes?.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
        <Workflow size={32} className="text-white drop-shadow" />
        <div className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">
          {summarizeWorkflowResource(item)}
        </div>
      </div>
    );
  }
  const nodeMap = new Map(preview.nodes.map((node) => [node.id, node]));
  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-label={`${item.title} 工作流拓扑预览`}>
        <defs>
          <pattern id={`${markerId}-grid`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="0.6" />
          </pattern>
          <marker id={markerId} markerWidth="4" markerHeight="4" refX="3.3" refY="2" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 4 2 L 0 4 z" fill="rgba(255,255,255,.78)" />
          </marker>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${markerId}-grid)`} opacity="0.8" />
        {preview.edges.map((edge, index) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          const midX = (source.x + target.x) / 2;
          const bend = source.y === target.y ? 0 : (target.y > source.y ? -7 : 7);
          return (
            <path
              key={`${edge.source}-${edge.target}-${index}`}
              d={`M ${source.x} ${source.y} Q ${midX} ${(source.y + target.y) / 2 + bend} ${target.x} ${target.y}`}
              fill="none"
              stroke="rgba(255,255,255,.76)"
              strokeWidth="2.2"
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
            />
          );
        })}
        {preview.nodes.map((node) => {
          const color = workflowNodeColor(node.type);
          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="8.6" fill="rgba(0,0,0,.44)" stroke="rgba(255,255,255,.72)" strokeWidth="1" />
              <circle cx={node.x} cy={node.y} r="6.8" fill={color} stroke="rgba(0,0,0,.38)" strokeWidth="1" />
              <text x={node.x} y={node.y + 2.4} textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#0f172a">
                {workflowNodeShortLabel(node.type, node.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
        拓扑预览
      </div>
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
        <span className="truncate">{summarizeWorkflowResource(item)}</span>
        <span className="shrink-0 rounded-full px-1.5 py-0.5" style={{ background: accent, color: '#07111f' }}>
          {preview.nodes.length}
        </span>
      </div>
    </div>
  );
}

import { create } from 'zustand';

/**
 * 节点组(GroupBox)操作总线
 * - 由 GroupBoxNode 内部按钮触发请求,Canvas 监听 ts 变化执行对应动作
 * - 不直接持有 nodes/edges 引用,避免双向耦合
 */

export interface GroupExecuteRequest {
  groupId: string;
  memberIds: string[];
  executionCount: number;
  ts: number;
}

export interface GroupDeleteRequest {
  groupId: string;
  ts: number;
}

export interface GroupRunAllRequest {
  ts: number;
}

interface GroupBusState {
  executeReq: GroupExecuteRequest | null;
  deleteReq: GroupDeleteRequest | null;
  runAllReq: GroupRunAllRequest | null;
  requestExecute: (groupId: string, memberIds: string[], executionCount?: number) => void;
  requestDelete: (groupId: string) => void;
  requestRunAll: () => void;
  clearExecute: () => void;
  clearDelete: () => void;
  clearRunAll: () => void;
}

export const useGroupBusStore = create<GroupBusState>((set) => ({
  executeReq: null,
  deleteReq: null,
  runAllReq: null,
  requestExecute: (groupId, memberIds, executionCount = 1) =>
    set({ executeReq: { groupId, memberIds, executionCount: Math.max(1, Math.min(99, Math.floor(Number(executionCount) || 1))), ts: Date.now() } }),
  requestDelete: (groupId) =>
    set({ deleteReq: { groupId, ts: Date.now() } }),
  requestRunAll: () =>
    set({ runAllReq: { ts: Date.now() } }),
  clearExecute: () => set({ executeReq: null }),
  clearDelete: () => set({ deleteReq: null }),
  clearRunAll: () => set({ runAllReq: null }),
}));

// 12 色 GroupBox 调色板(与 PenguinPravite NodeGroupBox.GROUP_COLORS 对齐)
export const GROUP_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4',
  '#EF4444', '#84CC16', '#F97316', '#14B8A6', '#A855F7', '#64748B',
];

export const DEFAULT_GROUP_NAME = '未命名组';

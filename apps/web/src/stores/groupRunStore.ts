import { create } from 'zustand';

import type { GroupRunSnapshot } from '../components/canvas/groupRunScheduler';

interface GroupRunStoreState extends GroupRunSnapshot {
  applySnapshot: (snapshot: GroupRunSnapshot) => void;
  reset: () => void;
}

const emptySnapshot = (): GroupRunSnapshot => ({
  activeGroupIds: [],
  activeNodeIds: [],
  groupStates: {},
});

export const useGroupRunStore = create<GroupRunStoreState>((set) => ({
  ...emptySnapshot(),
  applySnapshot: (snapshot) => set(snapshot),
  reset: () => set(emptySnapshot()),
}));

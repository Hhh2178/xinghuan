export type GenerationLibraryKind = 'image' | 'video' | 'audio';

export interface GenerationLibrarySettings {
  outputRetentionDays: number;
}

export interface GenerationLibraryItem {
  id: string;
  kind: GenerationLibraryKind;
  status: 'active' | 'promoted' | 'expired' | 'missing' | 'deleted';
  storageKey: string;
  title: string;
  url: string;
  fileUrl: string;
  mime?: string;
  size?: number;
  filename?: string;
  previewUrl?: string;
  downloadUrl?: string;
  openUrl?: string;
  canDownload?: boolean;
  isExpired?: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  promotedAssetId?: string;
  duplicate?: boolean;
}

export interface AddGenerationLibraryItemPayload {
  kind: GenerationLibraryKind;
  url: string;
  title?: string;
  mime?: string;
  size?: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
}

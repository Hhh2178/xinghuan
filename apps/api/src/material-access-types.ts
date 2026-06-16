export type MaterialSource = "generation-library";

export type MaterialAccessDisposition = "inline" | "attachment";

export interface MaterialAccessDescriptor {
  source: MaterialSource;
  materialId: string;
  filename: string;
  mime: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
  openUrl: string;
  canDownload: boolean;
  isExpired: boolean;
}

export interface ResolvedMaterialAccess {
  source: MaterialSource;
  materialId: string;
  filename: string;
  mime: string;
  size: number;
  absolutePath: string;
  isExpired: boolean;
}

import type { GenerationLibraryItem } from '../services/api';
import LoopingVideo from './LoopingVideo';
import { ResourcePreviewOverlay } from './resource-library/ResourcePreviewOverlay';

interface GenerationLibraryPreviewOverlayProps {
  item: GenerationLibraryItem;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export default function GenerationLibraryPreviewOverlay({
  item,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: GenerationLibraryPreviewOverlayProps) {
  return (
    <ResourcePreviewOverlay
      title={item.title}
      filename={item.filename || item.title}
      downloadUrl={item.downloadUrl && item.canDownload !== false ? item.downloadUrl : undefined}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={onPrev}
      onNext={onNext}
      onClose={onClose}
      media={
        <>
          {item.kind === 'image' && (
            <img
              src={item.previewUrl || item.fileUrl}
              alt={item.title}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          )}
          {item.kind === 'video' && (
            <LoopingVideo
              src={item.previewUrl || item.fileUrl}
              controls
              className="max-h-full max-w-full object-contain"
            />
          )}
        </>
      }
    />
  );
}

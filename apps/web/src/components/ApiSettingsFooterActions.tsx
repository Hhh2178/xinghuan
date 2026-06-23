import { Download, FileUp, Loader2, Save } from 'lucide-react';
import { useRef } from 'react';

interface ApiSettingsFooterActionsProps {
  loading: boolean;
  saved: boolean;
  isPixel: boolean;
  onImportFile: (file: File | null) => void;
  onExportSettings: () => void;
  onClose: () => void;
  onSave: () => void;
}

export default function ApiSettingsFooterActions({
  loading,
  saved,
  isPixel,
  onImportFile,
  onExportSettings,
  onClose,
  onSave,
}: ApiSettingsFooterActionsProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={`t8-api-settings-footer flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0 ${
        isPixel ? 'border-[var(--px-ink)]' : ''
      }`}
    >
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => onImportFile(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        onClick={() => importInputRef.current?.click()}
        className={isPixel ? 't8-api-settings-secondary-btn px-btn flex items-center gap-2' : 't8-api-settings-secondary-btn px-3 py-2 text-sm rounded-md border flex items-center gap-2'}
        title="导入设置备份，回填后需点击保存生效"
      >
        <FileUp size={14} />
        导入设置
      </button>
      <button
        type="button"
        onClick={onExportSettings}
        className={isPixel ? 't8-api-settings-secondary-btn px-btn flex items-center gap-2' : 't8-api-settings-secondary-btn px-3 py-2 text-sm rounded-md border flex items-center gap-2'}
        title="导出包含明文 API Key 的私密备份"
      >
        <Download size={14} />
        导出设置
      </button>
      <button
        onClick={onClose}
        className={isPixel ? 't8-api-settings-secondary-btn px-btn' : 't8-api-settings-secondary-btn px-4 py-2 text-sm rounded-md border'}
      >
        取消
      </button>
      <button
        onClick={onSave}
        disabled={loading}
        className={isPixel ? 't8-api-settings-primary-btn px-btn px-btn--mint disabled:opacity-50 flex items-center gap-2' : 't8-api-settings-primary-btn px-4 py-2 text-sm rounded-md flex items-center gap-2 disabled:opacity-50'}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : saved ? (
          <span>✓ 已保存</span>
        ) : (
          <Save size={14} />
        )}
        {!loading && !saved && '保存'}
      </button>
    </div>
  );
}

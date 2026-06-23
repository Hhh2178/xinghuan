import { ExternalLink, FolderOpen, Lock } from 'lucide-react';

interface ApiSettingsLocalPathsSectionProps {
  fileSavePathInput: string;
  canvasAutoSavePathInput: string;
  resourceLibraryPathInput: string;
  themeTemplatePathInput: string;
  eagleApiBaseInput: string;
  labelClassName: string;
  hintClassName: string;
  inputClassName: string;
  isDark: boolean;
  isPixel: boolean;
  error?: string;
  backupMessage?: string;
  onFileSavePathChange: (value: string) => void;
  onCanvasAutoSavePathChange: (value: string) => void;
  onResourceLibraryPathChange: (value: string) => void;
  onThemeTemplatePathChange: (value: string) => void;
  onEagleApiBaseChange: (value: string) => void;
}

function renderPathSection(
  title: string,
  desc: string,
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
  labelClassName: string,
  hintClassName: string,
  inputClassName: string,
  note: string,
) {
  return (
    <div className="t8-api-settings-divider pt-3 border-t">
      <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelClassName}`}>
        <FolderOpen size={14} className="t8-api-settings-icon" />
        {title}
        <span className={`text-[11px] font-normal ${hintClassName}`}>{desc}</span>
      </label>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintClassName}`}>
        <span className="flex items-center gap-1.5">
          <Lock size={11} /> {note}
        </span>
      </div>
    </div>
  );
}

export default function ApiSettingsLocalPathsSection({
  fileSavePathInput,
  canvasAutoSavePathInput,
  resourceLibraryPathInput,
  themeTemplatePathInput,
  eagleApiBaseInput,
  labelClassName,
  hintClassName,
  inputClassName,
  isDark,
  isPixel,
  error,
  backupMessage,
  onFileSavePathChange,
  onCanvasAutoSavePathChange,
  onResourceLibraryPathChange,
  onThemeTemplatePathChange,
  onEagleApiBaseChange,
}: ApiSettingsLocalPathsSectionProps) {
  return (
    <>
      {renderPathSection(
        '文件自动保存路径',
        '· 所有可执行节点生成的图像/视频/音频均会自动复制一份到此路径',
        fileSavePathInput,
        onFileSavePathChange,
        '例：D:\\zhenzhen 或 ~/zhenzhen · 路径不存在时会自动创建',
        labelClassName,
        hintClassName,
        inputClassName,
        '仅保存在本地机, 不上传上游。同名文件不覆盖。',
      )}
      {renderPathSection(
        '画布自动保存路径',
        '· 当前画布变更后自动导出 JSON，方便更换版本后导入',
        canvasAutoSavePathInput,
        onCanvasAutoSavePathChange,
        '例：D:\\zhenzhen 或 ~/zhenzhen · 实际保存到此路径下的 T8-penguin-canvas\\canvases',
        labelClassName,
        hintClassName,
        inputClassName,
        '默认路径由后端按平台返回：Windows 为 D:\\zhenzhen，macOS/Linux 为用户目录下的 zhenzhen。',
      )}
      {renderPathSection(
        '资源库路径',
        '· 资源文件与分类索引都保存在此路径，更换版本后可继续读取',
        resourceLibraryPathInput,
        onResourceLibraryPathChange,
        '例：D:\\zhenzhen\\resources 或 ~/zhenzhen/resources · 路径不存在时会自动创建',
        labelClassName,
        hintClassName,
        inputClassName,
        '加入资源库会复制一份到此目录，删除资源只删除资源库副本。',
      )}
      {renderPathSection(
        '主题模板路径',
        '· 导入或编辑后的主题 JSON 保存在此路径',
        themeTemplatePathInput,
        onThemeTemplatePathChange,
        '例：D:\\zhenzhen\\theme-templates 或 ~/zhenzhen/theme-templates · 路径不存在时会自动创建',
        labelClassName,
        hintClassName,
        inputClassName,
        '内置主题不可删除；自定义主题可导入、导出、编辑和删除。',
      )}
      <div className="t8-api-settings-divider pt-3 border-t">
        <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelClassName}`}>
          <ExternalLink size={14} className="t8-api-settings-icon" />
          Eagle 本地接口
          <span className={`text-[11px] font-normal ${hintClassName}`}>· 发送素材到本机 Eagle 时使用</span>
        </label>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={eagleApiBaseInput}
            onChange={(e) => onEagleApiBaseChange(e.target.value)}
            placeholder="http://127.0.0.1:41595"
            className={inputClassName}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintClassName}`}>
          <span className="flex items-center gap-1.5">
            <Lock size={11} /> 后端只允许 127.0.0.1 / localhost，避免把本地素材发送到远端代理。
          </span>
        </div>
      </div>
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          ❌ {error}
        </div>
      )}
      {backupMessage && (
        <div
          className={
            isPixel
              ? 'text-xs px-3 py-2 border border-[var(--px-ink)] bg-[var(--px-yellow)] text-[var(--px-ink)]'
              : `text-xs rounded-md px-3 py-2 border ${
                  backupMessage.includes('失败') || backupMessage.includes('不正确')
                    ? 'text-red-300 bg-red-500/10 border-red-500/25'
                    : isDark
                      ? 'text-amber-100 bg-amber-500/10 border-amber-500/25'
                      : 'text-amber-800 bg-amber-50 border-amber-200'
                }`
          }
        >
          {backupMessage}
        </div>
      )}
    </>
  );
}

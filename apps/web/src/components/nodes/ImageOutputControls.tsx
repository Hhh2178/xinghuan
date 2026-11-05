import type { PublicModelImageOutput } from '../../services/api';

export type ImageSizeMode = 'preset' | 'exact';

export interface ImageOutputControlChange {
  imageSizeMode?: ImageSizeMode;
  imageWidth?: number;
  imageHeight?: number;
  sizeLevel?: string;
  providerParams?: Record<string, unknown>;
}

interface ImageOutputControlsProps {
  capabilities: PublicModelImageOutput;
  sizePresets: string[];
  sizeMode: ImageSizeMode;
  width: number;
  height: number;
  sizeLevel: string;
  outputFormat: string;
  providerParams: Record<string, any>;
  referenceImageCount: number;
  onChange: (change: ImageOutputControlChange) => void;
}

const inputClass = 'mt-1 w-full rounded border border-white/10 bg-zinc-900 p-1.5 text-xs text-white';

export function resolveImageOutputFormat(value: string, capabilities: PublicModelImageOutput): string {
  if (value === 'gif' && capabilities.gif?.enabled) return 'gif';
  return capabilities.staticFormats.includes(value as PublicModelImageOutput['staticFormats'][number])
    ? value
    : capabilities.staticFormats[0] || 'png';
}

export function exactPixelValidationError(
  width: number,
  height: number,
  options: NonNullable<PublicModelImageOutput['size']['exactPixels']>,
): string | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return '宽和高必须是正整数';
  if (width < options.minWidth || width > options.maxWidth || height < options.minHeight || height > options.maxHeight) {
    return `尺寸范围：宽 ${options.minWidth}–${options.maxWidth}，高 ${options.minHeight}–${options.maxHeight} 像素`;
  }
  if (width % options.step !== 0 || height % options.step !== 0) return `宽和高必须为 ${options.step} 像素的整数倍`;
  const pixels = width * height;
  if (pixels < options.minTotalPixels || pixels > options.maxTotalPixels) {
    return `总像素数必须在 ${options.minTotalPixels.toLocaleString()}–${options.maxTotalPixels.toLocaleString()} 之间`;
  }
  if (Math.max(width / height, height / width) > options.maxAspectRatio) {
    return `长短边比例不能超过 ${options.maxAspectRatio}:1`;
  }
  return null;
}

function parseSize(value: unknown, fallback: { width: number; height: number }) {
  const match = String(value || '').match(/^(\d+)x(\d+)$/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : fallback;
}

export default function ImageOutputControls({
  capabilities,
  sizePresets,
  sizeMode,
  width,
  height,
  sizeLevel,
  outputFormat,
  providerParams,
  referenceImageCount,
  onChange,
}: ImageOutputControlsProps) {
  const exactOptions = capabilities.size.exactPixels;
  const supportsExact = capabilities.size.allowExactPixels && Boolean(exactOptions);
  const supportsGif = capabilities.gif?.enabled === true;
  const selectedFormat = resolveImageOutputFormat(outputFormat, capabilities);
  const isGif = selectedFormat === 'gif';
  const exactError = supportsExact && sizeMode === 'exact' && exactOptions
    ? exactPixelValidationError(width, height, exactOptions)
    : null;
  const gifSize = parseSize(providerParams.gif_size || capabilities.gif?.size.default, { width: 512, height: 512 });
  const gifOptions = capabilities.gif;

  const updateParams = (patch: Record<string, unknown>) => onChange({ providerParams: { ...providerParams, ...patch } });

  return (
    <div className="rounded border border-white/10 bg-white/[0.025] p-2 space-y-2">
      <div className="text-[10px] font-semibold text-white/75">图像输出</div>
      {supportsExact && (
        <div>
          <label className="text-[10px] text-white/55 block mb-1">尺寸方式</label>
          <select
            value={sizeMode}
            onChange={(event) => onChange({ imageSizeMode: event.target.value === 'exact' ? 'exact' : 'preset' })}
            className={inputClass}
          >
            <option value="preset">预设尺寸</option>
            <option value="exact">精确像素</option>
          </select>
        </div>
      )}
      {sizeMode === 'exact' && supportsExact && exactOptions ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-white/55">宽（像素）
            <input type="number" min={exactOptions.minWidth} max={exactOptions.maxWidth} step={exactOptions.step} value={width} onChange={(event) => onChange({ imageWidth: Number(event.target.value) })} className={inputClass} />
          </label>
          <label className="text-[10px] text-white/55">高（像素）
            <input type="number" min={exactOptions.minHeight} max={exactOptions.maxHeight} step={exactOptions.step} value={height} onChange={(event) => onChange({ imageHeight: Number(event.target.value) })} className={inputClass} />
          </label>
          <div className="col-span-2 text-[10px] text-white/40">
            宽高按 {exactOptions.step} 像素递增；单边 {exactOptions.minWidth}–{exactOptions.maxWidth} × {exactOptions.minHeight}–{exactOptions.maxHeight}
          </div>
          {exactError && <div className="col-span-2 text-[10px] text-amber-300">{exactError}</div>}
        </div>
      ) : sizePresets.length > 0 ? (
        <div>
          <label className="text-[10px] text-white/55 block mb-1">预设尺寸</label>
          <select value={sizeLevel} onChange={(event) => onChange({ sizeLevel: event.target.value })} className={inputClass}>
            {sizePresets.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
          </select>
        </div>
      ) : null}

      {supportsGif && (
        <div>
          <label className="text-[10px] text-white/55 block mb-1">输出模式</label>
          <select value={isGif ? 'gif' : 'static'} onChange={(event) => {
            const next = event.target.value === 'gif' ? 'gif' : capabilities.staticFormats[0] || 'png';
            updateParams({ output_format: next });
          }} className={inputClass}>
            <option value="static">静态图</option>
            <option value="gif">GIF 动图</option>
          </select>
        </div>
      )}
      {!isGif && capabilities.staticFormats.length > 1 && (
        <div>
          <label className="text-[10px] text-white/55 block mb-1">静态图格式</label>
          <select value={selectedFormat} onChange={(event) => updateParams({ output_format: event.target.value })} className={inputClass}>
            {capabilities.staticFormats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
          </select>
        </div>
      )}
      {isGif && gifOptions && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-white/55">帧数
            <input type="number" min={gifOptions.frameCount.min} max={gifOptions.frameCount.max} step={gifOptions.frameCount.step} value={Number(providerParams.frame_count ?? gifOptions.frameCount.default)} onChange={(event) => updateParams({ frame_count: Number(event.target.value) })} className={inputClass} />
          </label>
          <label className="text-[10px] text-white/55">单帧时长（毫秒）
            <input type="number" min={gifOptions.frameDurationMs.min} max={gifOptions.frameDurationMs.max} step={gifOptions.frameDurationMs.step} value={Number(providerParams.frame_duration_ms ?? gifOptions.frameDurationMs.default)} onChange={(event) => updateParams({ frame_duration_ms: Number(event.target.value) })} className={inputClass} />
          </label>
          <label className="col-span-2 text-[10px] text-white/55">单帧尺寸（像素）
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={gifOptions.size.step} step={gifOptions.size.step} value={gifSize.width} onChange={(event) => updateParams({ gif_size: `${Number(event.target.value)}x${gifSize.height}` })} className={inputClass} aria-label="GIF 单帧宽度" />
              <input type="number" min={gifOptions.size.step} step={gifOptions.size.step} value={gifSize.height} onChange={(event) => updateParams({ gif_size: `${gifSize.width}x${Number(event.target.value)}` })} className={inputClass} aria-label="GIF 单帧高度" />
            </div>
          </label>
          {referenceImageCount > 0 && (
            <div className="col-span-2 text-[10px] text-cyan-200/80">
              {gifOptions.allowReferenceImages
                ? `${referenceImageCount} 张参考图会随 GIF 请求提交。上游是否接受由服务端返回结果。`
                : '当前模型未开放 GIF 参考图输入。'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

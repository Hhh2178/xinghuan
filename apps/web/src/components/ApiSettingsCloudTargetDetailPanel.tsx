import { Info, TestTube2 } from 'lucide-react';

import type { CloudUploadTargetConfig } from '../types/canvas';
import { CLOUD_UPLOAD_GUIDES, CLOUD_UPLOAD_LABELS } from './apiSettingsHelpers';
import ApiSettingsFormBlock from './ApiSettingsFormBlock';

interface CloudTargetTestStatus {
  loading?: boolean;
  ok?: boolean;
  message?: string;
}

interface ApiSettingsCloudTargetDetailPanelProps {
  target: CloudUploadTargetConfig;
  isPixel: boolean;
  inputClassName: string;
  labelClassName: string;
  hintClassName: string;
  testStatus?: CloudTargetTestStatus;
  onUpdateTarget: (id: string, patch: Partial<CloudUploadTargetConfig>) => void;
  onUpdateTargetNested: (
    id: string,
    key: 'tencentCos' | 'aliyunOss' | 'baiduNetdisk' | 'quarkNetdisk',
    patch: Record<string, any>,
  ) => void;
  onMarkDefault: (id: string) => void;
  onTestTarget: (target: CloudUploadTargetConfig) => void;
}

export default function ApiSettingsCloudTargetDetailPanel({
  target,
  isPixel,
  inputClassName,
  labelClassName,
  hintClassName,
  testStatus,
  onUpdateTarget,
  onUpdateTargetNested,
  onMarkDefault,
  onTestTarget,
}: ApiSettingsCloudTargetDetailPanelProps) {
  const providerLabel = CLOUD_UPLOAD_LABELS[target.provider] || target.provider;
  const guide = CLOUD_UPLOAD_GUIDES[target.provider];
  const sectionCls = isPixel
    ? 't8-api-settings-provider-panel border p-3 space-y-4 min-w-0'
    : 't8-api-settings-provider-panel border rounded-xl p-3 sm:p-4 space-y-4 min-w-0';
  const formBlockCls = isPixel
    ? 't8-api-settings-section border p-3 space-y-3'
    : 't8-api-settings-section rounded-lg border p-3 space-y-3';
  const fieldInputCls = `${inputClassName.replace('flex-1 ', '')} w-full min-w-0`;
  const guideBoxCls = isPixel
    ? 't8-api-settings-guide border p-3 text-[11px] leading-relaxed'
    : 't8-api-settings-guide rounded-lg border p-3 text-[11px] leading-relaxed';
  const smallPillCls = isPixel
    ? 't8-api-settings-pill inline-flex items-center px-1.5 py-0.5 border text-[10px] font-bold'
    : 't8-api-settings-pill inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] font-semibold';
  const supported = target.provider === 'tencent-cos' || target.provider === 'aliyun-oss';

  return (
    <div className={sectionCls}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-black ${labelClassName}`}>{target.label || providerLabel}</span>
            <span className={smallPillCls}>{providerLabel}</span>
            <span className={target.enabled ? 'text-[11px] font-bold text-emerald-500' : `text-[11px] font-bold ${hintClassName}`}>
              {target.enabled ? '已启用' : '未启用'}
            </span>
            <span className={supported ? 'text-[11px] font-bold text-emerald-500' : `text-[11px] font-bold ${hintClassName}`}>
              {guide?.status}
            </span>
          </div>
          <p className={`mt-1 text-[11px] leading-relaxed ${hintClassName}`}>{guide?.subtitle}</p>
        </div>
        <label className={`flex items-center gap-2 text-xs font-bold shrink-0 ${labelClassName}`}>
          <input
            type="checkbox"
            checked={!!target.enabled}
            onChange={(event) => onUpdateTarget(target.id, { enabled: event.target.checked })}
          />
          右键菜单显示
        </label>
        <label className={`flex items-center gap-2 text-xs font-bold shrink-0 ${labelClassName}`}>
          <input
            type="radio"
            checked={!!target.isDefault}
            onChange={() => onMarkDefault(target.id)}
          />
          默认目标
        </label>
        <button
          type="button"
          onClick={() => onTestTarget(target)}
          disabled={!!testStatus?.loading}
          className={
            isPixel
              ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0'
              : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0 inline-flex items-center gap-1'
          }
        >
          <TestTube2 size={12} />
          {testStatus?.loading ? '检查中...' : '配置检查'}
        </button>
      </div>

      {testStatus?.message && (
        <div className={testStatus.ok ? 'text-[11px] text-emerald-500' : 'text-[11px] text-red-400'}>
          {testStatus.message}
        </div>
      )}

      <div className={guideBoxCls}>
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold">这是什么？</div>
            <p>{guide?.description}</p>
            <p className={`mt-2 ${hintClassName}`}>
              右键上传只复制一份外部副本，不会改动画布节点、资源库文件或本地自动保存结果。
            </p>
          </div>
        </div>
      </div>

      <ApiSettingsFormBlock
        className={formBlockCls}
        labelClassName={labelClassName}
        hintClassName={hintClassName}
        title="1. 基础信息"
        note="显示名称会出现在素材右键菜单中；路径前缀支持 {kind}、{yyyy-mm}、{date}，例如 t8-canvas/{kind}/{yyyy-mm}。"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={`text-[11px] ${labelClassName}`}>显示名称</span>
            <input
              value={target.label || ''}
              onChange={(event) => onUpdateTarget(target.id, { label: event.target.value })}
              className={fieldInputCls}
              placeholder={providerLabel}
            />
          </label>
          <label className="space-y-1">
            <span className={`text-[11px] ${labelClassName}`}>路径前缀</span>
            <input
              value={target.prefix || ''}
              onChange={(event) => onUpdateTarget(target.id, { prefix: event.target.value })}
              className={fieldInputCls}
              placeholder="t8-canvas/{kind}/{yyyy-mm}"
            />
          </label>
          {supported && (
            <label className="space-y-1 lg:col-span-2">
              <span className={`text-[11px] ${labelClassName}`}>公共域名（可选）</span>
              <input
                value={target.publicBaseUrl || ''}
                onChange={(event) => onUpdateTarget(target.id, { publicBaseUrl: event.target.value })}
                className={fieldInputCls}
                placeholder="https://cdn.example.com/path · 留空返回默认对象 URL"
              />
            </label>
          )}
        </div>
      </ApiSettingsFormBlock>

      {target.provider === 'tencent-cos' && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="2. 腾讯云 COS"
          note="SecretId / SecretKey 留空或保留 **** 表示不覆盖后端已保存密钥。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Bucket</span>
              <input
                value={target.tencentCos?.bucket || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'tencentCos', { bucket: event.target.value })}
                className={fieldInputCls}
                placeholder="example-1250000000"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Region</span>
              <input
                value={target.tencentCos?.region || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'tencentCos', { region: event.target.value })}
                className={fieldInputCls}
                placeholder="ap-guangzhou"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>SecretId</span>
              <input
                type="password"
                value={target.tencentCos?.secretId || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'tencentCos', { secretId: event.target.value })}
                className={fieldInputCls}
                placeholder={target.tencentCos?.hasSecretId ? '留空保持不变' : '请输入 SecretId'}
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>SecretKey</span>
              <input
                type="password"
                value={target.tencentCos?.secretKey || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'tencentCos', { secretKey: event.target.value })}
                className={fieldInputCls}
                placeholder={target.tencentCos?.hasSecretKey ? '留空保持不变' : '请输入 SecretKey'}
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}

      {target.provider === 'aliyun-oss' && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="2. 阿里云 OSS"
          note="Endpoint 可以填 oss-cn-hangzhou.aliyuncs.com 或完整 https 地址；保存时会统一清洗。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Bucket</span>
              <input
                value={target.aliyunOss?.bucket || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'aliyunOss', { bucket: event.target.value })}
                className={fieldInputCls}
                placeholder="example-bucket"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Endpoint</span>
              <input
                value={target.aliyunOss?.endpoint || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'aliyunOss', { endpoint: event.target.value })}
                className={fieldInputCls}
                placeholder="oss-cn-hangzhou.aliyuncs.com"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>AccessKeyId</span>
              <input
                type="password"
                value={target.aliyunOss?.accessKeyId || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'aliyunOss', { accessKeyId: event.target.value })}
                className={fieldInputCls}
                placeholder={target.aliyunOss?.hasAccessKeyId ? '留空保持不变' : '请输入 AccessKeyId'}
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>AccessKeySecret</span>
              <input
                type="password"
                value={target.aliyunOss?.accessKeySecret || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'aliyunOss', { accessKeySecret: event.target.value })}
                className={fieldInputCls}
                placeholder={target.aliyunOss?.hasAccessKeySecret ? '留空保持不变' : '请输入 AccessKeySecret'}
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}

      {target.provider === 'baidu-netdisk' && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="2. 百度网盘（预留）"
          note="第一版不执行真实上传，字段用于后续 OAuth / PCS 接入时平滑迁移。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1 lg:col-span-2">
              <span className={`text-[11px] ${labelClassName}`}>网盘目录</span>
              <input
                value={target.baiduNetdisk?.folder || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'baiduNetdisk', { folder: event.target.value })}
                className={fieldInputCls}
                placeholder="/apps/T8PenguinCanvas"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Access Token</span>
              <input
                type="password"
                value={target.baiduNetdisk?.accessToken || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'baiduNetdisk', { accessToken: event.target.value })}
                className={fieldInputCls}
                placeholder={target.baiduNetdisk?.hasAccessToken ? '留空保持不变' : '后续接入时使用'}
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Refresh Token</span>
              <input
                type="password"
                value={target.baiduNetdisk?.refreshToken || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'baiduNetdisk', { refreshToken: event.target.value })}
                className={fieldInputCls}
                placeholder={target.baiduNetdisk?.hasRefreshToken ? '留空保持不变' : '后续接入时使用'}
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}

      {target.provider === 'quark-netdisk' && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="2. 夸克网盘（预留）"
          note="第一版不执行真实上传，字段用于后续稳定 CLI / 授权方案接入。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>网盘目录</span>
              <input
                value={target.quarkNetdisk?.folder || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'quarkNetdisk', { folder: event.target.value })}
                className={fieldInputCls}
                placeholder="/T8PenguinCanvas"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>外部命令路径</span>
              <input
                value={target.quarkNetdisk?.commandPath || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'quarkNetdisk', { commandPath: event.target.value })}
                className={fieldInputCls}
                placeholder="后续 CLI 接入时使用"
              />
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className={`text-[11px] ${labelClassName}`}>Cookie / 授权信息（不推荐长期依赖）</span>
              <input
                type="password"
                value={target.quarkNetdisk?.cookie || ''}
                onChange={(event) => onUpdateTargetNested(target.id, 'quarkNetdisk', { cookie: event.target.value })}
                className={fieldInputCls}
                placeholder={target.quarkNetdisk?.hasCookie ? '留空保持不变' : '等待稳定方案后再填写'}
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}
    </div>
  );
}

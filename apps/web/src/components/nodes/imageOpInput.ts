import type { UpstreamMaterials } from './useUpstreamMaterials';

export function missingImageInputMessage(
  upstream: Pick<UpstreamMaterials, 'texts' | 'videos' | 'audios'>,
) {
  if (upstream.videos.length > 0) {
    return '输入类型不匹配：当前节点仅支持图片。视频请先连接“首尾帧获取”或“视频抽帧”节点。';
  }
  if (upstream.audios.length > 0) {
    return '输入类型不匹配：当前节点仅支持图片，上游提供的是音频。';
  }
  if (upstream.texts.length > 0) {
    return '输入类型不匹配：当前节点仅支持图片，上游提供的是文本。';
  }
  return '请连接一个有可用输出的上游图片节点。';
}

const KNOWN_FIELD_OPTIONS: Record<string, Array<string | number>> = {
  aspectRatio: ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '3:2', '2:3', '21:9', '9:21', '1:4', '4:1', '1:8', '8:1'],
  aspect_ratio: ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '3:2', '2:3', '21:9', '9:21'],
  ratio: ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '3:2', '2:3'],
  resolution: ['1k', '2k', '4k', '8k'],
  size: ['512', '768', '1024', '1280', '1536', '2048'],
  mode: ['text2img', 'img2img'],
  quality: ['low', 'medium', 'high', 'best'],
  instanceType: ['default', 'plus', 'pro'],
  instance_type: ['default', 'plus', 'pro'],
  precision: ['fp16', 'fp32', 'bf16'],
  scheduler: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'],
  sampler: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2m', 'dpmpp_sde', 'ddim', 'uni_pc'],
};

export function inferRhToolsValueType(fieldType: string | undefined): 'text' | 'number' | 'image' | 'video' | 'audio' {
  const t = String(fieldType || '').toUpperCase();
  if (t === 'IMAGE') return 'image';
  if (t === 'VIDEO') return 'video';
  if (t === 'AUDIO') return 'audio';
  if (t === 'NUMBER' || t === 'FLOAT' || t === 'INTEGER' || t === 'INT') return 'number';
  return 'text';
}

export function extractRhToolsFieldOptions(it: any): Array<string | number> | null {
  const candidates = [it?.fieldData, it?.options, it?.list, it?.values, it?.enum, it?.choices, it?.items, it?.selectOptions, it?.dropdown];
  for (const c of candidates) {
    if (!Array.isArray(c) || c.length === 0) continue;
    if (c.every((x) => typeof x === 'string' || typeof x === 'number')) return c as Array<string | number>;
    if (c.every((x) => x && typeof x === 'object' && ('value' in x || 'label' in x || 'name' in x))) {
      return c.map((x: any) => (x.value ?? x.label ?? x.name)).filter((v: any) => v != null);
    }
  }
  const t = String(it?.fieldType || '').toUpperCase();
  if ((t === 'LIST' || t === 'SELECT' || t === 'DROPDOWN' || t === 'COMBO' || t === 'ENUM') && Array.isArray(it?.fieldValue)) {
    const arr = it.fieldValue;
    if (arr.length > 0 && arr.every((x: any) => typeof x === 'string' || typeof x === 'number')) {
      return arr as Array<string | number>;
    }
  }
  const fieldName = String(it?.fieldName || '').trim();
  if (fieldName) {
    const direct = KNOWN_FIELD_OPTIONS[fieldName];
    if (direct) return direct;
    const lower = fieldName.toLowerCase();
    for (const key in KNOWN_FIELD_OPTIONS) {
      if (key.toLowerCase() === lower) return KNOWN_FIELD_OPTIONS[key];
    }
  }
  return null;
}

export function extractRhToolsDefaultValue(it: any): string {
  let v = it?.fieldValue;
  if (Array.isArray(v)) v = v[0];
  if (v == null) return '';
  return typeof v === 'object' ? '' : String(v);
}

export function rhToolsFieldDisplayLabel(it: any) {
  return String(it?.displayLabel || it?.label || it?.fieldName || '').trim();
}

export function emptyRhToolsOutputState() {
  return {
    urls: [] as string[],
    imageUrl: '',
    imageUrls: [] as string[],
    videoUrl: '',
    videoUrls: [] as string[],
    audioUrl: '',
    audioUrls: [] as string[],
  };
}

export function buildRhToolsOutputStateFromUrls(list: string[]) {
  const clean = Array.isArray(list)
    ? list.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const isImg = (u: string) => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(u);
  const isVid = (u: string) => /\.(mp4|webm|mov|m4v|mkv)$/i.test(u);
  const isAud = (u: string) => /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(u);
  const imageUrls = clean.filter(isImg);
  const videoUrls = clean.filter(isVid);
  const audioUrls = clean.filter(isAud);
  const fallbackImageUrls = !imageUrls.length && !videoUrls.length && !audioUrls.length && clean[0] ? [clean[0]] : [];
  return {
    ...emptyRhToolsOutputState(),
    urls: clean,
    imageUrl: imageUrls[0] || fallbackImageUrls[0] || '',
    imageUrls: imageUrls.length > 0 ? imageUrls : fallbackImageUrls,
    videoUrl: videoUrls[0] || '',
    videoUrls,
    audioUrl: audioUrls[0] || '',
    audioUrls,
  };
}

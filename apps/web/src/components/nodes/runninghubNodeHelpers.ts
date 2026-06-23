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

export function inferValueType(fieldType: string | undefined): 'text' | 'number' | 'image' | 'video' | 'audio' {
  const t = String(fieldType || '').toUpperCase();
  if (t === 'IMAGE') return 'image';
  if (t === 'VIDEO') return 'video';
  if (t === 'AUDIO') return 'audio';
  if (t === 'NUMBER' || t === 'FLOAT' || t === 'INTEGER' || t === 'INT') return 'number';
  return 'text';
}

export function extractFieldOptions(it: any): Array<string | number> | null {
  const candidates = [
    it?.fieldData,
    it?.options,
    it?.list,
    it?.values,
    it?.enum,
    it?.choices,
    it?.items,
    it?.selectOptions,
    it?.dropdown,
  ];
  for (const c of candidates) {
    if (!Array.isArray(c) || c.length === 0) continue;
    if (c.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return c as Array<string | number>;
    }
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
  const fname = String(it?.fieldName || '').trim();
  if (fname) {
    const direct = KNOWN_FIELD_OPTIONS[fname];
    if (direct) return direct;
    const lower = fname.toLowerCase();
    for (const k in KNOWN_FIELD_OPTIONS) {
      if (k.toLowerCase() === lower) return KNOWN_FIELD_OPTIONS[k];
    }
  }
  return null;
}

export function extractDefaultValue(it: any): string {
  let v = it?.fieldValue;
  if (Array.isArray(v)) v = v[0];
  if (v == null) return '';
  return typeof v === 'object' ? '' : String(v);
}

export function fieldDisplayLabel(it: any) {
  return String(it?.displayLabel || it?.label || it?.fieldName || '').trim();
}

export function emptyRhOutputState() {
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

export function buildRhOutputStateFromUrls(list: string[]) {
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
    ...emptyRhOutputState(),
    urls: clean,
    imageUrl: imageUrls[0] || fallbackImageUrls[0] || '',
    imageUrls: imageUrls.length > 0 ? imageUrls : fallbackImageUrls,
    videoUrl: videoUrls[0] || '',
    videoUrls,
    audioUrl: audioUrls[0] || '',
    audioUrls,
  };
}

export function countSchemaProperties(value: string | undefined) {
  if (!value?.trim()) return 0;
  try {
    const parsed = JSON.parse(value) as { properties?: Record<string, unknown> };
    return parsed.properties && typeof parsed.properties === 'object' ? Object.keys(parsed.properties).length : 0;
  } catch {
    return 0;
  }
}

export function mergeNodeInfoListWithPresetMetadata(primaryList: unknown, presetList: unknown) {
  const presetMap = new Map<string, any>();
  for (const item of Array.isArray(presetList) ? presetList : []) {
    const nodeId = String(item?.nodeId || '').trim();
    const fieldName = String(item?.fieldName || '').trim();
    if (!nodeId || !fieldName) continue;
    presetMap.set(`${nodeId}::${fieldName}`, item);
  }
  const merged: any[] = [];
  const seen = new Set<string>();
  const appendItem = (item: any, preset?: any) => {
    const nodeId = String(item?.nodeId || '').trim();
    const fieldName = String(item?.fieldName || '').trim();
    if (!nodeId || !fieldName) return;
    const key = `${nodeId}::${fieldName}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...item,
      nodeId,
      fieldName,
      label: String(preset?.label || item?.label || item?.title || fieldName).trim() || fieldName,
      displayLabel: String(
        preset?.displayLabel
          || preset?.label
          || item?.displayLabel
          || item?.label
          || item?.title
          || fieldName,
      ).trim() || fieldName,
      description: String(
        preset?.description
          || item?.description
          || item?.descriptionCn
          || item?.descriptionEn
          || '',
      ).trim(),
      placeholder: String(preset?.placeholder || item?.placeholder || '').trim(),
      required: typeof preset?.required === 'boolean' ? preset.required : item?.required === true,
      fieldType: String(item?.fieldType || preset?.fieldType || '').trim(),
      fieldValue: item?.fieldValue ?? preset?.fieldValue ?? '',
      fieldData: item?.fieldData ?? preset?.fieldData ?? (Array.isArray(preset?.options) ? preset.options : undefined),
      options: Array.isArray(item?.options)
        ? item.options
        : Array.isArray(item?.fieldData)
          ? item.fieldData
          : Array.isArray(preset?.options)
            ? preset.options
            : Array.isArray(preset?.fieldData)
              ? preset.fieldData
              : undefined,
    });
  };
  for (const item of Array.isArray(primaryList) ? primaryList : []) {
    const nodeId = String(item?.nodeId || '').trim();
    const fieldName = String(item?.fieldName || '').trim();
    appendItem(item, presetMap.get(`${nodeId}::${fieldName}`));
  }
  for (const item of Array.isArray(presetList) ? presetList : []) {
    appendItem(item, item);
  }
  return merged;
}

export function normalizeRemoteNodeInfoList(value: unknown, existingList: any[]) {
  const existingMap = new Map<string, any>();
  for (const item of Array.isArray(existingList) ? existingList : []) {
    const nodeId = String(item?.nodeId || '').trim();
    const fieldName = String(item?.fieldName || '').trim();
    if (!nodeId || !fieldName) continue;
    existingMap.set(`${nodeId}::${fieldName}`, item);
  }
  return (Array.isArray(value) ? value : [])
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const nodeId = String(row.nodeId || '').trim();
      const fieldName = String(row.fieldName || '').trim();
      if (!nodeId || !fieldName) return [];
      const existing = existingMap.get(`${nodeId}::${fieldName}`);
      let parsedFieldData: unknown = row.fieldData;
      if (typeof parsedFieldData === 'string') {
        const trimmedFieldData = parsedFieldData.trim();
        if (trimmedFieldData.startsWith('[') || trimmedFieldData.startsWith('{')) {
          try {
            parsedFieldData = JSON.parse(trimmedFieldData);
          } catch {
            parsedFieldData = row.fieldData;
          }
        }
      }
      const parsedDisplayLabel = String(
        row.displayLabel
          || row.title
          || row.label
          || row.description
          || fieldName,
      ).trim() || fieldName;
      const parsedLabel = String(row.label || row.title || fieldName).trim() || fieldName;
      return [{
        ...row,
        nodeId,
        fieldName,
        fieldData: parsedFieldData,
        options: Array.isArray(row.options)
          ? row.options
          : Array.isArray(parsedFieldData)
            ? parsedFieldData
            : existing?.options,
        label: existing?.label || parsedLabel,
        displayLabel: existing?.displayLabel || parsedDisplayLabel,
        description: String(existing?.description || row.description || row.descriptionCn || row.descriptionEn || '').trim(),
        placeholder: String(existing?.placeholder || row.placeholder || '').trim(),
        required: typeof existing?.required === 'boolean' ? existing.required : row.required === true,
        fieldType: String(row.fieldType || existing?.fieldType || '').trim(),
        fieldValue: row.fieldValue ?? existing?.fieldValue ?? '',
      }];
    });
}

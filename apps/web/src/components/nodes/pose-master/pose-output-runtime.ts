export type PoseOutputItem = {
  imageUrl: string;
  prompt: string;
  metadata: unknown;
};

export type PoseOutputNode = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
};

export type PoseOutputEdge = {
  source: string;
  target: string;
};

export type PoseOutputData = {
  title: string;
  directImageUrl: string;
  directImageUrls: string[];
  imageUrl: string;
  imageUrls: string[];
  urls: string[];
  directOutputText: string;
  directTextSegments: string[];
  textSegments: string[];
  texts: string[];
  prompt: string;
  text: string;
  outputText: string;
  poseMasterSourceId: string;
  poseMasterRenderMode: string;
  poseMasterOutputMode: 'single' | 'collection';
  poseMasterMetadata: unknown;
  updatedAt: number;
};

export type PoseOutputTargetPlan = {
  targetOutputId: string | null;
  removableOutputIds: string[];
};

export function buildPoseOutputData(
  sourceId: string,
  items: PoseOutputItem[],
  renderMode: string,
  updatedAt = Date.now(),
): PoseOutputData | null {
  if (items.length === 0) return null;
  const imageUrls = items.map((item) => item.imageUrl);
  const prompts = items.map((item) => item.prompt);
  const metadata = items.map((item) => item.metadata);
  const joinedPrompt = prompts.join('\n\n');

  return {
    title: items.length > 1 ? '姿势分镜合集' : '姿势参考',
    directImageUrl: imageUrls[0],
    directImageUrls: imageUrls,
    imageUrl: imageUrls[0],
    imageUrls,
    urls: imageUrls,
    directOutputText: joinedPrompt,
    directTextSegments: prompts,
    textSegments: prompts,
    texts: prompts,
    prompt: joinedPrompt,
    text: joinedPrompt,
    outputText: joinedPrompt,
    poseMasterSourceId: sourceId,
    poseMasterRenderMode: renderMode,
    poseMasterOutputMode: items.length > 1 ? 'collection' : 'single',
    poseMasterMetadata: items.length === 1 ? metadata[0] : metadata,
    updatedAt,
  };
}

export function planPoseOutputTargets(
  sourceId: string,
  nodes: PoseOutputNode[],
  edges: PoseOutputEdge[],
): PoseOutputTargetPlan {
  const downstream = edges
    .filter((edge) => edge.source === sourceId)
    .map((edge) => nodes.find((node) => node.id === edge.target))
    .filter((node): node is PoseOutputNode => Boolean(node && node.type === 'output'));
  const managed = downstream.filter(
    (node) => node.id.startsWith(`output-auto-pose-master-${sourceId}-`) || node.data?.poseMasterSourceId === sourceId,
  );
  const legacy = downstream.filter(
    (node) => node.id.startsWith(`output-auto-${sourceId}-`) && node.data?.poseMasterSourceId !== sourceId,
  );
  const target =
    managed[0] ||
    downstream.find((node) => !legacy.some((candidate) => candidate.id === node.id)) ||
    legacy[0];
  const removableOutputIds = [...managed, ...legacy]
    .filter((node) => node.id !== target?.id)
    .map((node) => node.id);

  return { targetOutputId: target?.id || null, removableOutputIds };
}

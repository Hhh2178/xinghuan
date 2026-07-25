import { describe, expect, it } from 'vitest';

describe('node execution projection merge', () => {
  it('overrides manual runtime and output fields without mutating persisted node data', async () => {
    const { mergeNodeExecutionProjection } = await import('./useNodeExecutionProjection');
    const projection = {
      authority: 'workflow_run',
      runId: 'run-1',
      nodeId: 'image-1',
      nodeType: 'image',
      status: 'running',
      progress: '1/2',
      taskId: 'task-1',
      taskRuns: [{ batchIndex: 0, status: 'success', generationArtifactIds: ['artifact-0'] }],
      outputs: {
        generationArtifactIds: ['artifact-0'],
        imageUrls: ['/files/output/current.png'],
        videoUrls: [],
        audioUrls: [],
      },
    } as any;
    const persisted = {
      prompt: 'keep',
      status: 'success',
      imageUrl: '/files/output/old.png',
      imageUrls: ['/files/output/old.png'],
      __runtimeProjection: projection,
    };

    const merged = mergeNodeExecutionProjection(persisted);

    expect(merged).toMatchObject({
      prompt: 'keep',
      status: 'running',
      progress: '1/2',
      taskId: 'task-1',
      imageUrl: '/files/output/current.png',
      imageUrls: ['/files/output/current.png'],
      taskRuns: [{ batchIndex: 0, status: 'success', outputCount: 1 }],
    });
    expect(persisted).toEqual(expect.objectContaining({ status: 'success', imageUrl: '/files/output/old.png' }));
  });

  it('returns persisted node data when the selected Run projection is cleared', async () => {
    const { mergeNodeExecutionProjection } = await import('./useNodeExecutionProjection');
    const persisted = { status: 'success', imageUrl: '/files/output/manual.png' };

    expect(mergeNodeExecutionProjection(persisted)).toBe(persisted);
  });

  it('marks projected upstream nodes so OutputNode can avoid persistence side effects', async () => {
    const { hasNodeExecutionProjection } = await import('./useNodeExecutionProjection');

    expect(hasNodeExecutionProjection([{ data: { __runtimeProjection: { runId: 'run-1' } } }])).toBe(true);
    expect(hasNodeExecutionProjection([{ data: { imageUrl: '/manual.png' } }])).toBe(false);
  });

  it('maps supervised video and audio outputs into existing preview fields', async () => {
    const { mergeNodeExecutionProjection } = await import('./useNodeExecutionProjection');
    const merged = mergeNodeExecutionProjection({
      __runtimeProjection: {
        authority: 'workflow_run',
        runId: 'run-media',
        nodeId: 'media-1',
        nodeType: 'runninghub',
        status: 'success',
        progress: '1/1',
        taskRuns: [],
        outputs: {
          generationArtifactIds: ['video-1', 'audio-1'],
          imageUrls: [],
          videoUrls: ['/files/output/result.mp4'],
          audioUrls: ['/files/output/result.wav'],
          text: '完成',
        },
      },
    });

    expect(merged).toMatchObject({
      videoUrl: '/files/output/result.mp4',
      videoUrls: ['/files/output/result.mp4'],
      audioUrl: '/files/output/result.wav',
      audioUrls: ['/files/output/result.wav'],
      tracks: [{ audioUrl: '/files/output/result.wav' }],
      outputText: '完成',
    });
  });

  it('projects nodes without mutating Canvas state and clears a switched Run immediately', async () => {
    const { projectCanvasRuntimeNodes } = await import('./useNodeExecutionProjection');
    const nodes = [{ id: 'image-1', position: { x: 0, y: 0 }, data: { prompt: 'keep' } }] as any;
    const projection = {
      authority: 'workflow_run',
      runId: 'run-1',
      nodeId: 'image-1',
      nodeType: 'image',
      status: 'running',
      progress: '0/1',
      taskRuns: [],
      outputs: { generationArtifactIds: [], imageUrls: [], videoUrls: [], audioUrls: [] },
    } as any;

    const rendered = projectCanvasRuntimeNodes(nodes, { 'image-1': projection });
    const cleared = projectCanvasRuntimeNodes(nodes, {});

    expect(rendered[0].data).toMatchObject({ prompt: 'keep', __runtimeProjection: { runId: 'run-1' } });
    expect(nodes[0].data).toEqual({ prompt: 'keep' });
    expect(cleared[0]).toBe(nodes[0]);
  });
});

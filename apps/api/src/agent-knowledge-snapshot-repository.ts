import { createHash, randomUUID } from "node:crypto";
import {
  buildKnowledgeSnapshotCanonicalValue,
  CANVAS_RUN_NODE_CAPABILITIES,
  NODE_CAPABILITY_CATALOG_VERSION,
  projectAgentModelCatalog,
  type AgentModelCatalogSource,
  type AgentModelProjection,
  type KnowledgeAudience,
  type KnowledgeDocumentProjection,
  type KnowledgeEnvironment,
  type WorkflowTemplateReference,
} from "@xinghuan/agent-core";
import type { Pool, PoolClient } from "pg";

export interface AgentKnowledgeSnapshotRecord {
  id: string;
  ownerId: string;
  environment: KnowledgeEnvironment;
  audience: KnowledgeAudience;
  nodeCatalogVersion: string;
  nodeCatalogHash: string;
  nodes: typeof CANVAS_RUN_NODE_CAPABILITIES;
  modelCatalogRevision: string;
  modelCatalogHash: string;
  models: AgentModelProjection[];
  documents: KnowledgeDocumentProjection[];
  workflowTemplates: WorkflowTemplateReference[];
  snapshotHash: string;
}

export function createAgentKnowledgeSnapshotRepository(deps: {
  getPostgresPool: () => Promise<Pool>;
  newId?: (prefix: string) => string;
}) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function createSnapshot(input: {
    ownerId: string;
    environment: KnowledgeEnvironment;
    audience: KnowledgeAudience;
    collectionAllowlist: string[];
    includePublishedDocuments?: boolean;
  }): Promise<AgentKnowledgeSnapshotRecord> {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const modelRows = await client.query(
        `select m.id, m.model_id, m.display_name, m.capability, m.enabled as model_enabled,
          m.input_profile, m.input_capabilities, m.capability_tags, m.parameter_schema, m.test_state,
          m.updated_at as model_updated_at,
          p.id as provider_id, p.name as provider_name, p.protocol as provider_protocol,
          p.enabled as provider_enabled, p.last_probe_status as provider_health_state, p.updated_at as provider_updated_at
         from xh_models m
         join xh_providers p on p.id = m.provider_id
         order by m.id`,
      );
      const modelSources = modelRows.rows.map(mapModelSource);
      const models = projectAgentModelCatalog(modelSources);
      const modelCatalogRevision = latestRevision(modelRows.rows);
      const modelCatalogHash = sha256(stableStringify(models));

      const allowlist = input.includePublishedDocuments === true
        ? [...new Set(input.collectionAllowlist.filter(Boolean))].sort()
        : [];
      const documentRows = allowlist.length === 0 ? { rows: [] } : await client.query(
        `select pub.id as publication_id, d.id as document_id, d.document_key, d.version, d.title, d.body,
          d.source_snapshot, c.collection_key, c.audience, pub.environment
         from xh_agent_knowledge_collections c
         join xh_agent_knowledge_documents d on d.collection_id = c.id and d.status = 'approved'
         join xh_agent_knowledge_publications pub on pub.document_id = d.id
           and pub.environment = $1 and pub.retired_at is null
         where c.audience = $2 and c.collection_key = any($3::text[]) and c.enabled = true
         order by c.collection_key, d.document_key, d.version desc, pub.id`,
        [input.environment, input.audience, allowlist],
      );
      const documents = latestPublishedDocuments(documentRows.rows, input.environment, input.audience);
      const workflowTemplates = extractWorkflowTemplateReferences(documentRows.rows);
      const nodeCatalogHash = sha256(stableStringify(CANVAS_RUN_NODE_CAPABILITIES));
      const canonical = buildKnowledgeSnapshotCanonicalValue({
        environment: input.environment,
        audience: input.audience,
        nodeCatalogVersion: NODE_CAPABILITY_CATALOG_VERSION,
        nodeCatalogHash,
        modelCatalogRevision,
        modelCatalogHash,
        documentPublications: documents,
        workflowTemplates,
      });
      const snapshotHash = sha256(stableStringify(canonical));
      const id = newId("agent_knowledge_snapshot");
      const inserted = await client.query(
        `insert into xh_agent_knowledge_snapshots
          (id, owner_id, environment, audience, node_catalog_version, node_catalog_hash, node_catalog_projection,
           model_catalog_revision, model_catalog_hash, model_catalog_projection, document_publications,
           workflow_template_refs, snapshot_hash)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13)
         on conflict (owner_id, snapshot_hash) do nothing returning id`,
        [id, input.ownerId, input.environment, input.audience, NODE_CAPABILITY_CATALOG_VERSION, nodeCatalogHash,
          JSON.stringify(CANVAS_RUN_NODE_CAPABILITIES), modelCatalogRevision, modelCatalogHash, JSON.stringify(models),
          JSON.stringify(documents), JSON.stringify(workflowTemplates), snapshotHash],
      );
      let snapshotId = String(inserted.rows[0]?.id || "");
      if (!snapshotId) {
        const replay = await client.query(
          "select id from xh_agent_knowledge_snapshots where owner_id = $1 and snapshot_hash = $2 limit 1",
          [input.ownerId, snapshotHash],
        );
        snapshotId = String(replay.rows[0]?.id || "");
      }
      if (!snapshotId) throw new Error("AGENT_KNOWLEDGE_SNAPSHOT_CREATE_FAILED");
      return {
        id: snapshotId,
        ownerId: input.ownerId,
        environment: input.environment,
        audience: input.audience,
        nodeCatalogVersion: NODE_CAPABILITY_CATALOG_VERSION,
        nodeCatalogHash,
        nodes: CANVAS_RUN_NODE_CAPABILITIES,
        modelCatalogRevision,
        modelCatalogHash,
        models,
        documents,
        workflowTemplates,
        snapshotHash,
      };
    });
  }

  async function readSnapshot(input: { ownerId: string; snapshotId: string }): Promise<AgentKnowledgeSnapshotRecord> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select * from xh_agent_knowledge_snapshots where id = $1 and owner_id = $2 limit 1`,
      [input.snapshotId, input.ownerId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("AGENT_KNOWLEDGE_SNAPSHOT_NOT_FOUND");
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      environment: row.environment as KnowledgeEnvironment,
      audience: row.audience as KnowledgeAudience,
      nodeCatalogVersion: String(row.node_catalog_version),
      nodeCatalogHash: String(row.node_catalog_hash),
      nodes: arrayValue(row.node_catalog_projection) as unknown as typeof CANVAS_RUN_NODE_CAPABILITIES,
      modelCatalogRevision: String(row.model_catalog_revision),
      modelCatalogHash: String(row.model_catalog_hash),
      models: arrayValue(row.model_catalog_projection) as unknown as AgentModelProjection[],
      documents: arrayValue(row.document_publications) as unknown as KnowledgeDocumentProjection[],
      workflowTemplates: arrayValue(row.workflow_template_refs) as unknown as WorkflowTemplateReference[],
      snapshotHash: String(row.snapshot_hash),
    };
  }

  return { createSnapshot, readSnapshot };
}

function mapModelSource(row: Record<string, unknown>): AgentModelCatalogSource {
  return {
    id: String(row.id),
    modelId: String(row.model_id || ""),
    displayName: String(row.display_name || row.model_id || ""),
    capability: String(row.capability || ""),
    providerId: String(row.provider_id || ""),
    providerName: String(row.provider_name || ""),
    providerProtocol: String(row.provider_protocol || ""),
    enabled: Boolean(row.model_enabled),
    providerEnabled: Boolean(row.provider_enabled),
    inputProfile: String(row.input_profile || ""),
    inputCapabilities: plainObject(row.input_capabilities),
    capabilityTags: stringArray(row.capability_tags),
    parameterSchema: typeof row.parameter_schema === "string" ? row.parameter_schema : plainObject(row.parameter_schema),
    testState: row.test_state,
    providerHealthState: typeof row.provider_health_state === "string" ? row.provider_health_state : undefined,
  };
}

function latestPublishedDocuments(rows: Array<Record<string, unknown>>, environment: KnowledgeEnvironment, audience: KnowledgeAudience) {
  const seen = new Set<string>();
  return rows.flatMap((row): KnowledgeDocumentProjection[] => {
    const identity = `${String(row.collection_key)}:${String(row.document_key)}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const body = String(row.body || "");
    return [{
      publicationId: String(row.publication_id),
      documentId: String(row.document_id),
      documentKey: String(row.document_key),
      collectionKey: String(row.collection_key),
      audience,
      environment,
      version: Number(row.version),
      title: String(row.title || ""),
      body,
      bodyHash: sha256(body),
    }];
  });
}

function extractWorkflowTemplateReferences(rows: Array<Record<string, unknown>>) {
  return rows.flatMap((row): WorkflowTemplateReference[] => {
    const source = plainObject(row.source_snapshot);
    if (source.type !== "workflow-template" || typeof source.templateKey !== "string") return [];
    return [{
      templateKey: source.templateKey,
      revision: Math.max(1, Math.floor(Number(source.revision) || 1)),
      hash: typeof source.hash === "string" ? source.hash : sha256(String(row.body || "")),
      documentId: String(row.document_id),
    }];
  }).sort((left, right) => left.templateKey.localeCompare(right.templateKey) || left.revision - right.revision);
}

function latestRevision(rows: Array<Record<string, unknown>>) {
  const timestamps = rows.flatMap((row) => [row.model_updated_at, row.provider_updated_at])
    .map((value) => value instanceof Date ? value.getTime() : new Date(String(value || 0)).getTime())
    .filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : "empty";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

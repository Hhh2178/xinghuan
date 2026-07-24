import { randomUUID } from "node:crypto";
import {
  AGENT_TOOL_CATALOG,
  normalizeAgentRuntimeConfiguration,
  routeLlmCandidates,
  routeStateAfterCooldown,
  type AgentRole,
  type LlmRouteCandidate,
  type LlmRouteEntryState,
} from "@xinghuan/agent-core";
import type { Pool, PoolClient } from "pg";

export type GovernanceEnvironment = "gray" | "production";
export type GovernedVersionStatus = "draft" | "review" | "approved" | "retired";

export interface LlmPoolVersionInput {
  policy: Record<string, unknown>;
  entries: Array<{
    modelId: string;
    providerId: string;
    capabilityTags: string[];
    priority: number;
    weight: number;
    estimatedCost: number;
    enabled?: boolean;
  }>;
}

export function createAgentGovernanceRepository(deps: {
  getPostgresPool: () => Promise<Pool>;
  newId?: (prefix: string) => string;
}) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function readOverview() {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select
        (select count(*)::int from xh_agent_definitions where enabled = true) as enabled_roles,
        (select count(*)::int from xh_llm_route_pools where enabled = true) as enabled_pools,
        (select count(*)::int from xh_llm_route_entry_health where state in ('degraded', 'rate_limited', 'unavailable', 'circuit_open')) as unhealthy_routes,
        (select count(*)::int from xh_agent_runs where status in ('queued', 'running', 'awaiting_approval')) as active_agent_runs,
        (select count(*)::int from xh_canvas_runs where status in ('planned', 'queued', 'running', 'paused', 'awaiting_approval')) as active_canvas_runs,
        (select count(*)::int from xh_agent_approvals where status = 'pending') as pending_approvals,
        (select count(*)::int from xh_recovery_decisions where status in ('proposed', 'approved')) as pending_recovery,
        (select count(*)::int from xh_artifact_evaluations where created_at >= now() - interval '24 hour') as evaluations_24h`,
    );
    return numberRecord(result.rows[0] || {});
  }

  async function listAgentDefinitions() {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select d.id, d.agent_key, d.name, d.role, d.description, d.enabled, d.created_at, d.updated_at,
        coalesce(jsonb_agg(distinct jsonb_build_object(
          'id', cv.id, 'version', cv.version, 'status', cv.status, 'configuration', cv.configuration,
          'createdAt', extract(epoch from cv.created_at) * 1000
        )) filter (where cv.id is not null), '[]'::jsonb) as versions,
        coalesce(jsonb_agg(distinct jsonb_build_object(
          'id', cp.id, 'configurationVersionId', cp.configuration_version_id, 'environment', cp.environment,
          'publishedAt', extract(epoch from cp.published_at) * 1000
        )) filter (where cp.id is not null and cp.retired_at is null), '[]'::jsonb) as publications
       from xh_agent_definitions d
       left join xh_agent_configuration_versions cv on cv.agent_definition_id = d.id
       left join xh_agent_configuration_publications cp on cp.configuration_version_id = cv.id
       group by d.id order by d.role, d.agent_key`,
    );
    return result.rows.map(mapAgentDefinition);
  }

  async function createAgentDefinition(input: { actorId: string; agentKey: string; name: string; role: AgentRole; description: string }) {
    const pool = await deps.getPostgresPool();
    const id = newId("agent_definition");
    const schemas = defaultAgentSchemas(input.role);
    const result = await pool.query(
      `insert into xh_agent_definitions (id, agent_key, name, role, input_schema, output_schema, tool_allowlist, description, enabled)
       values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7, true) returning *`,
      [id, input.agentKey, input.name, input.role, schemas.inputSchema, schemas.outputSchema, input.description],
    );
    return mapAgentDefinition({ ...result.rows[0], versions: [], publications: [] });
  }

  async function bootstrapDefaults(actorId: string) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      let definitionsCreated = 0;
      let configurationsCreated = 0;
      let routePoolsCreated = 0;
      for (const routePool of DEFAULT_LLM_ROUTE_POOLS) {
        const inserted = await client.query(
          `insert into xh_llm_route_pools (id, pool_key, name, role, scenario, enabled)
           values ($1, $2, $3, $4, $5, true) on conflict (pool_key) do nothing returning id`,
          [newId("llm_pool"), routePool.poolKey, routePool.name, routePool.role, routePool.scenario],
        );
        routePoolsCreated += inserted.rows.length;
      }
      for (const definition of DEFAULT_AGENT_DEFINITIONS) {
        const schemas = defaultAgentSchemas(definition.role);
        const inserted = await client.query(
          `insert into xh_agent_definitions (id, agent_key, name, role, input_schema, output_schema, tool_allowlist, description, enabled)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, true) on conflict (agent_key) do nothing returning id`,
          [newId("agent_definition"), definition.agentKey, definition.name, definition.role, schemas.inputSchema, schemas.outputSchema, JSON.stringify(definition.tools), definition.description],
        );
        definitionsCreated += inserted.rows.length;
        const current = await client.query("select id from xh_agent_definitions where agent_key = $1 limit 1", [definition.agentKey]);
        const definitionId = current.rows[0]?.id;
        if (!definitionId) throw new Error("AGENT_DEFAULT_DEFINITION_MISSING");
        const existingConfiguration = await client.query("select id from xh_agent_configuration_versions where agent_definition_id = $1 limit 1", [definitionId]);
        if (!existingConfiguration.rows[0]) {
          await client.query(
            `insert into xh_agent_configuration_versions (id, agent_definition_id, version, status, configuration, created_by)
             values ($1, $2, 1, 'draft', $3::jsonb, $4)`,
            [newId("agent_configuration"), definitionId, JSON.stringify(normalizeAgentRuntimeConfiguration({ toolAllowlist: definition.tools, maxTokens: definition.maxTokens, timeoutMs: 120000, llmPoolKey: definition.llmPoolKey })), actorId],
          );
          configurationsCreated += 1;
        }
      }
      return { definitionsCreated, configurationsCreated, routePoolsCreated, knowledgeCollectionsCreated: 0 };
    });
  }

  async function createAgentConfigurationVersion(input: { actorId: string; agentDefinitionId: string; configuration: Record<string, unknown> }) {
    const configuration = normalizeAgentRuntimeConfiguration(input.configuration);
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const definition = await client.query("select id, role from xh_agent_definitions where id = $1 for update", [input.agentDefinitionId]);
      if (!definition.rows[0]) throw new Error("AGENT_DEFINITION_NOT_FOUND");
      await validateAgentConfigurationReferences(client, configuration, definition.rows[0].role as AgentRole);
      const version = await client.query("select coalesce(max(version), 0) + 1 as next from xh_agent_configuration_versions where agent_definition_id = $1", [input.agentDefinitionId]);
      const result = await client.query(
        `insert into xh_agent_configuration_versions (id, agent_definition_id, version, status, configuration, created_by)
         values ($1, $2, $3, 'draft', $4::jsonb, $5) returning *`,
        [newId("agent_configuration"), input.agentDefinitionId, Number(version.rows[0].next), JSON.stringify(configuration), input.actorId],
      );
      return result.rows[0];
    });
  }

  async function cloneAgentConfigurationVersion(input: { actorId: string; sourceVersionId: string }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const source = await client.query(
        `select cv.agent_definition_id, cv.configuration
         from xh_agent_configuration_versions cv where cv.id = $1 for share`,
        [input.sourceVersionId],
      );
      if (!source.rows[0]) throw new Error("AGENT_CONFIGURATION_NOT_FOUND");
      const configuration = normalizeAgentRuntimeConfiguration(source.rows[0].configuration);
      const definition = await client.query("select role from xh_agent_definitions where id = $1 for share", [source.rows[0].agent_definition_id]);
      if (!definition.rows[0]) throw new Error("AGENT_DEFINITION_NOT_FOUND");
      await validateAgentConfigurationReferences(client, configuration, definition.rows[0].role as AgentRole);
      const version = await client.query(
        "select coalesce(max(version), 0) + 1 as next from xh_agent_configuration_versions where agent_definition_id = $1",
        [source.rows[0].agent_definition_id],
      );
      const result = await client.query(
        `insert into xh_agent_configuration_versions (id, agent_definition_id, version, status, configuration, created_by)
         values ($1, $2, $3, 'draft', $4::jsonb, $5) returning *`,
        [newId("agent_configuration"), source.rows[0].agent_definition_id, Number(version.rows[0].next), JSON.stringify(configuration), input.actorId],
      );
      return result.rows[0];
    });
  }

  async function transitionAgentConfigurationVersion(input: { actorId: string; versionId: string; next: GovernedVersionStatus }) {
    const pool = await deps.getPostgresPool();
    if (input.next === "review" || input.next === "approved") await validateStoredAgentConfiguration(pool, input.versionId);
    return transitionVersion(pool, {
      table: "xh_agent_configuration_versions",
      publicationTable: "xh_agent_configuration_publications",
      publicationForeignKey: "configuration_version_id",
      id: input.versionId,
      next: input.next,
      actorId: input.actorId,
    });
  }

  async function publishAgentConfiguration(input: { actorId: string; versionId: string; environment: GovernanceEnvironment }) {
    const pool = await deps.getPostgresPool();
    await validateStoredAgentConfiguration(pool, input.versionId);
    return publishVersion(pool, {
      parentTable: "xh_agent_definitions",
      versionTable: "xh_agent_configuration_versions",
      parentForeignKey: "agent_definition_id",
      publicationTable: "xh_agent_configuration_publications",
      publicationForeignKey: "configuration_version_id",
      publicationId: newId("agent_configuration_publication"),
      versionId: input.versionId,
      environment: input.environment,
      actorId: input.actorId,
    });
  }

  async function listLlmPools() {
    const pool = await deps.getPostgresPool();
    const [pools, versions, entries, health, publications] = await Promise.all([
      pool.query("select * from xh_llm_route_pools order by role, scenario, pool_key"),
      pool.query("select * from xh_llm_route_pool_versions order by pool_id, version desc"),
      pool.query("select * from xh_llm_route_entries order by pool_version_id, priority, id"),
      pool.query("select * from xh_llm_route_entry_health"),
      pool.query("select * from xh_llm_route_pool_publications where retired_at is null order by environment"),
    ]);
    const healthByEntry = new Map(health.rows.map((row) => [String(row.route_entry_id), mapHealth(row)]));
    return pools.rows.map((poolRow) => ({
      id: String(poolRow.id),
      poolKey: String(poolRow.pool_key),
      name: String(poolRow.name),
      role: poolRow.role as AgentRole,
      scenario: String(poolRow.scenario),
      enabled: Boolean(poolRow.enabled),
      versions: versions.rows.filter((row) => row.pool_id === poolRow.id).map((row) => ({
        id: String(row.id),
        version: Number(row.version),
        status: row.status as GovernedVersionStatus,
        policy: objectValue(row.policy_snapshot),
        entries: entries.rows.filter((entry) => entry.pool_version_id === row.id).map((entry) => ({
          id: String(entry.id),
          modelId: String(entry.model_id),
          providerId: String(entry.provider_id),
          capabilityTags: stringArray(entry.capability_tags_snapshot),
          inputCapabilities: objectValue(entry.model_input_capabilities_snapshot),
          mediaInputTransports: stringArray(entry.media_input_transports_snapshot),
          priority: Number(entry.priority),
          weight: Number(entry.weight),
          estimatedCost: Number(entry.estimated_cost),
          enabled: Boolean(entry.enabled),
          health: healthByEntry.get(String(entry.id)) || defaultHealth(),
        })),
        publications: publications.rows.filter((publication) => publication.pool_version_id === row.id).map(mapPublication),
      })),
    }));
  }

  async function createLlmPool(input: { poolKey: string; name: string; role: AgentRole; scenario: string }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `insert into xh_llm_route_pools (id, pool_key, name, role, scenario, enabled)
       values ($1, $2, $3, $4, $5, true) returning *`,
      [newId("llm_pool"), input.poolKey, input.name, input.role, input.scenario],
    );
    const row = result.rows[0];
    return { id: row.id, poolKey: row.pool_key, name: row.name, role: row.role, scenario: row.scenario, enabled: row.enabled, versions: [] };
  }

  async function createLlmPoolVersion(input: { actorId: string; poolId: string; value: LlmPoolVersionInput }) {
    if (input.value.entries.length === 0) throw new Error("LLM_POOL_ENTRIES_REQUIRED");
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const parent = await client.query("select id from xh_llm_route_pools where id = $1 for update", [input.poolId]);
      if (!parent.rows[0]) throw new Error("LLM_POOL_NOT_FOUND");
      const modelIds = [...new Set(input.value.entries.map((entry) => entry.modelId))];
      if (modelIds.length !== input.value.entries.length) throw new Error("LLM_POOL_DUPLICATE_MODEL");
      const compatible = await client.query(
        `select m.id as model_id, m.provider_id, m.input_capabilities, m.protocol_override,
          p.protocol as provider_protocol
         from xh_models m join xh_providers p on p.id = m.provider_id
         where m.id = any($1::text[]) and m.capability = 'chat' and m.enabled = true and p.enabled = true`,
        [modelIds],
      );
      const allowed = new Set(compatible.rows.map((row) => `${row.model_id}:${row.provider_id}`));
      if (input.value.entries.some((entry) => !allowed.has(`${entry.modelId}:${entry.providerId}`))) throw new Error("LLM_POOL_CHAT_MODEL_REQUIRED");
      const modelSnapshots = new Map(compatible.rows.map((row) => [String(row.model_id), {
        inputCapabilities: objectValue(row.input_capabilities),
        mediaInputTransports: deriveMediaInputTransports(row),
      }]));
      const versionResult = await client.query("select coalesce(max(version), 0) + 1 as next from xh_llm_route_pool_versions where pool_id = $1", [input.poolId]);
      const versionId = newId("llm_pool_version");
      const version = Number(versionResult.rows[0].next);
      await client.query(
        `insert into xh_llm_route_pool_versions (id, pool_id, version, status, policy_snapshot, created_by)
         values ($1, $2, $3, 'draft', $4::jsonb, $5)`,
        [versionId, input.poolId, version, JSON.stringify(input.value.policy), input.actorId],
      );
      for (const entry of input.value.entries) {
        await client.query(
          `insert into xh_llm_route_entries
           (id, pool_version_id, model_id, provider_id, model_capability_snapshot, capability_tags_snapshot,
            model_input_capabilities_snapshot, media_input_transports_snapshot, priority, weight, estimated_cost, enabled)
           values ($1, $2, $3, $4, 'chat', $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11)`,
          [newId("llm_route_entry"), versionId, entry.modelId, entry.providerId, JSON.stringify(entry.capabilityTags),
            JSON.stringify(modelSnapshots.get(entry.modelId)?.inputCapabilities || {}),
            JSON.stringify(modelSnapshots.get(entry.modelId)?.mediaInputTransports || []),
            integer(entry.priority, 0, 10_000), integer(entry.weight, 1, 1_000), finite(entry.estimatedCost, 0), entry.enabled !== false],
        );
      }
      return { id: versionId, poolId: input.poolId, version, status: "draft" as const };
    });
  }

  async function transitionLlmPoolVersion(input: { actorId: string; versionId: string; next: GovernedVersionStatus }) {
    const pool = await deps.getPostgresPool();
    return transitionVersion(pool, {
      table: "xh_llm_route_pool_versions", publicationTable: "xh_llm_route_pool_publications",
      publicationForeignKey: "pool_version_id", id: input.versionId, next: input.next, actorId: input.actorId,
      validate: input.next === "approved" ? (client) => validateLlmPoolVersionForPublication(client, input.versionId) : undefined,
    });
  }

  async function publishLlmPoolVersion(input: { actorId: string; versionId: string; environment: GovernanceEnvironment }) {
    const pool = await deps.getPostgresPool();
    return publishVersion(pool, {
      parentTable: "xh_llm_route_pools", versionTable: "xh_llm_route_pool_versions", parentForeignKey: "pool_id",
      publicationTable: "xh_llm_route_pool_publications", publicationForeignKey: "pool_version_id",
      publicationId: newId("llm_pool_publication"), versionId: input.versionId, environment: input.environment, actorId: input.actorId,
      validate: (client) => validateLlmPoolVersionForPublication(client, input.versionId),
    });
  }

  async function simulateLlmRoute(input: {
    versionId: string;
    role: AgentRole;
    scenario: string;
    requiredCapabilityTags: string[];
    requiredInputCapabilities?: string[];
    maximumEstimatedCost?: number;
    decisionKey: string;
  }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select e.id, e.provider_id, e.model_id, e.model_capability_snapshot, e.capability_tags_snapshot, pv.policy_snapshot,
        e.model_input_capabilities_snapshot, e.media_input_transports_snapshot,
        e.priority, e.weight, e.estimated_cost::text, coalesce(h.state, 'healthy') as state, h.circuit_opened_at,
        coalesce(h.p95_latency_ms, 0) as p95_latency_ms
       from xh_llm_route_entries e
       join xh_llm_route_pool_versions pv on pv.id = e.pool_version_id
       left join xh_llm_route_entry_health h on h.route_entry_id = e.id
       where e.pool_version_id = $1 and e.enabled = true order by e.priority, e.id`,
      [input.versionId],
    );
    const policy = objectValue(result.rows[0]?.policy_snapshot);
    const candidates = result.rows.map((row) => mapCandidate(row, policy));
    return { candidates, decision: routeLlmCandidates({ ...input, candidates }) };
  }

  async function listToolPolicies() {
    const pool = await deps.getPostgresPool();
    const result = await pool.query("select * from xh_agent_tool_policies order by subject_type, subject_id nulls first, tool_name");
    return result.rows.map((row) => ({ id: row.id, subjectType: row.subject_type, subjectId: row.subject_id, toolName: row.tool_name, effect: row.effect, constraints: objectValue(row.constraints), revision: Number(row.revision), updatedAt: dateMillis(row.updated_at) }));
  }

  async function upsertToolPolicy(input: { actorId: string; id?: string; subjectType: string; subjectId?: string; toolName: string; effect: string; constraints: Record<string, unknown>; revision?: number }) {
    const catalogEntry = AGENT_TOOL_CATALOG.find((tool) => tool.name === input.toolName);
    if (!catalogEntry) throw new Error("AGENT_TOOL_POLICY_TOOL_UNKNOWN");
    if (!new Set(["platform", "user_group", "user"]).has(input.subjectType)) throw new Error("AGENT_TOOL_POLICY_SUBJECT_INVALID");
    if (!new Set(["allow", "deny", "require_approval"]).has(input.effect)) throw new Error("AGENT_TOOL_POLICY_EFFECT_INVALID");
    if (catalogEntry.approvalRequired && input.effect === "allow") throw new Error("AGENT_TOOL_APPROVAL_CANNOT_BE_BYPASSED");
    const constraints = normalizeToolPolicyConstraints(input.constraints);
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const current = await client.query(
        `select * from xh_agent_tool_policies where subject_type = $1 and subject_id is not distinct from $2 and tool_name = $3 for update`,
        [input.subjectType, input.subjectId || null, input.toolName],
      );
      if (current.rows[0]) {
        if (input.revision !== Number(current.rows[0].revision)) throw revisionConflict("AGENT_TOOL_POLICY_REVISION_CONFLICT", current.rows[0].revision);
        const updated = await client.query(
          `update xh_agent_tool_policies set effect = $4, constraints = $5::jsonb, revision = revision + 1, updated_at = now()
           where id = $1 and subject_type = $2 and subject_id is not distinct from $3 returning *`,
          [current.rows[0].id, input.subjectType, input.subjectId || null, input.effect, JSON.stringify(constraints)],
        );
        return updated.rows[0];
      }
      const inserted = await client.query(
        `insert into xh_agent_tool_policies (id, subject_type, subject_id, tool_name, effect, constraints, revision, created_by)
         values ($1, $2, $3, $4, $5, $6::jsonb, 1, $7) returning *`,
        [input.id || newId("agent_tool_policy"), input.subjectType, input.subjectId || null, input.toolName, input.effect, JSON.stringify(constraints), input.actorId],
      );
      return inserted.rows[0];
    });
  }

  async function listQualityProfiles() {
    const pool = await deps.getPostgresPool();
    const [profiles, publications] = await Promise.all([
      pool.query("select * from xh_artifact_quality_profiles order by profile_key, version desc"),
      pool.query("select * from xh_artifact_quality_profile_publications where retired_at is null order by environment"),
    ]);
    return profiles.rows.map((row) => ({
      id: row.id, profileKey: row.profile_key, version: Number(row.version), mediaKind: row.media_kind, status: row.status,
      minimumOverallScore: Number(row.minimum_overall_score), minimumConfidence: Number(row.minimum_confidence),
      weights: objectValue(row.weights), instructions: String(row.instructions),
      publications: publications.rows.filter((publication) => publication.quality_profile_id === row.id).map(mapPublication),
    }));
  }

  async function createQualityProfile(input: { actorId: string; profileKey: string; mediaKind: "image" | "video"; minimumOverallScore: number; minimumConfidence: number; weights: Record<string, number>; instructions: string }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`quality:${input.profileKey}`]);
      const version = await client.query("select coalesce(max(version), 0) + 1 as next from xh_artifact_quality_profiles where profile_key = $1", [input.profileKey]);
      const result = await client.query(
        `insert into xh_artifact_quality_profiles
         (id, profile_key, version, media_kind, status, minimum_overall_score, minimum_confidence, weights, instructions, created_by)
         values ($1, $2, $3, $4, 'draft', $5, $6, $7::jsonb, $8, $9) returning *`,
        [newId("quality_profile"), input.profileKey, Number(version.rows[0].next), input.mediaKind,
          finite(input.minimumOverallScore, 0), finite(input.minimumConfidence, 0), JSON.stringify(input.weights), input.instructions, input.actorId],
      );
      return result.rows[0];
    });
  }

  async function transitionQualityProfile(input: { actorId: string; profileId: string; next: GovernedVersionStatus }) {
    const pool = await deps.getPostgresPool();
    return transitionVersion(pool, {
      table: "xh_artifact_quality_profiles", publicationTable: "xh_artifact_quality_profile_publications",
      publicationForeignKey: "quality_profile_id", id: input.profileId, next: input.next, actorId: input.actorId,
    });
  }

  async function publishQualityProfile(input: { actorId: string; profileId: string; environment: GovernanceEnvironment }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const version = await client.query("select id, profile_key, status from xh_artifact_quality_profiles where id = $1 for update", [input.profileId]);
      if (!version.rows[0]) throw new Error("QUALITY_PROFILE_NOT_FOUND");
      if (version.rows[0].status !== "approved") throw new Error("QUALITY_PROFILE_NOT_APPROVED");
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`quality:${version.rows[0].profile_key}:${input.environment}`]);
      await client.query(
        `update xh_artifact_quality_profile_publications pub set retired_at = now()
         from xh_artifact_quality_profiles p where pub.quality_profile_id = p.id and p.profile_key = $1
         and pub.environment = $2 and pub.retired_at is null and pub.quality_profile_id <> $3`,
        [version.rows[0].profile_key, input.environment, input.profileId],
      );
      const publication = await client.query(
        `insert into xh_artifact_quality_profile_publications (id, quality_profile_id, environment, published_by)
         values ($1, $2, $3, $4)
         on conflict (quality_profile_id, environment) do update set published_by = excluded.published_by, published_at = now(), retired_at = null
         returning *`,
        [newId("quality_profile_publication"), input.profileId, input.environment, input.actorId],
      );
      return mapPublication(publication.rows[0]);
    });
  }

  async function readRuntimeControls() {
    const pool = await deps.getPostgresPool();
    const result = await pool.query("select * from xh_agent_runtime_controls order by environment");
    const rows = new Map(result.rows.map((row) => [row.environment, mapRuntimeControls(row)]));
    return (["gray", "production"] as const).map((environment) => rows.get(environment) || defaultRuntimeControls(environment));
  }

  async function readRuntimeControl(environment: GovernanceEnvironment) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query("select * from xh_agent_runtime_controls where environment = $1 limit 1", [environment]);
    return result.rows[0] ? mapRuntimeControls(result.rows[0]) : defaultRuntimeControls(environment);
  }

  async function updateRuntimeControls(input: { actorId: string; environment: GovernanceEnvironment; revision: number; values: Record<string, boolean> }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      await client.query(
        `insert into xh_agent_runtime_controls (environment, revision, updated_by)
         values ($1, 1, $2) on conflict (environment) do nothing`,
        [input.environment, input.actorId],
      );
      const result = await client.query(
        `update xh_agent_runtime_controls set
          agent_enabled = $3, canvas_runs_enabled = $4, automatic_recovery_enabled = $5,
          quality_evaluation_enabled = $6, revision = revision + 1, updated_by = $2, updated_at = now()
         where environment = $1 and revision = $7 returning *`,
        [input.environment, input.actorId, Boolean(input.values.agentEnabled), Boolean(input.values.canvasRunsEnabled),
          Boolean(input.values.automaticRecoveryEnabled), Boolean(input.values.qualityEvaluationEnabled), input.revision],
      );
      if (!result.rows[0]) {
        const current = await client.query("select revision from xh_agent_runtime_controls where environment = $1", [input.environment]);
        throw revisionConflict("AGENT_RUNTIME_CONTROL_REVISION_CONFLICT", current.rows[0]?.revision || 1);
      }
      return mapRuntimeControls(result.rows[0]);
    });
  }

  async function listKnowledge() {
    const pool = await deps.getPostgresPool();
    const [collections, documents, publications] = await Promise.all([
      pool.query("select * from xh_agent_knowledge_collections order by audience, collection_key"),
      pool.query("select * from xh_agent_knowledge_documents order by collection_id, document_key, version desc"),
      pool.query("select * from xh_agent_knowledge_publications where retired_at is null order by environment"),
    ]);
    return collections.rows.map((collection) => ({
      id: collection.id, collectionKey: collection.collection_key, name: collection.name, description: collection.description,
      audience: collection.audience, enabled: collection.enabled, revision: Number(collection.revision),
      documents: documents.rows.filter((document) => document.collection_id === collection.id).map((document) => ({
        id: document.id, documentKey: document.document_key, version: Number(document.version), title: document.title,
        body: document.body, source: objectValue(document.source_snapshot), status: document.status,
        publications: publications.rows.filter((publication) => publication.document_id === document.id).map(mapPublication),
      })),
    }));
  }

  async function readPublishedKnowledgeContext(input: { collectionKey: string; environment: GovernanceEnvironment; limit?: number }) {
    const pool = await deps.getPostgresPool();
    const limit = integer(input.limit, 1, 50);
    const result = await pool.query(
      `select distinct on (d.document_key) d.document_key, d.title, d.body, d.version
       from xh_agent_knowledge_collections c
       join xh_agent_knowledge_documents d on d.collection_id = c.id and d.status = 'approved'
       join xh_agent_knowledge_publications pub on pub.document_id = d.id and pub.environment = $2 and pub.retired_at is null
       where c.collection_key = $1 and c.audience = 'public' and c.enabled = true
       order by d.document_key, d.version desc limit $3`,
      [input.collectionKey, input.environment, limit],
    );
    let remaining = 24_000;
    return result.rows.flatMap((row) => {
      if (remaining <= 0) return [];
      const body = String(row.body || "").trim().slice(0, remaining);
      remaining -= body.length;
      return body ? [{ documentKey: String(row.document_key), title: String(row.title), version: Number(row.version), body }] : [];
    });
  }

  async function createKnowledgeCollection(input: { actorId: string; collectionKey: string; name: string; description: string; audience: "public" | "internal" }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `insert into xh_agent_knowledge_collections
       (id, collection_key, name, description, audience, enabled, revision, created_by)
       values ($1, $2, $3, $4, $5, true, 1, $6) returning *`,
      [newId("agent_knowledge_collection"), input.collectionKey, input.name, input.description, input.audience, input.actorId],
    );
    return result.rows[0];
  }

  async function createKnowledgeDocument(input: { actorId: string; collectionId: string; documentKey: string; title: string; body: string; source: Record<string, unknown> }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const collection = await client.query("select id from xh_agent_knowledge_collections where id = $1 for update", [input.collectionId]);
      if (!collection.rows[0]) throw new Error("AGENT_KNOWLEDGE_COLLECTION_NOT_FOUND");
      const next = await client.query(
        "select coalesce(max(version), 0) + 1 as next from xh_agent_knowledge_documents where collection_id = $1 and document_key = $2",
        [input.collectionId, input.documentKey],
      );
      const result = await client.query(
        `insert into xh_agent_knowledge_documents
         (id, collection_id, document_key, version, title, body, source_snapshot, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', $8) returning *`,
        [newId("agent_knowledge_document"), input.collectionId, input.documentKey, Number(next.rows[0].next), input.title, input.body, JSON.stringify(input.source), input.actorId],
      );
      return result.rows[0];
    });
  }

  async function transitionKnowledgeDocument(input: { actorId: string; documentId: string; next: GovernedVersionStatus }) {
    const pool = await deps.getPostgresPool();
    return transitionVersion(pool, {
      table: "xh_agent_knowledge_documents", publicationTable: "xh_agent_knowledge_publications",
      publicationForeignKey: "document_id", id: input.documentId, next: input.next, actorId: input.actorId,
    });
  }

  async function publishKnowledgeDocument(input: { actorId: string; documentId: string; environment: GovernanceEnvironment }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const document = await client.query(
        `select d.id, d.document_key, d.status, d.collection_id from xh_agent_knowledge_documents d
         join xh_agent_knowledge_collections c on c.id = d.collection_id where d.id = $1 for update of d, c`,
        [input.documentId],
      );
      if (!document.rows[0]) throw new Error("AGENT_KNOWLEDGE_DOCUMENT_NOT_FOUND");
      if (document.rows[0].status !== "approved") throw new Error("AGENT_KNOWLEDGE_DOCUMENT_NOT_APPROVED");
      await client.query(
        `update xh_agent_knowledge_publications pub set retired_at = now()
         from xh_agent_knowledge_documents d where pub.document_id = d.id and d.collection_id = $1 and d.document_key = $2
         and pub.environment = $3 and pub.retired_at is null and pub.document_id <> $4`,
        [document.rows[0].collection_id, document.rows[0].document_key, input.environment, input.documentId],
      );
      const result = await client.query(
        `insert into xh_agent_knowledge_publications (id, document_id, environment, published_by)
         values ($1, $2, $3, $4)
         on conflict (document_id, environment) do update set published_by = excluded.published_by, published_at = now(), retired_at = null
         returning *`,
        [newId("agent_knowledge_publication"), input.documentId, input.environment, input.actorId],
      );
      return mapPublication(result.rows[0]);
    });
  }

  async function listRuns(limit = 100) {
    const pool = await deps.getPostgresPool();
    const [agentRuns, canvasRuns] = await Promise.all([
      pool.query(
        `select r.id, r.owner_id, u.email as owner_email, r.canvas_run_id, r.parent_agent_run_id, r.role, r.scenario,
          r.status, r.budget_snapshot, r.error, r.created_at, r.updated_at
         from xh_agent_runs r join xh_users u on u.id = r.owner_id order by r.updated_at desc limit $1`, [limit]),
      pool.query(
        `select r.id, r.owner_id, u.email as owner_email, r.canvas_id, r.canvas_revision, r.status,
          r.budget_snapshot, r.created_at, r.updated_at
         from xh_canvas_runs r join xh_users u on u.id = r.owner_id order by r.updated_at desc limit $1`, [limit]),
    ]);
    return { agentRuns: agentRuns.rows.map(mapRunRow), canvasRuns: canvasRuns.rows.map(mapRunRow) };
  }

  async function listApprovals(limit = 100) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select a.*, u.email as owner_email from xh_agent_approvals a join xh_users u on u.id = a.owner_id
       order by case when a.status = 'pending' then 0 else 1 end, a.created_at desc limit $1`, [limit],
    );
    return result.rows.map((row) => ({ id: row.id, ownerId: row.owner_id, ownerEmail: row.owner_email, canvasRunId: row.canvas_run_id, runStepId: row.run_step_id, actionType: row.action_type, action: objectValue(row.action_snapshot), status: row.status, requestedBy: row.requested_by, decidedBy: row.decided_by, decisionReason: row.decision_reason, createdAt: dateMillis(row.created_at) }));
  }

  async function listRecoveryDecisions(limit = 100) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select d.id, d.owner_id, u.email as owner_email, d.canvas_run_id, d.run_step_id, d.task_attempt_id,
        d.failure_category, d.action_type, d.current_generation_provider_id_snapshot, d.current_generation_model_id_snapshot,
        d.alternative_generation_provider_id_snapshot, d.alternative_generation_model_id_snapshot, d.parameter_patch, d.budget_snapshot,
        d.reason, d.status, d.approval_id, d.created_at, d.updated_at
       from xh_recovery_decisions d join xh_users u on u.id = d.owner_id
       order by d.created_at desc limit $1`, [limit],
    );
    return result.rows.map((row) => ({
      id: row.id, ownerId: row.owner_id, ownerEmail: row.owner_email, canvasRunId: row.canvas_run_id,
      runStepId: row.run_step_id, taskAttemptId: row.task_attempt_id, failureClass: row.failure_category,
      decision: row.action_type, currentProviderId: row.current_generation_provider_id_snapshot, currentModelId: row.current_generation_model_id_snapshot,
      targetProviderId: row.alternative_generation_provider_id_snapshot, targetModelId: row.alternative_generation_model_id_snapshot,
      parameterPatch: objectValue(row.parameter_patch), budget: objectValue(row.budget_snapshot),
      reason: row.reason, status: row.status, approvalId: row.approval_id,
      createdAt: dateMillis(row.created_at), updatedAt: dateMillis(row.updated_at),
    }));
  }

  async function decideApproval(input: { approvalId: string; actorId: string; next: "approved" | "rejected" | "cancelled"; reason: string }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `update xh_agent_approvals set status = $2, decided_by = $3, decision_reason = $4, decided_at = now(), updated_at = now()
       where id = $1 and status = 'pending' returning *`,
      [input.approvalId, input.next, input.actorId, input.reason],
    );
    if (!result.rows[0]) throw new Error("AGENT_APPROVAL_NOT_PENDING");
    return result.rows[0];
  }

  async function listAgentAudit(limit = 200) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select a.id, a.owner_id, a.agent_run_id, a.sequence, a.action_type, a.tool_name, a.status,
        a.input_snapshot, a.output_snapshot, a.error, a.created_at
       from xh_agent_actions a order by a.created_at desc limit $1`, [limit],
    );
    return result.rows.map((row) => ({ id: row.id, ownerId: row.owner_id, agentRunId: row.agent_run_id, sequence: Number(row.sequence), actionType: row.action_type, toolName: row.tool_name, status: row.status, input: objectValue(row.input_snapshot), output: objectValue(row.output_snapshot), error: objectValue(row.error), createdAt: dateMillis(row.created_at) }));
  }

  return {
    bootstrapDefaults, cloneAgentConfigurationVersion, createAgentConfigurationVersion, createAgentDefinition, createKnowledgeCollection, createKnowledgeDocument,
    createLlmPool, createLlmPoolVersion, createQualityProfile, decideApproval, listAgentAudit, listAgentDefinitions,
    listApprovals, listKnowledge, listLlmPools, listQualityProfiles, listRecoveryDecisions, listRuns, listToolPolicies, publishAgentConfiguration,
    publishKnowledgeDocument, publishLlmPoolVersion, publishQualityProfile, readOverview, readPublishedKnowledgeContext, readRuntimeControl, readRuntimeControls,
    simulateLlmRoute, transitionAgentConfigurationVersion, transitionKnowledgeDocument, transitionLlmPoolVersion,
    transitionQualityProfile, updateRuntimeControls, upsertToolPolicy,
  };
}

async function validateStoredAgentConfiguration(pool: Pool, versionId: string) {
  const result = await pool.query(
    `select cv.configuration, d.role from xh_agent_configuration_versions cv
     join xh_agent_definitions d on d.id = cv.agent_definition_id where cv.id = $1 limit 1`,
    [versionId],
  );
  if (!result.rows[0]) throw new Error("AGENT_CONFIGURATION_NOT_FOUND");
  await validateAgentConfigurationReferences(pool, normalizeAgentRuntimeConfiguration(result.rows[0].configuration), result.rows[0].role as AgentRole);
}

async function validateAgentConfigurationReferences(client: Pick<PoolClient, "query"> | Pool, configuration: ReturnType<typeof normalizeAgentRuntimeConfiguration>, role: AgentRole) {
  if (configuration.llmPoolKey) {
    const pool = await client.query("select id from xh_llm_route_pools where pool_key = $1 and role = $2 and enabled = true limit 1", [configuration.llmPoolKey, role]);
    if (!pool.rows[0]) throw new Error("AGENT_CONFIGURATION_LLM_POOL_INVALID");
  }
  if (configuration.knowledge.collectionAllowlist.length > 0) {
    const collections = await client.query(
      "select collection_key from xh_agent_knowledge_collections where collection_key = any($1::text[]) and audience = $2 and enabled = true",
      [configuration.knowledge.collectionAllowlist, configuration.knowledge.audience],
    );
    const found = new Set(collections.rows.map((row) => String(row.collection_key)));
    if (configuration.knowledge.collectionAllowlist.some((key) => !found.has(key))) throw new Error("AGENT_CONFIGURATION_KNOWLEDGE_COLLECTION_INVALID");
  }
  if (configuration.qualityProfileKey) {
    const quality = await client.query("select id from xh_artifact_quality_profiles where profile_key = $1 limit 1", [configuration.qualityProfileKey]);
    if (!quality.rows[0]) throw new Error("AGENT_CONFIGURATION_QUALITY_PROFILE_INVALID");
  }
}

const DEFAULT_LLM_ROUTE_POOLS: Array<{ poolKey: string; name: string; role: AgentRole; scenario: string }> = [
  { poolKey: "assistant-diagnosis", name: "创作侧助手路由", role: "planner", scenario: "assistant-chat" },
  { poolKey: "admin-assistant-diagnosis", name: "后台助手路由", role: "planner", scenario: "assistant-chat" },
  { poolKey: "supervision-planning", name: "AI 托管规划路由", role: "planner", scenario: "canvas-supervision-analysis" },
];

const DEFAULT_AGENT_DEFINITIONS: Array<{ agentKey: string; name: string; role: AgentRole; description: string; tools: string[]; maxTokens: number; llmPoolKey?: string }> = [
  { agentKey: "assistant-planner", name: "画布诊断助手", role: "planner", description: "解释画布与节点错误，给出不修改拓扑的受控建议。", tools: ["knowledge.node.get", "knowledge.model.get"], maxTokens: 8000, llmPoolKey: "assistant-diagnosis" },
  { agentKey: "admin-assistant-planner", name: "后台诊断助手", role: "planner", description: "分析后台任务、Provider、模型与审计上下文，给出受控诊断建议。", tools: ["knowledge.model.get"], maxTokens: 8000, llmPoolKey: "admin-assistant-diagnosis" },
  { agentKey: "supervision-planner", name: "AI 托管规划器", role: "planner", description: "分析工作流依赖、可并发入口、串行约束和执行风险；确定性编译器仍是执行权威。", tools: ["knowledge.node.get", "knowledge.model.get"], maxTokens: 8000, llmPoolKey: "supervision-planning" },
  { agentKey: "provider-analysis-planner", name: "Provider 分析者", role: "planner", description: "分析 Provider 和聊天模型接入配置。", tools: [], maxTokens: 8000 },
  { agentKey: "artifact-image-understanding", name: "图片质量评估者", role: "image_understanding", description: "按已发布图片质量配置生成结构化评分。", tools: ["artifact.evaluate"], maxTokens: 4000 },
  { agentKey: "artifact-video-understanding", name: "视频质量评估者", role: "video_understanding", description: "按时间戳采样帧评估视频质量和时序。", tools: ["artifact.evaluate"], maxTokens: 6000 },
  { agentKey: "artifact-checker", name: "产物检查者", role: "checker", description: "复核批次评分并选择下游输入。", tools: ["artifact.evaluate", "artifact.select"], maxTokens: 4000 },
  { agentKey: "generation-recovery", name: "生成恢复代理", role: "recovery", description: "分类失败并执行有限重试、参数修复或节点备选模型。", tools: ["canvas-run.pause", "canvas-run.retry", "generation.recover"], maxTokens: 4000 },
];

function defaultAgentSchemas(role: AgentRole) {
  return {
    inputSchema: `agent-${role}-input/v1`,
    outputSchema: `agent-${role}-output/v1`,
  };
}

const TRANSITIONS: Record<GovernedVersionStatus, GovernedVersionStatus[]> = {
  draft: ["review"], review: ["draft", "approved"], approved: ["retired"], retired: [],
};

async function transitionVersion(pool: Pool, input: {
  table: string; publicationTable: string; publicationForeignKey: string; id: string; next: GovernedVersionStatus; actorId: string;
  validate?: (client: PoolClient) => Promise<void>;
}) {
  return withTransaction(pool, async (client) => {
    const current = await client.query(`select status from ${input.table} where id = $1 for update`, [input.id]);
    if (!current.rows[0]) throw new Error("GOVERNED_VERSION_NOT_FOUND");
    const status = current.rows[0].status as GovernedVersionStatus;
    if (!TRANSITIONS[status].includes(input.next)) throw new Error(`GOVERNED_VERSION_TRANSITION_INVALID:${status}:${input.next}`);
    if (input.next === "retired") {
      const active = await client.query(`select id from ${input.publicationTable} where ${input.publicationForeignKey} = $1 and retired_at is null limit 1`, [input.id]);
      if (active.rows[0]) throw new Error("GOVERNED_VERSION_ACTIVE_PUBLICATION");
    }
    await input.validate?.(client);
    const reviewer = input.next === "approved" ? input.actorId : null;
    const result = await client.query(
      `update ${input.table} set status = $2,
       reviewed_by = case when $2 = 'approved' then $3 else reviewed_by end,
       reviewed_at = case when $2 = 'approved' then now() else reviewed_at end,
       retired_at = case when $2 = 'retired' then now() else retired_at end
       where id = $1 returning *`,
      [input.id, input.next, reviewer],
    );
    return result.rows[0];
  });
}

async function publishVersion(pool: Pool, input: {
  parentTable: string; versionTable: string; parentForeignKey: string; publicationTable: string;
  publicationForeignKey: string; publicationId: string; versionId: string; environment: GovernanceEnvironment; actorId: string;
  validate?: (client: PoolClient) => Promise<void>;
}) {
  return withTransaction(pool, async (client) => {
    const version = await client.query(
      `select v.id, v.${input.parentForeignKey} as parent_id, v.status from ${input.versionTable} v
       join ${input.parentTable} p on p.id = v.${input.parentForeignKey} where v.id = $1 for update of p, v`, [input.versionId],
    );
    if (!version.rows[0]) throw new Error("GOVERNED_VERSION_NOT_FOUND");
    if (version.rows[0].status !== "approved") throw new Error("GOVERNED_VERSION_NOT_APPROVED");
    await input.validate?.(client);
    await client.query(
      `update ${input.publicationTable} publication set retired_at = now()
       from ${input.versionTable} v where publication.${input.publicationForeignKey} = v.id
       and v.${input.parentForeignKey} = $1 and publication.environment = $2
       and publication.retired_at is null and publication.${input.publicationForeignKey} <> $3`,
      [version.rows[0].parent_id, input.environment, input.versionId],
    );
    const result = await client.query(
      `insert into ${input.publicationTable} (id, ${input.publicationForeignKey}, environment, published_by)
       values ($1, $2, $3, $4)
       on conflict (${input.publicationForeignKey}, environment) do update
       set published_by = excluded.published_by, published_at = now(), retired_at = null returning *`,
      [input.publicationId, input.versionId, input.environment, input.actorId],
    );
    return mapPublication(result.rows[0]);
  });
}

async function validateLlmPoolVersionForPublication(client: Pick<PoolClient, "query">, versionId: string) {
  const result = await client.query(
    `select p.enabled as pool_enabled, e.id as entry_id, e.enabled as entry_enabled,
       m.id as model_id, m.enabled as model_enabled, m.capability,
       pr.id as provider_id, pr.enabled as provider_enabled
     from xh_llm_route_pool_versions pv
     join xh_llm_route_pools p on p.id = pv.pool_id
     left join xh_llm_route_entries e on e.pool_version_id = pv.id
     left join xh_models m on m.id = e.model_id
     left join xh_providers pr on pr.id = e.provider_id
     where pv.id = $1`,
    [versionId],
  );
  if (!result.rows[0] || result.rows[0].pool_enabled !== true) throw new Error("LLM_POOL_DISABLED");
  const entries = result.rows.filter((row) => row.entry_id && row.entry_enabled !== false);
  if (entries.length === 0) throw new Error("LLM_POOL_ENTRIES_REQUIRED");
  if (entries.some((row) => row.model_enabled !== true || row.provider_enabled !== true || row.capability !== "chat")) {
    throw new Error("LLM_POOL_CHAT_MODEL_REQUIRED");
  }
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

function mapAgentDefinition(row: Record<string, unknown>) {
  return { id: String(row.id), agentKey: String(row.agent_key), name: String(row.name), role: row.role as AgentRole, description: String(row.description || ""), enabled: Boolean(row.enabled), versions: arrayValue(row.versions), publications: arrayValue(row.publications) };
}
function mapCandidate(row: Record<string, unknown>, policy: Record<string, unknown> = {}): LlmRouteCandidate {
  return { entryId: String(row.id), providerId: String(row.provider_id), modelId: String(row.model_id), capability: String(row.model_capability_snapshot), capabilityTags: stringArray(row.capability_tags_snapshot), inputCapabilities: objectValue(row.model_input_capabilities_snapshot), mediaInputTransports: stringArray(row.media_input_transports_snapshot), priority: Number(row.priority), weight: Number(row.weight), state: effectiveRouteState(row, policy), estimatedCost: Number(row.estimated_cost), p95LatencyMs: Number(row.p95_latency_ms) };
}
function mapPublication(row: Record<string, unknown>) { return { id: String(row.id), environment: row.environment as GovernanceEnvironment, publishedAt: dateMillis(row.published_at) }; }
function mapHealth(row: Record<string, unknown>) { return { state: row.state, consecutiveTechnicalFailures: Number(row.consecutive_technical_failures), successCount: Number(row.success_count), technicalFailureCount: Number(row.technical_failure_count), qualityFailureCount: Number(row.quality_failure_count), p95LatencyMs: Number(row.p95_latency_ms), updatedAt: dateMillis(row.updated_at) }; }
function defaultHealth() { return { state: "healthy", consecutiveTechnicalFailures: 0, successCount: 0, technicalFailureCount: 0, qualityFailureCount: 0, p95LatencyMs: 0, updatedAt: 0 }; }
function mapRuntimeControls(row: Record<string, unknown>) { return { environment: row.environment, agentEnabled: Boolean(row.agent_enabled), canvasRunsEnabled: Boolean(row.canvas_runs_enabled), automaticRecoveryEnabled: Boolean(row.automatic_recovery_enabled), qualityEvaluationEnabled: Boolean(row.quality_evaluation_enabled), revision: Number(row.revision), updatedAt: dateMillis(row.updated_at) }; }
function defaultRuntimeControls(environment: GovernanceEnvironment) { return { environment, agentEnabled: false, canvasRunsEnabled: false, automaticRecoveryEnabled: false, qualityEvaluationEnabled: false, revision: 1, updatedAt: 0 }; }
function mapRunRow(row: Record<string, unknown>) { return { id: row.id, ownerId: row.owner_id, ownerEmail: row.owner_email, canvasRunId: row.canvas_run_id, parentAgentRunId: row.parent_agent_run_id, canvasId: row.canvas_id, canvasRevision: row.canvas_revision === undefined ? undefined : Number(row.canvas_revision), role: row.role, scenario: row.scenario, status: row.status, budget: objectValue(row.budget_snapshot), error: objectValue(row.error), createdAt: dateMillis(row.created_at), updatedAt: dateMillis(row.updated_at) }; }
function revisionConflict(code: string, revision: unknown) { return Object.assign(new Error(code), { code, currentRevision: Number(revision) }); }
function numberRecord(value: Record<string, unknown>) { return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), Number(item || 0)])); }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function deriveMediaInputTransports(row: Record<string, unknown>) {
  const inputCapabilities = objectValue(row.input_capabilities);
  const protocol = String(row.protocol_override || row.provider_protocol || "").trim().toLowerCase();
  const transports: string[] = [];
  if (inputCapabilities.videoReference === true && protocol === "gemini") transports.push("gemini_file");
  if (inputCapabilities.imageReference === true) transports.push("sampled_frames");
  return transports;
}
function effectiveRouteState(row: Record<string, unknown>, policy: Record<string, unknown>): LlmRouteEntryState {
  const current = String(row.state || "healthy") as LlmRouteEntryState;
  const openedAt = row.circuit_opened_at ? new Date(String(row.circuit_opened_at)).getTime() : Number.NaN;
  const configuredCooldown = Number(policy.cooldownMs);
  const cooldownMs = Number.isFinite(configuredCooldown) ? Math.max(1_000, Math.min(86_400_000, configuredCooldown)) : 60_000;
  return Number.isFinite(openedAt) ? routeStateAfterCooldown({ current, openedAt, now: Date.now(), cooldownMs }) : current;
}
function dateMillis(value: unknown) { const time = value instanceof Date ? value.getTime() : new Date(String(value || "")).getTime(); return Number.isFinite(time) ? time : 0; }
function finite(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function integer(value: unknown, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, Math.floor(finite(value, minimum)))); }
function normalizeToolPolicyConstraints(value: Record<string, unknown>) {
  return {
    maxCallsPerRun: integer(value.maxCallsPerRun ?? 20, 1, 1_000),
    requireCanvasRevision: value.requireCanvasRevision !== false,
    requireBudget: value.requireBudget !== false,
  };
}

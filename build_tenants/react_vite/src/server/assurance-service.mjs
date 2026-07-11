import { resolve } from 'node:path';
import {
  assetDeliverySchema,
  assuranceLoadRequestSchema,
  assuranceSnapshotSchema,
  attentionItemSchema,
  gateAssessmentSchema,
} from '@odd-manager/developer-control-contracts';
import { loadAssuranceCatalog } from './assurance-catalog-service.mjs';
import { sameProjectRevisionBasis } from './project-revision-service.mjs';

const INSPECT_REACTION = 'reaction://odd_manager/open-run-inspector';

export class AssuranceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AssuranceError';
    this.statusCode = options.statusCode ?? 400;
  }
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function statusCount(rows, status) {
  return rows.filter((entry) => entry.status === status).length;
}

function summaryOf(catalogAdmission, execution, gates, assets, attention) {
  const gateCounts = {
    total: gates.length,
    satisfied: statusCount(gates, 'satisfied'),
    failed: statusCount(gates, 'failed'),
    missing: statusCount(gates, 'missing') + statusCount(gates, 'required'),
    stale: statusCount(gates, 'stale'),
    waitingHuman: statusCount(gates, 'waiting_human'),
  };
  const assetCounts = {
    total: assets.length,
    delivered: statusCount(assets, 'delivered'),
    failed: statusCount(assets, 'failed'),
    missing: statusCount(assets, 'missing') + statusCount(assets, 'expected'),
    stale: statusCount(assets, 'stale'),
  };
  let posture = 'partial';
  if (catalogAdmission.status !== 'ready') posture = 'unsupported';
  else if (!execution) posture = 'unassessed';
  else if (gateCounts.failed > 0 || assetCounts.failed > 0) posture = 'failed';
  else if (gateCounts.stale > 0 || assetCounts.stale > 0) posture = 'stale';
  else if (gateCounts.waitingHuman > 0) posture = 'waiting_human';
  else if (gateCounts.missing > 0 || assetCounts.missing > 0) posture = 'partial';
  else if (
    gateCounts.total + assetCounts.total > 0
    && gateCounts.satisfied === gateCounts.total
    && assetCounts.delivered === assetCounts.total
  ) posture = 'verified';
  return {
    posture,
    gateCounts,
    assetCounts,
    blockingAttentionCount: attention.filter((entry) => entry.severity === 'blocking').length,
  };
}

function evidenceCheck(observation, evidenceKey, declaredDigest, evidenceRefs) {
  if (!observation || !declaredDigest || evidenceRefs.length === 0) {
    return { verified: false, detail: 'Required evidence identity or digest is missing.', observed: null };
  }
  const observed = observation.observeEvidence(evidenceKey);
  if (observed.state !== 'present') {
    return { verified: false, detail: `Evidence file is ${observed.state}.`, observed };
  }
  if (observed.digest !== declaredDigest) {
    return { verified: false, detail: 'Evidence digest does not match the admitted file.', observed };
  }
  return { verified: true, detail: 'Evidence identity and digest match.', observed };
}

function attentionForAssessment(project, execution, row, definition, observedAt, sourceKind) {
  if (['satisfied', 'delivered'].includes(row.status)) return null;
  const severity = ['failed', 'stale', 'missing'].includes(row.status)
    ? 'blocking'
    : row.status === 'waiting_human'
      ? 'warning'
      : 'warning';
  const identity = sourceKind === 'gate' ? row.gateRef : row.requirementRef;
  return attentionItemSchema.parse({
    attentionId: `assurance:${execution?.executionId ?? 'unassessed'}:${identity}`,
    correlationId: execution?.correlationId ?? `project:${project.id}:assurance`,
    project,
    executionId: execution?.executionId ?? null,
    sourceKind,
    sourceRef: definition.sourceRefs[0] ?? identity,
    severity,
    reason: `${row.label}: ${row.detail}`,
    observedAt,
    reactionRefs: unique([
      ...definition.reactionRefs,
      ...(execution?.runRefs.length ? [INSPECT_REACTION] : []),
    ]),
  });
}

export function createAssuranceService(options) {
  if (!options?.buildControlService) throw new Error('buildControlService is required');
  const buildControlService = options.buildControlService;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    catalogAdmission(project) {
      const buildSnapshot = buildControlService.snapshot(project);
      return loadAssuranceCatalog(project, buildSnapshot.descriptorAdmission);
    },

    snapshot(inputValue) {
      const input = assuranceLoadRequestSchema.parse(inputValue);
      const project = { ...input.project, root: resolve(input.project.root) };
      const observedAt = now();
      const buildSnapshot = buildControlService.snapshot(project);
      const catalogAdmission = loadAssuranceCatalog(project, buildSnapshot.descriptorAdmission);
      const orderedExecutions = [...buildSnapshot.executions]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const execution = input.executionId
        ? orderedExecutions.find((entry) => entry.executionId === input.executionId) ?? null
        : orderedExecutions[0] ?? null;
      if (input.executionId && !execution) {
        throw new AssuranceError(`Build Execution not found: ${input.executionId}.`, { statusCode: 404 });
      }

      let evidenceObservation = null;
      let evidenceError = null;
      if (execution) {
        try {
          evidenceObservation = buildControlService.evidence(execution.executionId, project.root);
        } catch (error) {
          evidenceError = error instanceof Error ? error.message : String(error);
        }
      }
      const bundle = evidenceObservation?.bundle ?? null;
      const catalog = catalogAdmission.catalog;
      const executionCurrent = execution ? sameProjectRevisionBasis(execution.revision, input.revision) : false;
      const bundleCurrent = execution && bundle
        ? sameProjectRevisionBasis(bundle.revision, execution.revision)
        : false;

      const gateAssessments = (catalog?.gates ?? []).map((definition) => {
        const result = bundle?.gateResults.find((entry) => entry.gateRef === definition.gateRef) ?? null;
        let status = execution ? 'missing' : 'required';
        let detail = execution
          ? 'No admitted evidence result was published for this required gate.'
          : 'Gate is required; no Build Execution is selected.';
        let check = null;
        if (execution && (!executionCurrent || evidenceError || (bundle && !bundleCurrent))) {
          status = 'stale';
          detail = evidenceError ?? 'Execution, Project, or evidence revision basis does not match.';
        } else if (execution && result) {
          if (result.evidenceKey !== definition.evidenceKey) {
            status = 'stale';
            detail = 'Evidence result key does not match the required gate catalog key.';
          } else {
            check = evidenceCheck(evidenceObservation, definition.evidenceKey, result.digest, result.evidenceRefs);
          }
          if (status !== 'stale' && result.status === 'failed') {
            status = 'failed';
            detail = 'The admitted evaluator reported failure.';
          } else if (status !== 'stale' && result.status === 'waiting_human') {
            status = 'waiting_human';
            detail = 'The admitted evaluator requires a human decision.';
          } else if (status !== 'stale' && result.status === 'unsupported') {
            status = 'unsupported';
            detail = 'The carrier reports this evaluator as unsupported.';
          } else if (status !== 'stale' && check.verified) {
            status = 'satisfied';
            detail = check.detail;
          } else if (status !== 'stale') {
            status = 'stale';
            detail = check.detail;
          }
        }
        return gateAssessmentSchema.parse({
          gateRef: definition.gateRef,
          label: definition.label,
          requirementRef: definition.requirementRef,
          project,
          revision: input.revision,
          executionId: execution?.executionId ?? null,
          regime: definition.regime,
          status,
          detail,
          producerRef: bundle?.producerRef ?? null,
          evidenceDigest: result?.digest ?? null,
          evidenceRefs: unique([...(result?.evidenceRefs ?? []), ...(check?.observed?.sourceRef ? [check.observed.sourceRef] : [])]),
          sourceRefs: unique([...definition.sourceRefs, ...(result?.sourceRefs ?? []), catalogAdmission.sourceRefs[0]]),
          assessedAt: observedAt,
        });
      });

      const assetDeliveries = (catalog?.assets ?? []).map((definition) => {
        const result = bundle?.assetResults.find((entry) => entry.requirementRef === definition.requirementRef) ?? null;
        let status = execution ? 'missing' : 'expected';
        let detail = execution
          ? 'No admitted delivery result was published for this expected asset.'
          : 'Asset is expected; no Build Execution is selected.';
        let check = null;
        if (execution && (!executionCurrent || evidenceError || (bundle && !bundleCurrent))) {
          status = 'stale';
          detail = evidenceError ?? 'Execution, Project, or evidence revision basis does not match.';
        } else if (execution && result) {
          if (result.evidenceKey !== definition.evidenceKey) {
            status = 'stale';
            detail = 'Evidence result key does not match the expected asset catalog key.';
          } else {
            check = evidenceCheck(evidenceObservation, definition.evidenceKey, result.digest, result.evidenceRefs);
          }
          if (status !== 'stale' && result.status === 'failed') {
            status = 'failed';
            detail = 'The admitted producer reported asset failure.';
          } else if (status !== 'stale' && result.status === 'unsupported') {
            status = 'unsupported';
            detail = 'The carrier reports this asset as unsupported.';
          } else if (status !== 'stale' && result.artifactRef && check.verified) {
            status = 'delivered';
            detail = check.detail;
          } else if (status !== 'stale') {
            status = 'stale';
            detail = result.artifactRef ? check.detail : 'Delivered result has no artifact identity.';
          }
        }
        return assetDeliverySchema.parse({
          requirementRef: definition.requirementRef,
          label: definition.label,
          artifactRef: result?.artifactRef ?? null,
          project,
          revision: input.revision,
          executionId: execution?.executionId ?? null,
          status,
          detail,
          producerRef: result?.producerRef ?? bundle?.producerRef ?? null,
          digest: result?.digest ?? null,
          evidenceRefs: unique([...(result?.evidenceRefs ?? []), ...(check?.observed?.sourceRef ? [check.observed.sourceRef] : [])]),
          sourceRefs: unique([...definition.sourceRefs, ...(result?.sourceRefs ?? []), catalogAdmission.sourceRefs[0]]),
        });
      });

      const attentionItems = [];
      if (catalogAdmission.status !== 'ready') {
        attentionItems.push(attentionItemSchema.parse({
          attentionId: `assurance-catalog:${project.id}`,
          correlationId: `project:${project.id}:assurance`,
          project,
          executionId: execution?.executionId ?? null,
          sourceKind: 'assurance-catalog',
          sourceRef: catalogAdmission.sourceRefs[0],
          severity: 'blocking',
          reason: catalogAdmission.reason ?? 'Assurance catalog is not admitted.',
          observedAt,
          reactionRefs: [],
        }));
      }
      for (let index = 0; index < gateAssessments.length; index += 1) {
        const item = attentionForAssessment(project, execution, gateAssessments[index], catalog.gates[index], observedAt, 'gate');
        if (item) attentionItems.push(item);
      }
      for (let index = 0; index < assetDeliveries.length; index += 1) {
        const item = attentionForAssessment(project, execution, assetDeliveries[index], catalog.assets[index], observedAt, 'asset');
        if (item) attentionItems.push(item);
      }
      const summary = summaryOf(catalogAdmission, execution, gateAssessments, assetDeliveries, attentionItems);
      return assuranceSnapshotSchema.parse({
        schemaVersion: '1',
        projectRoot: project.root,
        revision: input.revision,
        execution,
        catalogAdmission,
        evidenceBundleRef: bundle?.evidenceBundleRef ?? null,
        gateAssessments,
        assetDeliveries,
        attentionItems,
        summary,
        observedAt,
        sourceRefs: unique([
          ...catalogAdmission.sourceRefs,
          ...(evidenceObservation?.sourceRefs ?? []),
          ...(execution ? [`build-execution://${execution.executionId}`] : []),
        ]),
      });
    },
  };
}

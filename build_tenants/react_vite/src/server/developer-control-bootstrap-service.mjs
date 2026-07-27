import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  assuranceSnapshotSchema,
  buildControlSnapshotSchema,
  buildPortfolioSchema,
  developerControlBootstrapSchema,
} from '@odd-manager/developer-control-contracts';
import {
  observeProjectRevision,
  sameProjectRevisionBasis,
} from './project-revision-service.mjs';

export { observeProjectRevision } from './project-revision-service.mjs';

function normalizedRoot(value) {
  return resolve(typeof value === 'string' && value.trim() ? value : '.');
}

function registeredProject(projectRoot, projects) {
  const root = normalizedRoot(projectRoot);
  return projects.find((project) => normalizedRoot(project.root) === root) ?? null;
}

function ready(contractRefs) {
  return { kind: 'ready', contractRefs };
}

function unavailable(reason, missingRefs) {
  return { kind: 'unavailable', reason, missingRefs };
}

function unsupported(reason, sourceRefs) {
  return { kind: 'unsupported', reason, sourceRefs };
}

const PROJECT_REVISION_CONTRACT_REF = 'contract://odd_manager/developer-control/project-revision';

function projectRevisionSourceRef(project) {
  return `project://${project.id}/revision`;
}

function observeBootstrapRevision(root, project, observedAt, options) {
  const sourceRef = projectRevisionSourceRef(project);
  if (Object.hasOwn(options, 'revision')) {
    return {
      revision: options.revision ?? null,
      error: null,
      sourceRef,
    };
  }

  const observer = typeof options.revisionObserver === 'function'
    ? options.revisionObserver
    : observeProjectRevision;
  try {
    return {
      revision: observer(root, observedAt),
      error: null,
      sourceRef,
    };
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught);
    return {
      revision: null,
      error: `Project revision observation failed for Project ${project.id}: ${detail}`,
      sourceRef,
    };
  }
}

function revisionAvailabilityGate(observation, capabilityLabel) {
  if (observation.error) {
    return {
      kind: 'error',
      error: `${capabilityLabel} cannot establish an admitted ProjectRevision. ${observation.error}`,
      sourceRefs: [observation.sourceRef],
    };
  }
  if (!observation.revision) {
    return unavailable(
      `${capabilityLabel} requires an admitted ProjectRevision, but the selected Project publishes no observable revision basis.`,
      [observation.sourceRef],
    );
  }
  return null;
}

function buildAvailability(admission, fallbackRef) {
  if (!admission) {
    return unavailable(
      'Build remains unavailable until the selected product publishes a manager-callable descriptor and execution adapter.',
      [fallbackRef],
    );
  }
  if (admission.status === 'ready' && admission.descriptor) {
    return ready([
      admission.descriptor.descriptorRef,
      admission.descriptor.worksiteProvisionerRef,
      admission.descriptor.executionAdapterRef,
    ]);
  }
  if (admission.status === 'unsupported') {
    return unsupported(admission.reason, admission.sourceRefs);
  }
  if (admission.status === 'error') {
    return { kind: 'error', error: admission.reason, sourceRefs: admission.sourceRefs };
  }
  return unavailable(admission.reason, admission.sourceRefs);
}

function assuranceAvailability(admission, fallbackRefs) {
  if (!admission) return ready(fallbackRefs);
  if (admission.status === 'ready' && admission.catalog) {
    return ready([
      admission.catalog.catalogRef,
      admission.catalog.requirementCatalogRef,
      admission.catalog.assetCatalogRef,
    ]);
  }
  if (admission.status === 'unsupported') return unsupported(admission.reason, admission.sourceRefs);
  if (admission.status === 'error') return { kind: 'error', error: admission.reason, sourceRefs: admission.sourceRefs };
  return unavailable(admission.reason, admission.sourceRefs);
}

function contribution(input) {
  return {
    id: input.id,
    label: input.label,
    summary: input.summary,
    implementationStage: input.implementationStage ?? 'structural',
    requiredContractRefs: input.requiredContractRefs,
    availability: input.availability,
    defaultRoute: input.defaultRoute,
    attentionCount: 0,
  };
}

function projectReference(project) {
  const productRef = typeof project.odd_type === 'string' && project.odd_type !== 'unknown'
    ? `product://${project.odd_type}`
    : null;
  return {
    id: project.id,
    root: normalizedRoot(project.root),
    label: project.name || project.label || project.id,
    publishedProductRef: productRef,
  };
}

function posture(kind, label, sourceRefs = []) {
  return { kind, label, sourceRefs };
}

function observePortfolioSource(source, projectRef, observer) {
  try {
    return observer();
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught);
    throw new Error(
      `Developer control portfolio ${source} observation failed for Project ${projectRef.id}: ${detail}`,
    );
  }
}

function sameProjectReference(left, right) {
  return Boolean(
    left
    && right
    && left.id === right.id
    && normalizedRoot(left.root) === normalizedRoot(right.root)
    && left.label === right.label
    && left.publishedProductRef === right.publishedProductRef,
  );
}

function sameNullableRevision(left, right) {
  return left === null || right === null
    ? left === right
    : sameProjectRevisionBasis(left, right);
}

function projectAttentionCorrelation(projectId, sourceKind) {
  return `project:${projectId}:${sourceKind}`;
}

function assuranceAttentionCorrelation(projectRef, selectedExecution) {
  return selectedExecution?.correlationId
    ?? projectAttentionCorrelation(projectRef.id, 'assurance');
}

function requirePortfolioObservation(condition, source, detail) {
  if (!condition) {
    throw new Error(`${source} observation ${detail}`);
  }
}

function admitPortfolioBuildObservation(value, projectRef, revision) {
  const snapshot = buildControlSnapshotSchema.parse(value);
  requirePortfolioObservation(
    normalizedRoot(snapshot.projectRoot) === projectRef.root,
    'Build',
    'Project root does not match the portfolio row.',
  );
  requirePortfolioObservation(
    normalizedRoot(snapshot.descriptorAdmission.projectRoot) === projectRef.root,
    'Build',
    'descriptor admission does not belong to the portfolio row Project.',
  );
  if (snapshot.descriptorAdmission.status === 'ready') {
    requirePortfolioObservation(
      snapshot.descriptorAdmission.descriptor?.productRef === projectRef.publishedProductRef,
      'Build',
      'descriptor admission does not name the portfolio row Product.',
    );
  }
  requirePortfolioObservation(
    sameNullableRevision(snapshot.revision, revision),
    'Build',
    'revision does not match the portfolio row Project Revision.',
  );

  const requestsById = new Map();
  for (const request of snapshot.requests) {
    requirePortfolioObservation(
      !requestsById.has(request.requestId),
      'Build',
      `contains duplicate request identity ${request.requestId}.`,
    );
    requirePortfolioObservation(
      sameProjectReference(request.project, projectRef),
      'Build',
      `request ${request.requestId} does not belong to the portfolio row Project.`,
    );
    requirePortfolioObservation(
      revision !== null && sameProjectRevisionBasis(request.revision, revision),
      'Build',
      `request ${request.requestId} does not belong to the portfolio row Project Revision.`,
    );
    requirePortfolioObservation(
      request.descriptorBinding.productRef === projectRef.publishedProductRef
      && (
        snapshot.descriptorAdmission.status !== 'ready'
        || request.descriptorBinding.descriptorRef
          === snapshot.descriptorAdmission.descriptor?.descriptorRef
      ),
      'Build',
      `request ${request.requestId} does not use the portfolio row Build carrier.`,
    );
    requestsById.set(request.requestId, request);
  }

  const executionIds = new Set();
  for (const execution of snapshot.executions) {
    const request = requestsById.get(execution.requestId) ?? null;
    requirePortfolioObservation(
      !executionIds.has(execution.executionId),
      'Build',
      `contains duplicate execution identity ${execution.executionId}.`,
    );
    requirePortfolioObservation(
      sameProjectReference(execution.project, projectRef),
      'Build',
      `execution ${execution.executionId} does not belong to the portfolio row Project.`,
    );
    requirePortfolioObservation(
      revision !== null && sameProjectRevisionBasis(execution.revision, revision),
      'Build',
      `execution ${execution.executionId} does not belong to the portfolio row Project Revision.`,
    );
    requirePortfolioObservation(
      request !== null
      && request.correlationId === execution.correlationId
      && sameProjectRevisionBasis(request.revision, execution.revision)
      && sameProjectReference(request.project, execution.project),
      'Build',
      `execution ${execution.executionId} is not bound to its admitted row request.`,
    );
    executionIds.add(execution.executionId);
  }
  return snapshot;
}

function admitPortfolioAssuranceObservation(
  value,
  projectRef,
  revision,
  selectedExecution,
) {
  const snapshot = assuranceSnapshotSchema.parse(value);
  const selectedExecutionId = selectedExecution?.executionId ?? null;
  const expectedAttentionCorrelation = assuranceAttentionCorrelation(
    projectRef,
    selectedExecution,
  );
  requirePortfolioObservation(
    normalizedRoot(snapshot.projectRoot) === projectRef.root,
    'Assurance',
    'Project root does not match the portfolio row.',
  );
  requirePortfolioObservation(
    normalizedRoot(snapshot.catalogAdmission.projectRoot) === projectRef.root,
    'Assurance',
    'catalog admission does not belong to the portfolio row Project.',
  );
  if (snapshot.catalogAdmission.status === 'ready') {
    requirePortfolioObservation(
      snapshot.catalogAdmission.catalog?.productRef === projectRef.publishedProductRef,
      'Assurance',
      'catalog admission does not name the portfolio row Product.',
    );
  }
  requirePortfolioObservation(
    sameNullableRevision(snapshot.revision, revision),
    'Assurance',
    'revision does not match the portfolio row Project Revision.',
  );
  requirePortfolioObservation(
    (snapshot.execution?.executionId ?? null) === selectedExecutionId,
    'Assurance',
    'selected Build Execution does not match the portfolio row selection.',
  );
  if (snapshot.execution && selectedExecution) {
    requirePortfolioObservation(
      sameProjectReference(snapshot.execution.project, projectRef)
      && sameProjectRevisionBasis(snapshot.execution.revision, revision)
      && snapshot.execution.requestId === selectedExecution.requestId
      && snapshot.execution.correlationId === selectedExecution.correlationId
      && snapshot.execution.worksiteRef === selectedExecution.worksiteRef
      && snapshot.execution.attempt === selectedExecution.attempt,
      'Assurance',
      `selected execution ${snapshot.execution.executionId} does not belong to the portfolio row basis.`,
    );
  }

  for (const assessment of snapshot.gateAssessments) {
    requirePortfolioObservation(
      sameProjectReference(assessment.project, projectRef)
      && sameProjectRevisionBasis(assessment.revision, revision)
      && assessment.executionId === selectedExecutionId,
      'Assurance',
      `gate assessment ${assessment.gateRef} does not belong to the portfolio row selection.`,
    );
  }
  for (const delivery of snapshot.assetDeliveries) {
    requirePortfolioObservation(
      sameProjectReference(delivery.project, projectRef)
      && sameProjectRevisionBasis(delivery.revision, revision)
      && delivery.executionId === selectedExecutionId,
      'Assurance',
      `asset delivery ${delivery.requirementRef} does not belong to the portfolio row selection.`,
    );
  }
  for (const item of snapshot.attentionItems) {
    requirePortfolioObservation(
      sameProjectReference(item.project, projectRef)
      && item.executionId === selectedExecutionId
      && item.correlationId === expectedAttentionCorrelation,
      'Assurance',
      `attention item ${item.attentionId} does not belong to the portfolio row selection or correlation.`,
    );
  }
  return snapshot;
}

export function loadDeveloperControlPortfolio(projects, options = {}) {
  const observedAt = options.observedAt ?? new Date().toISOString();
  const browseRoot = normalizedRoot(options.browseRoot ?? '..');
  const rows = projects.map((project) => {
    const projectRef = projectReference(project);
    const root = projectRef.root;
    const revision = observeProjectRevision(root, observedAt);
    const productPath = join(root, 'specification', 'PRODUCT.md');
    const requirementsPath = join(root, 'specification', 'requirements');
    const hasProduct = existsSync(productPath);
    const hasRequirements = existsSync(requirementsPath);
    const specification = hasProduct && hasRequirements
      ? posture('present', 'Product and requirements present', [productPath, requirementsPath])
      : hasProduct || hasRequirements
        ? posture('partial', 'Specification surfaces are partial', [
          ...(hasProduct ? [productPath] : []),
          ...(hasRequirements ? [requirementsPath] : []),
        ])
        : posture('missing', 'Specification product and requirements are missing', [root]);
    const descriptorRef = projectRef.publishedProductRef
      ? `build-carrier-descriptor://${String(project.odd_type)}/software-build`
      : `build-carrier-descriptor://${project.id}/software-build`;
    const buildSnapshot = typeof options.buildObservation === 'function'
      ? observePortfolioSource(
          'Build',
          projectRef,
          () => admitPortfolioBuildObservation(
            options.buildObservation(projectRef),
            projectRef,
            revision,
          ),
        )
      : null;
    const admission = buildSnapshot?.descriptorAdmission ?? null;
    const executions = Array.isArray(buildSnapshot?.executions) ? buildSnapshot.executions : [];
    const orderedExecutions = [...executions]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const latestExecution = orderedExecutions[0] ?? null;
    const build = admission?.status === 'ready'
      ? posture(
          'present',
          executions.length > 0
            ? `${executions.filter((entry) => ['starting', 'running'].includes(entry.state)).length} running, ${executions.filter((entry) => entry.state === 'queued').length} queued`
            : 'Manager-callable Build carrier is admitted',
          admission.sourceRefs,
        )
      : posture(
          admission?.status === 'unsupported' ? 'unsupported' : 'unavailable',
          admission?.reason ?? 'Manager-callable Build carrier is not admitted',
          admission?.sourceRefs ?? [descriptorRef],
        );
    const buildActivity = {
      queuedCount: executions.filter((entry) => entry.state === 'queued').length,
      runningCount: executions.filter((entry) => ['starting', 'running'].includes(entry.state)).length,
      waitingHumanCount: executions.filter((entry) => entry.state === 'waiting_human').length,
      terminalCount: executions.filter((entry) => ['converged', 'failed', 'cancelled'].includes(entry.state)).length,
      latestExecutionId: latestExecution?.executionId ?? null,
      latestState: latestExecution?.state ?? null,
      sourceRefs: executions.map((entry) => `build-execution://${entry.executionId}`),
    };
    const admittedRunRefs = [...new Set(executions.flatMap((entry) => entry.runRefs))];
    const run = admittedRunRefs.length > 0
      ? posture('present', `${admittedRunRefs.length} admitted Build Run reference${admittedRunRefs.length === 1 ? '' : 's'}`, admittedRunRefs)
      : project.has_ai_workspace === true
      ? posture('unobserved', 'Run summary not loaded at portfolio level', [`project://${project.id}/.ai-workspace`])
      : posture('unsupported', 'Project publishes no .ai-workspace run source', [`project://${project.id}`]);
    const assuranceSnapshot = revision && typeof options.assuranceObservation === 'function'
      ? observePortfolioSource(
          'Assurance',
          projectRef,
          () => admitPortfolioAssuranceObservation(
            options.assuranceObservation(
              projectRef,
              revision,
              latestExecution?.executionId ?? null,
            ),
            projectRef,
            revision,
            latestExecution,
          ),
        )
      : null;
    const assurance = assuranceSnapshot
      ? assuranceSnapshot.summary.posture === 'verified'
        ? posture('present', 'Every required gate and asset is verified', assuranceSnapshot.sourceRefs)
        : assuranceSnapshot.summary.posture === 'stale'
          ? posture('stale', 'Assurance evidence or revision basis is stale', assuranceSnapshot.sourceRefs)
          : assuranceSnapshot.summary.posture === 'unsupported'
            ? posture('unsupported', assuranceSnapshot.catalogAdmission.reason ?? 'Assurance is unsupported', assuranceSnapshot.sourceRefs)
            : assuranceSnapshot.summary.posture === 'unassessed'
              ? posture('unobserved', 'Required gates and assets are not yet assessed', assuranceSnapshot.sourceRefs)
              : posture('partial', `Assurance posture: ${assuranceSnapshot.summary.posture}`, assuranceSnapshot.sourceRefs)
      : project.has_ai_workspace === true
        ? posture('partial', 'Read-only evidence source present; gate verdict not established', [`project://${project.id}/.ai-workspace`])
        : posture('unsupported', 'No admitted evidence source', [`project://${project.id}`]);
    const attention = [];
    if (revision?.dirty) {
      attention.push({
        attentionId: `revision-dirty:${project.id}`,
        correlationId: projectAttentionCorrelation(project.id, 'revision'),
        severity: 'warning',
        sourceKind: 'revision',
        sourceRef: `git://${project.id}/${revision.revision}`,
        reason: 'Project revision is a dirty worktree.',
      });
    }
    if (specification.kind === 'missing' || specification.kind === 'partial') {
      attention.push({
        attentionId: `specification:${project.id}`,
        correlationId: projectAttentionCorrelation(project.id, 'specification'),
        severity: specification.kind === 'missing' ? 'blocking' : 'warning',
        sourceKind: 'specification',
        sourceRef: `project://${project.id}/specification`,
        reason: specification.label,
      });
    }
    if (admission?.status !== 'ready') {
      attention.push({
        attentionId: `build-carrier:${project.id}`,
        correlationId: projectAttentionCorrelation(project.id, 'build-carrier'),
        severity: 'warning',
        sourceKind: 'build-carrier',
        sourceRef: admission?.sourceRefs?.[0] ?? descriptorRef,
        reason: build.label,
      });
    }
    for (const execution of orderedExecutions.filter((entry) => entry.state === 'failed').slice(0, 3)) {
      attention.push({
        attentionId: `build-failed:${execution.executionId}`,
        correlationId: execution.correlationId,
        severity: 'blocking',
        sourceKind: 'build-execution',
        sourceRef: `build-execution://${execution.executionId}`,
        reason: `Build Execution ${execution.executionId} failed.`,
      });
    }
    for (const execution of orderedExecutions.filter((entry) => ['stale', 'disconnected'].includes(entry.state)).slice(0, 3)) {
      attention.push({
        attentionId: `build-connectivity:${execution.executionId}`,
        correlationId: execution.correlationId,
        severity: 'warning',
        sourceKind: 'build-execution',
        sourceRef: `build-execution://${execution.executionId}`,
        reason: `Build Execution ${execution.executionId} is ${execution.state}.`,
      });
    }
    for (const item of (assuranceSnapshot?.attentionItems ?? []).slice(0, 12)) {
      attention.push({
        attentionId: item.attentionId,
        correlationId: item.correlationId,
        severity: item.severity,
        sourceKind: item.sourceKind,
        sourceRef: item.sourceRef,
        reason: item.reason,
      });
    }

    return {
      project: projectRef,
      revision,
      active: project.is_active === true,
      specification,
      build,
      buildActivity,
      run,
      assurance,
      participants: {
        kind: 'unobserved',
        count: null,
        sourceRefs: [`project://${project.id}/participants`],
      },
      features: {
        hasAiWorkspace: project.has_ai_workspace === true,
        hasGenesis: project.has_genesis === true,
        buildTenants: Array.isArray(project.build_tenants) ? project.build_tenants : [],
      },
      freshness: {
        observedAt,
        sourceRefs: [`project://${project.id}`, ...(revision ? [`git://${project.id}/${revision.revision}`] : [])],
      },
      attention,
      sourceRefs: [`project://${project.id}`, 'contract://odd_manager/project-registry'],
    };
  });
  return buildPortfolioSchema.parse({
    schemaVersion: '1',
    rows,
    browseRoot,
    observedAt,
    sourceRefs: ['contract://odd_manager/project-registry', 'contract://odd_manager/developer-control/portfolio'],
  });
}

export function loadDeveloperControlBootstrap(projectRoot, projects, options = {}) {
  const project = registeredProject(projectRoot, projects);
  if (!project) {
    throw new Error(`Developer control bootstrap requires a registered Project: ${projectRoot}`);
  }

  const root = normalizedRoot(project.root);
  const hasAiWorkspace = project.has_ai_workspace === true || existsSync(join(root, '.ai-workspace'));
  const productRef = typeof project.odd_type === 'string' && project.odd_type !== 'unknown'
    ? `product://${project.odd_type}`
    : null;
  const workspaceRef = productRef ? `workspace://${project.odd_type}` : null;
  const observedAt = options.observedAt ?? new Date().toISOString();
  const revisionObservation = observeBootstrapRevision(root, project, observedAt, options);
  const revision = revisionObservation.revision;
  const runAvailability = hasAiWorkspace
    ? ready(['contract://odd_manager/ai-workspace-observation', 'contract://odd_manager/abg-run-observation'])
    : unsupported('Project publishes no .ai-workspace observation root.', [`project://${project.id}`]);
  const readOnlyAssuranceAvailability = hasAiWorkspace
    ? ready(['contract://odd_manager/abg-run-observation/assurance-read-only'])
    : unsupported('Read-only assurance requires admitted Project/run evidence.', [`project://${project.id}`]);
  const buildDescriptorRef = productRef
    ? `build-carrier-descriptor://${project.odd_type}/software-build`
    : 'build-carrier-descriptor://selected-project/software-build';
  const proposalParticipantRef = options.proposalParticipantRef
    ?? 'participant://codex/specification-proposal';
  const buildAdmission = options.buildDescriptorAdmission ?? null;
  const admittedBuildDescriptorRef = buildAdmission?.descriptor?.descriptorRef ?? buildDescriptorRef;
  const assuranceAdmission = options.assuranceCatalogAdmission ?? null;
  const proposalRevisionGate = revisionAvailabilityGate(
    revisionObservation,
    'Specification Proposal',
  );
  const buildRevisionGate = revisionAvailabilityGate(revisionObservation, 'Build Control');
  const assuranceRevisionGate = revisionAvailabilityGate(
    revisionObservation,
    'Assurance & Attention',
  );

  const bootstrap = {
    schemaVersion: '1',
    context: {
      project: {
        id: project.id,
        root,
        label: project.name || project.label || project.id,
        publishedProductRef: productRef,
      },
      workspaceRef,
      revision,
    },
    capabilities: [
      contribution({
        id: 'build-portfolio',
        label: 'Build Portfolio',
        summary: 'Registered Project observation is available; readiness and build enrichment arrive in MVP iterations.',
        requiredContractRefs: ['contract://odd_manager/project-registry'],
        availability: ready(['contract://odd_manager/project-registry']),
        defaultRoute: 'portfolio',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'project-workbench',
        label: 'Project Workbench',
        summary: 'Structural Review, Tune, Build, and Assure composition is available.',
        requiredContractRefs: ['contract://odd_manager/developer-control/context'],
        availability: ready(['contract://odd_manager/developer-control/context']),
        defaultRoute: 'project-workbench',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'specification-proposal',
        label: 'Specification Proposal',
        summary: proposalRevisionGate
          ? 'Proposal generation, validation, and acceptance require an admitted ProjectRevision.'
          : 'Read-only proposal generation, deterministic validation, and atomic acceptance are available.',
        requiredContractRefs: [
          PROJECT_REVISION_CONTRACT_REF,
          'action://odd_manager/specification-proposal',
        ],
        availability: proposalRevisionGate ?? ready([
          PROJECT_REVISION_CONTRACT_REF,
          'action://odd_manager/specification-proposal',
          proposalParticipantRef,
        ]),
        defaultRoute: 'specification-proposal',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'build-control',
        label: 'Build Control',
        summary: buildRevisionGate
          ? 'Build submission and supervision require an admitted ProjectRevision.'
          : buildAdmission?.status === 'ready'
          ? 'Typed build submission, immutable worksite provisioning, queue supervision, attach, and cancellation are available.'
          : 'No complete manager-callable build carrier is admitted for this Project.',
        requiredContractRefs: [PROJECT_REVISION_CONTRACT_REF, admittedBuildDescriptorRef],
        availability: buildRevisionGate ?? buildAvailability(buildAdmission, buildDescriptorRef),
        defaultRoute: 'build-control',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'assurance-attention',
        label: 'Assurance & Attention',
        summary: assuranceRevisionGate
          ? 'Assurance and Attention projection requires an admitted ProjectRevision.'
          : assuranceAdmission?.status === 'ready'
          ? 'Required-versus-delivered gate, asset, evidence, and Attention projection is available.'
          : 'Assurance remains read-only and incomplete until the selected product publishes its catalog and evidence carrier.',
        requiredContractRefs: [
          PROJECT_REVISION_CONTRACT_REF,
          'contract://odd_manager/abg-run-observation/assurance-read-only',
        ],
        availability: assuranceRevisionGate ?? (
          assuranceAdmission
            ? assuranceAvailability(assuranceAdmission, [])
            : readOnlyAssuranceAvailability
        ),
        defaultRoute: 'assurance-attention',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'run-observation',
        label: 'Run Observation',
        summary: 'AI Workspace, Run Inspector, Traversal, events, artifacts, and proof remain the forensic surface.',
        requiredContractRefs: ['contract://odd_manager/ai-workspace-observation'],
        availability: runAvailability,
        defaultRoute: 'run-observation',
      }),
    ],
    observedAt,
    sourceRefs: [
      `project://${project.id}`,
      'specification/PRODUCT.md',
      'build_tenants/common/design/DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md',
    ],
  };

  return developerControlBootstrapSchema.parse(bootstrap);
}

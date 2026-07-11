import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildPortfolioSchema,
  developerControlBootstrapSchema,
} from '@odd-manager/developer-control-contracts';
import { observeProjectRevision } from './project-revision-service.mjs';

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
    let buildSnapshot = null;
    try {
      buildSnapshot = typeof options.buildObservation === 'function'
        ? options.buildObservation(projectRef)
        : null;
    } catch {
      buildSnapshot = null;
    }
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
    let assuranceSnapshot = null;
    try {
      assuranceSnapshot = revision && typeof options.assuranceObservation === 'function'
        ? options.assuranceObservation(projectRef, revision, latestExecution?.executionId ?? null)
        : null;
    } catch {
      assuranceSnapshot = null;
    }
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
        severity: 'warning',
        sourceKind: 'revision',
        sourceRef: `git://${project.id}/${revision.revision}`,
        reason: 'Project revision is a dirty worktree.',
      });
    }
    if (specification.kind === 'missing' || specification.kind === 'partial') {
      attention.push({
        attentionId: `specification:${project.id}`,
        severity: specification.kind === 'missing' ? 'blocking' : 'warning',
        sourceKind: 'specification',
        sourceRef: `project://${project.id}/specification`,
        reason: specification.label,
      });
    }
    if (admission?.status !== 'ready') {
      attention.push({
        attentionId: `build-carrier:${project.id}`,
        severity: 'warning',
        sourceKind: 'build-carrier',
        sourceRef: admission?.sourceRefs?.[0] ?? descriptorRef,
        reason: build.label,
      });
    }
    for (const execution of orderedExecutions.filter((entry) => entry.state === 'failed').slice(0, 3)) {
      attention.push({
        attentionId: `build-failed:${execution.executionId}`,
        severity: 'blocking',
        sourceKind: 'build-execution',
        sourceRef: `build-execution://${execution.executionId}`,
        reason: `Build Execution ${execution.executionId} failed.`,
      });
    }
    for (const execution of orderedExecutions.filter((entry) => ['stale', 'disconnected'].includes(entry.state)).slice(0, 3)) {
      attention.push({
        attentionId: `build-connectivity:${execution.executionId}`,
        severity: 'warning',
        sourceKind: 'build-execution',
        sourceRef: `build-execution://${execution.executionId}`,
        reason: `Build Execution ${execution.executionId} is ${execution.state}.`,
      });
    }
    for (const item of (assuranceSnapshot?.attentionItems ?? []).slice(0, 12)) {
      attention.push({
        attentionId: item.attentionId,
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
  const revision = options.revision ?? observeProjectRevision(root, observedAt);
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
        summary: 'Read-only proposal generation, deterministic validation, and atomic acceptance are available.',
        requiredContractRefs: ['action://odd_manager/specification-proposal'],
        availability: ready([
          'action://odd_manager/specification-proposal',
          proposalParticipantRef,
        ]),
        defaultRoute: 'specification-proposal',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'build-control',
        label: 'Build Control',
        summary: buildAdmission?.status === 'ready'
          ? 'Typed build submission, immutable worksite provisioning, queue supervision, attach, and cancellation are available.'
          : 'No complete manager-callable build carrier is admitted for this Project.',
        requiredContractRefs: [admittedBuildDescriptorRef],
        availability: buildAvailability(buildAdmission, buildDescriptorRef),
        defaultRoute: 'build-control',
        implementationStage: 'mvp',
      }),
      contribution({
        id: 'assurance-attention',
        label: 'Assurance & Attention',
        summary: assuranceAdmission?.status === 'ready'
          ? 'Required-versus-delivered gate, asset, evidence, and Attention projection is available.'
          : 'Assurance remains read-only and incomplete until the selected product publishes its catalog and evidence carrier.',
        requiredContractRefs: ['contract://odd_manager/abg-run-observation/assurance-read-only'],
        availability: assuranceAdmission
          ? assuranceAvailability(assuranceAdmission, [])
          : readOnlyAssuranceAvailability,
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

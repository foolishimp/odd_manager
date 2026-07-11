import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildCarrierDescriptorSchema,
  buildDescriptorAdmissionSchema,
} from '@odd-manager/developer-control-contracts';

export const BUILD_CARRIER_DESCRIPTOR_RELATIVE_PATH = '.odd/build-carrier.json';
export const PROJECT_SNAPSHOT_PROVISIONER_REF = 'worksite-provisioner://odd_manager/project-snapshot/v1';
export const FIXTURE_EXECUTION_ADAPTER_REF = 'execution-adapter://odd_manager/fixture/v1';

function admission(projectRoot, status, descriptor, reason, sourceRefs) {
  return buildDescriptorAdmissionSchema.parse({
    schemaVersion: '1',
    projectRoot,
    status,
    descriptor,
    reason,
    sourceRefs,
  });
}

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

export function loadBuildCarrierDescriptor(project, options = {}) {
  const projectRoot = resolve(project?.root || '.');
  const descriptorPath = join(projectRoot, BUILD_CARRIER_DESCRIPTOR_RELATIVE_PATH);
  const sourceRefs = [descriptorPath];
  if (!existsSync(descriptorPath)) {
    return admission(
      projectRoot,
      'unavailable',
      null,
      `Project does not publish ${BUILD_CARRIER_DESCRIPTOR_RELATIVE_PATH}.`,
      sourceRefs,
    );
  }

  let descriptor;
  try {
    descriptor = buildCarrierDescriptorSchema.parse(JSON.parse(readFileSync(descriptorPath, 'utf8')));
  } catch (error) {
    return admission(
      projectRoot,
      'error',
      null,
      `Build carrier descriptor is invalid: ${errorDetail(error)}`,
      sourceRefs,
    );
  }

  if (!project?.publishedProductRef) {
    return admission(
      projectRoot,
      'unsupported',
      descriptor,
      'Build carrier admission requires a published Project product identity.',
      [...sourceRefs, descriptor.productRef],
    );
  }
  if (descriptor.productRef !== project.publishedProductRef) {
    return admission(
      projectRoot,
      'unsupported',
      descriptor,
      `Descriptor product ${descriptor.productRef} does not match ${project.publishedProductRef}.`,
      [...sourceRefs, descriptor.productRef, project.publishedProductRef],
    );
  }
  if (!descriptor.supportedCommands.includes('submit')) {
    return admission(
      projectRoot,
      'unsupported',
      descriptor,
      'Build carrier descriptor does not publish submit support.',
      [...sourceRefs, descriptor.descriptorRef],
    );
  }

  const provisionerRefs = options.provisionerRefs ?? new Set();
  if (!provisionerRefs.has(descriptor.worksiteProvisionerRef)) {
    return admission(
      projectRoot,
      'unsupported',
      descriptor,
      `Worksite provisioner is not installed: ${descriptor.worksiteProvisionerRef}.`,
      [...sourceRefs, descriptor.worksiteProvisionerRef],
    );
  }
  const adapterRefs = options.adapterRefs ?? new Set();
  if (!adapterRefs.has(descriptor.executionAdapterRef)) {
    return admission(
      projectRoot,
      'unsupported',
      descriptor,
      `Execution adapter is not installed: ${descriptor.executionAdapterRef}.`,
      [...sourceRefs, descriptor.executionAdapterRef],
    );
  }

  return admission(
    projectRoot,
    'ready',
    descriptor,
    null,
    [
      ...sourceRefs,
      descriptor.descriptorRef,
      descriptor.worksiteProvisionerRef,
      descriptor.executionAdapterRef,
    ],
  );
}

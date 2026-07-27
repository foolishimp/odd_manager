import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
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

function isWithin(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function admitDescriptorCarrier(projectRoot, descriptorPath) {
  const descriptorDirectory = dirname(descriptorPath);
  const directoryStat = lstatSync(descriptorDirectory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error('Build carrier descriptor parent must be an exact non-symlink Project directory.');
  }
  const descriptorStat = lstatSync(descriptorPath);
  if (descriptorStat.isSymbolicLink() || !descriptorStat.isFile()) {
    throw new Error('Build carrier descriptor must be a regular non-symlink Project file.');
  }
  const realProjectRoot = realpathSync(projectRoot);
  const realDescriptorPath = realpathSync(descriptorPath);
  if (!isWithin(realProjectRoot, realDescriptorPath)) {
    throw new Error('Build carrier descriptor resolves outside the Project.');
  }
  return realDescriptorPath;
}

export function loadBuildCarrierDescriptor(project, options = {}) {
  const projectRoot = resolve(project?.root || '.');
  const descriptorPath = join(projectRoot, BUILD_CARRIER_DESCRIPTOR_RELATIVE_PATH);
  const sourceRefs = [descriptorPath];
  let descriptorCarrier = null;
  try {
    descriptorCarrier = lstatSync(descriptorPath);
  } catch {
    descriptorCarrier = null;
  }
  if (!descriptorCarrier) {
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
    if (descriptorCarrier.isSymbolicLink() || !descriptorCarrier.isFile()) {
      throw new Error('Build carrier descriptor must be a regular non-symlink Project file.');
    }
    const admittedPath = admitDescriptorCarrier(projectRoot, descriptorPath);
    descriptor = buildCarrierDescriptorSchema.parse(JSON.parse(readFileSync(admittedPath, 'utf8')));
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

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildExecutionAdapterRegistrySchema,
} from '@odd-manager/developer-control-contracts';
import { FIXTURE_EXECUTION_ADAPTER_REF } from './build-carrier-descriptor-service.mjs';

export const BUILD_EXECUTION_ADAPTER_REGISTRY_RELATIVE_PATH = join(
  '.ai-workspace',
  'runtime',
  'odd_manager',
  'build-execution-adapters.local.json',
);

export class BuildExecutionAdapterRegistryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BuildExecutionAdapterRegistryError';
  }
}

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function regularFile(path, label) {
  if (!existsSync(path)) {
    throw new BuildExecutionAdapterRegistryError(`${label} is unavailable: ${path}`);
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new BuildExecutionAdapterRegistryError(`${label} must be a regular non-symlink file: ${path}`);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateAdapter(value, entry) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BuildExecutionAdapterRegistryError(`Adapter factory returned no adapter: ${entry.adapterRef}`);
  }
  if (value.adapterRef !== entry.adapterRef) {
    throw new BuildExecutionAdapterRegistryError(
      `Adapter identity ${String(value.adapterRef)} does not match registry identity ${entry.adapterRef}.`,
    );
  }
  if (typeof value.validateInputs !== 'function' || typeof value.createProcessPlan !== 'function') {
    throw new BuildExecutionAdapterRegistryError(
      `Adapter ${entry.adapterRef} must implement validateInputs and createProcessPlan.`,
    );
  }
  for (const method of ['observeExecution', 'cancelExecution']) {
    if (value[method] !== undefined && typeof value[method] !== 'function') {
      throw new BuildExecutionAdapterRegistryError(
        `Adapter ${entry.adapterRef} ${method} must be a function when published.`,
      );
    }
  }
  return Object.freeze({
    adapterRef: entry.adapterRef,
    sourceRefs: Object.freeze([...new Set(entry.sourceRefs)]),
    validateInputs(input) {
      return value.validateInputs(input);
    },
    createProcessPlan(input) {
      return value.createProcessPlan(input);
    },
    observeExecution: typeof value.observeExecution === 'function'
      ? (input) => value.observeExecution(input)
      : undefined,
    cancelExecution: typeof value.cancelExecution === 'function'
      ? (input) => value.cancelExecution(input)
      : undefined,
  });
}

export async function loadBuildExecutionAdapterRegistry(options) {
  if (!options?.managerStateRoot) throw new Error('managerStateRoot is required');
  const managerStateRoot = resolve(options.managerStateRoot);
  const registryPath = resolve(
    options.registryPath ?? join(managerStateRoot, BUILD_EXECUTION_ADAPTER_REGISTRY_RELATIVE_PATH),
  );
  const registrySourceRef = `adapter-registry-file://${registryPath}`;
  if (!existsSync(registryPath)) {
    return Object.freeze({
      status: 'absent',
      registryPath,
      registryDigest: null,
      adapters: new Map(),
      sourceRefs: Object.freeze([registrySourceRef]),
    });
  }

  regularFile(registryPath, 'Build execution adapter registry');
  const registryBytes = readFileSync(registryPath);
  let registry;
  try {
    registry = buildExecutionAdapterRegistrySchema.parse(JSON.parse(registryBytes.toString('utf8')));
  } catch (error) {
    throw new BuildExecutionAdapterRegistryError(`Build execution adapter registry is invalid: ${errorDetail(error)}`);
  }

  const registryDigest = sha256(registryBytes);
  const adapters = new Map();
  for (const entry of registry.adapters) {
    if (entry.adapterRef === FIXTURE_EXECUTION_ADAPTER_REF) {
      throw new BuildExecutionAdapterRegistryError('The test-only fixture adapter cannot be installed from production registry.');
    }
    if (!isAbsolute(entry.modulePath)) {
      throw new BuildExecutionAdapterRegistryError(`Adapter modulePath must be absolute: ${entry.adapterRef}.`);
    }
    const modulePath = resolve(entry.modulePath);
    regularFile(modulePath, `Execution adapter module ${entry.adapterRef}`);
    const realModulePath = realpathSync(modulePath);
    const moduleBytes = readFileSync(realModulePath);
    const moduleDigest = sha256(moduleBytes);
    if (moduleDigest !== entry.moduleSha256) {
      throw new BuildExecutionAdapterRegistryError(
        `Execution adapter digest mismatch for ${entry.adapterRef}: expected ${entry.moduleSha256}, observed ${moduleDigest}.`,
      );
    }

    let namespace;
    try {
      const moduleUrl = `${pathToFileURL(realModulePath).href}?sha256=${moduleDigest}`;
      namespace = await import(moduleUrl);
    } catch (error) {
      throw new BuildExecutionAdapterRegistryError(
        `Execution adapter module could not load for ${entry.adapterRef}: ${errorDetail(error)}`,
      );
    }
    const factory = namespace[entry.exportName];
    if (typeof factory !== 'function') {
      throw new BuildExecutionAdapterRegistryError(
        `Execution adapter export ${entry.exportName} is not a function for ${entry.adapterRef}.`,
      );
    }
    let candidate;
    try {
      candidate = await factory(Object.freeze({
        adapterRef: entry.adapterRef,
        registryPath,
        registryDigest,
        modulePath: realModulePath,
        moduleDigest,
      }));
    } catch (error) {
      throw new BuildExecutionAdapterRegistryError(
        `Execution adapter factory failed for ${entry.adapterRef}: ${errorDetail(error)}`,
      );
    }
    const adapter = validateAdapter(candidate, entry);
    adapters.set(entry.adapterRef, Object.freeze({
      ...adapter,
      sourceRefs: Object.freeze([
        ...new Set([
          ...adapter.sourceRefs,
          registrySourceRef,
          `adapter-registry-sha256://${registryDigest}`,
          `adapter-module-file://${realModulePath}`,
          `adapter-module-sha256://${moduleDigest}`,
        ]),
      ]),
    }));
  }

  return Object.freeze({
    status: 'ready',
    registryPath,
    registryDigest,
    adapters,
    sourceRefs: Object.freeze([
      registrySourceRef,
      `adapter-registry-sha256://${registryDigest}`,
    ]),
  });
}

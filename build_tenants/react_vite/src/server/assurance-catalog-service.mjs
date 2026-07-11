import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  assuranceCatalogAdmissionSchema,
  assuranceCatalogSchema,
} from '@odd-manager/developer-control-contracts';

export const ASSURANCE_CATALOG_RELATIVE_PATH = '.odd/assurance-catalog.json';

function admission(projectRoot, status, catalog, reason, sourceRefs) {
  return assuranceCatalogAdmissionSchema.parse({
    schemaVersion: '1', projectRoot, status, catalog, reason, sourceRefs,
  });
}

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function unique(values) {
  return new Set(values).size === values.length;
}

export function loadAssuranceCatalog(project, descriptorAdmission) {
  const projectRoot = resolve(project?.root || '.');
  const catalogPath = join(projectRoot, ASSURANCE_CATALOG_RELATIVE_PATH);
  if (descriptorAdmission?.status !== 'ready' || !descriptorAdmission.descriptor) {
    return admission(
      projectRoot,
      'unavailable',
      null,
      'Assurance requires an admitted Build Carrier Descriptor.',
      descriptorAdmission?.sourceRefs ?? [catalogPath],
    );
  }
  if (!existsSync(catalogPath)) {
    return admission(
      projectRoot,
      'unavailable',
      null,
      `Project does not publish ${ASSURANCE_CATALOG_RELATIVE_PATH}.`,
      [catalogPath],
    );
  }
  let catalog;
  try {
    catalog = assuranceCatalogSchema.parse(JSON.parse(readFileSync(catalogPath, 'utf8')));
  } catch (error) {
    return admission(projectRoot, 'error', null, `Assurance catalog is invalid: ${errorDetail(error)}`, [catalogPath]);
  }
  const descriptor = descriptorAdmission.descriptor;
  if (catalog.productRef !== project.publishedProductRef || catalog.productRef !== descriptor.productRef) {
    return admission(
      projectRoot,
      'unsupported',
      catalog,
      'Assurance catalog product identity does not match the admitted Project and Build Carrier.',
      [catalogPath, catalog.productRef, descriptor.productRef],
    );
  }
  if (!descriptor.requirementCatalogRefs.includes(catalog.requirementCatalogRef)) {
    return admission(
      projectRoot,
      'unsupported',
      catalog,
      `Requirement catalog ref is not published by the Build Carrier: ${catalog.requirementCatalogRef}.`,
      [catalogPath, descriptor.descriptorRef],
    );
  }
  if (!descriptor.expectedAssetCatalogRefs.includes(catalog.assetCatalogRef)) {
    return admission(
      projectRoot,
      'unsupported',
      catalog,
      `Asset catalog ref is not published by the Build Carrier: ${catalog.assetCatalogRef}.`,
      [catalogPath, descriptor.descriptorRef],
    );
  }
  if (catalog.gates.length === 0 && catalog.assets.length === 0) {
    return admission(projectRoot, 'unsupported', catalog, 'Assurance catalog declares no required gates or assets.', [catalogPath]);
  }
  if (
    !unique(catalog.gates.map((entry) => entry.gateRef))
    || !unique(catalog.gates.map((entry) => entry.evidenceKey))
    || !unique(catalog.assets.map((entry) => entry.requirementRef))
    || !unique(catalog.assets.map((entry) => entry.evidenceKey))
  ) {
    return admission(projectRoot, 'error', catalog, 'Assurance catalog identities and evidence keys must be unique.', [catalogPath]);
  }
  return admission(projectRoot, 'ready', catalog, null, [
    catalogPath,
    catalog.catalogRef,
    catalog.requirementCatalogRef,
    catalog.assetCatalogRef,
  ]);
}

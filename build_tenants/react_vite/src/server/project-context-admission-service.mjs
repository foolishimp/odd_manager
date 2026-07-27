import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

export class ProjectContextAdmissionError extends Error {
  constructor(projectRoot) {
    super(`Project root is not registered: ${projectRoot}`);
    this.name = 'ProjectContextAdmissionError';
    this.statusCode = 403;
    this.projectRoot = projectRoot;
  }
}

export class ProjectWorkingDirectoryAdmissionError extends Error {
  constructor(projectRoot, requestedCwd, detail) {
    super(`Session working directory is not admitted by Project ${projectRoot}: ${detail}`);
    this.name = 'ProjectWorkingDirectoryAdmissionError';
    this.statusCode = 403;
    this.projectRoot = projectRoot;
    this.requestedCwd = requestedCwd;
  }
}

export function admitRegisteredProject(
  requestedRoot,
  registeredProjects,
  defaultProjectRoot,
) {
  const projectRoot = resolve(
    typeof requestedRoot === 'string' && requestedRoot.trim()
      ? requestedRoot
      : defaultProjectRoot,
  );
  const registered = registeredProjects.find(
    (project) => resolve(project.root) === projectRoot,
  );
  if (!registered) throw new ProjectContextAdmissionError(projectRoot);
  return {
    ...registered,
    root: resolve(registered.root),
  };
}

export function admitRegisteredProjectRoot(
  requestedRoot,
  registeredProjects,
  defaultProjectRoot,
) {
  return admitRegisteredProject(
    requestedRoot,
    registeredProjects,
    defaultProjectRoot,
  ).root;
}

export function admitProjectWorkingDirectory(projectRootInput, requestedCwd) {
  const projectRoot = resolve(projectRootInput);
  const cwd = resolve(
    typeof requestedCwd === 'string' && requestedCwd.trim()
      ? requestedCwd
      : projectRoot,
  );
  const relativeCwd = relative(projectRoot, cwd);
  if (
    relativeCwd === '..'
    || relativeCwd.startsWith('../')
    || relativeCwd.startsWith('..\\')
    || isAbsolute(relativeCwd)
  ) {
    throw new ProjectWorkingDirectoryAdmissionError(
      projectRoot,
      cwd,
      'the requested path is outside the Project root',
    );
  }

  let realProjectRoot;
  let realCwd;
  try {
    realProjectRoot = realpathSync(projectRoot);
    realCwd = realpathSync(cwd);
  } catch {
    throw new ProjectWorkingDirectoryAdmissionError(
      projectRoot,
      cwd,
      'the requested path is not an existing resolvable directory',
    );
  }
  if (!statSync(realCwd).isDirectory()) {
    throw new ProjectWorkingDirectoryAdmissionError(
      projectRoot,
      cwd,
      'the requested path is not a directory',
    );
  }
  const expectedRealCwd = resolve(realProjectRoot, relativeCwd);
  if (realCwd !== expectedRealCwd) {
    throw new ProjectWorkingDirectoryAdmissionError(
      projectRoot,
      cwd,
      'symlink traversal cannot change the Project-relative working directory',
    );
  }
  return cwd;
}

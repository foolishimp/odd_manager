import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export class ProjectRuntimeCarrierError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProjectRuntimeCarrierError';
    this.statusCode = 403;
  }
}

function isWithin(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function admittedSegment(value, label) {
  const segment = String(value ?? '');
  if (
    !segment
    || segment === '.'
    || segment === '..'
    || segment.includes('/')
    || segment.includes('\\')
    || segment.includes('\0')
  ) {
    throw new ProjectRuntimeCarrierError(`${label} is not a canonical runtime carrier segment.`);
  }
  return segment;
}

function projectRoots(projectRoot) {
  const lexicalRoot = resolve(projectRoot);
  let rootStat;
  let realRoot;
  try {
    rootStat = lstatSync(lexicalRoot);
    realRoot = realpathSync(lexicalRoot);
  } catch {
    throw new ProjectRuntimeCarrierError(`Project runtime root is unavailable: ${lexicalRoot}`);
  }
  if (!rootStat.isDirectory() && !rootStat.isSymbolicLink()) {
    throw new ProjectRuntimeCarrierError(`Project runtime root is not a directory: ${lexicalRoot}`);
  }
  return { lexicalRoot, realRoot };
}

export function projectRuntimeLexicalPath(projectRoot, segments) {
  const { lexicalRoot } = projectRoots(projectRoot);
  return segments.reduce(
    (current, segment, index) => join(current, admittedSegment(segment, `Runtime path segment ${index + 1}`)),
    lexicalRoot,
  );
}

export function admitProjectRuntimeDirectory(projectRoot, segments, options = {}) {
  const { lexicalRoot, realRoot } = projectRoots(projectRoot);
  let current = lexicalRoot;
  for (const [index, value] of segments.entries()) {
    const segment = admittedSegment(value, `Runtime directory segment ${index + 1}`);
    current = join(current, segment);
    if (!existsSync(current)) {
      if (options.create !== true) {
        throw new ProjectRuntimeCarrierError(`Project runtime directory is unavailable: ${current}`);
      }
      mkdirSync(current);
    }
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ProjectRuntimeCarrierError(
        `Project runtime directory must be a non-symlink directory: ${current}`,
      );
    }
    const realCurrent = realpathSync(current);
    if (!isWithin(realRoot, realCurrent)) {
      throw new ProjectRuntimeCarrierError(
        `Project runtime directory resolves outside the Project: ${current}`,
      );
    }
  }
  if (!isWithin(lexicalRoot, current)) {
    throw new ProjectRuntimeCarrierError(`Project runtime directory escapes the Project: ${current}`);
  }
  return current;
}

export function admitProjectRuntimeFile(projectRoot, directorySegments, fileName, options = {}) {
  const directory = admitProjectRuntimeDirectory(projectRoot, directorySegments, {
    create: options.createDirectory === true,
  });
  const path = join(directory, admittedSegment(fileName, 'Runtime file name'));
  if (!existsSync(path)) {
    if (options.mustExist === true) {
      throw new ProjectRuntimeCarrierError(`Project runtime file is unavailable: ${path}`);
    }
    return path;
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new ProjectRuntimeCarrierError(
      `Project runtime file must be a regular non-symlink file: ${path}`,
    );
  }
  const { realRoot } = projectRoots(projectRoot);
  if (!isWithin(realRoot, realpathSync(path))) {
    throw new ProjectRuntimeCarrierError(`Project runtime file resolves outside the Project: ${path}`);
  }
  return path;
}

function noFollowFlag(flag) {
  return flag | (constants.O_NOFOLLOW ?? 0);
}

export function writeProjectRuntimeFile(
  projectRoot,
  directorySegments,
  fileName,
  value,
  options = {},
) {
  const path = admitProjectRuntimeFile(projectRoot, directorySegments, fileName, {
    createDirectory: true,
    mustExist: false,
  });
  const fd = openSync(
    path,
    noFollowFlag(constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC),
    options.mode ?? 0o600,
  );
  try {
    writeFileSync(fd, value, options.encoding ?? 'utf8');
  } finally {
    closeSync(fd);
  }
  admitProjectRuntimeFile(projectRoot, directorySegments, fileName, { mustExist: true });
  return path;
}

export function appendProjectRuntimeFile(
  projectRoot,
  directorySegments,
  fileName,
  value,
  options = {},
) {
  const path = admitProjectRuntimeFile(projectRoot, directorySegments, fileName, {
    createDirectory: true,
    mustExist: false,
  });
  const fd = openSync(
    path,
    noFollowFlag(constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND),
    options.mode ?? 0o600,
  );
  try {
    writeFileSync(fd, value, options.encoding ?? 'utf8');
  } finally {
    closeSync(fd);
  }
  admitProjectRuntimeFile(projectRoot, directorySegments, fileName, { mustExist: true });
  return path;
}

export function readProjectRuntimeFile(projectRoot, directorySegments, fileName, options = {}) {
  const path = admitProjectRuntimeFile(projectRoot, directorySegments, fileName, {
    mustExist: true,
  });
  const fd = openSync(path, noFollowFlag(constants.O_RDONLY));
  try {
    return readFileSync(fd, options.encoding ?? null);
  } finally {
    closeSync(fd);
  }
}

export function statProjectRuntimeFile(projectRoot, directorySegments, fileName) {
  const path = admitProjectRuntimeFile(projectRoot, directorySegments, fileName, {
    mustExist: true,
  });
  return statSync(path);
}

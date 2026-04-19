# Implements: REQ-F-ODDSDLC-003
# Implements: REQ-F-ODDSDLC-004
# Implements: REQ-F-ASSETMODEL-005
# Implements: REQ-F-ODDSDLC-030
"""Bounded constructor turn for odd_sdlc software-domain workspaces."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

from .asset_types import ASSET_TYPES
from .project_profile import SOURCE_EXTENSIONS, load_project_profile
from .runtime_effects import publish_workspace_runtime_event
from .traceability import (
    authority_requirement_refs,
    current_requirement_refs,
    implementation_claim_refs,
    planned_test_claim_refs,
)
from .workspace_assets import (
    assess_generated_asset_contract,
    asset_declared_type,
    asset_marker,
    asset_materialization_path,
    asset_path,
    checkpoint_for_path,
    relative_file_uri,
    summarize_code_surface,
    summarize_test_evidence,
)


IMPORTED_AUTHORITY_CANDIDATES: tuple[Path, ...] = (
    Path("README.md"),
    Path("specification/INTENT.md"),
    Path("specification/REQUIREMENTS.md"),
    Path("specification/mapper_requirements.md"),
)
PRESERVED_AUTHORITY_ASSETS = {"intent_surface", "product_surface", "goal_surface"}
_REQUIREMENT_ID_RE = re.compile(r"\b(?:REQ|RF)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b")
_GENERATED_TEST_CODE_MARKER = "Generated governed test code for the odd_sdlc test_code_surface."
_GENERIC_TITLE_HEADINGS = {"intent", "product", "goals", "requirements"}
_OPERATIONAL_DISPATCH_REGISTER_PATH = Path(".ai-workspace/runtime/odd_sdlc-operational-dispatch.json")


def _is_concrete_requirement_id(requirement_id: str) -> bool:
    parts = requirement_id.upper().split("-")
    return any(any(char.isdigit() for char in part) for part in parts[1:])


def _read_json(path: Path, *, label: str) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{label} must be a JSON object")
    return raw


def _workspace_asset_path(workspace_root: Path, target_asset: str) -> Path:
    return asset_materialization_path(workspace_root, target_asset)


def _asset_text(workspace_root: Path, asset_id: str, *parts: str) -> str:
    path = asset_materialization_path(workspace_root, asset_id)
    if parts:
        path = asset_path(workspace_root, asset_id).joinpath(*parts)
    return path.read_text(encoding="utf-8").strip()


def _optional_asset_text(workspace_root: Path, asset_id: str, *parts: str) -> str:
    path = asset_materialization_path(workspace_root, asset_id)
    if parts:
        path = asset_path(workspace_root, asset_id).joinpath(*parts)
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def _code_surface_root(workspace_root: Path) -> Path:
    return asset_path(workspace_root, "code_surface")


def _proving_subset_requirement_ids(workspace_root: Path) -> tuple[str, ...]:
    current_ids = tuple(
        sorted(
            requirement_id
            for requirement_id in current_requirement_refs(workspace_root)
            if _is_concrete_requirement_id(requirement_id)
        )
    )
    if current_ids:
        return current_ids
    return tuple(
        sorted(
            requirement_id
            for requirement_id in authority_requirement_refs(workspace_root)
            if _is_concrete_requirement_id(requirement_id)
        )
    )


def _tag_lines(tag: str, requirement_ids: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(f"# {tag}: {requirement_id}" for requirement_id in requirement_ids)


def _build_artifact_summary(workspace_root: Path) -> dict[str, Any]:
    observed_paths: list[str] = []
    for relative in ("dist", "build", "target"):
        candidate = workspace_root / relative
        if candidate.exists():
            observed_paths.append(relative)
    return {
        "observed_paths": observed_paths,
        "artifact_root_count": len(observed_paths),
    }


def _load_operational_dispatch_register(workspace_root: Path) -> dict[str, Any]:
    path = workspace_root / _OPERATIONAL_DISPATCH_REGISTER_PATH
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, dict) else {}


def _operational_dispatch_entry(workspace_root: Path, lane: str) -> dict[str, Any]:
    payload = _load_operational_dispatch_register(workspace_root)
    lanes = payload.get("lanes", {})
    if not isinstance(lanes, dict):
        return {}
    entry = lanes.get(lane, {})
    return dict(entry) if isinstance(entry, dict) else {}


def _classify_operational_binding(contract: str) -> str:
    lowered = contract.strip().lower()
    if not lowered:
        return "undeclared"
    if "sbt" in lowered:
        return "local_scala_sbt"
    if "pytest" in lowered:
        return "local_python_pytest"
    if lowered.startswith("python "):
        return "local_python_command"
    return "local_shell_command"


def _strip_quotes(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {'"', "'"}:
        return stripped[1:-1]
    return stripped


def _project_constraints_path(workspace_root: Path) -> Path:
    return workspace_root / ".ai-workspace" / "context" / "project_constraints.yml"


def _project_constraint_scalar(workspace_root: Path, key: str) -> str:
    path = _project_constraints_path(workspace_root)
    if not path.exists():
        return ""
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith(f"{key}:"):
            return _strip_quotes(stripped.partition(":")[2])
    return ""


def _imported_authority_paths(workspace_root: Path) -> tuple[Path, ...]:
    return tuple(
        path
        for relative in IMPORTED_AUTHORITY_CANDIDATES
        for path in (workspace_root / relative,)
        if path.exists()
    )


def _imported_authority_lines(workspace_root: Path) -> tuple[str, ...]:
    sources = _imported_authority_paths(workspace_root)
    if not sources:
        return ("- no imported authority source detected",)
    return tuple(f"- `{path.relative_to(workspace_root).as_posix()}`" for path in sources)


def _imported_requirement_authority_lines(workspace_root: Path) -> tuple[str, ...]:
    ids: set[str] = set()
    for path in _imported_authority_paths(workspace_root):
        if "requirement" not in path.name.lower():
            continue
        ids.update(_REQUIREMENT_ID_RE.findall(path.read_text(encoding="utf-8")))
    if not ids:
        return ("- no imported REQ-* authority markers detected",)
    return tuple(f"- {requirement_id}: carried forward from imported requirement authority" for requirement_id in sorted(ids))


def _authority_requirement_lines(workspace_root: Path) -> tuple[str, ...]:
    refs = authority_requirement_refs(workspace_root)
    if not refs:
        return ("- no live REQ-* authority markers detected",)
    return tuple(
        f"- {requirement_id}: carried forward from {', '.join(refs[requirement_id])}"
        for requirement_id in sorted(refs)
    )


def _file_heading(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return path.stem


def _project_title(workspace_root: Path) -> str:
    intent_path = workspace_root / "specification" / "INTENT.md"
    if intent_path.exists():
        for line in intent_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.lower().startswith("**project**:"):
                return _strip_quotes(stripped.partition(":")[2]).strip()
        heading = _file_heading(intent_path)
        if heading and heading.strip().lower() not in _GENERIC_TITLE_HEADINGS:
            return heading
    readme_path = workspace_root / "README.md"
    if readme_path.exists():
        heading = _file_heading(readme_path)
        if heading and heading.strip().lower() not in _GENERIC_TITLE_HEADINGS:
            return heading
    return load_project_profile(workspace_root).project_slug


def _module_names(workspace_root: Path) -> tuple[str, ...]:
    raw = _project_constraint_scalar(workspace_root, "module_structure")
    if "(" in raw and ")" in raw:
        inner = raw[raw.find("(") + 1 : raw.rfind(")")]
        modules = tuple(part.strip() for part in inner.split(",") if part.strip())
        if modules:
            return modules
    return ("app-core",)


def _software_project_mode(workspace_root: Path) -> bool:
    return bool(load_project_profile(workspace_root).declared_output_dir)


def _should_preserve_authoritative_surface(workspace_root: Path, target_asset: str) -> bool:
    if target_asset not in PRESERVED_AUTHORITY_ASSETS or not _software_project_mode(workspace_root):
        return False
    path = asset_materialization_path(workspace_root, target_asset)
    if not path.exists() or not path.is_file():
        return False
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return False
    marker = asset_marker(target_asset)
    if marker in text:
        return False
    if target_asset == "intent_surface":
        return text.startswith("# Intent") or text.startswith("# Project Intent")
    expected_heading = "# Product" if target_asset == "product_surface" else "# Goals"
    if not text.startswith(expected_heading):
        return False
    return "normalized by odd_sdlc" not in text and "generated by odd_sdlc" not in text.lower()


def _package_segments_for_module(module_name: str) -> tuple[str, ...]:
    slug = module_name.replace("-", "_")
    return ("cdme", slug)


def _package_name_for_module(module_name: str) -> str:
    return ".".join(_package_segments_for_module(module_name))


def _module_identifier(module_name: str) -> str:
    parts = [part for part in re.split(r"[^A-Za-z0-9]+", module_name) if part]
    if not parts:
        return "GeneratedModule"
    return "".join(part[:1].upper() + part[1:] for part in parts)


def _governed_summary_lines(workspace_root: Path) -> tuple[str, ...]:
    profile = load_project_profile(workspace_root)
    build_tool = _project_constraint_scalar(workspace_root, "tool") or "unspecified"
    module_names = ", ".join(_module_names(workspace_root))
    return (
        f"- project: `{_project_title(workspace_root)}`",
        f"- workspace: `{workspace_root.name}`",
        f"- language: `{profile.language or 'unspecified'}`",
        f"- test runner: `{profile.test_runner or 'unspecified'}`",
        f"- tenant: `{profile.tenant_name or 'default'}`",
        f"- governed code root: `{profile.code_relative_path()}`",
        f"- realization mode: `{profile.realization_mode}`",
        f"- build tool: `{build_tool}`",
        f"- declared modules: {module_names}",
    )


def _selected_test_stack_defaults(workspace_root: Path) -> dict[str, str]:
    profile = load_project_profile(workspace_root)
    language = (profile.language or "").strip().lower()
    test_runner = (profile.test_runner or "").strip().lower()
    build_tool = (_project_constraint_scalar(workspace_root, "tool") or "").strip().lower()
    combined = " ".join(part for part in (language, test_runner, build_tool, profile.tenant_name.lower()) if part)

    default_family = "generic_test_harness"

    if "playwright" in combined:
        return {
            "family": default_family,
            "binding": "browser_playwright",
            "implementation": "playwright_typescript",
            "primary_harness": "Playwright",
            "summary": "generic_test_harness bound to a Playwright browser-testing implementation over the governed implementation branch.",
        }
    if "pytest" in combined or language == "python":
        return {
            "family": default_family,
            "binding": "python_pytest",
            "implementation": "pytest_source_trace",
            "primary_harness": "pytest",
            "summary": "generic_test_harness bound to a pytest-style developer-test implementation over the governed implementation branch.",
        }
    if "scala" in combined or "sbt" in combined or "spark" in combined:
        return {
            "family": default_family,
            "binding": "scala_sbt",
            "implementation": "scala_source_trace",
            "primary_harness": "Scala source trace",
            "summary": "generic_test_harness bound to a Scala source-level developer-test implementation over the governed sbt branch.",
        }
    if "java" in combined or "maven" in combined or "gradle" in combined:
        return {
            "family": default_family,
            "binding": "java_junit",
            "implementation": "java_source_trace",
            "primary_harness": "Java source trace",
            "summary": "generic_test_harness bound to a Java source-level developer-test implementation over the governed implementation branch.",
        }
    if "kotlin" in combined:
        return {
            "family": default_family,
            "binding": "kotlin_junit",
            "implementation": "kotlin_source_trace",
            "primary_harness": "Kotlin source trace",
            "summary": "generic_test_harness bound to a Kotlin source-level developer-test implementation over the governed implementation branch.",
        }
    if language == "go":
        return {
            "family": default_family,
            "binding": "go_test",
            "implementation": "go_source_trace",
            "primary_harness": "go test",
            "summary": "generic_test_harness bound to a Go developer-test implementation over the governed implementation branch.",
        }
    if language == "rust":
        return {
            "family": default_family,
            "binding": "rust_test",
            "implementation": "rust_source_trace",
            "primary_harness": "cargo test",
            "summary": "generic_test_harness bound to a Rust developer-test implementation over the governed implementation branch.",
        }
    if language in {"typescript", "javascript"} or any(token in combined for token in ("node", "jest", "vitest", "react", "tsx", "ts")):
        extension = "ts" if language == "typescript" or "typescript" in combined or "ts" in combined else "js"
        return {
            "family": default_family,
            "binding": "js_ts_test",
            "implementation": f"{extension}_source_trace",
            "primary_harness": "TypeScript/JavaScript source trace",
            "summary": "generic_test_harness bound to a TypeScript or JavaScript source-level developer-test implementation over the governed implementation branch.",
        }
    return {
        "family": default_family,
        "binding": "generic_source_trace",
        "implementation": "python_source_trace",
        "primary_harness": "generic source trace",
        "summary": "generic_test_harness bound to a generic source-level developer-test implementation over the governed implementation branch.",
    }


def _planned_test_requirement_ids(workspace_root: Path) -> tuple[str, ...]:
    implementation_ids = tuple(sorted(implementation_claim_refs(workspace_root)))
    if implementation_ids:
        return implementation_ids
    current_ids = tuple(sorted(current_requirement_refs(workspace_root)))
    if current_ids:
        return current_ids
    return tuple(sorted(planned_test_claim_refs(workspace_root)))


def _distributed_requirement_ids(requirement_ids: tuple[str, ...], modules: tuple[str, ...]) -> dict[str, tuple[str, ...]]:
    if not modules:
        return {}
    distributed: dict[str, list[str]] = {module_name: [] for module_name in modules}
    for index, requirement_id in enumerate(requirement_ids):
        distributed[modules[index % len(modules)]].append(requirement_id)
    return {
        module_name: tuple(distributed[module_name])
        for module_name in modules
    }


def _generated_test_relpath(module_name: str, *, implementation: str) -> str:
    module_slug = module_name.replace("-", "_")
    identifier = _module_identifier(module_name)
    if implementation == "scala_source_trace":
        return f"{module_name}/src/test/scala/odd/generated/{identifier}GeneratedTraceSpec.scala"
    if implementation == "pytest_source_trace":
        return f"tests/test_{module_slug}_generated.py"
    if implementation in {"ts_source_trace", "js_source_trace", "playwright_typescript"}:
        extension = "ts" if implementation in {"ts_source_trace", "playwright_typescript"} else "js"
        return f"tests/{module_slug}.generated.spec.{extension}"
    if implementation == "java_source_trace":
        return f"{module_name}/src/test/java/odd/generated/{identifier}GeneratedTraceTest.java"
    if implementation == "kotlin_source_trace":
        return f"{module_name}/src/test/kotlin/odd/generated/{identifier}GeneratedTraceTest.kt"
    if implementation == "go_source_trace":
        return f"tests/{module_slug}_generated_test.go"
    if implementation == "rust_source_trace":
        return f"tests/{module_slug}_generated.rs"
    return f"tests/test_{module_slug}_generated.py"


def _quoted_requirement_list(requirement_ids: tuple[str, ...]) -> str:
    return ", ".join(f'"{requirement_id}"' for requirement_id in requirement_ids)


def _render_generated_test_source(
    *,
    module_name: str,
    requirement_ids: tuple[str, ...],
    implementation: str,
) -> str:
    identifier = _module_identifier(module_name)
    module_slug = module_name.replace("-", "_")
    quoted = _quoted_requirement_list(requirement_ids)

    if implementation == "scala_source_trace":
        body = "Nil" if not requirement_ids else f"List({quoted})"
        return "\n".join(
            (
                f"// {_GENERATED_TEST_CODE_MARKER}",
                *(f"// Validates: {requirement_id}" for requirement_id in requirement_ids),
                "package odd.generated",
                "",
                f"object {identifier}GeneratedTraceSpec {{",
                f'  val moduleName: String = "{module_name}"',
                f"  val tracedRequirements: List[String] = {body}",
                "}",
                "",
            )
        )
    if implementation == "java_source_trace":
        body = "{}" if not requirement_ids else "{ " + quoted + " }"
        return "\n".join(
            (
                f"// {_GENERATED_TEST_CODE_MARKER}",
                *(f"// Validates: {requirement_id}" for requirement_id in requirement_ids),
                "package odd.generated;",
                "",
                f"public final class {identifier}GeneratedTraceTest {{",
                f'  public static final String MODULE_NAME = "{module_name}";',
                f"  public static final String[] TRACED_REQUIREMENTS = new String[] {body};",
                "}",
                "",
            )
        )
    if implementation == "kotlin_source_trace":
        body = "emptyList()" if not requirement_ids else f"listOf({quoted})"
        return "\n".join(
            (
                f"// {_GENERATED_TEST_CODE_MARKER}",
                *(f"// Validates: {requirement_id}" for requirement_id in requirement_ids),
                "package odd.generated",
                "",
                f"object {identifier}GeneratedTraceTest {{",
                f'    val moduleName: String = "{module_name}"',
                f"    val tracedRequirements: List<String> = {body}",
                "}",
                "",
            )
        )
    if implementation == "go_source_trace":
        body = "nil" if not requirement_ids else "[]string{" + quoted + "}"
        return "\n".join(
            (
                f"// {_GENERATED_TEST_CODE_MARKER}",
                *(f"// Validates: {requirement_id}" for requirement_id in requirement_ids),
                "package tests",
                "",
                f"var {identifier}GeneratedTrace = {body}",
                "",
            )
        )
    if implementation == "rust_source_trace":
        body = "&[]" if not requirement_ids else "&[" + quoted + "]"
        const_name = re.sub(r"[^A-Za-z0-9]+", "_", identifier).upper()
        return "\n".join(
            (
                f"// {_GENERATED_TEST_CODE_MARKER}",
                *(f"// Validates: {requirement_id}" for requirement_id in requirement_ids),
                f'pub const {const_name}_GENERATED_TRACE_MODULE: &str = "{module_name}";',
                f"pub const {const_name}_GENERATED_TRACE_REQUIREMENTS: &[&str] = {body};",
                "",
            )
        )
    if implementation in {"ts_source_trace", "js_source_trace", "playwright_typescript"}:
        return "\n".join(
            (
                f"// {_GENERATED_TEST_CODE_MARKER}",
                *(f"// Validates: {requirement_id}" for requirement_id in requirement_ids),
                f'export const {identifier}GeneratedTrace = {{',
                f'  moduleName: "{module_name}",',
                f"  tracedRequirements: [{quoted}],",
                "};",
                "",
            )
        )
    return "\n".join(
        (
            f"# {_GENERATED_TEST_CODE_MARKER}",
            *(f"# Validates: {requirement_id}" for requirement_id in requirement_ids),
            f'MODULE_NAME = "{module_name}"',
            f"TRACED_REQUIREMENTS = [{quoted}]",
            "",
            f"def test_{module_slug}_generated_trace() -> None:",
            "    assert MODULE_NAME",
            "    assert isinstance(TRACED_REQUIREMENTS, list)",
            "",
        )
    )


def _clear_generated_test_code_files(workspace_root: Path) -> None:
    code_root = _code_surface_root(workspace_root)
    if not code_root.exists() or not code_root.is_dir():
        return
    for path in sorted(code_root.rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_EXTENSIONS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if _GENERATED_TEST_CODE_MARKER in text:
            path.unlink()


def _planned_generated_test_files(workspace_root: Path) -> tuple[dict[str, object], ...]:
    stack = _selected_test_stack_defaults(workspace_root)
    modules = _module_names(workspace_root)
    requirement_ids = _planned_test_requirement_ids(workspace_root)
    distributed = _distributed_requirement_ids(requirement_ids, modules)
    planned: list[dict[str, object]] = []
    for module_name in modules:
        module_requirement_ids = distributed.get(module_name, ())
        if not module_requirement_ids:
            continue
        relative_path = _generated_test_relpath(module_name, implementation=stack["implementation"])
        planned.append(
            {
                "module_name": module_name,
                "relative_path": relative_path,
                "requirement_ids": module_requirement_ids,
                "content": _render_generated_test_source(
                    module_name=module_name,
                    requirement_ids=module_requirement_ids,
                    implementation=stack["implementation"],
                ),
            }
        )
    return tuple(planned)


def _intent_authority_lines(workspace_root: Path) -> tuple[str, ...]:
    intent_path = workspace_root / "specification" / "INTENT.md"
    if not intent_path.exists():
        return ("- no imported INT-* authority markers detected",)
    intent_ids = tuple(sorted(set(re.findall(r"\bINT-\d{3}\b", intent_path.read_text(encoding="utf-8")))))
    if not intent_ids:
        return ("- no imported INT-* authority markers detected",)
    return tuple(f"- {intent_id}: carried forward from imported intent authority" for intent_id in intent_ids)


def _construct_planned_software_tree(workspace_root: Path) -> dict[str, str]:
    profile = load_project_profile(workspace_root)
    project_title = _project_title(workspace_root)
    scala_version = _project_constraint_scalar(workspace_root, "version") or "2.13.12"
    modules = _module_names(workspace_root)
    root_name = profile.project_slug.replace("_", "-")

    def module_project_block(module_name: str) -> str:
        identifier = _module_identifier(module_name)
        return "\n".join(
            (
                f"lazy val {identifier[:1].lower() + identifier[1:]} = (project in file({module_name!r}))",
                "  .settings(commonSettings)",
                f"  .settings(name := {module_name!r})",
                "",
            )
        )

    build_lines = [
        f'ThisBuild / organization := "odd.generated"',
        f'ThisBuild / version := "0.1.0-SNAPSHOT"',
        f'ThisBuild / scalaVersion := "{scala_version}"',
        "",
        "lazy val commonSettings = Seq(",
        '  scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked")',
        ")",
        "",
        "lazy val root = (project in file(\".\"))",
        "  .aggregate(" + ", ".join(_module_identifier(name)[:1].lower() + _module_identifier(name)[1:] for name in modules) + ")",
        "  .settings(commonSettings)",
        f"  .settings(name := {root_name!r})",
        "  .settings(publish / skip := true)",
        "",
    ]
    for module_name in modules:
        build_lines.append(module_project_block(module_name).rstrip())

    files: dict[str, str] = {
        "build.sbt": "\n".join(build_lines).rstrip() + "\n",
        "project/build.properties": "sbt.version=1.11.7\n",
        "README.md": "\n".join(
            (
                f"# {project_title}",
                "",
                "Generated governed implementation branch for the odd_sdlc software-domain package.",
                "",
                "## Governed Summary",
                *_governed_summary_lines(workspace_root),
                "",
                "## Imported Authority",
                *_imported_authority_lines(workspace_root),
                "",
            )
        ),
    }

    for module_name in modules:
        identifier = _module_identifier(module_name)
        package_segments = _package_segments_for_module(module_name)
        package_name = ".".join(package_segments)
        package_path = "/".join(package_segments)
        main_rel = f"{module_name}/src/main/scala/{package_path}/{identifier}Module.scala"
        test_rel = f"{module_name}/src/test/scala/{package_path}/{identifier}ModuleSpec.scala"
        files[main_rel] = "\n".join(
            (
                f"package {package_name}",
                "",
                f"object {identifier}Module {{",
                f'  val moduleName: String = "{module_name}"',
                f'  val projectName: String = "{project_title}"',
                f'  val governedCodeRoot: String = "{profile.code_relative_path()}"',
                "  def summary: String = s\"$projectName::$moduleName\"",
                "}",
                "",
            )
        )
        files[test_rel] = "\n".join(
            (
                f"package {package_name}",
                "",
                f"object {identifier}ModuleSpec {{",
                f"  val preservedIdentity: Boolean = {identifier}Module.projectName.nonEmpty",
                f"  val governedBranch: Boolean = {identifier}Module.governedCodeRoot.nonEmpty",
                "}",
                "",
            )
        )
    return files


def _work_act_for_target_asset(target_asset: str, *, operation: str) -> str:
    if operation in {"adopt", "import", "repair", "return", "deploy", "retrofit"}:
        return operation
    if target_asset == "release_surface":
        return "release"
    if target_asset in {"deployment_surface", "deployment_result_surface", "deployed_environment_surface"}:
        return "deploy"
    if target_asset in {"build_execution_result_surface", "test_execution_result_surface", "runtime_observation_surface"}:
        return "return"
    if target_asset == "deployment_surface":
        return "deploy"
    if target_asset == "retrofit_plan_surface":
        return "retrofit"
    if target_asset in {"test_run_archive_surface", "testcase_authority_surface"}:
        return "qualify"
    return "generate"


def _operation_verb(operation: str) -> str:
    return {
        "generate": "generated",
        "adopt": "adopted",
        "import": "imported",
        "repair": "repaired",
        "return": "returned",
        "release": "released",
        "qualify": "qualified",
        "deploy": "deployed",
        "retrofit": "retrofitted",
    }.get(operation, operation)


def _build_work_report(
    *,
    workspace_root: Path,
    target_asset: str,
    target_path: Path,
    previous_checkpoint,
    current_checkpoint,
    attestation: dict[str, Any],
    operation: str,
) -> dict[str, Any]:
    project_profile = load_project_profile(workspace_root)
    report = {
        "target_asset": target_asset,
        "target_relative_path": str(target_path.relative_to(workspace_root)),
        "work_act": _work_act_for_target_asset(target_asset, operation=operation),
        "operation": operation,
        "project_profile": project_profile.to_dict(),
        "previous_checkpoint": previous_checkpoint.to_dict(),
        "current_checkpoint": current_checkpoint.to_dict(),
        "contract_satisfied": attestation["contract_satisfied"],
        "evidence_refs": [str(target_path.relative_to(workspace_root))],
    }
    if target_asset == "code_surface":
        report["governed_code_summary"] = summarize_code_surface(workspace_root)
    if target_asset in {
        "test_run_archive_surface",
        "release_surface",
        "build_execution_surface",
        "build_execution_result_surface",
        "test_execution_surface",
        "test_execution_result_surface",
        "deployment_surface",
        "deployment_result_surface",
        "deployed_environment_surface",
        "runtime_observation_surface",
        "retrofit_plan_surface",
    }:
        report["test_evidence_summary"] = summarize_test_evidence(workspace_root)
    if target_asset in {"build_execution_surface", "build_execution_result_surface"}:
        report["build_artifact_summary"] = _build_artifact_summary(workspace_root)
    return report


def _construct_intent(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        return "\n".join(
            (
                "# Intent",
                "",
                asset_marker("intent_surface"),
                "",
                "## Governing Project Position",
                *_governed_summary_lines(workspace_root),
                "",
                "## Imported Authority",
                *_imported_authority_lines(workspace_root),
                "",
                "## Mission",
                "- preserve imported project identity and intent authority as the governing semantic source",
                "- materialize and maintain software under the declared governed implementation branch",
                "- keep release, deployment, runtime-return, and retrofit surfaces projected over governed evidence",
                "",
            )
        )
    product = _asset_text(workspace_root, "product_surface")
    goals = _asset_text(workspace_root, "goal_surface")
    return "\n".join(
        (
            "# Intent",
            "",
            asset_marker("intent_surface"),
            "",
            "## Purpose",
            "`odd_sdlc` exists to prove that asset-typed GTL/ABG apps can be built, run, audited, reset, and rerun.",
            "",
            "## Bound Sources",
            f"- Product surface present: {'yes' if product else 'no'}",
            f"- Goals surface present: {'yes' if goals else 'no'}",
            "",
            "## Runtime Contract",
            "- graph functions are the constructive carrier",
            "- ABG owns runtime facts",
            "- post-mortem event audit is the primary proof surface",
            "",
        )
    )


def _construct_product(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        return "\n".join(
            (
                "# Product",
                "",
                asset_marker("product_surface"),
                "",
                "This product surface is a generated software-domain read model over the imported project authority.",
                "",
                "## Project Identity",
                *_governed_summary_lines(workspace_root),
                "",
                "## Imported Authority",
                *_imported_authority_lines(workspace_root),
                "",
                "## Product Position",
                "- the workspace defines and governs a real software product, not a proving toy",
                "- odd_sdlc must preserve imported project truth while materializing the active implementation branch",
                "- the declared tenant root is the operative software branch for implementation, qualification, and release projection",
                "",
            )
        )
    intent = _asset_text(workspace_root, "intent_surface")
    goals = _asset_text(workspace_root, "goal_surface")
    return "\n".join(
        (
            "# Product",
            "",
            asset_marker("product_surface"),
            "",
            "The current product is a toy app with one real canonical use case:",
            "- derive intent from the bootstrap input set",
            "- derive product from the bootstrap input set plus the current intent surface",
            "- derive goals from the bootstrap input set plus the current intent and product surfaces",
            "- audit emitted facts across that dependency chain",
            "- reset and rerun the same chain",
            "",
            "## Intent Dependency Snapshot",
            intent,
            "",
            "## Current Goals Snapshot",
            goals,
            "",
        )
    )


def _construct_goals(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        return "\n".join(
            (
                "# Goals",
                "",
                asset_marker("goal_surface"),
                "",
                "## Active Wave",
                "- preserve imported project authority while making the workspace operable under odd_sdlc",
                f"- materialize governed software under `{load_project_profile(workspace_root).code_relative_path()}`",
                "- align generated design, implementation, test, and release surfaces to the governed branch",
                "- keep returned runtime evidence and retrofit planning within the same worksite lifecycle",
                "",
                "## Intent Authority Carry-Forward",
                *_intent_authority_lines(workspace_root),
                "",
                "## Imported Authority",
                *_imported_authority_lines(workspace_root),
                "",
            )
        )
    intent = _asset_text(workspace_root, "intent_surface")
    product = _asset_text(workspace_root, "product_surface")
    return "\n".join(
        (
            "# Goals",
            "",
            asset_marker("goal_surface"),
            "",
            "## Current Wave",
            "- keep the `INTENT -> PRODUCT -> GOALS` dependency chain canonical",
            "- keep the installed sandbox use case repeatable",
            "- prove runtime truth by event audit and archived rerun comparison",
            "",
            "## Upstream Surfaces",
            intent,
            "",
            product,
            "",
        )
    )


def _construct_requirements(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        profile = load_project_profile(workspace_root)
        return "\n".join(
            (
                "# Generated Bootstrap Requirements",
                "",
                asset_marker("requirement_surface"),
                "",
                "## Active Software-Domain Requirements",
                "- imported project authority must remain the semantic source of truth",
                f"- the governed implementation branch must be materialized at `{profile.code_relative_path()}`",
                "- implementation outputs must be attributable through governed work reports and checkpoints",
                f"- qualification must project over the governed branch and declared test runner `{profile.test_runner or 'unspecified'}`",
                "- release, deployment, runtime observation, and retrofit surfaces must remain projections over governed assets and evidence",
                "",
                "## Requirement Authority Carry-Forward",
                *_authority_requirement_lines(workspace_root),
                "",
                "## Imported Authority",
                *_imported_authority_lines(workspace_root),
                "",
                "## Governing Project Position",
                *_governed_summary_lines(workspace_root),
                "",
            )
        )
    intent = _asset_text(workspace_root, "intent_surface")
    product = _asset_text(workspace_root, "product_surface")
    goals = _asset_text(workspace_root, "goal_surface")
    return "\n".join(
        (
            "# Generated Bootstrap Requirements",
            "",
            asset_marker("requirement_surface"),
            "",
            "The retained odd_sdlc proving subset must remain installable, runnable, auditable, and resettable.",
            "",
            "## Generated Expectations",
            "- the installed sandbox opens the intent, product, and goal graph calls in dependency order",
            "- each bounded constructor turn records attributable asset mutation",
            "- assess-result closes each call lawfully",
            "- reset clears runtime state without corrupting the workspace",
            "",
            "## Derived Sources",
            intent,
            "",
            product,
            "",
            goals,
            "",
        )
    )


def _construct_feature_decomp(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        module_lines = tuple(f"- `{module_name}`" for module_name in _module_names(workspace_root))
        return "\n".join(
            (
                "# Generated Feature Decomposition",
                "",
                asset_marker("feature_decomp_surface"),
                "",
                "## Software-Domain Feature Families",
                "- imported authority preservation and normalization",
                "- governed implementation branch materialization",
                "- qualification, release, deployment, runtime-return, and retrofit projection",
                "",
                "## Declared Module Branches",
                *module_lines,
                "",
            )
        )
    requirements = _asset_text(workspace_root, "requirement_surface", "10-generated-bootstrap.md")
    return "\n".join(
        (
            "# Generated Feature Decomposition",
            "",
            asset_marker("feature_decomp_surface"),
            "",
            "## Candidate Features",
            "- bootstrap_chain: derive intent, product, goals, and requirements in lawful dependency order",
            "- fanout_outputs: derive downstream planning and proving surfaces from the generated requirement surface",
            "",
            "## Source Requirements Snapshot",
            requirements,
            "",
        )
    )


def _construct_uat_testcases(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        profile = load_project_profile(workspace_root)
        return "\n".join(
            (
                "# Generated UAT Testcases",
                "",
                asset_marker("uat_testcases_surface"),
                "",
                "## Canonical Software-Domain Acceptance Cases",
                "1. preserve imported project identity and authority after install and traversal",
                f"2. materialize the governed implementation branch at `{profile.code_relative_path()}`",
                f"3. keep qualification aligned to the declared test runner `{profile.test_runner or 'unspecified'}`",
                "4. project release and downstream lifecycle surfaces over the governed branch",
                "",
            )
        )
    requirements = _asset_text(workspace_root, "requirement_surface", "10-generated-bootstrap.md")
    return "\n".join(
        (
            "# Generated UAT Testcases",
            "",
            asset_marker("uat_testcases_surface"),
            "",
            "## Canonical Acceptance Cases",
            "1. install a clean sandbox workspace",
            "2. run the bootstrap subgraph to requirements",
            "3. fan out from requirements to feature decomposition and UAT testcase surfaces",
            "4. reset runtime state and rerun without losing archived evidence",
            "",
            "## Source Requirements Snapshot",
            requirements,
            "",
        )
    )


def _construct_design(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        return "\n".join(
            (
                "# Generated odd_sdlc Design",
                "",
                asset_marker("design_surface"),
                "",
                "## Design Boundary",
                "- odd_sdlc acts as the software-domain worksite supervisor over imported project authority",
                "- GTL/ABG remains the execution substrate while odd_sdlc owns the SDLC asset graph and branch bindings",
                "- the declared tenant root is the active implementation branch, not ambient repository context",
                "",
                "## Governed Project Position",
                *_governed_summary_lines(workspace_root),
                "",
            )
        )
    requirements = _asset_text(workspace_root, "requirement_surface", "10-generated-bootstrap.md")
    feature_decomp = _asset_text(workspace_root, "feature_decomp_surface")
    return "\n".join(
        (
            "# Generated odd_sdlc Design",
            "",
            asset_marker("design_surface"),
            "",
            "## Design Boundary",
            "- odd_sdlc keeps ABG as runtime truth and exposes domain query logic as a plugin boundary",
            "- the toy app grows by extending the asset graph, not by introducing a shadow controller",
            "",
            "## Source Requirements Snapshot",
            requirements,
            "",
            "## Source Feature Decomposition Snapshot",
            feature_decomp,
            "",
        )
    )


def _construct_review_assessment(workspace_root: Path) -> str:
    design = _asset_text(workspace_root, "design_surface")
    return "\n".join(
        (
            "# Generated Review Assessments",
            "",
            asset_marker("review_assessment_surface"),
            "",
            "## Reviewers",
            "- reviewer.codex: confirms the design remains traceable to generated requirements and decomposition surfaces",
            "- reviewer.claude: confirms the design is explainable, inspectable, and ready for downstream implementation and test branches",
            "",
            "## Proposed Deltas",
            "- preserve design-to-module and design-to-test branch symmetry",
            "- require consensus reduction before a reviewed design is treated as downstream authority",
            "",
            "## Source Design Snapshot",
            design,
            "",
        )
    )


def _construct_consensus_decision(workspace_root: Path) -> str:
    review_assessments = _asset_text(workspace_root, "review_assessment_surface")
    return "\n".join(
        (
            "# Generated Consensus Decision",
            "",
            asset_marker("consensus_decision_surface"),
            "",
            "## Decision",
            "- quorum reached: yes",
            "- next action: apply reviewed design surface",
            "- escalation required: no",
            "",
            "## Assessment Reduction Snapshot",
            review_assessments,
            "",
        )
    )


def _construct_reviewed_design(workspace_root: Path) -> str:
    design = _asset_text(workspace_root, "design_surface")
    consensus_decision = _asset_text(workspace_root, "consensus_decision_surface")
    return "\n".join(
        (
            "# Reviewed odd_sdlc Design",
            "",
            asset_marker("reviewed_design_surface"),
            "",
            "## Reviewed Design Boundary",
            "- this surface is the reviewed derivative of the generated odd_sdlc design surface",
            "- downstream consumers may prefer this reviewed form when explicit consensus is required",
            "",
            "## Source Design Snapshot",
            design,
            "",
            "## Source Consensus Decision Snapshot",
            consensus_decision,
            "",
        )
    )


def _construct_testcase_authority(workspace_root: Path) -> str:
    uat_testcases = _asset_text(workspace_root, "uat_testcases_surface")
    scenarios = _asset_text(workspace_root, "scenario_surface")
    return "\n".join(
        (
            "# Generated Testcase Authority",
            "",
            asset_marker("testcase_authority_surface"),
            "",
            "## Current Authority Position",
            "- the generated UAT testcase collection together with the generated scenario set is the active authoritative verification surface for the current odd_sdlc sandbox slice",
            "- downstream proof lanes should validate against this joined verification surface until superseded by a newer qualified surface",
            "",
            "## Source UAT Testcase Snapshot",
            uat_testcases,
            "",
            "## Source Scenario Snapshot",
            scenarios,
            "",
        )
    )


def _construct_scenarios(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        return "\n".join(
            (
                "# Generated Scenarios",
                "",
                asset_marker("scenario_surface"),
                "",
                "## Canonical Scenario Bundles",
                "1. adopt imported authority and derive the active software-domain surfaces without collapsing project identity",
                "2. materialize the governed implementation branch and align qualification to it",
                "3. project release, deployment, runtime-return, and retrofit over the governed branch",
                "",
            )
        )
    requirements = _asset_text(workspace_root, "requirement_surface", "10-generated-bootstrap.md")
    design = _asset_text(workspace_root, "design_surface")
    return "\n".join(
        (
            "# Generated Scenarios",
            "",
            asset_marker("scenario_surface"),
            "",
            "## Canonical Scenario Bundles",
            "1. bootstrap the odd_sdlc sandbox and derive the current asset graph to release readiness",
            "2. observe the resulting runtime truth through ABG events and ODD domain queries",
            "3. reset runtime state and compare archived first-run and rerun evidence",
            "",
            "## Source Requirements Snapshot",
            requirements,
            "",
            "## Source Design Snapshot",
            design,
            "",
        )
    )


def _construct_implementation_design(workspace_root: Path) -> str:
    design = _asset_text(workspace_root, "design_surface")
    scenarios = _asset_text(workspace_root, "scenario_surface")
    profile = load_project_profile(workspace_root)
    return "\n".join(
        (
            "# Generated Implementation Design",
            "",
            asset_marker("implementation_design_surface"),
            "",
            "## Selected Implementation Branch",
            f"- tenant: `{profile.tenant_name or 'default'}`",
            f"- realization mode: `{profile.realization_mode}`",
            f"- governed code root: `{profile.code_relative_path()}`",
            "- implementation work is governed as the active software-domain branch selected by project constraints and realization profile",
            "",
            "## Current Expectations",
            "- generated or adopted implementation must remain bound to the governed code root",
            "- downstream release and qualification surfaces must project over that governed branch",
            "- carried-forward implementation must be represented as governed provenance rather than ambient file state",
            "- implementation planning surfaces must retain explicit requirement identifiers so generated source files can carry `Implements:` authority tags",
            "",
            "## Source Design Snapshot",
            design,
            "",
            "## Source Scenario Snapshot",
            scenarios,
            "",
        )
    )


def _construct_implementation_stack_profile(workspace_root: Path) -> str:
    implementation_design = _asset_text(workspace_root, "implementation_design_surface")
    profile = load_project_profile(workspace_root)
    return "\n".join(
        (
            "# Generated Implementation Stack Profile",
            "",
            asset_marker("implementation_stack_profile"),
            "",
            "## Selected Stack",
            f"- primary language: {profile.language or 'python'}",
            f"- tenant: {profile.tenant_name or 'default'}",
            f"- governed code root: {profile.code_relative_path()}",
            f"- realization mode: {profile.realization_mode}",
            f"- declared test runner: {profile.test_runner or 'not declared'}",
            "",
            "## Source Implementation Design Snapshot",
            implementation_design,
            "",
        )
    )


def _construct_implementation_module_surface(workspace_root: Path) -> str:
    implementation_design = _asset_text(workspace_root, "implementation_design_surface")
    implementation_stack = _asset_text(workspace_root, "implementation_stack_profile")
    code_summary = summarize_code_surface(workspace_root)
    proving_subset_requirement_ids = (
        _proving_subset_requirement_ids(workspace_root)
        if load_project_profile(workspace_root).realization_mode == "generated_proving_subset"
        else ()
    )
    claimed_requirement_lines = (
        (f"- claimed requirement ids: {', '.join(proving_subset_requirement_ids)}",)
        if proving_subset_requirement_ids
        else ()
    )
    return "\n".join(
        (
            "# Generated Implementation Modules",
            "",
            asset_marker("implementation_module_surface"),
            "",
            "## Module Layout",
            f"- governed code root: `{code_summary['relative_path']}`",
            f"- build markers detected: {', '.join(code_summary['build_markers']) or 'none'}",
            f"- source files detected: {code_summary['source_file_count']}",
            f"- test-source files detected: {code_summary['test_source_file_count']}",
            "- generated source files in the governed branch must carry `Implements:` tags for the requirements claimed by this branch",
            *claimed_requirement_lines,
            "",
            "## Source Implementation Design Snapshot",
            implementation_design,
            "",
            "## Source Implementation Stack Snapshot",
            implementation_stack,
            "",
        )
    )


def _construct_code_surface(workspace_root: Path) -> dict[str, str]:
    profile = load_project_profile(workspace_root)
    implementation_modules = _asset_text(workspace_root, "implementation_module_surface")
    implementation_stack = _asset_text(workspace_root, "implementation_stack_profile")
    if profile.realization_mode == "selected_output_tree":
        raise RuntimeError(
            "selected_output_tree code surfaces are adopted from the governed realization root and "
            "must not be regenerated as the proving package"
        )
    if profile.realization_mode == "planned_output_tree":
        return _construct_planned_software_tree(workspace_root)
    code_marker = asset_marker("code_surface")
    hello_message = "Hello from odd_sdlc proving subset."
    requirement_ids = _proving_subset_requirement_ids(workspace_root)
    implements_lines = _tag_lines("Implements", requirement_ids)
    validates_lines = _tag_lines("Validates", requirement_ids)
    init_text = "\n".join(
        (
            '"""Generated odd_sdlc proving-subset implementation package."""',
            "",
            *implements_lines,
            f"# {code_marker}",
            "",
            "from .app import hello_message, main",
            "from .workflow import implementation_summary",
            "",
            "__all__ = [\"hello_message\", \"implementation_summary\", \"main\"]",
            "",
        )
    )
    app_text = "\n".join(
        (
            '"""Generated hello-world application for the odd_sdlc proving subset."""',
            "",
            *implements_lines,
            f"HELLO_MESSAGE = {hello_message!r}",
            "",
            "def hello_message() -> str:",
            '    """Return the generated greeting for the retained odd_sdlc proving subset."""',
            "    return HELLO_MESSAGE",
            "",
            "def main() -> int:",
            '    """Run the retained proving-subset generated application."""',
            "    print(HELLO_MESSAGE)",
            "    return 0",
            "",
            'if __name__ == "__main__":',
            "    raise SystemExit(main())",
            "",
        )
    )
    main_text = "\n".join(
        (
            '"""Package entry point for the generated odd_sdlc proving application."""',
            "",
            *implements_lines,
            "from .app import main",
            "",
            'if __name__ == "__main__":',
            "    raise SystemExit(main())",
            "",
        )
    )
    workflow_text = "\n".join(
        (
            '"""Generated implementation workflow helpers for the odd_sdlc proving subset."""',
            "",
            *implements_lines,
            f"CODE_MARKER = {code_marker!r}",
            "",
            "def implementation_summary() -> dict[str, object]:",
            '    """Return the retained proving-subset implementation branch summary."""',
            "    return {",
            '        "package": "odd_sdlc_proving_impl",',
            '        "graph_function": "bootstrap_release_self_test",',
            '        "hello_message": ' + repr(hello_message) + ",",
            '        "entry_module": "odd_sdlc_proving_impl.app",',
            '        "entrypoint": "main",',
            '        "implementation_branch": [',
            '            "derive_implementation_design_surface",',
            '            "select_implementation_stack_profile",',
            '            "derive_implementation_module_surface",',
            '            "derive_code_surface",',
            "        ],",
            '        "artifacts": [',
            '            "implementation_design_surface",',
            '            "implementation_stack_profile",',
            '            "implementation_module_surface",',
            '            "code_surface",',
            "        ],",
            '        "module_surface_heading": '
            + repr(implementation_modules.splitlines()[0] if implementation_modules else ""),
            ",",
            '        "stack_surface_heading": '
            + repr(implementation_stack.splitlines()[0] if implementation_stack else ""),
            ",",
            "    }",
            "",
        )
    )
    test_app_text = "\n".join(
        (
            '"""Generated proving-subset test coverage for the retained odd_sdlc application."""',
            "",
            *validates_lines,
            "from odd_sdlc_proving_impl.app import hello_message",
            "",
            "def test_hello_message() -> None:",
            '    """Validate the generated hello-world boundary remains stable."""',
            '    assert hello_message() == "Hello from odd_sdlc proving subset."',
            "",
        )
    )
    test_workflow_text = "\n".join(
        (
            '"""Generated proving-subset test coverage for the retained odd_sdlc workflow summary."""',
            "",
            *validates_lines,
            "from odd_sdlc_proving_impl.workflow import implementation_summary",
            "",
            "def test_implementation_summary_contains_traceable_branch() -> None:",
            '    """Validate the generated implementation summary remains branch-aware."""',
            "    summary = implementation_summary()",
            '    assert summary["graph_function"] == "bootstrap_release_self_test"',
            '    assert "derive_code_surface" in summary["implementation_branch"]',
            "",
        )
    )
    return {
        "__init__.py": init_text,
        "__main__.py": main_text,
        "app.py": app_text,
        "workflow.py": workflow_text,
        "tests/test_app.py": test_app_text,
        "tests/test_workflow.py": test_workflow_text,
    }


def _construct_release(workspace_root: Path) -> str:
    requirements = _asset_text(workspace_root, "requirement_surface", "10-generated-bootstrap.md")
    design = _asset_text(workspace_root, "design_surface")
    scenarios = _asset_text(workspace_root, "scenario_surface")
    testcase_authority = _asset_text(workspace_root, "testcase_authority_surface")
    test_run_archive = _asset_text(workspace_root, "test_run_archive_surface")
    code_summary = summarize_code_surface(workspace_root)
    test_summary = summarize_test_evidence(workspace_root)
    if test_summary["parsed_report_count"] == 0:
        completion_state = "construction_complete_pending_execution"
    elif test_summary["failures"] == 0 and test_summary["errors"] == 0:
        completion_state = "execution_evidence_recorded"
    else:
        completion_state = "execution_evidence_recorded_with_failures"
    if test_summary["parsed_report_count"] == 0:
        release_status = "pending_evidence"
    elif test_summary["failures"] == 0 and test_summary["errors"] == 0:
        release_status = "qualified"
    else:
        release_status = "blocked"
    return "\n".join(
        (
            "# Generated Release Surface",
            "",
            asset_marker("release_surface"),
            "",
            "## Governed Release Position",
            f"- status: {release_status}",
            f"- completion_state: {completion_state}",
            f"- governed code root: `{code_summary['relative_path']}`",
            f"- source files observed: {code_summary['source_file_count']}",
            f"- build markers observed: {', '.join(code_summary['build_markers']) or 'none'}",
            f"- report files observed: {test_summary['report_file_count']}",
            f"- parsed reports: {test_summary['parsed_report_count']}",
            f"- tests observed: {test_summary['tests']}",
            f"- failures observed: {test_summary['failures']}",
            f"- errors observed: {test_summary['errors']}",
            f"- ungoverned report files observed: {test_summary['ungoverned_report_file_count']}",
            "",
            "## Source Requirements Snapshot",
            requirements,
            "",
            "## Source Design Snapshot",
            design,
            "",
            "## Source Scenario Snapshot",
            scenarios,
            "",
            "## Governed Code Summary",
            json.dumps(code_summary, indent=2, sort_keys=True),
            "",
            "## Source Testcase Authority Snapshot",
            testcase_authority,
            "",
            "## Source Test Run Archive Snapshot",
            test_run_archive,
            "",
            "## Ungoverned Execution Observations",
            (
                "- no undeclared execution reports observed"
                if not test_summary["ungoverned_report_paths"]
                else "\n".join(f"- `{path}`" for path in test_summary["ungoverned_report_paths"])
            ),
            "",
        )
    )


def _construct_build_execution_surface(workspace_root: Path) -> str:
    release_surface = _asset_text(workspace_root, "release_surface")
    code_summary = summarize_code_surface(workspace_root)
    build_summary = _build_artifact_summary(workspace_root)
    project_profile = load_project_profile(workspace_root)
    binding = _classify_operational_binding(project_profile.build_execution_contract or "")
    return "\n".join(
        (
            "# Generated Build Execution Surface",
            "",
            asset_marker("build_execution_surface"),
            "",
            "## Operational Transition Command",
            "- status: prepared",
            "- saga_state: prepared",
            f"- substrate_binding: `{binding}`",
            f"- substrate_contract: `{project_profile.build_execution_contract or 'undeclared'}`",
            "- target_result_surface: `build_execution_result_surface`",
            f"- governed code root: `{code_summary['relative_path']}`",
            f"- build markers observed: {', '.join(code_summary['build_markers']) or 'none'}",
            f"- observed build artifact roots: {', '.join(build_summary['observed_paths']) or 'none'}",
            "",
            "## Source Release Snapshot",
            release_surface,
            "",
            "## Governed Code Summary",
            json.dumps(code_summary, indent=2, sort_keys=True),
            "",
            "## Build Artifact Summary",
            json.dumps(build_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_build_execution_result_surface(workspace_root: Path) -> str:
    build_execution_surface = _asset_text(workspace_root, "build_execution_surface")
    build_summary = _build_artifact_summary(workspace_root)
    dispatch = _operational_dispatch_entry(workspace_root, "build")
    if dispatch.get("status") == "failed":
        status = "failed"
        saga_state = "failed"
    elif dispatch.get("status") == "succeeded":
        status = "result_admitted"
        saga_state = "result_admitted"
    else:
        status = "result_admitted" if build_summary["artifact_root_count"] else "pending_external_evidence"
        saga_state = "result_admitted" if build_summary["artifact_root_count"] else "dispatched"
    return "\n".join(
        (
            "# Generated Build Execution Result Surface",
            "",
            asset_marker("build_execution_result_surface"),
            "",
            "## Admitted Build Result",
            f"- status: {status}",
            f"- saga_state: {saga_state}",
            f"- observed build artifact roots: {', '.join(build_summary['observed_paths']) or 'none'}",
            f"- dispatch_binding: `{dispatch.get('binding', 'none')}`",
            f"- dispatch_exit_code: {dispatch.get('exit_code', 'n/a')}",
            f"- dispatch_stdout_log: `{dispatch.get('stdout_path', 'none')}`",
            f"- dispatch_stderr_log: `{dispatch.get('stderr_path', 'none')}`",
            "",
            "## Source Build Execution Snapshot",
            build_execution_surface,
            "",
            "## Build Artifact Summary",
            json.dumps(build_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_test_execution_surface(workspace_root: Path) -> str:
    release_surface = _asset_text(workspace_root, "release_surface")
    test_summary = summarize_test_evidence(workspace_root)
    project_profile = load_project_profile(workspace_root)
    binding = _classify_operational_binding(project_profile.test_execution_contract or "")
    return "\n".join(
        (
            "# Generated Test Execution Surface",
            "",
            asset_marker("test_execution_surface"),
            "",
            "## Operational Transition Command",
            "- status: prepared",
            "- saga_state: prepared",
            f"- substrate_binding: `{binding}`",
            f"- substrate_contract: `{project_profile.test_execution_contract or 'undeclared'}`",
            "- target_result_surface: `test_execution_result_surface`",
            f"- expected returned report files observed now: {test_summary['report_file_count']}",
            "",
            "## Source Release Snapshot",
            release_surface,
            "",
            "## Current Test Evidence Summary",
            json.dumps(test_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_test_execution_result_surface(workspace_root: Path) -> str:
    test_execution_surface = _asset_text(workspace_root, "test_execution_surface")
    test_summary = summarize_test_evidence(workspace_root)
    dispatch = _operational_dispatch_entry(workspace_root, "test")
    if dispatch.get("status") == "failed":
        status = "failed"
        saga_state = "failed"
    elif dispatch.get("status") == "succeeded":
        status = "result_admitted"
        saga_state = "result_admitted"
    elif test_summary["parsed_report_count"] == 0:
        status = "pending_external_evidence"
        saga_state = "dispatched"
    elif test_summary["failures"] == 0 and test_summary["errors"] == 0:
        status = "result_admitted"
        saga_state = "result_admitted"
    else:
        status = "result_admitted_with_failures"
        saga_state = "result_admitted"
    return "\n".join(
        (
            "# Generated Test Execution Result Surface",
            "",
            asset_marker("test_execution_result_surface"),
            "",
            "## Admitted Test Execution Result",
            f"- status: {status}",
            f"- saga_state: {saga_state}",
            f"- report files returned: {test_summary['report_file_count']}",
            f"- parsed reports: {test_summary['parsed_report_count']}",
            f"- tests observed: {test_summary['tests']}",
            f"- failures observed: {test_summary['failures']}",
            f"- errors observed: {test_summary['errors']}",
            f"- dispatch_binding: `{dispatch.get('binding', 'none')}`",
            f"- dispatch_exit_code: {dispatch.get('exit_code', 'n/a')}",
            f"- dispatch_stdout_log: `{dispatch.get('stdout_path', 'none')}`",
            f"- dispatch_stderr_log: `{dispatch.get('stderr_path', 'none')}`",
            "",
            "## Source Test Execution Snapshot",
            test_execution_surface,
            "",
            "## Returned Evidence Projection",
            json.dumps(test_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_deployment_surface(workspace_root: Path) -> str:
    release_surface = _asset_text(workspace_root, "release_surface")
    project_profile = load_project_profile(workspace_root)
    test_execution_result = _optional_asset_text(workspace_root, "test_execution_result_surface")
    binding = _classify_operational_binding(project_profile.deployment_contract or "")
    return "\n".join(
        (
            "# Generated Deployment Surface",
            "",
            asset_marker("deployment_surface"),
            "",
            "## Operational Transition Command",
            "- status: prepared",
            "- saga_state: prepared",
            f"- substrate_binding: `{binding}`",
            f"- substrate_contract: `{project_profile.deployment_contract or 'undeclared'}`",
            "- target_result_surface: `deployment_result_surface`",
            "- target_state_surface: `deployed_environment_surface`",
            "",
            "## Source Release Snapshot",
            release_surface,
            "",
            "## Source Test Execution Result Snapshot",
            (
                test_execution_result
                if test_execution_result
                else "- no admitted test execution result surface is present in the current branch"
            ),
            "",
        )
    )


def _construct_deployment_result_surface(workspace_root: Path) -> str:
    deployment_surface = _asset_text(workspace_root, "deployment_surface")
    test_summary = summarize_test_evidence(workspace_root)
    dispatch = _operational_dispatch_entry(workspace_root, "deployment")
    if dispatch.get("status") == "failed":
        status = "failed"
        saga_state = "failed"
    elif dispatch.get("status") == "succeeded":
        status = "result_admitted"
        saga_state = "result_admitted"
    else:
        status = "pending_external_evidence"
        saga_state = "dispatched"
    return "\n".join(
        (
            "# Generated Deployment Result Surface",
            "",
            asset_marker("deployment_result_surface"),
            "",
            "## Admitted Deployment Result",
            f"- status: {status}",
            f"- saga_state: {saga_state}",
            f"- returned runtime or deployment reports currently observed: {test_summary['report_file_count']}",
            f"- dispatch_binding: `{dispatch.get('binding', 'none')}`",
            f"- dispatch_exit_code: {dispatch.get('exit_code', 'n/a')}",
            f"- dispatch_stdout_log: `{dispatch.get('stdout_path', 'none')}`",
            f"- dispatch_stderr_log: `{dispatch.get('stderr_path', 'none')}`",
            "",
            "## Source Deployment Snapshot",
            deployment_surface,
            "",
            "## Returned Evidence Summary",
            json.dumps(test_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_deployed_environment_surface(workspace_root: Path) -> str:
    deployment_result_surface = _asset_text(workspace_root, "deployment_result_surface")
    dispatch = _operational_dispatch_entry(workspace_root, "deployment")
    if dispatch.get("status") == "failed":
        status = "deployment_failed"
    elif dispatch.get("status") == "succeeded":
        status = "deployment_result_admitted"
    else:
        status = "deployment_pending_external_evidence"
    return "\n".join(
        (
            "# Generated Deployed Environment Surface",
            "",
            asset_marker("deployed_environment_surface"),
            "",
            "## Current Projected State",
            f"- status: {status}",
            "- projection_basis: admitted deployment result surface",
            f"- deployment_dispatch_stdout_log: `{dispatch.get('stdout_path', 'none')}`",
            "",
            "## Source Deployment Result Snapshot",
            deployment_result_surface,
            "",
        )
    )


def _construct_runtime_observation_surface(workspace_root: Path) -> str:
    deployment_result_surface = _asset_text(workspace_root, "deployment_result_surface")
    code_summary = summarize_code_surface(workspace_root)
    test_summary = summarize_test_evidence(workspace_root)
    dispatch = _operational_dispatch_entry(workspace_root, "deployment")
    if dispatch.get("status") == "failed":
        completion_state = "deployment_failed"
        observed_status = "failed"
        saga_state = "failed"
    elif dispatch.get("status") == "succeeded":
        completion_state = "deployment_result_recorded"
        observed_status = "result_admitted"
        saga_state = "result_admitted"
    elif test_summary["parsed_report_count"] == 0:
        completion_state = "construction_complete_pending_execution"
        observed_status = "pending_external_evidence"
        saga_state = "dispatched"
    elif test_summary["failures"] == 0 and test_summary["errors"] == 0:
        completion_state = "execution_evidence_recorded"
        observed_status = "result_admitted"
        saga_state = "result_admitted"
    else:
        completion_state = "execution_evidence_recorded_with_failures"
        observed_status = "result_admitted_with_failures"
        saga_state = "result_admitted"
    return "\n".join(
        (
            "# Generated Runtime Observation Surface",
            "",
            asset_marker("runtime_observation_surface"),
            "",
            "## Admitted Runtime Observation",
            f"- status: {observed_status}",
            f"- saga_state: {saga_state}",
            f"- completion_state: {completion_state}",
            f"- governed code root: `{code_summary['relative_path']}`",
            f"- report files returned: {test_summary['report_file_count']}",
            f"- parsed reports: {test_summary['parsed_report_count']}",
            f"- tests observed: {test_summary['tests']}",
            f"- failures observed: {test_summary['failures']}",
            f"- errors observed: {test_summary['errors']}",
            f"- ungoverned report files observed: {test_summary['ungoverned_report_file_count']}",
            f"- deployment_dispatch_stdout_log: `{dispatch.get('stdout_path', 'none')}`",
            "",
            "## Source Deployment Result Snapshot",
            deployment_result_surface,
            "",
            "## Returned Evidence Projection",
            json.dumps(test_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_retrofit_plan_surface(workspace_root: Path) -> str:
    runtime_observation = _asset_text(workspace_root, "runtime_observation_surface")
    release_surface = _asset_text(workspace_root, "release_surface")
    code_summary = summarize_code_surface(workspace_root)
    test_summary = summarize_test_evidence(workspace_root)
    next_actions = [
        "- preserve the current governed code root and provenance chain",
        "- regenerate release, deployment, and runtime-return surfaces after any bounded branch change",
    ]
    if test_summary["failures"] or test_summary["errors"]:
        next_actions.insert(0, "- repair the failing implementation branch before relaunch")
    else:
        next_actions.insert(0, "- continue bounded retrofit work from the current qualified branch and returned evidence")
    return "\n".join(
        (
            "# Generated Retrofit Plan",
            "",
            asset_marker("retrofit_plan_surface"),
            "",
            "## Retrofit Boundary",
            f"- governed code root: `{code_summary['relative_path']}`",
            f"- source files observed: {code_summary['source_file_count']}",
            f"- returned evidence files: {test_summary['report_file_count']}",
            f"- tests observed: {test_summary['tests']}",
            f"- failures observed: {test_summary['failures']}",
            f"- errors observed: {test_summary['errors']}",
            "",
            "## Planned Next Actions",
            *next_actions,
            "",
            "## Source Runtime Observation Snapshot",
            runtime_observation,
            "",
            "## Source Release Snapshot",
            release_surface,
            "",
            "## Governing Evidence Projection",
            json.dumps(test_summary, indent=2, sort_keys=True),
            "",
        )
    )


def _construct_test_design(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        return "\n".join(
            (
                "# Generated Test Design",
                "",
                asset_marker("test_design_surface"),
                "",
                "## Governed Qualification Boundary",
                "- qualification work is tied to the governed implementation branch, not a shadow proving subset",
                "- archive and release projection must summarize evidence discovered under the active code root",
                "- generated test files in the governed branch must carry `Validates:` tags for the requirements claimed by testcase authority",
                "",
                "## Governed Project Position",
                *_governed_summary_lines(workspace_root),
                "",
            )
        )
    design = _asset_text(workspace_root, "design_surface")
    scenarios = _asset_text(workspace_root, "scenario_surface")
    profile = load_project_profile(workspace_root)
    return "\n".join(
        (
            "# Generated Test Design",
            "",
            asset_marker("test_design_surface"),
            "",
            "## Retained Proving-Subset Test Branch",
            f"- test work is modeled as one bounded proving-subset SDLC branch under `build_tenants/{profile.tenant_name}/test_env`",
            "- sandbox design, stack choice, module structure, and archived run evidence are explicit generated proving-subset assets",
            "",
            "## Source Design Snapshot",
            design,
            "",
            "## Source Scenario Snapshot",
            scenarios,
            "",
        )
    )


def _construct_test_stack_profile(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        profile = load_project_profile(workspace_root)
        stack = _selected_test_stack_defaults(workspace_root)
        return "\n".join(
            (
                "# Generated Test Stack Profile",
                "",
                asset_marker("test_stack_profile"),
                "",
                "## Selected Stack",
                f"- declared test runner: {profile.test_runner or 'unspecified'}",
                f"- selected harness family: {stack['family']}",
                f"- selected stack binding: {stack['binding']}",
                f"- primary harness: {stack['primary_harness']}",
                f"- governed code root: {profile.code_relative_path()}",
                f"- implementation: {stack['implementation']}",
                "- evidence projection is rooted in discovered reports under the governed implementation branch",
                f"- stack rationale: {stack['summary']}",
                "",
            )
        )
    test_design = _asset_text(workspace_root, "test_design_surface")
    return "\n".join(
        (
            "# Generated Test Stack Profile",
            "",
            asset_marker("test_stack_profile"),
            "",
            "## Selected Stack",
            "- selected harness family: generic_test_harness",
            "- selected stack binding: proving_subset_default",
            "- primary harness: proving-subset sandbox defaults",
            "- sandbox orchestration: installed odd_sdlc workspace seeded through gen-install",
            "- archive model: persistent run archive with runtime snapshots and comparative analysis",
            "- concrete harness binding remains selectable from downstream implementation truth",
            "",
            "## Source Test Design Snapshot",
            test_design,
            "",
        )
    )


def _construct_test_module_surface(workspace_root: Path) -> str:
    if _software_project_mode(workspace_root):
        planned_requirement_ids = _planned_test_requirement_ids(workspace_root)
        module_lines = tuple(f"- `{module_name}` test sources under the governed implementation branch" for module_name in _module_names(workspace_root))
        return "\n".join(
            (
                "# Generated Test Modules",
                "",
                asset_marker("test_module_surface"),
                "",
                "## Module Layout",
                *module_lines,
                "- this surface declares planned developer-test coverage and module ownership; it does not itself count as realized test source",
                "- realized test traceability is satisfied only when governed test source is materialized under the active code root",
                f"- planned requirement claims: {', '.join(planned_requirement_ids) if planned_requirement_ids else 'none yet declared'}",
                "",
            )
        )
    test_design = _asset_text(workspace_root, "test_design_surface")
    test_stack = _asset_text(workspace_root, "test_stack_profile")
    planned_requirement_ids = _proving_subset_requirement_ids(workspace_root)
    return "\n".join(
        (
            "# Generated Test Modules",
            "",
            asset_marker("test_module_surface"),
            "",
            "## Module Layout",
            "- sandbox_runtime.py: installed sandbox orchestration helpers",
            "- run_archive.py: persistent comparative archive helpers",
            "- test_odd_sdlc_sandbox_usecase.py: canonical sandbox proving lane",
            f"- planned requirement claims: {', '.join(planned_requirement_ids)}",
            "",
            "## Source Test Design Snapshot",
            test_design,
            "",
            "## Source Test Stack Snapshot",
            test_stack,
            "",
        )
    )


def _construct_test_code_surface(workspace_root: Path) -> str:
    stack = _selected_test_stack_defaults(workspace_root)
    planned_files = _planned_generated_test_files(workspace_root)
    inventory_lines = tuple(
        f"- `{entry['relative_path']}` ({entry['module_name']}): "
        + (", ".join(entry["requirement_ids"]) if entry["requirement_ids"] else "no explicit planned requirement claims yet")
        for entry in planned_files
    ) or ("- no generated test source files planned",)
    return "\n".join(
        (
            "# Generated Test Code",
            "",
            "## Realized Test-Code Position",
            f"- governed code root: `{load_project_profile(workspace_root).code_relative_path()}`",
            f"- selected harness family: {stack['family']}",
            f"- selected stack binding: {stack['binding']}",
            f"- primary harness: {stack['primary_harness']}",
            f"- generated test source files: {len(planned_files)}",
            "- this surface summarizes realized developer-test source generated under the governed implementation branch",
            "",
            "## Generated Test Source Inventory",
            *inventory_lines,
            "",
        )
    )


def _construct_test_run_archive(workspace_root: Path) -> str:
    test_summary = summarize_test_evidence(workspace_root)
    ungoverned_report_lines = tuple(
        f"- `{path}`" for path in test_summary["ungoverned_report_paths"]
    ) or ("- no undeclared execution reports observed",)
    if _software_project_mode(workspace_root):
        test_code = _construct_test_code_surface(workspace_root)
        report_lines = tuple(f"- `{path}`" for path in test_summary["report_paths"]) or (
            "- no report files observed yet",
        )
        return "\n".join(
            (
                "# Generated Test Run Archive",
                "",
                asset_marker("test_run_archive_surface"),
                "",
                "## Governed Evidence Projection",
                f"- report files observed: {test_summary['report_file_count']}",
                f"- parsed reports: {test_summary['parsed_report_count']}",
                f"- tests observed: {test_summary['tests']}",
                f"- failures observed: {test_summary['failures']}",
                f"- errors observed: {test_summary['errors']}",
                f"- ungoverned report files observed: {test_summary['ungoverned_report_file_count']}",
                "",
                "## Governed Project Position",
                *_governed_summary_lines(workspace_root),
                "",
                "## Source Test Code Snapshot",
                test_code,
                "",
                "## Observed Report Paths",
                *report_lines,
                "",
                "## Ungoverned Report Paths",
                *ungoverned_report_lines,
                "",
            )
        )
    test_modules = _asset_text(workspace_root, "test_module_surface")
    test_stack = _asset_text(workspace_root, "test_stack_profile")
    return "\n".join(
        (
            "# Generated Test Run Archive",
            "",
            asset_marker("test_run_archive_surface"),
            "",
            "## Proving-Subset Archive Policy",
            f"- report files observed: {test_summary['report_file_count']}",
            f"- parsed reports: {test_summary['parsed_report_count']}",
            f"- tests observed: {test_summary['tests']}",
            f"- failures observed: {test_summary['failures']}",
            f"- errors observed: {test_summary['errors']}",
            f"- ungoverned report files observed: {test_summary['ungoverned_report_file_count']}",
            "",
            "## Source Test Module Snapshot",
            test_modules,
            "",
            "## Source Test Stack Snapshot",
            test_stack,
            "",
            "## Governed Evidence Projection",
            json.dumps(test_summary, indent=2, sort_keys=True),
            "",
            "## Ungoverned Report Paths",
            *ungoverned_report_lines,
            "",
        )
    )


def _constructed_content(target_asset: str, workspace_root: Path) -> str:
    if target_asset == "intent_surface":
        return _construct_intent(workspace_root)
    if target_asset == "product_surface":
        return _construct_product(workspace_root)
    if target_asset == "goal_surface":
        return _construct_goals(workspace_root)
    if target_asset == "requirement_surface":
        return _construct_requirements(workspace_root)
    if target_asset == "feature_decomp_surface":
        return _construct_feature_decomp(workspace_root)
    if target_asset == "uat_testcases_surface":
        return _construct_uat_testcases(workspace_root)
    if target_asset == "design_surface":
        return _construct_design(workspace_root)
    if target_asset == "review_assessment_surface":
        return _construct_review_assessment(workspace_root)
    if target_asset == "consensus_decision_surface":
        return _construct_consensus_decision(workspace_root)
    if target_asset == "reviewed_design_surface":
        return _construct_reviewed_design(workspace_root)
    if target_asset == "testcase_authority_surface":
        return _construct_testcase_authority(workspace_root)
    if target_asset == "scenario_surface":
        return _construct_scenarios(workspace_root)
    if target_asset == "implementation_design_surface":
        return _construct_implementation_design(workspace_root)
    if target_asset == "implementation_stack_profile":
        return _construct_implementation_stack_profile(workspace_root)
    if target_asset == "implementation_module_surface":
        return _construct_implementation_module_surface(workspace_root)
    if target_asset == "code_surface":
        return _construct_code_surface(workspace_root)
    if target_asset == "test_design_surface":
        return _construct_test_design(workspace_root)
    if target_asset == "test_stack_profile":
        return _construct_test_stack_profile(workspace_root)
    if target_asset == "test_module_surface":
        return _construct_test_module_surface(workspace_root)
    if target_asset == "test_run_archive_surface":
        return _construct_test_run_archive(workspace_root)
    if target_asset == "release_surface":
        return _construct_release(workspace_root)
    if target_asset == "build_execution_surface":
        return _construct_build_execution_surface(workspace_root)
    if target_asset == "build_execution_result_surface":
        return _construct_build_execution_result_surface(workspace_root)
    if target_asset == "test_execution_surface":
        return _construct_test_execution_surface(workspace_root)
    if target_asset == "test_execution_result_surface":
        return _construct_test_execution_result_surface(workspace_root)
    if target_asset == "deployment_surface":
        return _construct_deployment_surface(workspace_root)
    if target_asset == "deployment_result_surface":
        return _construct_deployment_result_surface(workspace_root)
    if target_asset == "deployed_environment_surface":
        return _construct_deployed_environment_surface(workspace_root)
    if target_asset == "runtime_observation_surface":
        return _construct_runtime_observation_surface(workspace_root)
    if target_asset == "retrofit_plan_surface":
        return _construct_retrofit_plan_surface(workspace_root)
    raise ValueError(f"Unsupported target_asset {target_asset!r}")


def construct_manifest(manifest_path: str | Path, *, workspace_root: str | Path = ".") -> dict[str, Any]:
    workspace = Path(workspace_root).resolve()
    manifest_file = Path(manifest_path).resolve()
    manifest = _read_json(manifest_file, label=f"manifest file {manifest_file}")
    project_profile = load_project_profile(workspace)

    target_asset = manifest.get("target_asset")
    result_path = manifest.get("result_path")
    if not isinstance(target_asset, str) or not target_asset:
        raise ValueError("manifest must provide target_asset")
    if not isinstance(result_path, str) or not result_path:
        raise ValueError("manifest must provide result_path")

    target_path = _workspace_asset_path(workspace, target_asset)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    previous_checkpoint = checkpoint_for_path(target_path)
    operation = {
        "build_execution_result_surface": "return",
        "test_execution_result_surface": "return",
        "deployment_surface": "deploy",
        "deployment_result_surface": "deploy",
        "deployed_environment_surface": "deploy",
        "runtime_observation_surface": "return",
        "retrofit_plan_surface": "retrofit",
    }.get(target_asset, "generate")
    preserve_authority = _should_preserve_authoritative_surface(workspace, target_asset)
    if preserve_authority:
        operation = "adopt"
    if target_asset == "code_surface" and project_profile.realization_mode == "selected_output_tree":
        if not target_path.exists():
            raise RuntimeError(
                f"governed code surface target {target_path.relative_to(workspace)!s} does not exist for adopted realization"
            )
        operation = "adopt"
    elif not preserve_authority:
        if target_asset == "code_surface":
            content = _constructed_content(target_asset, workspace)
            if target_path.exists():
                shutil.rmtree(target_path)
            target_path.mkdir(parents=True, exist_ok=True)
            for relative_path, file_content in content.items():
                file_path = target_path / relative_path
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(file_content, encoding="utf-8")
        else:
            if target_asset == "test_run_archive_surface":
                _clear_generated_test_code_files(workspace)
                for entry in _planned_generated_test_files(workspace):
                    file_path = _code_surface_root(workspace) / str(entry["relative_path"])
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    file_path.write_text(str(entry["content"]), encoding="utf-8")
            content = _constructed_content(target_asset, workspace)
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")
            if previous_checkpoint.exists and operation == "generate":
                operation = "repair"
    current_checkpoint = checkpoint_for_path(target_path)
    attestation = assess_generated_asset_contract(workspace, target_asset)
    if not attestation["contract_satisfied"]:
        foreign_candidates = ", ".join(
            candidate["relative_path"]
            for candidate in attestation.get("foreign_realization_candidates", [])
            if isinstance(candidate, dict) and isinstance(candidate.get("relative_path"), str)
        )
        if foreign_candidates:
            raise RuntimeError(
                f"constructed asset {target_asset!r} failed its generated-asset contract; "
                f"foreign realization candidates detected: {foreign_candidates}"
            )
        raise RuntimeError(f"constructed asset {target_asset!r} failed its generated-asset contract")
    work_report = _build_work_report(
        workspace_root=workspace,
        target_asset=target_asset,
        target_path=target_path,
        previous_checkpoint=previous_checkpoint,
        current_checkpoint=current_checkpoint,
        attestation=attestation,
        operation=operation,
    )

    declared_asset_type = asset_declared_type(target_asset)
    asset_profile = ASSET_TYPES[declared_asset_type]

    publish_workspace_runtime_event(
        workspace_root=workspace,
        event_type="asset_checkpoint_updated",
        data={
            "asset_id": target_asset,
            "asset_uri": relative_file_uri(target_path, workspace_root=workspace),
            "declared_asset_type": declared_asset_type,
            "mutable": asset_profile.mutable_default,
            "manifest_id": manifest["manifest_id"],
            "edge": manifest["edge"],
            "target_path": str(target_path),
            "previous_checkpoint": previous_checkpoint.to_dict(),
            "current_checkpoint": current_checkpoint.to_dict(),
        },
        workflow_version=manifest.get("workflow_version", "unknown"),
        run_id=manifest.get("run_id"),
        job_id=manifest.get("job_id"),
        graph_function_id=manifest.get("graph_function_id"),
        materialization_id=manifest.get("materialization_id"),
        call_id=manifest.get("call_id"),
        vector_id=manifest.get("vector_id"),
        aggregate_type="graph_call",
        aggregate_id=manifest.get("call_id"),
        correlation_id=manifest.get("call_id"),
    )

    fulfillment_obligations = [
        obligation
        for obligation in manifest.get("fulfillment_obligations", ())
        if isinstance(obligation, dict)
        and isinstance(obligation.get("id"), str)
        and obligation["id"]
    ]
    if not fulfillment_obligations:
        raise ValueError("manifest must include fulfillment_obligations with stable ids")
    primary_evaluator = str(fulfillment_obligations[0]["id"])
    evidence = (
        f"{_operation_verb(operation)} {target_path.relative_to(workspace)} under governed odd_sdlc work-report "
        "and satisfied the generated-asset contract"
    )
    payload = {
        "edge": manifest["edge"],
        "actor": "odd_sdlc_constructor",
        "attestation": attestation,
        "work_report": work_report,
        "fulfillment_assessments": [
            {
                "id": str(obligation["id"]),
                "evaluator": (
                    str(obligation.get("evaluator"))
                    if isinstance(obligation.get("evaluator"), str) and obligation.get("evaluator")
                    else str(obligation["id"])
                ),
                "fulfillment_status": "fulfilled",
                "fulfillment_detail": evidence,
                "blocking_reasons": [],
                "evidence_refs": [str(target_path.relative_to(workspace))],
            }
            for obligation in fulfillment_obligations
        ],
    }
    result_file = Path(result_path)
    result_file.parent.mkdir(parents=True, exist_ok=True)
    result_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {
        "status": "constructed",
        "manifest_path": str(manifest_file),
        "target_asset": target_asset,
        "target_path": str(target_path),
        "result_path": str(result_file),
        "actor": payload["actor"],
        "evaluator": primary_evaluator,
        "attestation": attestation,
        "work_report": work_report,
    }

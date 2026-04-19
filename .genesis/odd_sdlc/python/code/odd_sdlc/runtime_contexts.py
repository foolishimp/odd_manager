"""Published runtime context sidecars for odd_sdlc."""
from __future__ import annotations

from pathlib import Path


STATEFUL_ITERATOR_CONTROL_CONTEXT_PATH = Path(
    ".ai-workspace/runtime/odd_sdlc-stateful-builder-control-frame.md"
)
REALIZED_TEST_SOURCE_CONTEXT_PATH = Path(
    ".ai-workspace/runtime/odd_sdlc-realized-test-source-obligation.md"
)
REALIZATION_DEEPENING_CONTEXT_PATH = Path(
    ".ai-workspace/runtime/odd_sdlc-realization-deepening-control-frame.md"
)


def publish_runtime_contexts(workspace_root: Path) -> list[dict[str, str]]:
    package_python_root = Path(__file__).resolve().parents[2]
    published_contexts = (
        (
            package_python_root / "design" / "fp" / "STATEFUL_ITERATOR_CONTROL_FRAME.md",
            workspace_root / STATEFUL_ITERATOR_CONTROL_CONTEXT_PATH,
            "stateful_builder_control_frame",
        ),
        (
            package_python_root / "design" / "fp" / "REALIZED_TEST_SOURCE_OBLIGATION.md",
            workspace_root / REALIZED_TEST_SOURCE_CONTEXT_PATH,
            "realized_test_source_obligation",
        ),
        (
            package_python_root / "design" / "fp" / "REALIZATION_DEEPENING_CONTROL_FRAME.md",
            workspace_root / REALIZATION_DEEPENING_CONTEXT_PATH,
            "realization_deepening_control_frame",
        ),
    )
    actions: list[dict[str, str]] = []
    for source_path, target_path, label in published_contexts:
        content = source_path.read_text(encoding="utf-8")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        existing = target_path.read_text(encoding="utf-8") if target_path.exists() else None
        if existing == content:
            continue
        target_path.write_text(content, encoding="utf-8")
        action_kind = f"{'update' if existing is not None else 'create'}_{label}"
        actions.append(
            {
                "kind": action_kind,
                "path": target_path.as_posix(),
                "detail": f"published {label.replace('_', ' ')} runtime context for odd_sdlc execution",
            }
        )
    return actions

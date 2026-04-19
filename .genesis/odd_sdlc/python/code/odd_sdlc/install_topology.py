"""Shared installed-topology constants for odd_sdlc runtime consumers."""
from __future__ import annotations

from pathlib import Path


INSTALLED_PRODUCT_ROOT_RELATIVE = Path(".genesis") / "odd_sdlc"
INSTALLED_PRODUCT_PYTHON_ROOT_RELATIVE = INSTALLED_PRODUCT_ROOT_RELATIVE / "python"
INSTALLED_PRODUCT_CODE_ROOT_RELATIVE = INSTALLED_PRODUCT_PYTHON_ROOT_RELATIVE / "code"
INSTALLED_PRODUCT_DESIGN_ROOT_RELATIVE = INSTALLED_PRODUCT_PYTHON_ROOT_RELATIVE / "design"
INSTALLED_PRODUCT_RELEASE_ROOT_RELATIVE = INSTALLED_PRODUCT_ROOT_RELATIVE / "release"
INSTALLED_RUNTIME_CONTRACT_RELATIVE = INSTALLED_PRODUCT_RELEASE_ROOT_RELATIVE / "genesis.yml"


def installed_product_root(workspace_root: Path) -> Path:
    return workspace_root / INSTALLED_PRODUCT_ROOT_RELATIVE


def installed_product_code_root(workspace_root: Path) -> Path:
    return workspace_root / INSTALLED_PRODUCT_CODE_ROOT_RELATIVE


def installed_product_design_root(workspace_root: Path) -> Path:
    return workspace_root / INSTALLED_PRODUCT_DESIGN_ROOT_RELATIVE


def installed_product_release_root(workspace_root: Path) -> Path:
    return workspace_root / INSTALLED_PRODUCT_RELEASE_ROOT_RELATIVE


def installed_runtime_contract_path(workspace_root: Path) -> Path:
    return workspace_root / INSTALLED_RUNTIME_CONTRACT_RELATIVE

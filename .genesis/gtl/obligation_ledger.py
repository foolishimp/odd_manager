# Implements: REQ-L-GTL3-GRAPHVECTOR
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from .graph import Attrs


OBLIGATION_LEDGER_DECLARATION_KEY = "obligation_ledger"
OBLIGATION_LEDGER_STATIC_DECLARATION_FAMILY = "static_obligations"
OBLIGATION_LEDGER_ADAPTER_DECLARATION_FAMILY = "adapter_driven"
OBLIGATION_LEDGER_CERTIFICATION_SCOPE_PER_OBLIGATION = "per_obligation"
OBLIGATION_LEDGER_CERTIFICATION_SCOPE_EDGE = "edge"


def _require_non_empty_string(value: Any, *, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    return value


def _coerce_string_list(value: Any, *, field: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, tuple):
        items = list(value)
    elif isinstance(value, list):
        items = value
    elif isinstance(value, Iterable) and not isinstance(value, (str, bytes, Mapping)):
        items = list(value)
    else:
        raise ValueError(f"{field} must be a list of strings")
    result: list[str] = []
    for index, entry in enumerate(items):
        if not isinstance(entry, str) or not entry.strip():
            raise ValueError(f"{field}[{index}] must be a non-empty string")
        result.append(entry)
    return result


def _optional_non_empty_string(value: Any, *, field: str) -> str | None:
    if value is None:
        return None
    return _require_non_empty_string(value, field=field)


def declared_fulfillment_obligation(
    obligation_id: str,
    *,
    evaluator: str,
    statement: str = "",
    source_kind: str = "declared_obligation_ledger",
    source_refs: Iterable[str] = (),
) -> dict[str, Any]:
    return {
        "id": _require_non_empty_string(obligation_id, field="obligation.id"),
        "evaluator": _require_non_empty_string(evaluator, field="obligation.evaluator"),
        "statement": statement if isinstance(statement, str) else "",
        "source_kind": _require_non_empty_string(source_kind, field="obligation.source_kind"),
        "source_refs": _coerce_string_list(list(source_refs), field="obligation.source_refs"),
    }


def validate_declared_fulfillment_obligations(
    obligations: Iterable[Mapping[str, Any]],
    *,
    field: str,
) -> None:
    seen_ids: dict[str, int] = {}
    seen_evaluators: dict[str, int] = {}
    for index, obligation in enumerate(obligations):
        obligation_id = _require_non_empty_string(
            obligation.get("id"),
            field=f"{field}[{index}].id",
        )
        evaluator = _require_non_empty_string(
            obligation.get("evaluator"),
            field=f"{field}[{index}].evaluator",
        )
        prior_id_index = seen_ids.get(obligation_id)
        if prior_id_index is not None:
            raise ValueError(
                f"{field}[{index}].id duplicates {field}[{prior_id_index}].id: {obligation_id!r}"
            )
        prior_evaluator_index = seen_evaluators.get(evaluator)
        if prior_evaluator_index is not None:
            raise ValueError(
                f"{field}[{index}].evaluator duplicates "
                f"{field}[{prior_evaluator_index}].evaluator: {evaluator!r}"
            )
        seen_ids[obligation_id] = index
        seen_evaluators[evaluator] = index


def coerce_obligation_ledger_declaration(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, Attrs):
        raw = value.to_dict()
    elif isinstance(value, Mapping):
        raw = dict(value)
    else:
        raise ValueError("obligation_ledger declaration must be an object")

    obligations_value = raw.get("obligations")
    declaration_family_hint = raw.get("declaration_family")
    signal_key = _optional_non_empty_string(
        raw.get("signal_key"),
        field="obligation_ledger.signal_key",
    )
    adapter_ref = _optional_non_empty_string(
        raw.get("adapter_ref"),
        field="obligation_ledger.adapter_ref",
    )
    if declaration_family_hint is not None and declaration_family_hint not in {
        OBLIGATION_LEDGER_STATIC_DECLARATION_FAMILY,
        OBLIGATION_LEDGER_ADAPTER_DECLARATION_FAMILY,
    }:
        raise ValueError(
            "obligation_ledger.declaration_family must be one of "
            f"{[OBLIGATION_LEDGER_ADAPTER_DECLARATION_FAMILY, OBLIGATION_LEDGER_STATIC_DECLARATION_FAMILY]}"
        )
    has_obligations = obligations_value is not None
    if declaration_family_hint == OBLIGATION_LEDGER_ADAPTER_DECLARATION_FAMILY:
        if obligations_value not in (None, [], ()):
            raise ValueError(
                "adapter-driven obligation_ledger declarations must not publish a static obligations list"
            )
        has_obligations = False
    if has_obligations and (signal_key is not None or adapter_ref is not None):
        raise ValueError(
            "obligation_ledger must declare either static obligations or an adapter-driven family, not both"
        )

    obligations: list[dict[str, Any]] = []
    declaration_family = OBLIGATION_LEDGER_STATIC_DECLARATION_FAMILY
    certification_scope = raw.get("certification_scope")
    if has_obligations:
        if isinstance(obligations_value, tuple):
            obligation_items = list(obligations_value)
        elif isinstance(obligations_value, list):
            obligation_items = obligations_value
        else:
            raise ValueError("obligation_ledger.obligations must be a list")
        for index, entry in enumerate(obligation_items):
            if isinstance(entry, Attrs):
                entry_map: Mapping[str, Any] = entry.to_dict()
            elif isinstance(entry, Mapping):
                entry_map = entry
            else:
                raise ValueError(f"obligation_ledger.obligations[{index}] must be an object")
            obligations.append(
                declared_fulfillment_obligation(
                    entry_map.get("id"),
                    evaluator=entry_map.get("evaluator"),
                    statement=entry_map.get("statement", ""),
                    source_kind=entry_map.get("source_kind", "declared_obligation_ledger"),
                    source_refs=entry_map.get("source_refs", ()),
                )
            )
        validate_declared_fulfillment_obligations(
            obligations,
            field="obligation_ledger.obligations",
        )
        if certification_scope is None:
            certification_scope = OBLIGATION_LEDGER_CERTIFICATION_SCOPE_PER_OBLIGATION
    else:
        declaration_family = OBLIGATION_LEDGER_ADAPTER_DECLARATION_FAMILY
        if adapter_ref is None:
            raise ValueError(
                "obligation_ledger.adapter_ref must be a non-empty string for adapter-driven declarations"
            )
        if signal_key is None:
            raise ValueError(
                "obligation_ledger.signal_key must be a non-empty string for adapter-driven declarations"
            )
        if certification_scope is None:
            certification_scope = OBLIGATION_LEDGER_CERTIFICATION_SCOPE_EDGE
    certification_scope = _require_non_empty_string(
        certification_scope,
        field="obligation_ledger.certification_scope",
    )
    if certification_scope not in {
        OBLIGATION_LEDGER_CERTIFICATION_SCOPE_PER_OBLIGATION,
        OBLIGATION_LEDGER_CERTIFICATION_SCOPE_EDGE,
    }:
        raise ValueError(
            "obligation_ledger.certification_scope must be one of "
            f"{[OBLIGATION_LEDGER_CERTIFICATION_SCOPE_EDGE, OBLIGATION_LEDGER_CERTIFICATION_SCOPE_PER_OBLIGATION]}"
        )

    result = {
        "declaration_family": declaration_family,
        "obligation_source_kind": _require_non_empty_string(
            raw.get("obligation_source_kind", "declared_obligation_ledger"),
            field="obligation_ledger.obligation_source_kind",
        ),
        "obligation_source_ref": _require_non_empty_string(
            raw.get("obligation_source_ref"),
            field="obligation_ledger.obligation_source_ref",
        ),
        "obligation_kind": _require_non_empty_string(
            raw.get("obligation_kind"),
            field="obligation_ledger.obligation_kind",
        ),
        "carry_rule": _require_non_empty_string(
            raw.get("carry_rule"),
            field="obligation_ledger.carry_rule",
        ),
        "fulfillment_rule": _require_non_empty_string(
            raw.get("fulfillment_rule"),
            field="obligation_ledger.fulfillment_rule",
        ),
        "evidence_policy": _require_non_empty_string(
            raw.get("evidence_policy"),
            field="obligation_ledger.evidence_policy",
        ),
        "obligation_source_admission_basis": _require_non_empty_string(
            raw.get("obligation_source_admission_basis", "manifest"),
            field="obligation_ledger.obligation_source_admission_basis",
        ),
        "derivation_rule": _require_non_empty_string(
            raw.get("derivation_rule", "identity"),
            field="obligation_ledger.derivation_rule",
        ),
        "certification_scope": certification_scope,
        "obligations": obligations,
    }
    if declaration_family == OBLIGATION_LEDGER_ADAPTER_DECLARATION_FAMILY:
        result["signal_key"] = signal_key
        result["adapter_ref"] = adapter_ref
    return result


def obligation_ledger_declarations(
    *,
    obligation_source_ref: str,
    obligation_kind: str,
    carry_rule: str,
    fulfillment_rule: str,
    evidence_policy: str,
    obligations: Iterable[Mapping[str, Any]],
    declarations: Attrs | Mapping[str, Any] | None = None,
    obligation_source_kind: str = "declared_obligation_ledger",
    obligation_source_admission_basis: str = "manifest",
    derivation_rule: str = "identity",
    certification_scope: str = OBLIGATION_LEDGER_CERTIFICATION_SCOPE_PER_OBLIGATION,
) -> Attrs:
    merged = Attrs.coerce(declarations or {}).to_dict()
    merged[OBLIGATION_LEDGER_DECLARATION_KEY] = coerce_obligation_ledger_declaration(
        {
            "obligation_source_kind": obligation_source_kind,
            "obligation_source_ref": obligation_source_ref,
            "obligation_kind": obligation_kind,
            "carry_rule": carry_rule,
            "fulfillment_rule": fulfillment_rule,
            "evidence_policy": evidence_policy,
            "obligation_source_admission_basis": obligation_source_admission_basis,
            "derivation_rule": derivation_rule,
            "certification_scope": certification_scope,
            "obligations": [dict(entry) for entry in obligations],
        }
    )
    return Attrs.coerce(merged)

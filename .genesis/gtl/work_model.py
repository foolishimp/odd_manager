# Implements: REQ-L-GTL3-HOOKS
# Implements: REQ-L-GTL3-JOB
# Implements: REQ-L-GTL3-ROLE
# Implements: REQ-L-GTL3-IDENTITY
"""
gtl.work_model — Semantic work declarations.

Job is a durable semantic work contract. Role is a semantic capability class.
ContractRef is the indirection from a job to the GTL contract it binds.

These are GTL language types, not ABG runtime types.
No external dependencies. Dataclasses + stdlib only.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from gtl.graph import Attrs, _mint_id


# ── ContractRef ──────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ContractRef:
    """
    Indirection from a Job to the GTL contract it binds.

    kind: the contract type.
    target_id: the .id of the referenced GTL declaration.
    """
    kind: str
    target_id: str

    def __post_init__(self) -> None:
        if self.kind != "graph_function":
            raise ValueError(
                f"ContractRef.kind must be 'graph_function' for GTL 3 semantic work, got {self.kind!r}"
            )
        if not self.target_id:
            raise ValueError("ContractRef.target_id must be non-empty")


# ── Role ─────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Role:
    """
    Semantic capability class required to perform, supervise, or approve work.

    Language-owned. Distinct from Worker (engine-owned concrete identity).
    """
    name: str
    tags: tuple[str, ...] = ()
    policy_hooks: Attrs = field(default_factory=Attrs)
    id: str = field(default_factory=_mint_id, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "policy_hooks", Attrs.coerce(self.policy_hooks))


# ── Job ──────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Job:
    """
    Durable semantic work contract — persists across runs.

    A job references one or more GTL contracts via ContractRef.
    """
    name: str
    contracts: tuple[ContractRef, ...] = ()
    roles: tuple[Role, ...] = ()
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "contracts", tuple(self.contracts))
        object.__setattr__(self, "roles", tuple(self.roles))

        seen_contracts: set[tuple[str, str]] = set()
        for contract in self.contracts:
            signature = (contract.kind, contract.target_id)
            if signature in seen_contracts:
                raise ValueError(
                    f"Job({self.name!r}) declares duplicate contract ref {contract.kind}:{contract.target_id}"
                )
            seen_contracts.add(signature)

        seen_role_names: set[str] = set()
        seen_role_ids: set[str] = set()
        for role in self.roles:
            if role.name in seen_role_names or role.id in seen_role_ids:
                raise ValueError(
                    f"Job({self.name!r}) declares duplicate role requirement {role.name!r}"
                )
            seen_role_names.add(role.name)
            seen_role_ids.add(role.id)

# Implements: REQ-L-GTL3-OPERATOR
# Implements: REQ-L-GTL3-EVALUATOR
# Implements: REQ-L-GTL3-RULE
"""
gtl.operator_model — Effect and convergence declarations.

Domain model: Regime base class, frozen Operator/Evaluator/Rule with
the accepted field shapes from the constitutional design.

No external dependencies. Dataclasses + stdlib only.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from gtl.graph import Attrs


# ── Regime hierarchy ──────────────────────────────────────────────────────

class Regime:
    """Base class for evaluation/operator regimes."""

class F_D(Regime):
    """Deterministic — zero ambiguity, pass/fail."""

class F_P(Regime):
    """Probabilistic — agent/LLM, bounded ambiguity."""

class F_H(Regime):
    """Human — persistent ambiguity, judgment required."""


# ── Operator ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Operator:
    """
    Typed effectful action declaration.

    Operators perform work. Realization is plugin-dependent.
    """
    name: str
    regime: type[Regime] = F_D
    binding: str = ""            # plugin URI
    tags: tuple[str, ...] = ()

    def __post_init__(self):
        if not issubclass(self.regime, Regime):
            raise TypeError(f"Operator.regime must be a Regime subclass, got {self.regime!r}")


# ── Evaluator ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Evaluator:
    """
    Typed convergence / attestation declaration.

    Evaluators check or attest convergence. Realization is plugin-dependent.
    """
    name: str
    regime: type[Regime] = F_D
    description: str = ""        # human-readable convergence contract (NODE-006 pattern)
    binding: str = ""            # plugin URI
    tags: tuple[str, ...] = ()

    def __post_init__(self):
        if not issubclass(self.regime, Regime):
            raise TypeError(f"Evaluator.regime must be a Regime subclass, got {self.regime!r}")


# ── Rule ─────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Rule:
    """
    Declarative constraint — what must hold.

    Declarative constraint type (consensus, coverage, policy,
    type-consistency, and similar). Rules are passive.
    """
    name: str
    kind: str = "policy"         # "consensus", "coverage", "policy", etc.
    config: Attrs = field(default_factory=Attrs)
    tags: tuple[str, ...] = ()

    def __post_init__(self):
        object.__setattr__(self, "config", Attrs.coerce(self.config))

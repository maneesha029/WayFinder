"""Domain exceptions for the Wayfinder engine (Owner: P3)."""
from __future__ import annotations


class Infeasible(Exception):
    """Raised by the planner/swap solver when hard constraints cannot be satisfied."""

    def __init__(
        self,
        message: str,
        suggestion: str = "",
        binding_constraint: str = "",
    ) -> None:
        super().__init__(message)
        self.message = message
        self.suggestion = suggestion
        self.binding_constraint = binding_constraint

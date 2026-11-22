"""Pure Group coordination: preference merge, vote tally, exact cost split, regroup & audience (Owner: P3)."""
from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from datetime import datetime, timedelta

from contracts.models import (
    CostSplit,
    GroupMember,
    GroupPreference,
    MergedPreferences,
    Place,
    Plan,
    PrefConflict,
    RegroupSuggestion,
    Signal,
    SplitReport,
    TripIntent,
    VoteRequestRow,
    VoteTally,
)
from engine import config, geo


def merge_preferences(
    base: TripIntent,
    prefs: list[GroupPreference],
    members: list[GroupMember],
) -> MergedPreferences:
    """Merge group members' preferences deterministically and report explicit conflicts."""
    conflicts: list[PrefConflict] = []
    member_count = max(1, len(members))

    # 1. Budget: minimum per-person budget * member_count
    budgets = {p.user_id: p.budget_inr for p in prefs if p.budget_inr is not None}
    merged_budget = base.budget_inr
    if budgets:
        min_pp = min(budgets.values())
        merged_budget = min_pp * member_count
        if len(set(budgets.values())) > 1:
            conflicts.append(
                PrefConflict(
                    field="budget_inr",
                    values=budgets,
                    resolution=f"Used minimum per-person budget ₹{min_pp:,} × {member_count} = ₹{merged_budget:,} total.",
                )
            )

    # 2. Constraints: hard union
    c_by_user = {p.user_id: p.constraints for p in prefs if p.constraints}
    all_constraints = list(dict.fromkeys([c for c in base.constraints] + [c for p in prefs for c in p.constraints]))
    if len(c_by_user) > 1 or (c_by_user and len({tuple(sorted(v)) for v in c_by_user.values()}) > 1):
        conflicts.append(
            PrefConflict(
                field="constraints",
                values=c_by_user,
                resolution=f"Combined all hard constraints (union): {', '.join(all_constraints)}.",
            )
        )

    # 3. Interests: ranked by member count, ties alternated across members
    interest_counts: Counter[str] = Counter()
    for p in prefs:
        for intr in dict.fromkeys(i.strip().lower() for i in p.interests if i.strip()):
            interest_counts[intr] += 1
    for intr in base.interests:
        norm = intr.strip().lower()
        if norm and norm not in interest_counts:
            interest_counts[norm] = 1

    # Round-robin order on ties
    interleaved: list[str] = []
    max_len = max((len(p.interests) for p in prefs), default=0)
    for idx in range(max_len):
        for p in prefs:
            if idx < len(p.interests):
                val = p.interests[idx].strip().lower()
                if val and val not in interleaved:
                    interleaved.append(val)
    for b_i in base.interests:
        if b_i.strip().lower() not in interleaved:
            interleaved.append(b_i.strip().lower())

    tie_pos = {val: pos for pos, val in enumerate(interleaved)}
    merged_interests = sorted(
        interest_counts.keys(),
        key=lambda k: (-interest_counts[k], tie_pos.get(k, 999), k),
    )
    i_by_user = {p.user_id: p.interests for p in prefs if p.interests}
    if len({tuple(sorted(v)) for v in i_by_user.values()}) > 1:
        conflicts.append(
            PrefConflict(
                field="interests",
                values=i_by_user,
                resolution=f"Ranked interests by shared group demand: {', '.join(merged_interests)}.",
            )
        )

    # 4. Pace: most conservative (RELAXED < BALANCED < PACKED)
    pace_rank = {"RELAXED": 0, "BALANCED": 1, "PACKED": 2}
    paces = {p.user_id: p.pace for p in prefs if p.pace is not None}
    merged_pace = base.pace or "BALANCED"
    if paces:
        merged_pace = min(paces.values(), key=lambda pv: pace_rank.get(pv, 1))
        if len(set(paces.values())) > 1:
            conflicts.append(
                PrefConflict(
                    field="pace",
                    values=paces,
                    resolution=f"Selected most conservative pace: {merged_pace}.",
                )
            )

    # 5. Must-dos: union
    must_by_user = {p.user_id: p.must_dos for p in prefs if p.must_dos}
    merged_musts = list(dict.fromkeys(list(base.must_dos) + [m_i for p in prefs for m_i in p.must_dos]))
    if len({tuple(sorted(v)) for v in must_by_user.values()}) > 1:
        conflicts.append(
            PrefConflict(
                field="must_dos",
                values=must_by_user,
                resolution=f"Included union of member must-dos: {', '.join(merged_musts)}.",
            )
        )

    merged_intent = base.model_copy(
        update={
            "travellers": member_count if base.travellers is None else max(base.travellers, member_count),
            "budget_inr": merged_budget,
            "constraints": all_constraints,
            "interests": merged_interests,
            "pace": merged_pace,
            "must_dos": merged_musts,
        }
    )
    return MergedPreferences(merged_intent=merged_intent, conflicts=conflicts)


def tally_votes(
    members: list[GroupMember],
    votes: list[VoteRequestRow],
) -> VoteTally:
    """Count votes with majority rule and owner tie-break."""
    trip_id = votes[0].plan_id if votes else "trip_group"
    vote_map: dict[str, str] = {}
    for v in votes:
        vote_map[v.user_id] = v.vote

    counts = {"A": 0, "B": 0, "NEITHER": 0}
    for val in vote_map.values():
        if val in counts:
            counts[val] += 1

    n_members = max(1, len(members))
    majority = n_members // 2 + 1
    owner_id = next((m.user_id for m in members if m.role == "OWNER"), None)
    owner_vote = vote_map.get(owner_id) if owner_id else None

    leader: str | None = None
    decided = False

    if counts["A"] >= majority:
        leader = "A"
        decided = True
    elif counts["B"] >= majority:
        leader = "B"
        decided = True
    elif counts["A"] > counts["B"]:
        leader = "A"
    elif counts["B"] > counts["A"]:
        leader = "B"
    elif counts["A"] == counts["B"] and counts["A"] > 0 and owner_vote in ("A", "B"):
        leader = owner_vote
        if len(vote_map) >= n_members:
            decided = True

    if len(vote_map) >= n_members and leader in ("A", "B"):
        decided = True

    return VoteTally(
        trip_id=trip_id,
        votes=vote_map,
        counts=counts,
        leader="A" if leader == "A" else ("B" if leader == "B" else None),
        decided=decided,
    )


def split_cost(
    plan: Plan,
    members: list[GroupMember],
    prefs: list[GroupPreference],
    method: str = "EQUAL",
) -> SplitReport:
    """Split plan.total_cost_inr across members summing EXACTLY to total_inr via largest-remainder rounding."""
    total = plan.total_cost_inr
    ordered = sorted(members, key=lambda m: m.user_id)
    n = len(ordered)
    if n == 0:
        return SplitReport(
            trip_id=plan.trip_id,
            method="BY_BUDGET" if method == "BY_BUDGET" else "EQUAL",
            total_inr=total,
            shares=[],
        )

    if method == "BY_BUDGET":
        pref_map = {p.user_id: p.budget_inr for p in prefs if p.budget_inr and p.budget_inr > 0}
        avg_budget = sum(pref_map.values()) / len(pref_map) if pref_map else 1.0
        weights = [float(pref_map.get(m.user_id, avg_budget)) for m in ordered]
    else:
        weights = [1.0] * n

    w_sum = sum(weights) or float(n)
    exact = [total * (w / w_sum) for w in weights]
    floored = [int(x) for x in exact]
    remainder = total - sum(floored)

    # Distribute remaining rupees by largest fractional remainder (tie-break by sorted user_id order)
    indices = sorted(
        range(n),
        key=lambda i: (-(exact[i] - floored[i]), ordered[i].user_id),
    )
    for idx in indices[:remainder]:
        floored[idx] += 1

    shares = [
        CostSplit(member_id=ordered[i].user_id, name=ordered[i].name, share_inr=floored[i], item_ids=[])
        for i in range(n)
    ]
    return SplitReport(
        trip_id=plan.trip_id,
        method="BY_BUDGET" if method == "BY_BUDGET" else "EQUAL",
        total_inr=total,
        shares=shares,
    )


def regroup(
    plan: Plan,
    positions: dict[str, Place],
    now: datetime,
    eta_fn: Callable[[Place, Place, str], int] | None = None,
) -> RegroupSuggestion | None:
    """Suggest a regroup point if the ETA spread between positioned members exceeds 20 min."""
    if len(positions) < 2:
        return None

    upcoming = [
        it for it in sorted(plan.items, key=lambda x: (x.start, x.id))
        if it.place is not None and it.end >= now
    ]
    if not upcoming:
        stops = [it for it in plan.items if it.place is not None]
        if not stops:
            return None
        target = stops[-1]
    else:
        target = upcoming[0]

    assert target.place is not None
    etas: dict[str, int] = {}
    for uid, pos in sorted(positions.items()):
        etas[uid] = geo.travel_min(pos, target.place, "DRIVE", eta_fn=eta_fn)

    min_eta = min(etas.values())
    max_eta = max(etas.values())
    if max_eta - min_eta <= config.REGROUP_GAP_MIN:
        return None

    affected = [uid for uid, e in etas.items() if e - min_eta > config.REGROUP_GAP_MIN]
    meet_by = max(
        now + timedelta(minutes=max_eta + 10),
        target.start - timedelta(minutes=15),
    )
    return RegroupSuggestion(
        reason=f"ETA spread is {max_eta - min_eta} min (> {config.REGROUP_GAP_MIN} min) for {target.title}.",
        point=target.place,
        meet_by=meet_by,
        member_etas_min=etas,
        affected_user_ids=affected,
    )


def affected_members(
    plan: Plan,
    signal: Signal,
    members: list[GroupMember],
    item_members: dict[str, list[str]] | None = None,
) -> list[str]:
    """Return user_ids affected by a signal; owner always included for severity >= 2."""
    owner_ids = [m.user_id for m in members if m.role == "OWNER"]
    affected: list[str] = []

    sig_user = signal.payload.get("user_id")
    if isinstance(sig_user, str) and sig_user:
        affected.append(sig_user)

    if signal.item_id and item_members and signal.item_id in item_members:
        for uid in item_members[signal.item_id]:
            if uid not in affected:
                affected.append(uid)

    if not affected:
        affected = [m.user_id for m in members]
    elif signal.severity >= 2:
        for oid in owner_ids:
            if oid not in affected:
                affected.append(oid)

    return affected

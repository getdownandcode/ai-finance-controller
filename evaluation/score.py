"""Ground-truth evaluation: link-based precision / recall / F1 + match rates."""
from __future__ import annotations

from collections import defaultdict
from itertools import combinations
from pathlib import Path

import pandas as pd


def load_ground_truth(path: str | Path | None) -> dict[str, str] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    try:
        df = pd.read_csv(p)
        cols = {str(c).lower().strip(): c for c in df.columns}
        rec_col = cols.get("record_id", cols.get("id"))
        grp_col = cols.get("group_id", cols.get("group"))
        if not rec_col or not grp_col:
            return None
        return {str(r[rec_col]).strip(): str(r[grp_col]).strip() for _, r in df.iterrows()}
    except Exception:
        return None


def _pairs(members: set) -> set:
    return set(combinations(sorted(members), 2))


def evaluate(state, gt_map: dict[str, str] | None, records: dict) -> dict:
    matched_groups = [g for g in state.final_groups() if len(g) >= 2]
    total = len(records)
    matched_records = len(state.matched_ids())
    raw_rate = matched_records / total if total else 0.0

    method_counts = {"exact": 0, "fuzzy": 0, "llm": 0}
    for g in matched_groups:
        m = state.group_method_of(next(iter(g)))
        method_counts[m] += len(g)

    # Base operational metrics without ground truth
    metrics = {
        "has_ground_truth": gt_map is not None,
        "total_records": total,
        "matched_records": matched_records,
        "raw_match_rate": raw_rate,
        "validated_match_rate": None,
        "correctly_matched_records": None,
        "method_counts": method_counts,
        "tp_links": 0,
        "fp_links": 0,
        "fn_links": 0,
        "precision": None,
        "recall": None,
        "f1": None,
        "exceptions": len(state.exceptions)
    }

    if gt_map is None:
        return metrics

    # Link-level precision / recall / F1 against ground truth
    pred_pairs: set = set()
    for g in matched_groups:
        pred_pairs |= _pairs(g)

    gt_groups: dict[str, set] = defaultdict(set)
    for rid, gid in gt_map.items():
        gt_groups[gid].add(rid)
    gt_pairs: set = set()
    for members in gt_groups.values():
        if len(members) >= 2:
            gt_pairs |= _pairs(members)

    tp = len(pred_pairs & gt_pairs)
    fp = len(pred_pairs - gt_pairs)
    fn = len(gt_pairs - pred_pairs)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    # Validated match rate: predicted group must equal the ground-truth group exactly.
    pred_member_of = {}
    for g in matched_groups:
        fg = frozenset(g)
        for rid in g:
            pred_member_of[rid] = fg
    gt_member_of = {}
    for gid, members in gt_groups.items():
        fg = frozenset(members)
        for rid in members:
            gt_member_of[rid] = fg
    correct = sum(1 for rid in state.matched_ids()
                  if pred_member_of.get(rid) == gt_member_of.get(rid)
                  and len(gt_member_of.get(rid, ())) >= 2)
    validated_rate = correct / total if total else 0.0

    metrics.update({
        "validated_match_rate": validated_rate,
        "correctly_matched_records": correct,
        "tp_links": tp,
        "fp_links": fp,
        "fn_links": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    })
    return metrics

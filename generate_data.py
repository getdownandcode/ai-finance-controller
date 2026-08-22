#!/usr/bin/env python3
"""Synthetic data generator with built-in ground truth.

Distribution (29 matched groups + 3 orphan singletons = 80 records):
  clean exact-match groups .... 18  (~60% of records)
  fuzzy-match groups ..........  8  (~25%)
  ambiguous groups ............  3  (~10%)  -> fee-netting, nickname, hard duplicate
  true orphans ................  3  (~5%)   -> unidentified wire, double-post, open invoice

Ground truth is written at generation time, so accuracy is never self-reported.
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

VENDORS = ["Acme Corporation", "Northwind Traders", "Globex Industries",
           "Initech Systems", "Umbrella Logistics", "Stark Fabrication",
           "Wayne Components", "Soylent Foods"]
BANK_OPENING = 42_500.00
LEDGER_OPENING = 42_500.00
BASE = date(2026, 2, 1)


def money(x: float) -> float:
    return round(x + 1e-9, 2)


class Builder:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)
        self.bank: list[dict] = []
        self.ledger: list[dict] = []
        self.invoices: list[dict] = []
        self.gt: list[dict] = []
        self.inv_counter = 1000
        self.exp_counter = 2000
        self.group_counter = 0
        self.first_clean_triple: dict | None = None

    # -- primitives ---------------------------------------------------------
    def next_inv(self) -> str:
        self.inv_counter += 1
        return f"INV-{self.inv_counter}"

    def next_exp(self) -> str:
        self.exp_counter += 1
        return f"EXP-{self.exp_counter}"

    def new_group(self) -> str:
        self.group_counter += 1
        return f"G-{self.group_counter:03d}"

    def d(self, offset: int) -> date:
        return BASE + timedelta(days=offset)

    def add_bank(self, d: date, amount: float, ref: str, desc: str) -> str:
        rid = f"B-{len(self.bank)+1:03d}"
        self.bank.append(dict(bank_id=rid, date=d.isoformat(), amount=money(amount),
                              currency="USD", reference=ref, description=desc,
                              balance_after=""))
        return rid

    def add_ledger(self, d: date, amount: float, ref: str, desc: str,
                   account: str = "accounts_receivable") -> str:
        rid = f"L-{len(self.ledger)+1:03d}"
        self.ledger.append(dict(ledger_id=rid, date=d.isoformat(), amount=money(amount),
                                currency="USD", account=account, reference=ref,
                                description=desc))
        return rid

    def add_invoice(self, d: date, amount: float, vendor: str, status: str, ref: str) -> str:
        self.invoices.append(dict(invoice_id=ref, invoice_date=d.isoformat(),
                                  amount=money(amount), currency="USD", vendor=vendor,
                                  status=status, reference=ref))
        return ref

    def gt_row(self, gid, rid, source, resolution, notes):
        self.gt.append(dict(group_id=gid, record_id=rid, source=source,
                            expected_resolution=resolution, notes=notes))

    # -- group builders -------------------------------------------------------
    def clean_triple(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(400, 4800))
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 6)
        b = self.add_bank(self.d(off), amt, inv, f"Stripe payout {inv}")
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement")
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        note = f"Clean exact-match settlement of {inv}"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)
        self.gt_row(gid, i, "invoice", "matched", note)
        if self.first_clean_triple is None:
            self.first_clean_triple = dict(date=self.d(off), amount=amt, ref=inv,
                                           num=inv.split("-")[1], ledger_id=l)

    def clean_pair_receipt(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(400, 4800))
        off = rng.randint(0, 6)
        b = self.add_bank(self.d(off), amt, inv, f"WIRE CREDIT {inv} CUSTOMER PAYMENT")
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement (wire)")
        note = f"Wire receipt of {inv} booked directly (no invoice row in batch)"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)

    def payment_pair(self):
        gid, rng = self.new_group(), self.rng
        ref, amt = self.next_exp(), -money(rng.uniform(300, 2500))
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 7)
        b = self.add_bank(self.d(off), amt, ref, f"ACH DEBIT {vendor.upper()} SUPPLIES")
        l = self.add_ledger(self.d(off), amt, ref, f"Vendor payment {vendor}",
                            account="accounts_payable")
        note = f"Vendor payment {ref}"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)

    def fuzzy_triple(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(500, 4200))
        vendor, fee = rng.choice(VENDORS), rng.uniform(0.008, 0.018)
        off = rng.randint(0, 5)
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), amt, inv, f"Settlement of invoice {inv.split('-')[1]}")
        b = self.add_bank(self.d(off + rng.randint(2, 3)), amt * (1 - fee), inv,
                          f"  STRIPE PAYOUT {inv} net of fees ")
        note = f"Fuzzy: bank nets a {fee*100:.1f}% fee, +2/3d lag, reworded descriptions ({inv})"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    def fuzzy_pair(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(500, 4200))
        fee = rng.uniform(0.008, 0.018)
        off = rng.randint(0, 6)
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + rng.randint(1, 3)), amt * (1 - fee), inv,
                          f"stripe payout {inv.lower()} (net)")
        note = f"Fuzzy pair: fee-netted bank line for {inv}"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)

    def ambiguous_fee3(self):
        """Bank line nets a 2.9% + $0.30 card fee and carries no reference."""
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(2200, 3600))
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 5)
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + 3), amt * 0.971 - 0.30, "",
                          f"{vendor.upper()} NET SETTLEMENT")
        note = f"Ambiguous: bank amount nets 2.9%+$0.30 card fee vs {inv}; needs reasoning"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    def ambiguous_nickname(self):
        """Bank uses a vendor nickname and has no reference; amount is exact."""
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(500, 4200))
        vendor = rng.choice(VENDORS)
        nick = vendor.split()[0].upper()
        off = rng.randint(0, 6)
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + 2), amt, "", f"{nick} CORP CARD SETTLEMENT")
        note = f"Ambiguous: nickname description, missing reference ({inv}); needs reasoning"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    def ambiguous_hard_duplicate(self):
        """Two twin invoices, same vendor/amount; bank line has no distinguishing signal."""
        gid, rng = self.new_group(), self.rng
        vendor, amt = "Northwind Traders", money(rng.uniform(2400, 2800))
        off = rng.randint(0, 4)
        ia, ib = self.next_inv(), self.next_inv()
        i_a = self.add_invoice(self.d(off), amt, vendor, "paid", ia)
        i_b = self.add_invoice(self.d(off + 1), amt, vendor, "open", ib)
        l = self.add_ledger(self.d(off), amt, ia, f"Invoice {ia.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + 2), amt, "", "NORTHWIND TRADERS SETTLEMENT")
        note = f"Ambiguous hard case: bank line settles {ia} but is indistinguishable from {ib}"
        for rid, src in ((b, "bank"), (l, "ledger"), (i_a, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)
        gid_b = self.new_group()
        self.gt_row(gid_b, i_b, "invoice", "orphan",
                    f"Open invoice {ib}; twin of {ia}, settlement not identifiable in batch")

    def orphan_bank(self):
        gid = self.new_group()
        b = self.add_bank(self.d(4), 1245.00, "", "MISC CREDIT - UNIDENTIFIED WIRE")
        self.gt_row(gid, b, "bank", "orphan", "True orphan: unidentified wire, no counterpart")

    def orphan_duplicate_ledger(self):
        gid = self.new_group()
        t = self.first_clean_triple
        dup = self.add_ledger(t["date"], t["amount"], t["ref"],
                              f"Invoice {t['num']} settlement (duplicate post)")
        self.gt_row(gid, dup, "ledger", "orphan",
                    f"Double-posting of {t['ledger_id']}; must not be force-matched")

    # -- top level ---------------------------------------------------------
    def build(self):
        for _ in range(11):
            self.clean_triple()
        for _ in range(4):
            self.clean_pair_receipt()
        for _ in range(3):
            self.payment_pair()
        for _ in range(5):
            self.fuzzy_triple()
        for _ in range(3):
            self.fuzzy_pair()
        self.ambiguous_fee3()
        self.ambiguous_nickname()
        self.ambiguous_hard_duplicate()
        self.orphan_bank()
        self.orphan_duplicate_ledger()

        running = BANK_OPENING
        for row in self.bank:
            running += row["amount"]
            row["balance_after"] = money(running)


def generate(seed: int = 42, data_dir: str = "data") -> dict:
    b = Builder(seed)
    b.build()
    out = Path(data_dir)
    out.mkdir(parents=True, exist_ok=True)

    pd.DataFrame(b.bank).to_csv(out / "bank_feed.csv", index=False)
    pd.DataFrame(b.ledger).to_csv(out / "ledger.csv", index=False)
    pd.DataFrame(b.invoices).to_csv(out / "invoices.csv", index=False)
    pd.DataFrame(b.gt).to_csv(out / "ground_truth.csv", index=False)

    meta = {
        "batch_id": f"batch_2026_02_10_seed_{seed}",
        "seed": seed,
        "opening_balances": {"bank": BANK_OPENING, "ledger": LEDGER_OPENING},
        "counts": {"bank": len(b.bank), "ledger": len(b.ledger),
                   "invoice": len(b.invoices),
                   "total": len(b.bank) + len(b.ledger) + len(b.invoices)},
        "case_distribution": {"clean_groups": 18, "fuzzy_groups": 8,
                              "ambiguous_groups": 3, "orphan_singletons": 3},
    }
    (out / "batch_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"[generate] seed={seed}")
    print(f"[generate] bank={len(b.bank)} ledger={len(b.ledger)} "
          f"invoice={len(b.invoices)} total={meta['counts']['total']}")
    print(f"[generate] matched groups={b.group_counter - 3} orphan singletons=3")
    print(f"[generate] wrote {out}/bank_feed.csv, ledger.csv, invoices.csv, "
          f"ground_truth.csv, batch_meta.json")
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generate synthetic reconciliation batch")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--data-dir", default="data")
    args = ap.parse_args()
    generate(seed=args.seed, data_dir=args.data_dir)

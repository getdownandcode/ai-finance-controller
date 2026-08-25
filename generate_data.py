#!/usr/bin/env python3
"""Synthetic data generator with built-in ground truth (Indian Fintech / Razorpay Edition).

Distribution:
  - Clean exact-match groups
  - Credit Note / Return adjustments (Sales returns net of invoices)
  - Precision Paisa Round-off pairs (±₹0.01 to ₹0.99 GST rounding)
  - Phantom Net-Zero UPI Reversals (Self-balancing failed payments)
  - Fuzzy-match groups (Razorpay MDR 2.36%, Route, TDS 194C/J)
  - Ambiguous groups (Smart Collect VAN, UPI handles, twin duplicates)
  - Duplicate UTR collisions & True orphans

Currency: INR (₹)
Ecosystem: Razorpay Settlements, Smart Collect, Route, UPI, IMPS, NEFT, RTGS, TDS, GST.
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

VENDORS = [
    "Tata Consultancy Services Ltd", "Infosys Technologies Ltd",
    "Reliance Jio Infocomm", "Zomato Media Pvt Ltd",
    "Swiggy Bundl Technologies", "Flipkart Internet Pvt Ltd",
    "Razorpay Software Pvt Ltd", "Airtel Telecommunications",
    "Blue Dart Express", "Zepto Quick Commerce"
]

BANK_OPENING = 25_00_000.00  # ₹25 Lakhs
LEDGER_OPENING = 25_00_000.00
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
        self.cn_counter = 5000
        self.group_counter = 0
        self.first_clean_triple: dict | None = None

    # -- primitives ---------------------------------------------------------
    def next_inv(self) -> str:
        self.inv_counter += 1
        return f"INV-{self.inv_counter}"

    def next_exp(self) -> str:
        self.exp_counter += 1
        return f"EXP-{self.exp_counter}"

    def next_cn(self) -> str:
        self.cn_counter += 1
        return f"CN-{self.cn_counter}"

    def new_group(self) -> str:
        self.group_counter += 1
        return f"G-{self.group_counter:03d}"

    def d(self, offset: int) -> date:
        return BASE + timedelta(days=offset)

    def add_bank(self, d: date, amount: float, ref: str, desc: str) -> str:
        rid = f"B-{len(self.bank)+1:03d}"
        self.bank.append(dict(bank_id=rid, date=d.isoformat(), amount=money(amount),
                              currency="INR", reference=ref, description=desc,
                              balance_after=""))
        return rid

    def add_ledger(self, d: date, amount: float, ref: str, desc: str,
                   account: str = "accounts_receivable") -> str:
        rid = f"L-{len(self.ledger)+1:03d}"
        self.ledger.append(dict(ledger_id=rid, date=d.isoformat(), amount=money(amount),
                                currency="INR", account=account, reference=ref,
                                description=desc))
        return rid

    def add_invoice(self, d: date, amount: float, vendor: str, status: str, ref: str) -> str:
        self.invoices.append(dict(invoice_id=ref, invoice_date=d.isoformat(),
                                  amount=money(amount), currency="INR", vendor=vendor,
                                  status=status, reference=ref))
        return ref

    def gt_row(self, gid, rid, source, resolution, notes):
        self.gt.append(dict(group_id=gid, record_id=rid, source=source,
                            expected_resolution=resolution, notes=notes))

    # -- group builders -------------------------------------------------------
    def clean_triple(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(25000, 240000))
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 6)
        b = self.add_bank(self.d(off), amt, inv, f"RAZORPAY PAYOUT {inv} SETTLEMENT")
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement via Razorpay")
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        note = f"Clean exact-match settlement of {inv} (Razorpay payout)"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)
        self.gt_row(gid, i, "invoice", "matched", note)
        if self.first_clean_triple is None:
            self.first_clean_triple = dict(date=self.d(off), amount=amt, ref=inv,
                                           num=inv.split("-")[1], ledger_id=l)

    # 1. Credit Notes / Debit Notes (Sales Returns & Adjustments)
    def credit_note_triple(self):
        gid, rng = self.new_group(), self.rng
        inv, cn = self.next_inv(), self.next_cn()
        gross_amt = money(rng.uniform(75000, 150000))
        return_amt = money(rng.uniform(5000, 15000))
        net_amt = money(gross_amt - return_amt)
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 5)

        # Invoice + Credit Note in Invoice table
        i1 = self.add_invoice(self.d(off - 2), gross_amt, vendor, "paid", inv)
        i2 = self.add_invoice(self.d(off - 1), -return_amt, vendor, "paid", f"{inv},{cn}")
        l = self.add_ledger(self.d(off), net_amt, inv, f"Net settlement of {inv} after credit note {cn}")
        b = self.add_bank(self.d(off), net_amt, inv, f"RAZORPAY SETTLEMENT {inv} NET OF RETURN")
        note = f"Credit note adjustment: {inv} (₹{gross_amt}) adjusted by {cn} (-₹{return_amt}) settled at ₹{net_amt}"
        for rid, src in ((b, "bank"), (l, "ledger"), (i1, "invoice"), (i2, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    # 2. Precision Paisa Round-Off Rule (±₹0.01 to ₹0.99 GST rounding)
    def roundoff_paisa_pair(self):
        gid, rng = self.new_group(), self.rng
        inv = self.next_inv()
        base_amt = money(rng.uniform(35000, 85000))
        roundoff_diff = round(rng.uniform(0.15, 0.75), 2)
        inv_amt = money(base_amt + roundoff_diff)
        bank_amt = money(base_amt)  # Rounded to integer
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 5)

        i = self.add_invoice(self.d(off - 1), inv_amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), inv_amt, inv, f"Invoice {inv} GST booked")
        b = self.add_bank(self.d(off), bank_amt, inv, f"UPI/HDFC/{inv} ROUNDED SETTLEMENT")
        note = f"Precision paisa round-off: invoice ₹{inv_amt} vs bank ₹{bank_amt} (diff: ₹{roundoff_diff})"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    # 3. Phantom Net-Zero / Failed UPI Auto-Reversals
    def phantom_failed_upi_pair(self):
        gid, rng = self.new_group(), self.rng
        amt = money(rng.uniform(2500, 7500))
        off = rng.randint(1, 5)
        ref = f"UPI-FAIL-{rng.randint(10000,99999)}"
        b1 = self.add_bank(self.d(off), -amt, ref, f"UPI DR TO SWIGGY FAILED TXN REF {ref}")
        b2 = self.add_bank(self.d(off), amt, ref, f"UPI CR AUTO-REVERSAL OF FAILED TXN REF {ref}")
        note = f"Phantom net-zero reversal: auto-reversed failed UPI payment of ₹{amt}"
        self.gt_row(gid, b1, "bank", "matched", note)
        self.gt_row(gid, b2, "bank", "matched", note)

    def clean_pair_receipt(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(18000, 195000))
        off = rng.randint(0, 6)
        b = self.add_bank(self.d(off), amt, inv, f"NEFT CR-HDFCN00{rng.randint(1000,9999)}-{inv}-CLIENT RECEIPT")
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement (NEFT receipt)")
        note = f"NEFT receipt of {inv} booked directly in HDFC / ICICI feed"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)

    def payment_pair(self):
        gid, rng = self.new_group(), self.rng
        ref, amt = self.next_exp(), -money(rng.uniform(12000, 150000))
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 7)
        b = self.add_bank(self.d(off), amt, ref, f"RTGS/IMPS DR TO {vendor.upper()} VENDOR PAY")
        l = self.add_ledger(self.d(off), amt, ref, f"Vendor payment {vendor}",
                            account="accounts_payable")
        note = f"Vendor payment {ref} to {vendor}"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)

    def fuzzy_triple(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(35000, 280000))
        vendor, fee = rng.choice(VENDORS), rng.uniform(0.008, 0.0236)
        off = rng.randint(0, 5)
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), amt, inv, f"Settlement of GST invoice {inv.split('-')[1]}")
        b = self.add_bank(self.d(off + rng.randint(2, 3)), amt * (1 - fee), inv,
                          f"  RAZORPAY ROUTE SETTLEMENT {inv} NET OF MDR  ")
        note = f"Fuzzy: bank nets a {fee*100:.2f}% MDR/TDS fee, +2/3d lag, reworded descriptions ({inv})"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    def fuzzy_pair(self):
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(30000, 220000))
        fee = rng.uniform(0.008, 0.020)
        off = rng.randint(0, 6)
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} client receipt")
        b = self.add_bank(self.d(off + rng.randint(1, 3)), amt * (1 - fee), inv,
                          f"razorpay payout {inv.lower()} (net of mdr)")
        note = f"Fuzzy pair: fee-netted bank line for {inv}"
        self.gt_row(gid, b, "bank", "matched", note)
        self.gt_row(gid, l, "ledger", "matched", note)

    def ambiguous_fee3(self):
        """Bank line nets standard Razorpay 2.0% + 18% GST (2.36% MDR) and carries no reference."""
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(85000, 180000))
        vendor = rng.choice(VENDORS)
        off = rng.randint(0, 5)
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + 3), amt * (1 - 0.0236), "",
                          f"{vendor.upper()} RAZORPAY SMART COLLECT NET")
        note = f"Ambiguous: bank amount nets 2.36% Razorpay MDR+GST vs {inv}; needs reasoning"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    def ambiguous_nickname(self):
        """Bank uses UPI merchant handle / vendor nickname and has no reference; amount is exact."""
        gid, rng = self.new_group(), self.rng
        inv, amt = self.next_inv(), money(rng.uniform(25000, 190000))
        vendor = rng.choice(VENDORS)
        nick = vendor.split()[0].upper()
        off = rng.randint(0, 6)
        i = self.add_invoice(self.d(off - 1), amt, vendor, "paid", inv)
        l = self.add_ledger(self.d(off), amt, inv, f"Invoice {inv.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + 2), amt, "", f"UPI/409823901/{nick} CORP VIRTUAL ACCT")
        note = f"Ambiguous: UPI handle description, missing reference ({inv}); needs reasoning"
        for rid, src in ((b, "bank"), (l, "ledger"), (i, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)

    def ambiguous_hard_duplicate(self):
        """Two twin invoices, same vendor/amount; bank line has no distinguishing signal."""
        gid, rng = self.new_group(), self.rng
        vendor, amt = "Tata Consultancy Services Ltd", money(rng.uniform(145000, 185000))
        off = rng.randint(0, 4)
        ia, ib = self.next_inv(), self.next_inv()
        i_a = self.add_invoice(self.d(off), amt, vendor, "paid", ia)
        i_b = self.add_invoice(self.d(off + 1), amt, vendor, "open", ib)
        l = self.add_ledger(self.d(off), amt, ia, f"Invoice {ia.split('-')[1]} settlement")
        b = self.add_bank(self.d(off + 2), amt, "", "TATA CONSULTANCY SERVICES SETTLEMENT")
        note = f"Ambiguous hard case: bank line settles {ia} but is indistinguishable from {ib}"
        for rid, src in ((b, "bank"), (l, "ledger"), (i_a, "invoice")):
            self.gt_row(gid, rid, src, "matched", note)
        gid_b = self.new_group()
        self.gt_row(gid_b, i_b, "invoice", "orphan",
                    f"Open invoice {ib}; twin of {ia}, settlement not identifiable in batch")

    def orphan_bank(self):
        gid = self.new_group()
        b = self.add_bank(self.d(4), 54000.00, "", "MISC CR - UNIDENTIFIED IMPS INFLOW REF 9382104")
        self.gt_row(gid, b, "bank", "orphan", "True orphan: unidentified IMPS transfer, no counterpart")

    def orphan_duplicate_ledger(self):
        gid = self.new_group()
        t = self.first_clean_triple
        dup = self.add_ledger(t["date"], t["amount"], t["ref"],
                              f"Invoice {t['num']} settlement (duplicate post in Tally/ERP)")
        self.gt_row(gid, dup, "ledger", "orphan",
                    f"Double-posting of {t['ledger_id']}; must not be force-matched")

    # -- top level ---------------------------------------------------------
    def build(self):
        for _ in range(8):
            self.clean_triple()
        self.credit_note_triple()
        self.roundoff_paisa_pair()
        self.phantom_failed_upi_pair()
        for _ in range(3):
            self.clean_pair_receipt()
        for _ in range(2):
            self.payment_pair()
        for _ in range(4):
            self.fuzzy_triple()
        for _ in range(2):
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
    }
    (out / "batch_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"[generate] seed={seed}")
    print(f"[generate] bank={len(b.bank)} ledger={len(b.ledger)} "
          f"invoice={len(b.invoices)} total={meta['counts']['total']}")
    print(f"[generate] wrote {out}/bank_feed.csv, ledger.csv, invoices.csv, "
          f"ground_truth.csv, batch_meta.json")
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generate synthetic reconciliation batch (Indian Fintech / Razorpay Edition)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--data-dir", default="data")
    args = ap.parse_args()
    generate(seed=args.seed, data_dir=args.data_dir)

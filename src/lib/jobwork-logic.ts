/**
 * Job work logic — pure functions.
 *
 * The rule everything here protects: material sent to a job worker is still
 * ours. It leaves the raw store but lands in a vendor-stock bucket, so
 *
 *     raw store + stock with vendor + WIP + finished goods
 *
 * stays constant across a dispatch. Treating a dispatch as consumption is the
 * classic failure, and it quietly writes off real inventory.
 */

import { round2, round4 } from "./tax-regime";
import { RegimeState } from "./tax-types";
import {
  DeadlineStatus,
  ThreeWayMatch,
  WastageAssessment,
  MakeVsBuyLine,
} from "./jobwork-types";

/** Default statutory windows; overridden by the tax_rules table in practice. */
export const DEFAULT_INPUT_RETURN_MONTHS = 12;
export const DEFAULT_ALERT_MONTHS = 9;

export function monthsBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  const months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth()) +
    (b.getDate() >= a.getDate() ? 0 : -1);
  return Math.max(0, months);
}

export function daysBetween(from: string, to: string): number {
  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
  );
}

/**
 * How close a dispatch is to the deadline after which un-returned inputs are
 * deemed a supply and tax becomes payable on them.
 */
export function deadlineStatus(
  dispatchDate: string,
  today: string,
  returnMonths: number = DEFAULT_INPUT_RETURN_MONTHS,
  alertMonths: number = DEFAULT_ALERT_MONTHS
): { status: DeadlineStatus; months_out: number; months_remaining: number } {
  const monthsOut = monthsBetween(dispatchDate, today);
  const remaining = returnMonths - monthsOut;

  let status: DeadlineStatus = "ok";
  if (monthsOut >= returnMonths) status = "breached";
  else if (monthsOut >= alertMonths) status = "approaching";

  return { status, months_out: monthsOut, months_remaining: remaining };
}

/**
 * Whether an e-way bill is needed for a job work dispatch.
 *
 * Encoded as a rule rather than a hardcoded exemption: intra-state job work
 * movement within West Bengal is exempt, but the value threshold still governs
 * everything else. Unverified until the CA confirms.
 */
export function ewayBillRequirement(
  consignmentValue: number,
  fromStateCode: string,
  toStateCode: string,
  regime: RegimeState,
  rules: { threshold: number; intrastateJobWorkExempt: boolean }
): { required: boolean; exempt_reason: string | null } {
  if (!regime.registered) {
    return { required: false, exempt_reason: "Not registered — no e-way bill obligation" };
  }

  const isIntrastate = fromStateCode === toStateCode;

  if (isIntrastate && rules.intrastateJobWorkExempt) {
    return {
      required: false,
      exempt_reason: "Intra-state job work movement — exempt (verify with CA)",
    };
  }

  if (consignmentValue < rules.threshold) {
    return {
      required: false,
      exempt_reason: `Consignment below the ${rules.threshold} threshold`,
    };
  }

  return { required: true, exempt_reason: null };
}

/**
 * Compare what the vendor actually consumed against what the recipe says they
 * should have used, and recover the excess at material cost.
 *
 * consumed = sent − returned. Standard is the per-unit requirement times the
 * GOOD output only: a vendor cannot claim material against rejected work.
 */
export function assessWastage(
  lines: {
    material_id: number;
    material_code: string;
    material_name: string;
    stock_uom: string;
    sent_qty: number;
    returned_qty: number;
    /** Standard consumption per unit of good output */
    standard_per_unit: number;
    rate: number;
  }[],
  goodOutputQty: number,
  agreedWastagePct: number
): WastageAssessment[] {
  return lines.map((l) => {
    const consumed = round4(l.sent_qty - l.returned_qty);
    const standardQty = round4(l.standard_per_unit * goodOutputQty);

    // Wastage measured against the standard requirement, not against what was sent.
    const wastageQty = round4(consumed - standardQty);
    const actualWastagePct =
      standardQty > 0 ? round2((wastageQty / standardQty) * 100) : 0;

    const allowedQty = round4(standardQty * (1 + agreedWastagePct / 100));
    const excess = round4(Math.max(0, consumed - allowedQty));

    return {
      material_id: l.material_id,
      material_code: l.material_code,
      material_name: l.material_name,
      stock_uom: l.stock_uom,
      sent_qty: l.sent_qty,
      returned_qty: l.returned_qty,
      consumed_qty: consumed,
      standard_qty: standardQty,
      actual_wastage_pct: actualWastagePct,
      agreed_wastage_pct: agreedWastagePct,
      excess_wastage_qty: excess,
      rate: l.rate,
      recovery_amount: round2(excess * l.rate),
    };
  });
}

/**
 * Order ↔ receipt ↔ invoice. Any mismatch blocks payment; a clerk should not
 * be able to pay an invoice for more units than were actually received.
 */
export function threeWayMatch(args: {
  jw_order_id: number;
  jw_number: string;
  ordered_qty: number;
  ordered_rate: number;
  received_good_qty: number;
  invoice_qty: number | null;
  invoice_rate: number | null;
  invoice_amount: number | null;
  /** Recovery for excess wastage, deducted from what is payable */
  wastage_recovery?: number;
  /** Rounding tolerance in rupees */
  tolerance?: number;
}): ThreeWayMatch {
  const tolerance = args.tolerance ?? 1;
  const recovery = args.wastage_recovery ?? 0;
  const discrepancies: string[] = [];

  const expectedAmount = round2(args.received_good_qty * args.ordered_rate - recovery);

  if (args.invoice_qty === null || args.invoice_amount === null) {
    return {
      jw_order_id: args.jw_order_id,
      jw_number: args.jw_number,
      ordered_qty: args.ordered_qty,
      ordered_rate: args.ordered_rate,
      received_good_qty: args.received_good_qty,
      invoice_qty: null,
      invoice_rate: null,
      invoice_amount: null,
      expected_amount: expectedAmount,
      discrepancies: ["Vendor invoice not yet recorded"],
      matched: false,
      payment_blocked: true,
    };
  }

  if (args.invoice_qty > args.received_good_qty + 0.0001) {
    discrepancies.push(
      `Invoice bills ${args.invoice_qty} units but only ${args.received_good_qty} good units were received`
    );
  }
  if (args.invoice_qty < args.received_good_qty - 0.0001) {
    discrepancies.push(
      `Invoice bills ${args.invoice_qty} units against ${args.received_good_qty} received — under-billed`
    );
  }
  if (args.invoice_rate !== null && Math.abs(args.invoice_rate - args.ordered_rate) > 0.001) {
    discrepancies.push(
      `Invoice rate ${args.invoice_rate} does not match the agreed rate ${args.ordered_rate}`
    );
  }
  if (Math.abs(args.invoice_amount - expectedAmount) > tolerance) {
    discrepancies.push(
      `Invoice amount ${args.invoice_amount} differs from expected ${expectedAmount}` +
        (recovery > 0 ? ` (after ${recovery} wastage recovery)` : "")
    );
  }
  if (args.received_good_qty > args.ordered_qty + 0.0001) {
    discrepancies.push(
      `Received ${args.received_good_qty} units against an order for ${args.ordered_qty}`
    );
  }

  return {
    jw_order_id: args.jw_order_id,
    jw_number: args.jw_number,
    ordered_qty: args.ordered_qty,
    ordered_rate: args.ordered_rate,
    received_good_qty: args.received_good_qty,
    invoice_qty: args.invoice_qty,
    invoice_rate: args.invoice_rate,
    invoice_amount: args.invoice_amount,
    expected_amount: expectedAmount,
    discrepancies,
    matched: discrepancies.length === 0,
    payment_blocked: discrepancies.length > 0,
  };
}

/**
 * Make vs buy, regime-aware.
 *
 * While unregistered, a registered job worker's tax on labour is a real cost to
 * us. Once registered it becomes creditable, so outsourcing gets cheaper
 * automatically and the recommendation can flip without anyone editing a rate.
 */
export function makeVsBuy(
  operation: string,
  inHouseCost: number,
  jobWorkRate: number,
  jobWorkTaxRate: number,
  regime: RegimeState
): MakeVsBuyLine {
  const tax = round2((jobWorkRate * jobWorkTaxRate) / 100);
  const recoverable = regime.itc_available ? tax : 0;
  const effective = round2(jobWorkRate + tax - recoverable);

  return {
    operation,
    in_house_cost: round2(inHouseCost),
    job_work_labour: round2(jobWorkRate),
    job_work_tax: tax,
    job_work_recoverable_tax: recoverable,
    job_work_effective_cost: effective,
    cheaper: effective < inHouseCost ? "buy" : "make",
    difference: round2(Math.abs(effective - inHouseCost)),
  };
}

/**
 * Asset conservation check. Dispatching to a vendor must not change total
 * inventory value — it only moves value between buckets.
 */
export function totalInventoryValue(buckets: {
  raw_store: number;
  with_vendor: number;
  wip: number;
  finished_goods: number;
}): number {
  return round2(
    buckets.raw_store + buckets.with_vendor + buckets.wip + buckets.finished_goods
  );
}

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface TuitionCoverage {
  chargeId: string;
  description: string;
  currency: string;
  amountDue: number;
  amountPaid: number;
  outstandingBalance: number;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  coveredDays: number;
  expiryDate: string;
  elapsedDays: number;
  remainingDays: number;
  ratio: number;
  progressPercent: number;
  isExpired: boolean;
  status: "expired" | "expiring_soon" | "active" | "fully_paid";
  displayStatus: string;
}

export interface CalculateCoverageParams {
  chargeId?: string;
  description?: string;
  currency?: string;
  amountDue: number;
  amountPaid: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  displayStatus?: string;
  today?: Date;
}

export function calculateTuitionCoverage(params: CalculateCoverageParams): TuitionCoverage {
  const {
    chargeId = "",
    description = "Tuition / Program Fee",
    currency = "XAF",
    amountDue,
    amountPaid,
    displayStatus = "Outstanding",
    today = new Date(),
  } = params;

  const due = Math.max(0, amountDue);
  const paid = Math.max(0, amountPaid);
  const outstandingBalance = Math.max(0, due - paid);
  const ratio = due > 0 ? Math.min(1, Math.max(0, paid / due)) : 1;

  // Resolve start and end dates with safe fallbacks
  const now = today;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let startDate: Date;
  if (params.periodStart && !Number.isNaN(Date.parse(params.periodStart))) {
    startDate = new Date(params.periodStart);
  } else {
    startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
  }

  let endDate: Date;
  if (params.periodEnd && !Number.isNaN(Date.parse(params.periodEnd))) {
    endDate = new Date(params.periodEnd);
  } else {
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    endDate = new Date(Date.UTC(currentYear, currentMonth, lastDayOfMonth));
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay));
  const coveredDays = Math.max(0, Math.round(totalDays * ratio));

  const expiryDateObj = new Date(startDate.getTime() + coveredDays * msPerDay);
  const expiryDate = expiryDateObj.toISOString().substring(0, 10);
  const periodStartStr = startDate.toISOString().substring(0, 10);
  const periodEndStr = endDate.toISOString().substring(0, 10);

  const elapsedDays = Math.max(0, Math.round((now.getTime() - startDate.getTime()) / msPerDay));
  const remainingDays = Math.round((expiryDateObj.getTime() - now.getTime()) / msPerDay);

  let status: TuitionCoverage["status"] = "active";
  let progressPercent = 0;
  let isExpired = false;

  if (due > 0 && paid >= due) {
    status = "fully_paid";
    progressPercent = 100;
    isExpired = false;
  } else if (paid <= 0) {
    status = "expired";
    progressPercent = 100;
    isExpired = true;
  } else {
    // Fractional coverage calculation:
    // e.g., 15k / 20k = 75% coverage. Progress tracks elapsed time through the covered window.
    progressPercent = coveredDays > 0 ? Math.min(100, Math.max(0, Math.round((elapsedDays / coveredDays) * 100))) : 100;

    if (remainingDays <= 0) {
      status = "expired";
      progressPercent = 100; // Red and full
      isExpired = true;
    } else if (remainingDays <= 3) {
      status = "expiring_soon";
      isExpired = false;
    } else {
      status = "active";
      isExpired = false;
    }
  }

  return {
    chargeId,
    description,
    currency,
    amountDue: due,
    amountPaid: paid,
    outstandingBalance,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    totalDays,
    coveredDays,
    expiryDate,
    elapsedDays,
    remainingDays,
    ratio,
    progressPercent,
    isExpired,
    status,
    displayStatus,
  };
}

/**
 * Loads the current signed-in learner's tuition balance and coverage countdown.
 * Returns null if the learner has no financial charges on record.
 */
export const getMyTuitionCoverage = cache(async (): Promise<TuitionCoverage | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from("finance_participant_balances")
      .select("*")
      .eq("profile_id", user.id)
      .order("due_date", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return calculateTuitionCoverage({
      chargeId: row.charge_id,
      description: row.charge_description || "Internship / Tuition Fee",
      currency: row.currency || "XAF",
      amountDue: Number(row.amount_due) || 0,
      amountPaid: Number(row.amount_paid) || 0,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      displayStatus: row.display_status,
    });
  } catch (err) {
    console.error("Tuition coverage query failed:", err);
    return null;
  }
});

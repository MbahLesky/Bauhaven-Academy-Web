import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TuitionCoverage } from "@/lib/tuition-queries";

export function TuitionCoverageCard({ coverage }: { coverage: TuitionCoverage }) {
  const {
    description,
    amountDue,
    amountPaid,
    outstandingBalance,
    currency,
    expiryDate,
    remainingDays,
    progressPercent,
    status,
    isExpired,
  } = coverage;

  const formattedDue = `${amountDue.toLocaleString()} ${currency}`;
  const formattedPaid = `${amountPaid.toLocaleString()} ${currency}`;
  const formattedBalance = `${outstandingBalance.toLocaleString()} ${currency}`;

  // Date formatting for human-friendly display
  const formattedExpiry = new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="mb-5 overflow-hidden border border-neutral-200/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Tuition & Coverage
            </span>
            <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
              {description}
            </h3>
          </div>

          {status === "fully_paid" && (
            <Badge variant="success">
              ✓ Fully Paid
            </Badge>
          )}
          {status === "active" && (
            <Badge variant="neutral">
              Active ({remainingDays}d left)
            </Badge>
          )}
          {status === "expiring_soon" && (
            <Badge variant="warning">
              Expiring Soon ({remainingDays}d left)
            </Badge>
          )}
          {status === "expired" && (
            <Badge variant="danger" className="animate-pulse">
              Coverage Expired
            </Badge>
          )}
        </div>

        {/* Financial Metrics */}
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-neutral-50 p-2.5 text-center sm:p-3">
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Paid to Date</div>
            <div className="font-display text-sm font-bold text-emerald-600 sm:text-base">{formattedPaid}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Total Due</div>
            <div className="font-display text-sm font-bold text-foreground sm:text-base">{formattedDue}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Balance</div>
            <div
              className={`font-display text-sm font-bold sm:text-base ${
                outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {formattedBalance}
            </div>
          </div>
        </div>

        {/* Expiration Progress Bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-600">
              {status === "fully_paid"
                ? "Full period covered"
                : isExpired
                ? "Coverage period expired"
                : `Covered until ${formattedExpiry}`}
            </span>
            <span
              className={`font-semibold ${
                isExpired
                  ? "text-red-600 font-bold"
                  : status === "expiring_soon"
                  ? "text-amber-600"
                  : "text-neutral-500"
              }`}
            >
              {status === "fully_paid"
                ? "100%"
                : isExpired
                ? "100% Expired"
                : `${progressPercent}% elapsed`}
            </span>
          </div>

          {/* Progress bar container */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isExpired
                  ? "bg-red-600 shadow-sm"
                  : status === "expiring_soon"
                  ? "bg-amber-500"
                  : status === "fully_paid"
                  ? "bg-emerald-500"
                  : "bg-accent"
              }`}
              style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* Action Prompt when expired or expiring soon */}
        {isExpired && (
          <div className="mt-3.5 rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs text-red-800">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Your tuition coverage has expired</span>
            </div>
            <p className="mt-1 text-red-700 leading-relaxed">
              Your partial payment covered your subscription up to <strong>{formattedExpiry}</strong>.
              Remaining balance: <strong>{formattedBalance}</strong>. Please complete payment to renew coverage.
            </p>
          </div>
        )}

        {!isExpired && status === "expiring_soon" && (
          <div className="mt-3.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
            <div className="font-bold flex items-center gap-1.5">
              <span>⏳</span>
              <span>Coverage ending soon</span>
            </div>
            <p className="mt-1 text-amber-700 leading-relaxed">
              You have <strong>{remainingDays} day(s)</strong> of paid coverage remaining before{" "}
              <strong>{formattedExpiry}</strong>. Outstanding balance: <strong>{formattedBalance}</strong>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

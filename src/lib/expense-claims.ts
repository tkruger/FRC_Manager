// Expense claims: who reviews them, what each status means, and the limits on receipts.
// Safe to import on server and client.

/** Approve or deny claims, mark refunds paid, see every claim */
export const CLAIM_REVIEW_ROLES = ["TREASURER", "HEAD_MENTOR"] as const;

export function canReviewClaims(roles: readonly string[]): boolean {
  return roles.some((r) => (CLAIM_REVIEW_ROLES as readonly string[]).includes(r));
}

export type ClaimStatus = "SUBMITTED" | "APPROVED" | "DENIED" | "PAID" | "WITHDRAWN";

/** What a claim's status means, given whether it's a refund */
export function claimStatusInfo(status: ClaimStatus, reimbursement: boolean): { label: string; badge: "warning" | "info" | "success" | "danger" | "neutral"; open: boolean } {
  switch (status) {
    case "SUBMITTED": return { label: "Waiting for review", badge: "warning", open: true };
    case "APPROVED":  return reimbursement
      ? { label: "Approved — to be paid", badge: "info", open: true }
      : { label: "Approved — recorded", badge: "success", open: false };
    case "PAID":      return { label: "Paid", badge: "success", open: false };
    case "DENIED":    return { label: "Denied", badge: "danger", open: false };
    case "WITHDRAWN": return { label: "Withdrawn", badge: "neutral", open: false };
  }
}

/** How someone paid for it */
export const PAID_WITH_OPTIONS = ["My own card or account", "Cash", "Team credit card", "Check", "Other"];

/** How a refund was paid out */
export const PAYMENT_METHODS = ["Check", "Venmo", "Zelle", "PayPal", "Cash", "Bank transfer", "Other"];

export const MAX_RECEIPTS = 5;
/** Per file, after the browser shrinks photos (requests to the server are capped near 4.5 MB) */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export const RECEIPT_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

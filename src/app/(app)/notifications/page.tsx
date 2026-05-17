import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { MarkAllReadButton } from "./MarkAllReadButton";

const TYPE_ICONS: Record<string, string> = {
  REORDER_TRIGGERED:       "📦",
  PURCHASE_SUBMITTED:      "🛒",
  PURCHASE_APPROVED:       "✅",
  PURCHASE_DENIED:         "❌",
  ORDER_RECEIVED:          "📬",
  TASK_DUE_SOON:           "📅",
  TASK_OVERDUE:            "⚠️",
  TASK_BLOCKED:            "🚧",
  CRITICAL_ISSUE:          "🔴",
  WEIGHT_WARNING:          "⚖️",
  BOM_CAP_WARNING:         "💰",
  TOOL_OVERDUE:            "🔧",
  CERT_EXPIRING:           "🎓",
  SAFETY_INCIDENT:         "🚨",
  COMPETITION_APPROACHING: "🏆",
  MEMBER_APPROVAL_NEEDED:  "👤",
  ACCOUNT_APPROVED:        "✅",
  ACCOUNT_DENIED:          "❌",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Mark all as read on page load
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Notifications</h1>
          {unread.length > 0 && (
            <p className="text-small text-[--color-text-secondary] mt-0.5">{unread.length} unread</p>
          )}
        </div>
        {unread.length > 0 && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary]">No notifications yet.</p>
        </div>
      ) : (
        <div className="card divide-y divide-[--color-border]">
          {notifications.map((n) => (
            <div key={n.id} className={`py-4 flex gap-3 ${!n.read ? "bg-[--color-primary]/5" : ""}`}>
              <span className="text-xl shrink-0">{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${!n.read ? "text-[--color-text-primary]" : "text-[--color-text-secondary]"}`}>
                  {n.title}
                </p>
                {n.body && <p className="text-small text-[--color-text-secondary] mt-0.5">{n.body}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-small text-[--color-text-disabled]">{formatDate(n.createdAt)}</span>
                  {n.linkUrl && (
                    <Link href={n.linkUrl} className="text-small text-[--color-secondary] hover:underline">
                      View →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

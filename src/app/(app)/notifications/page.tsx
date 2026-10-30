import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { MarkAllReadButton } from "./MarkAllReadButton";
import { ClearNotificationButton } from "./ClearNotificationButton";
import { NOTIFICATION_ICONS } from "@/lib/notification-icons";


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
          <h1 className="text-h1 text-(--color-text-primary)">Notifications</h1>
          {unread.length > 0 && (
            <p className="text-small text-(--color-text-secondary) mt-0.5">{unread.length} unread</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings/notifications" className="text-sm font-medium text-(--color-secondary) hover:underline">
            Settings
          </Link>
          {unread.length > 0 && <MarkAllReadButton />}
          {notifications.length > 0 && <ClearNotificationButton all />}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary)">No notifications yet.</p>
        </div>
      ) : (
        <div className="card p-0 divide-y divide-(--color-border)">
          {notifications.map((n) => {
            const content = (
              <>
                <span className="text-xl shrink-0">{NOTIFICATION_ICONS[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.read ? "text-(--color-text-primary)" : "text-(--color-text-secondary)"}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-small text-(--color-text-secondary) mt-0.5">{n.body}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-small text-(--color-text-disabled)">{formatDate(n.createdAt)}</span>
                    {n.linkUrl && <span className="text-small text-(--color-secondary)">View →</span>}
                  </div>
                </div>
              </>
            );
            const rowClass = "px-5 py-4 flex flex-1 min-w-0 gap-3 transition-colors";
            // The whole notification opens what it's about; ✕ clears it
            return (
              <div key={n.id} className={`flex items-start ${!n.read ? "bg-(--color-primary)/5" : ""}`}>
                {n.linkUrl ? (
                  <Link href={n.linkUrl} className={`${rowClass} hover:bg-(--color-surface-overlay)`}>{content}</Link>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
                <ClearNotificationButton id={n.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CheckoutForm } from "./CheckoutForm";
import { CheckinButton } from "../CheckinButton";
import { BarcodePanel } from "./BarcodePanel";

const CONDITION_BADGE: Record<string, "success"|"warning"|"danger"|"neutral"> = {
  EXCELLENT: "success", GOOD: "success", FAIR: "warning",
  NEEDS_REPAIR: "danger", OUT_OF_SERVICE: "danger", OUT_FOR_MAINTENANCE: "warning",
};

export default async function ToolCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [tool, activeCheckouts] = await Promise.all([
    prisma.tool.findFirst({
      where: { id, teamId: session.user.teamId },
    }),
    prisma.toolCheckout.findMany({
      where: { toolId: id, returnedAt: null },
      include: { user: { select: { name: true } } },
    }),
  ]);

  if (!tool) notFound();

  const checkedOutQty = activeCheckouts.reduce((s, c) => s + c.quantity, 0);
  const available     = tool.quantityOwned - checkedOutQty;

  let hasCert = true;
  if (tool.requiresCertification && tool.certificationName) {
    const cert = await prisma.userCertification.findFirst({
      where: { userId: session.user.id, certName: tool.certificationName, status: "ACTIVE" },
    });
    hasCert = !!cert;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/tools" className="hover:text-[--color-primary]">Tools</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{tool.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">{tool.name}</h1>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant={CONDITION_BADGE[tool.condition] ?? "neutral"}>{tool.condition.replace(/_/g, " ")}</Badge>
            <Badge variant={available > 0 ? "success" : "danger"}>
              {available > 0 ? `${available} available` : "None available"}
            </Badge>
          </div>
        </div>
      </div>

      {tool.requiresCertification && !hasCert && (
        <div className="rounded-md bg-[--color-warning]/10 border border-[--color-warning]/20 px-4 py-3">
          <p className="text-sm font-medium text-[--color-warning]">
            You need <strong>{tool.certificationName}</strong> certification to check out this tool.
          </p>
        </div>
      )}

      {available > 0 && hasCert && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-4">Check out</h2>
          <CheckoutForm toolId={tool.id} maxQty={available} />
        </div>
      )}

      {activeCheckouts.length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Currently checked out</h2>
          <div className="space-y-2">
            {activeCheckouts.map((c) => {
              const isOver = c.expectedReturn < new Date();
              return (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[--color-text-primary]">
                      {c.user.name} · {c.quantity} unit{c.quantity !== 1 ? "s" : ""}
                    </p>
                    <p className={`text-small ${isOver ? "text-[--color-danger] font-medium" : "text-[--color-text-secondary]"}`}>
                      Due {formatDate(c.expectedReturn)}{isOver ? " — OVERDUE" : ""}
                    </p>
                  </div>
                  <CheckinButton checkoutId={c.id} toolName={tool.name} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BarcodePanel toolId={tool.id} toolName={tool.name} assetTag={tool.assetTag} />
    </div>
  );
}

// Small drawn previews of screens the tour talks about but isn't showing (the Volunteers page, the
// request card on Home) — built from the app's own styles, so they match the theme and dark mode, with
// the control that matters highlighted. Decorative: the card's text says the same.

const RED = "var(--color-danger)", GREEN = "var(--color-success)";

function Mock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className="mb-3 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface-overlay) text-[11px] leading-snug sm:text-xs">
      <div className="flex items-center gap-1.5 border-b border-(--color-border) px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-(--color-danger)/70" /><span className="h-2 w-2 rounded-full bg-(--color-warning)/70" /><span className="h-2 w-2 rounded-full bg-(--color-success)/70" />
        <span className="ml-1 font-semibold text-(--color-text-secondary)">{title}</span>
      </div>
      <div className="space-y-1.5 p-2.5">{children}</div>
    </div>
  );
}

/** The thing to look at: outlined, with a pulsing ring and a short label */
function Hi({ label, children, className = "" }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <span className="relative z-10 inline-flex rounded-md ring-2 ring-(--color-primary) ring-offset-2 ring-offset-(--color-surface)">{children}</span>
      <span className="tour-pulse pointer-events-none absolute -inset-1.5 rounded-lg border-2 border-(--color-primary)" />
      {label && (
        <span className="absolute -top-5 right-0 z-20 whitespace-nowrap rounded-full bg-(--color-primary) px-1.5 py-0.5 text-[10px] font-bold text-white shadow">{label}</span>
      )}
    </span>
  );
}

const Pill = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ color: ok ? GREEN : RED, backgroundColor: `color-mix(in srgb, ${ok ? GREEN : RED} 14%, transparent)` }}>{children}</span>
);
const Btn = ({ primary, children }: { primary?: boolean; children: React.ReactNode }) => (
  <span className={`rounded-md px-2 py-1 font-semibold ${primary ? "bg-(--color-primary) text-white" : "border border-(--color-border) text-(--color-text-primary)"}`}>{children}</span>
);
function Row({ when, what, right }: { when: string; what: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-(--color-surface) px-2 py-1.5">
      <span className="min-w-0"><span className="block font-semibold text-(--color-text-primary)">{what}</span><span className="block text-(--color-text-secondary)">{when}</span></span>
      <span className="flex shrink-0 items-center gap-1.5">{right}</span>
    </div>
  );
}

export function VolunteerSignupPreview() {
  return (
    <Mock title="Volunteers">
      <Row what="Build meeting" when="Tue, Nov 10 · 3:00 – 8:00 PM" right={<><Pill ok={false}>1 / 2 adults</Pill><Hi label="Tap"><Btn primary>Sign up</Btn></Hi></>} />
      <Row what="Build meeting" when="Thu, Nov 12 · 3:00 – 8:00 PM" right={<Pill ok>2 / 2 adults</Pill>} />
    </Mock>
  );
}

export function VolunteerAskPreview() {
  return (
    <Mock title="Home">
      <div className="rounded-lg border-l-4 bg-(--color-surface) p-2" style={{ borderLeftColor: "var(--color-warning)" }}>
        <p className="font-bold uppercase tracking-wide" style={{ color: "var(--color-warning)" }}>🙋 Waiting on you · Tomorrow</p>
        <p className="font-semibold text-(--color-text-primary)">The coordinator asked you to volunteer</p>
        <p className="text-(--color-text-secondary)">Build meeting · Tue, Nov 10 · 3:00 – 8:00 PM</p>
        <div className="mt-2 flex gap-1.5"><Hi label="Answer here"><Btn primary>Confirm</Btn></Hi><Btn>Can&apos;t make it</Btn></div>
      </div>
    </Mock>
  );
}

export function CoordinatorCoveragePreview() {
  return (
    <Mock title="Volunteers — next 8 weeks">
      <Row what="Build meeting" when="Tue, Nov 10" right={<Pill ok>2 / 2 adults</Pill>} />
      <div className="rounded-lg ring-1 ring-(--color-danger)/40">
        <Row what="Build meeting" when="Thu, Nov 12" right={<Hi label="Needs adults"><Pill ok={false}>0 / 2 adults</Pill></Hi>} />
      </div>
      <Row what="Outreach — library" when="Sat, Nov 14" right={<Pill ok>3 / 2 adults</Pill>} />
    </Mock>
  );
}

export function CoordinatorFillPreview() {
  return (
    <Mock title="Volunteers">
      <div className="rounded-lg bg-(--color-surface) p-2">
        <div className="flex items-center justify-between"><span className="font-semibold text-(--color-text-primary)">Build meeting · Thu, Nov 12</span><Pill ok={false}>1 / 2 adults</Pill></div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-(--color-success)/40 bg-(--color-success)/10 px-1.5 py-0.5 text-(--color-text-primary)">Jordan ✓ <span className="text-(--color-text-secondary)">×</span></span>
          <span className="rounded-full border border-(--color-warning)/40 bg-(--color-warning)/10 px-1.5 py-0.5 text-(--color-text-primary)">Sam · asked</span>
        </div>
        <div className="mt-5"><Hi label="Ask a cleared adult"><span className="rounded-md border border-(--color-border) px-2 py-1 text-(--color-text-primary)">Ask someone to cover… ▾</span></Hi></div>
      </div>
    </Mock>
  );
}

export function CoordinatorSetupPreview() {
  return (
    <Mock title="Volunteers">
      <div className="flex items-center justify-between rounded-lg bg-(--color-surface) px-2 py-1.5">
        <span className="font-semibold text-(--color-text-primary)">Volunteers</span>
        <Hi label="Defaults"><Btn>Edit Shift Instructions</Btn></Hi>
      </div>
      <div className="rounded-lg bg-(--color-surface) p-2 text-(--color-text-secondary)">
        <p className="font-semibold text-(--color-text-primary)">Default shift instructions</p>
        <p>Check in at the front office · park in lot B · stay until the last student is picked up…</p>
      </div>
    </Mock>
  );
}

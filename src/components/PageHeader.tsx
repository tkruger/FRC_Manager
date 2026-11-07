import { HelpLink, type HelpTopic } from "@/components/HelpLink";
import { HeaderActions, type HeaderItem } from "@/components/HeaderActions";

/**
 * Page title with its Guide button: on a phone at the right of the title row; on a computer right after
 * the words (so it follows a title that wraps).
 */
export function PageTitle({ children, help, share }: { children: React.ReactNode; help?: HelpTopic; share?: React.ReactNode }) {
  const extras = (help || share) && <>{share}{help && <HelpLink topic={help} />}</>;
  return (
    <div className="flex items-start justify-between gap-3 sm:block">
      <h1 className="text-h1 text-(--color-text-primary) min-w-0 break-words">
        {children}
        {extras && <span className="ml-3 hidden translate-y-[-0.2em] items-center gap-2 align-middle sm:inline-flex">{extras}</span>}
      </h1>
      {extras && <span className="mt-1 flex shrink-0 items-center gap-2 sm:hidden">{extras}</span>}
    </div>
  );
}

/**
 * Standard page header — the same on every page.
 *
 *   computer:  breadcrumb / title · Guide / subtitle            [filters] [secondary] [Primary] [⋯]
 *   phone:     breadcrumb / title                     Guide
 *              subtitle
 *                                      [filters] [Primary] [⋯]   (right-aligned; secondary actions move into ⋯)
 *
 * `items` are the page's actions (see HeaderItem). `actions` is for anything that isn't one (rare).
 */
export function PageHeader({
  title,
  help,
  subtitle,
  breadcrumb,
  items,
  filters,
  actions,
}: {
  title: React.ReactNode;
  help?: HelpTopic;
  subtitle?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  items?: (HeaderItem | false | null | undefined | "" | 0)[];
  /** A filter that belongs with the page (the robot picker) — before the actions */
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const list = (items ?? []).filter((i): i is HeaderItem => !!i);
  const right = list.length > 0 || filters || actions;
  // The breadcrumb sits above the row, so the buttons line up with the title itself
  return (
    <div>
      {breadcrumb && <nav className="text-small text-(--color-text-secondary) mb-1">{breadcrumb}</nav>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <PageTitle help={help}>{title}</PageTitle>
        {subtitle && <div className="text-body text-(--color-text-secondary) mt-1">{subtitle}</div>}
      </div>
      {right && (
        <div className="flex flex-wrap items-center justify-end gap-2 sm:max-w-[65%] sm:shrink-0">
          {filters}
          {actions}
          <HeaderActions items={list} />
        </div>
      )}
      </div>
    </div>
  );
}

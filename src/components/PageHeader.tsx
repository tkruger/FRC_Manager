import { HelpLink, type HelpTopic } from "@/components/HelpLink";
import { HeaderActions, type HeaderItem } from "@/components/HeaderActions";

/** Page title with its Guide button right after the words (so it follows a title that wraps) */
export function PageTitle({ children, help, share }: { children: React.ReactNode; help?: HelpTopic; share?: React.ReactNode }) {
  return (
    <h1 className="text-h1 text-(--color-text-primary) min-w-0 break-words">
      {children}
      {(help || share) && (
        <span className="ml-3 inline-flex translate-y-[-0.2em] items-center gap-2 align-middle">
          {share}{help && <HelpLink topic={help} />}
        </span>
      )}
    </h1>
  );
}

/**
 * Standard page header — the same on every page.
 *
 *   computer:  breadcrumb / title · Guide / subtitle            [filters] [secondary] [Primary] [⋯]
 *   phone:     breadcrumb / title · Guide / subtitle
 *              [filters] [Primary] [⋯]                          (secondary actions move into ⋯)
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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        {breadcrumb && <nav className="text-small text-(--color-text-secondary) mb-1">{breadcrumb}</nav>}
        <PageTitle help={help}>{title}</PageTitle>
        {subtitle && <div className="text-body text-(--color-text-secondary) mt-1">{subtitle}</div>}
      </div>
      {right && (
        <div className="flex flex-wrap items-center gap-2 sm:max-w-[65%] sm:shrink-0 sm:justify-end sm:pt-1">
          {filters}
          {actions}
          <HeaderActions items={list} />
        </div>
      )}
    </div>
  );
}

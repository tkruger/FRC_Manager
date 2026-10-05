import { HelpLink, type HelpTopic } from "@/components/HelpLink";

/** Page title with its Guide button: Guide on the right on phones, next to the title from sm up. */
export function PageTitle({ children, help }: { children: React.ReactNode; help?: HelpTopic }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:justify-start">
      <h1 className="text-h1 text-(--color-text-primary) min-w-0 break-words">{children}</h1>
      {help && <HelpLink topic={help} />}
    </div>
  );
}

/**
 * Standard page header.
 * Phones:  title on the left, Guide on the right, subtitle under them, actions on their own row below.
 * sm+:     title + Guide (and subtitle) on the left, actions on the right.
 */
export function PageHeader({
  title,
  help,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: React.ReactNode;
  help?: HelpTopic;
  subtitle?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <nav className="text-small text-(--color-text-secondary) mb-1">{breadcrumb}</nav>}
        <PageTitle help={help}>{title}</PageTitle>
        {subtitle && <div className="text-body text-(--color-text-secondary) mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

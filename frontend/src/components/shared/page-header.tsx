import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      <Breadcrumbs current={breadcrumb} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

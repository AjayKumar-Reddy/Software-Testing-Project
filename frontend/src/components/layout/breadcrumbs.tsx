"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { SEGMENT_LABELS } from "@/lib/navigation";
import { Fragment } from "react";

export function Breadcrumbs({ current }: { current?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return (
    <Breadcrumb className="no-print">
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard" aria-label="Home" />}>
            <Home className="size-3.5" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;
          const label = isLast && current ? current : SEGMENT_LABELS[seg] ?? (seg.length > 16 ? "Details" : decodeURIComponent(seg));
          if (seg === "dashboard" && segments.length === 1) {
            return (
              <Fragment key={href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Dashboard</BreadcrumbPage></BreadcrumbItem>
              </Fragment>
            );
          }
          return (
            <Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? <BreadcrumbPage className="font-medium">{label}</BreadcrumbPage> : <BreadcrumbLink render={<Link href={href} />}>{label}</BreadcrumbLink>}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

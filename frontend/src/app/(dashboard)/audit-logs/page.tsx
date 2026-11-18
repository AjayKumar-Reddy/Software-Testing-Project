"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { AppSelect } from "@/components/shared/app-select";
import { useDebounce } from "@/hooks/use-debounce";
import { get, getPage } from "@/lib/api";
import { cn, formatDateTime, titleCase } from "@/lib/utils";
import type { AuditLog } from "@/types";

const ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  APPROVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  UPDATE: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  MARK: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  LOGIN: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  DELETE: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  REJECT: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  ARCHIVE: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  DEACTIVATE: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  LOGIN_FAILED: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const facets = useQuery({ queryKey: ["audit", "facets"], queryFn: () => get<{ modules: string[]; actions: string[] }>("/audit-logs/facets") });
  const filters = { search: q, module, action, from, to, page, limit: 20 };
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["audit", filters], queryFn: () => getPage<AuditLog>("/audit-logs", filters), placeholderData: keepPreviousData });
  const p = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };
  return (
    <div>
      <PageHeader title="Audit Logs" description="A tamper-evident trail of sign-ins and administrative actions." />
      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <SearchInput value={search} onChange={p(setSearch)} placeholder="Search user, description, record…" />
          <div className="w-40"><AppSelect value={module} onChange={p(setModule)} allLabel="All modules" options={(facets.data?.modules ?? []).map((m) => ({ value: m, label: titleCase(m) }))} /></div>
          <div className="w-44"><AppSelect value={action} onChange={p(setAction)} allLabel="All actions" options={(facets.data?.actions ?? []).map((m) => ({ value: m, label: titleCase(m.toLowerCase()) }))} /></div>
          <Input type="date" aria-label="From" value={from} onChange={(e) => p(setFrom)(e.target.value)} className="h-9 w-38" />
          <Input type="date" aria-label="To" value={to} onChange={(e) => p(setTo)(e.target.value)} className="h-9 w-38" />
        </div>
        <DataTable
          data={data?.items}
          loading={isLoading || isFetching}
          error={error}
          onRetry={() => refetch()}
          rowKey={(l) => l._id}
          meta={data?.meta}
          onPageChange={setPage}
          empty={{ icon: ShieldCheck, title: "No audit entries match" }}
          columns={[
            { key: "time", header: "Timestamp", cell: (l) => <span className="whitespace-nowrap text-xs tabular">{formatDateTime(l.createdAt)}</span> },
            { key: "user", header: "User", cell: (l) => <div><p className="font-medium">{l.userName}</p><p className="text-xs text-muted-foreground">{titleCase(l.role)}</p></div> },
            { key: "action", header: "Action", cell: (l) => <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", ACTION_STYLE[l.action] ?? "bg-muted")}>{l.action}</span> },
            { key: "module", header: "Module", cell: (l) => <span className="text-xs">{titleCase(l.module)}</span> },
            { key: "desc", header: "Description", cell: (l) => <span className="text-[13px]">{l.description || "—"}</span> },
            { key: "record", header: "Record ID", cell: (l) => <span className="font-mono text-[11px] text-muted-foreground">{l.recordId ? `…${l.recordId.slice(-8)}` : "—"}</span> },
            { key: "ip", header: "IP", cell: (l) => <span className="font-mono text-[11px] text-muted-foreground">{l.ip || "—"}</span> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

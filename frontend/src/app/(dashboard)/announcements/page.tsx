"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Megaphone, MoreHorizontal, Pencil, Pin, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { AppSelect } from "@/components/shared/app-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { AnnouncementDialog } from "@/components/forms/announcement-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/auth-context";
import { apiError, del, getPage } from "@/lib/api";
import { cn, formatDate, formatDateTime, timeAgo, titleCase } from "@/lib/utils";
import type { Announcement } from "@/types";

const PRIORITY_BAR = { urgent: "bg-rose-500", important: "bg-amber-500", normal: "bg-blue-500" } as const;

function AnnouncementsInner() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { role } = useAuth();
  const isStaff = role !== "faculty";
  const [manage, setManage] = useState(false);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Announcement | null | undefined>(params.get("new") === "1" ? null : undefined);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const q = useDebounce(search);
  const filters = { search: q, priority, category, page, limit: 8, manage: manage ? "true" : undefined };
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ["announcements", filters], queryFn: () => getPage<Announcement>("/announcements", filters), placeholderData: keepPreviousData });
  const remove = useMutation({
    mutationFn: (a: Announcement) => del(`/announcements/${a._id}`),
    onSuccess: () => { toast.success("Announcement deleted"); qc.invalidateQueries({ queryKey: ["announcements"] }); setDeleting(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const p = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Institution-wide and department notices, events and updates."
        actions={isStaff && <Button onClick={() => setEditing(null)}><Plus className="size-4" /> New announcement</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={p(setSearch)} placeholder="Search titles…" />
        <div className="w-36"><AppSelect value={priority} onChange={p(setPriority)} allLabel="Any priority" options={[{ value: "urgent", label: "Urgent" }, { value: "important", label: "Important" }, { value: "normal", label: "Normal" }]} /></div>
        <div className="w-40"><AppSelect value={category} onChange={p(setCategory)} allLabel="All categories" options={["general", "event", "academic", "administrative"].map((c) => ({ value: c, label: titleCase(c) }))} /></div>
        {isStaff && (
          <div className="ml-auto inline-flex rounded-lg border bg-card p-0.5">
            {[{ v: false, l: "Live" }, { v: true, l: "Manage all (incl. scheduled & expired)" }].map((o) => (
              <button key={String(o.v)} type="button" onClick={() => { setManage(o.v); setPage(1); }} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition", manage === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{o.l}</button>
            ))}
          </div>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <SectionCard bodyClassName="p-0"><TableSkeleton /></SectionCard>
      ) : !data?.items.length ? (
        <SectionCard><EmptyState icon={Megaphone} title="No announcements" description="Nothing to show for the current filters." /></SectionCard>
      ) : (
        <div className={cn("space-y-3 transition-opacity", isFetching && "opacity-60")}>
          {data.items.map((a) => (
            <article key={a._id} className="relative overflow-hidden rounded-xl border bg-card p-5 pl-6 shadow-card transition hover:shadow-card-hover">
              <span className={cn("absolute inset-y-0 left-0 w-1", PRIORITY_BAR[a.priority])} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {a.isPinned && <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600"><Pin className="size-3" /> Pinned</span>}
                    {a.priority !== "normal" && <StatusBadge status={a.priority} />}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">{titleCase(a.category)}</span>
                    {a.state && a.state !== "published" && <StatusBadge status={a.state} />}
                  </div>
                  <h3 className="font-heading text-base font-semibold">{a.title}</h3>
                </div>
                {a.canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Announcement actions" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setEditing(a)}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(a)}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{a.content}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{a.createdBy?.name} · {timeAgo(a.publishAt)}</span>
                <span className="flex items-center gap-1"><Users className="size-3" /> {a.audience === "all" ? "All faculty" : a.departments.map((d) => d.code).join(", ")}</span>
                {a.eventDate && <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-300"><CalendarDays className="size-3" /> Event on {formatDate(a.eventDate, "EEE, d MMM yyyy")}</span>}
                {a.expiresAt && <span>Expires {formatDateTime(a.expiresAt)}</span>}
              </div>
            </article>
          ))}
          <div className="rounded-xl border bg-card"><Pagination meta={data.meta} onPageChange={setPage} /></div>
        </div>
      )}
      <AnnouncementDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} announcement={editing} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete announcement?" description={`“${deleting?.title}” will be removed for everyone.`} confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <Suspense>
      <AnnouncementsInner />
    </Suspense>
  );
}

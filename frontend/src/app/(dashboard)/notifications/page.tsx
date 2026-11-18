"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AppSelect } from "@/components/shared/app-select";
import { Pagination } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { NOTIF_ICONS, NOTIF_TONES } from "@/components/layout/notification-bell";
import { apiError, del, getPage, patch } from "@/lib/api";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { AppNotification } from "@/types";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [unread, setUnread] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const filters = { unread: unread || undefined, type, page, limit: 15 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["notifications", "page", filters], queryFn: () => getPage<AppNotification>("/notifications", filters), placeholderData: keepPreviousData });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({ mutationFn: (id: string) => patch(`/notifications/${id}/read`), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => patch("/notifications/read-all"), onSuccess: () => { toast.success("All marked as read"); invalidate(); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/notifications/${id}`), onSuccess: invalidate, onError: (e) => toast.error(apiError(e)) });
  const unreadCount = Number(data?.meta?.unread ?? 0);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
        actions={<Button variant="outline" onClick={() => readAll.mutate()} disabled={!unreadCount || readAll.isPending}><CheckCheck className="size-4" /> Mark all as read</Button>}
      />
      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap gap-2 border-b p-4">
          <div className="w-36"><AppSelect value={unread} onChange={(v) => { setUnread(v); setPage(1); }} allLabel="All" options={[{ value: "true", label: "Unread only" }]} /></div>
          <div className="w-44"><AppSelect value={type} onChange={(v) => { setType(v); setPage(1); }} allLabel="All types" options={[{ value: "announcement", label: "Announcements" }, { value: "leave", label: "Leave" }, { value: "workload", label: "Workload" }, { value: "timetable", label: "Timetable" }, { value: "system", label: "System" }]} /></div>
        </div>
        {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? <TableSkeleton /> : !data?.items.length ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
        ) : (
          <>
            <ul className="divide-y">
              {data.items.map((n) => {
                const Icon = NOTIF_ICONS[n.type];
                return (
                  <li key={n._id} className={cn("group flex gap-4 px-5 py-4 transition hover:bg-muted/40", !n.isRead && "bg-blue-50/40 dark:bg-blue-500/5")}>
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", NOTIF_TONES[n.type])}><Icon className="size-5" /></span>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { if (!n.isRead) read.mutate(n._id); if (n.link) router.push(n.link); }}>
                      <p className={cn("text-sm", !n.isRead ? "font-semibold" : "font-medium")}>{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</p>
                    </button>
                    <div className="flex items-start gap-1 opacity-70 transition group-hover:opacity-100">
                      {!n.isRead && <Button variant="ghost" size="icon-sm" onClick={() => read.mutate(n._id)} aria-label="Mark as read"><Check className="size-4" /></Button>}
                      <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(n._id)} aria-label="Delete notification"><Trash2 className="size-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </SectionCard>
    </div>
  );
}

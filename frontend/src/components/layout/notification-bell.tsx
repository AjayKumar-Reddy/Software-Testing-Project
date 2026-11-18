"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, CalendarMinus, CheckCheck, Gauge, Info, Megaphone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getPage, patch } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import type { AppNotification } from "@/types";

export const NOTIF_ICONS = { announcement: Megaphone, leave: CalendarMinus, workload: Gauge, timetable: CalendarClock, system: Info } as const;
export const NOTIF_TONES = {
  announcement: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  leave: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  workload: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  timetable: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  system: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
} as const;

export function NotificationBell() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["notifications", "bell"],
    queryFn: () => getPage<AppNotification>("/notifications", { limit: 6 }),
    refetchInterval: 60_000,
  });
  const unread = Number(data?.meta?.unread ?? 0);
  const markAll = useMutation({
    mutationFn: () => patch("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const open = useMutation({
    mutationFn: (n: AppNotification) => (n.isRead ? Promise.resolve(null) : patch(`/notifications/${n._id}/read`)),
    onSuccess: (_d, n) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (n.link) router.push(n.link);
    },
  });

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative rounded-full" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} />}>
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          {!data?.items.length ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            data.items.map((n) => {
              const Icon = NOTIF_ICONS[n.type] ?? Info;
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => open.mutate(n)}
                  className={cn("flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-0 hover:bg-muted/60", !n.isRead && "bg-blue-50/50 dark:bg-blue-500/5")}
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", NOTIF_TONES[n.type])}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("line-clamp-1 text-[13px]", n.isRead ? "font-medium" : "font-semibold")}>{n.title}</span>
                      {!n.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" render={<Link href="/notifications" />}>
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

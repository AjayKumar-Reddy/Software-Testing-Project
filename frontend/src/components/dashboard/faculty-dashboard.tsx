"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarClock, CalendarMinus, ChevronRight, Gauge, Megaphone, Percent, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { CardsSkeleton, ChartSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarChartView } from "@/components/charts/charts";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { NOTIF_ICONS, NOTIF_TONES } from "@/components/layout/notification-bell";
import { get } from "@/lib/api";
import { cn, formatDate, pct, timeAgo, titleCase } from "@/lib/utils";
import type { Announcement, AppNotification, AttendanceStats, LeaveApplication, LeaveBalance } from "@/types";

interface FacultyDashboardData {
  academicYear: string;
  profile: { fullName: string; designation: string; facultyId: string; department: { name: string; code: string } } | null;
  attendance: { month: AttendanceStats; last90Days: AttendanceStats };
  leaveBalance: LeaveBalance[];
  pendingLeaves: number;
  subjects: { _id: string; name: string; code: string; semester: number; credits: number; type: string }[];
  weeklyHours: number;
  workloadLimits: { minWeeklyHours: number; maxWeeklyHours: number };
  classesToday: { _id: string; startTime: string; endTime: string; room: string; section: string; subject: { name: string; code: string } }[];
  announcements: Announcement[];
  notifications: AppNotification[];
  recentLeaves: LeaveApplication[];
  monthlyAttendance: { month: string; present: number; late: number; absent: number; onLeave: number; percentage: number }[];
}

export function FacultyDashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => get<FacultyDashboardData>("/dashboard") });
  const available = data?.leaveBalance.reduce((a, b) => a + b.available, 0) ?? 0;
  const max = data?.workloadLimits.maxWeeklyHours ?? 18;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${data?.profile?.fullName.split(" ")[0] ?? ""}`}
        description={data?.profile ? `${data.profile.designation} · ${data.profile.department.name} · ${data.profile.facultyId}` : "Your personal dashboard"}
        actions={
          <Button render={<Link href="/leaves?apply=1" />}>
            <Plus className="size-4" /> Apply for leave
          </Button>
        }
      />
      <CheckInCard />
      {error ? (
        <SectionCard><ErrorState error={error} onRetry={() => refetch()} /></SectionCard>
      ) : isLoading || !data ? (
        <CardsSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Attendance this month" value={pct(data.attendance.month.percentage)} icon={Percent} tone="green" href="/attendance" hint={`${data.attendance.month.present + data.attendance.month.late} of ${data.attendance.month.total - data.attendance.month.onLeave} working days`} />
          <StatCard label="Leave available" value={`${available} d`} icon={CalendarMinus} tone="amber" href="/leaves" hint={`${data.pendingLeaves} application(s) pending`} />
          <StatCard label="Weekly teaching hours" value={data.weeklyHours} icon={Gauge} tone={data.weeklyHours > max ? "red" : "blue"} href="/workload" hint={`Institution limit: ${data.workloadLimits.minWeeklyHours}–${max} hrs`} />
          <StatCard label="Assigned subjects" value={data.subjects.length} icon={BookOpen} tone="violet" href="/subjects" hint={`Academic year ${data.academicYear}`} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Today's classes" description={formatDate(new Date(), "EEEE, d MMM")} bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/timetable" />}>Timetable <ChevronRight className="size-3.5" /></Button>}>
          {!data?.classesToday.length ? (
            <EmptyState icon={CalendarClock} title="No classes today" description="Your schedule is clear." className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.classesToday.map((c) => (
                <li key={c._id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-16 text-center">
                    <p className="text-sm font-semibold tabular">{c.startTime}</p>
                    <p className="text-[11px] text-muted-foreground tabular">{c.endTime}</p>
                  </div>
                  <div className="h-10 w-1 rounded-full bg-blue-500/80" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.subject.name}</p>
                    <p className="text-xs text-muted-foreground">{c.subject.code} · {c.section} · Room {c.room}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="My attendance" description="Monthly breakdown" className="xl:col-span-2">
          {isLoading ? <ChartSkeleton /> : (
            <BarChartView
              data={data?.monthlyAttendance ?? []}
              xKey="month"
              stacked
              height={250}
              series={[
                { key: "present", label: "Present", color: "var(--chart-3)" },
                { key: "late", label: "Late", color: "var(--chart-4)" },
                { key: "absent", label: "Absent", color: "var(--chart-6)" },
                { key: "onLeave", label: "On leave", color: "var(--chart-1)" },
              ]}
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Leave balance" description={data?.academicYear} actions={<Button variant="ghost" size="sm" render={<Link href="/leaves" />}>History <ChevronRight className="size-3.5" /></Button>}>
          <div className="space-y-4">
            {data?.leaveBalance.map((b) => (
              <div key={b.type}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{titleCase(b.type)}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    <span className="font-semibold text-foreground">{b.available}</span> / {b.allocated} left{b.pending ? ` · ${b.pending} pending` : ""}
                  </span>
                </div>
                <Progress value={b.allocated ? ((b.used + b.pending) / b.allocated) * 100 : 0} className="h-1.5" />
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="My subjects" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/subjects" />}>All <ChevronRight className="size-3.5" /></Button>}>
          {!data?.subjects.length ? (
            <EmptyState icon={BookOpen} title="No subjects assigned" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.subjects.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.code} · Semester {s.semester} · {s.credits} credits</p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">{s.type}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recent notifications" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/notifications" />}>All <ChevronRight className="size-3.5" /></Button>}>
          {!data?.notifications.length ? (
            <EmptyState icon={Megaphone} title="No notifications" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.notifications.map((n) => {
                const Icon = NOTIF_ICONS[n.type];
                return (
                  <li key={n._id} className="flex gap-3 px-5 py-3">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", NOTIF_TONES[n.type])}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("line-clamp-1 text-sm", !n.isRead && "font-semibold")}>{n.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Announcements" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/announcements" />}>All <ChevronRight className="size-3.5" /></Button>}>
          {!data?.announcements.length ? (
            <EmptyState icon={Megaphone} title="No announcements" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.announcements.map((a) => (
                <li key={a._id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.priority !== "normal" && <StatusBadge status={a.priority} dot={false} />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recent leave applications" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/leaves" />}>All <ChevronRight className="size-3.5" /></Button>}>
          {!data?.recentLeaves.length ? (
            <EmptyState icon={CalendarMinus} title="No leave applications" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.recentLeaves.map((l) => (
                <li key={l._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{titleCase(l.leaveType)} leave · {l.days} day{l.days > 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(l.startDate)} – {formatDate(l.endDate)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

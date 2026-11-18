"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarMinus,
  CalendarX2,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  Megaphone,
  Percent,
  Pin,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { CardsSkeleton, ChartSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AreaTrend, BarChartView, DonutChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/shared/page-header";
import { get } from "@/lib/api";
import { firstName, formatDate, pct, timeAgo, titleCase } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import type { Announcement, AuditLog, LeaveApplication } from "@/types";

interface AdminDashboardData {
  scope: "institution" | "department";
  academicYear: string;
  stats: {
    totalFaculty: number;
    activeFaculty: number;
    totalDepartments: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
    notMarkedToday: number;
    pendingLeaves: number;
    assignedCourses: number;
    averageAttendance: number | null;
  };
  charts: {
    facultyByDepartment: { department: string; code: string; count: number }[];
    designationDistribution: { designation: string; count: number }[];
    monthlyAttendance: { month: string; present: number; late: number; absent: number; onLeave: number; percentage: number }[];
    leaveByStatus: { status: string; count: number }[];
    leaveByType: { type: string; count: number; days: number }[];
    departmentStrength: { code: string; department: string; professors: number; associate: number; assistant: number; others: number; total: number }[];
  };
  recentFaculty: { _id: string; fullName: string; facultyId: string; designation: string; photo?: string; createdAt: string; department: { code: string } }[];
  pendingLeaveRequests: LeaveApplication[];
  upcomingEvents: Announcement[];
  recentActivities: AuditLog[];
  announcements: Announcement[];
}

const ACTION_TONES: Record<string, string> = {
  CREATE: "bg-emerald-500", APPROVE: "bg-emerald-500", LOGIN: "bg-sky-500", UPDATE: "bg-blue-500", MARK: "bg-blue-500",
  REJECT: "bg-rose-500", DELETE: "bg-rose-500", ARCHIVE: "bg-rose-500", DEACTIVATE: "bg-rose-500", LOGIN_FAILED: "bg-rose-500",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function AdminDashboard() {
  const { user, role } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => get<AdminDashboardData>("/dashboard") });
  const s = data?.stats;
  const isHod = role === "hod";
  const greetName = user?.faculty?.firstName ?? firstName(user?.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${greetName}`}
        description={
          <>
            {isHod ? `${user?.faculty?.department?.name} · Department overview` : "Institution overview"} · Academic year {data?.academicYear ?? "—"}
          </>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href="/attendance?tab=mark" />}>
              <CalendarCheck className="size-4" /> Mark attendance
            </Button>
            <Button render={<Link href="/faculty/new" />}>
              <UserPlus className="size-4" /> Add faculty
            </Button>
          </>
        }
      />

      {error ? (
        <SectionCard><ErrorState error={error} onRetry={() => refetch()} /></SectionCard>
      ) : isLoading || !s ? (
        <CardsSkeleton count={8} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total faculty" value={s.totalFaculty} icon={Users} tone="navy" href="/faculty" hint={<>{s.activeFaculty} currently active</>} />
          <StatCard label="Active faculty" value={s.activeFaculty} icon={UserCheck} tone="green" href="/faculty?status=active" hint={<>{s.totalFaculty ? Math.round((s.activeFaculty / s.totalFaculty) * 100) : 0}% of total strength</>} />
          <StatCard label={isHod ? "Department" : "Departments"} value={s.totalDepartments} icon={Building2} tone="violet" href="/departments" hint={isHod ? user?.faculty?.department?.code : "Academic departments"} />
          <StatCard label="Present today" value={s.presentToday} icon={CalendarCheck} tone="blue" href="/attendance" hint={<>{s.onLeaveToday} on leave · {s.notMarkedToday} not marked</>} />
          <StatCard label="Absent today" value={s.absentToday} icon={CalendarX2} tone="red" href="/attendance?status=absent" hint="Marked absent for today" />
          <StatCard label="Pending leave" value={s.pendingLeaves} icon={CalendarMinus} tone="amber" href="/leaves?status=pending" hint="Awaiting a decision" />
          <StatCard label="Assigned courses" value={s.assignedCourses} icon={ClipboardList} tone="sky" href="/subjects?tab=allocation" hint={`Subjects with faculty, ${data.academicYear}`} />
          <StatCard label="Avg. attendance" value={pct(s.averageAttendance)} icon={Percent} tone="green" href="/reports?type=attendance" hint="Last 30 days" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Monthly attendance trend" description="Attendance rate and daily status counts over the last six months" className="xl:col-span-2" actions={<Button variant="ghost" size="sm" render={<Link href="/attendance" />}>Details <ChevronRight className="size-3.5" /></Button>}>
          {isLoading ? <ChartSkeleton /> : <AreaTrend data={data?.charts.monthlyAttendance ?? []} xKey="month" series={[{ key: "percentage", label: "Attendance %" }]} unit="%" domain={[60, 100]} />}
        </SectionCard>
        <SectionCard title="Leave applications" description={`By status · ${data?.academicYear ?? ""}`}>
          {isLoading ? <ChartSkeleton /> : <DonutChart data={(data?.charts.leaveByStatus ?? []).map((l) => ({ ...l, status: titleCase(l.status) }))} nameKey="status" valueKey="count" centerLabel="applications" />}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title={isHod ? "Faculty by designation" : "Faculty by department"} description="Current faculty headcount" className="xl:col-span-1">
          {isLoading ? <ChartSkeleton /> : isHod ? (
            <BarChartView data={data?.charts.designationDistribution ?? []} xKey="designation" series={[{ key: "count", label: "Faculty" }]} horizontal height={260} />
          ) : (
            <BarChartView data={data?.charts.facultyByDepartment ?? []} xKey="code" series={[{ key: "count", label: "Faculty" }]} height={260} />
          )}
        </SectionCard>
        <SectionCard title="Designation distribution" description="Share of faculty by rank">
          {isLoading ? <ChartSkeleton /> : <DonutChart data={data?.charts.designationDistribution ?? []} nameKey="designation" valueKey="count" centerLabel="faculty" />}
        </SectionCard>
        <SectionCard title="Department-wise strength" description="Faculty composition by rank">
          {isLoading ? <ChartSkeleton /> : (
            <BarChartView
              data={data?.charts.departmentStrength ?? []}
              xKey="code"
              stacked
              height={260}
              series={[
                { key: "professors", label: "Professor" },
                { key: "associate", label: "Associate" },
                { key: "assistant", label: "Assistant" },
                { key: "others", label: "Others" },
              ]}
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="Pending leave requests" description="Most recent applications awaiting review" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/leaves?status=pending" />}>Review all <ChevronRight className="size-3.5" /></Button>}>
          {!data?.pendingLeaveRequests.length ? (
            <EmptyState icon={CalendarMinus} title="No pending requests" description="All leave applications have been reviewed." className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.pendingLeaveRequests.map((l) => (
                <li key={l._id}>
                  <Link href={`/leaves?status=pending&focus=${l._id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50">
                    <UserAvatar name={`${l.faculty.firstName} ${l.faculty.lastName}`} photo={l.faculty.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.faculty.firstName} {l.faculty.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {titleCase(l.leaveType)} · {l.days} day{l.days > 1 ? "s" : ""} · {formatDate(l.startDate, "d MMM")} – {formatDate(l.endDate, "d MMM")}
                      </p>
                    </div>
                    <StatusBadge status="pending" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent faculty registrations" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/faculty" />}>View all <ChevronRight className="size-3.5" /></Button>}>
          {!data?.recentFaculty.length ? (
            <EmptyState icon={Users} title="No faculty yet" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.recentFaculty.map((f) => (
                <li key={f._id}>
                  <Link href={`/faculty/${f._id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50">
                    <UserAvatar name={f.fullName} photo={f.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.designation} · {f.department?.code}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(f.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Upcoming events" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/announcements" />}>All <ChevronRight className="size-3.5" /></Button>}>
          {!data?.upcomingEvents.length ? (
            <EmptyState icon={CalendarDays} title="No upcoming events" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.upcomingEvents.map((e) => (
                <li key={e._id} className="flex items-center gap-3.5 px-5 py-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border bg-blue-50/60 py-1.5 dark:bg-blue-500/10">
                    <span className="text-[10px] font-semibold text-blue-600 uppercase dark:text-blue-300">{formatDate(e.eventDate, "MMM")}</span>
                    <span className="font-heading text-lg leading-none font-bold">{formatDate(e.eventDate, "d")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{e.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{formatDate(e.eventDate, "EEEE")} · {e.audience === "all" ? "All faculty" : "Department"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title={isHod ? "Department activity" : "Recent system activity"} description="Latest audited actions" className="xl:col-span-2" actions={role === "admin" ? <Button variant="ghost" size="sm" render={<Link href="/audit-logs" />}>Audit logs <ChevronRight className="size-3.5" /></Button> : undefined}>
          {!data?.recentActivities.length ? (
            <EmptyState icon={Activity} title="No recent activity" className="py-8" />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {data.recentActivities.map((a) => (
                <li key={a._id} className="relative">
                  <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card ${ACTION_TONES[a.action] ?? "bg-slate-400"}`} />
                  <p className="text-sm">
                    <span className="font-medium">{a.userName}</span> <span className="text-muted-foreground">— {a.description || `${a.action} in ${a.module}`}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {titleCase(a.module)} · {timeAgo(a.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
        <SectionCard title="Important announcements" bodyClassName="p-0" actions={<Button variant="ghost" size="sm" render={<Link href="/announcements" />}>All <ChevronRight className="size-3.5" /></Button>}>
          {!data?.announcements.length ? (
            <EmptyState icon={Megaphone} title="No announcements" className="py-10" />
          ) : (
            <ul className="divide-y">
              {data.announcements.map((a) => (
                <li key={a._id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">
                      {a.isPinned && <Pin className="mr-1 inline size-3 text-blue-500" />}
                      {a.title}
                    </p>
                    {a.priority !== "normal" && <StatusBadge status={a.priority} dot={false} />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{a.createdBy?.name} · {timeAgo(a.publishAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Quick actions" className="no-print">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/faculty/new", icon: UserPlus, label: "Add faculty member", tone: "text-blue-600 bg-blue-50 dark:bg-blue-500/10" },
            { href: "/attendance?tab=mark", icon: CalendarCheck, label: "Mark today's attendance", tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
            { href: "/announcements?new=1", icon: Megaphone, label: "Publish announcement", tone: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
            { href: "/reports", icon: FileBarChart, label: "Generate a report", tone: "text-violet-600 bg-violet-50 dark:bg-violet-500/10" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-blue-200 hover:shadow-card-hover dark:hover:border-blue-500/30">
              <span className={`flex size-10 items-center justify-center rounded-lg ${q.tone}`}>
                <q.icon className="size-5" />
              </span>
              <span className="text-sm font-medium">{q.label}</span>
              <ChevronRight className="ml-auto size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

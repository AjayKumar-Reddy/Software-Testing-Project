"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, startOfMonth } from "date-fns";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, CalendarCheck, CalendarX2, Clock, ListChecks, Pencil, Percent, Plane, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ExportMenu } from "@/components/shared/export-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ChartSkeleton, EmptyState } from "@/components/shared/states";
import { AreaTrend, BarChartView } from "@/components/charts/charts";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { MarkAttendance } from "@/components/attendance/mark-attendance";
import { EditAttendanceDialog } from "@/components/attendance/edit-attendance-dialog";
import { useDepartments, useFacultyOptions } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, del, get, getPage } from "@/lib/api";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { formatDate, pct, todayInput } from "@/lib/utils";
import type { AttendanceRecord, AttendanceStats } from "@/types";

const monthStart = () => format(startOfMonth(new Date()), "yyyy-MM-dd");

function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="date" aria-label="From date" value={from} max={to || todayInput()} onChange={(e) => onFrom(e.target.value)} className="h-9 w-40" />
      <span className="text-xs text-muted-foreground">to</span>
      <Input type="date" aria-label="To date" value={to} min={from} max={todayInput()} onChange={(e) => onTo(e.target.value)} className="h-9 w-40" />
    </div>
  );
}

function SummaryCards({ stats, loading }: { stats?: AttendanceStats; loading?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Attendance rate" value={pct(stats?.percentage)} icon={Percent} tone="green" loading={loading} hint="(Present + late) ÷ working days, excluding leave" />
      <StatCard label="Present" value={stats?.present ?? 0} icon={CalendarCheck} tone="blue" loading={loading} />
      <StatCard label="Late" value={stats?.late ?? 0} icon={Clock} tone="amber" loading={loading} />
      <StatCard label="Absent" value={stats?.absent ?? 0} icon={CalendarX2} tone="red" loading={loading} />
      <StatCard label="On leave" value={stats?.onLeave ?? 0} icon={Plane} tone="violet" loading={loading} />
    </div>
  );
}

function Overview() {
  const { role } = useAuth();
  const { data: departments } = useDepartments();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayInput());
  const [department, setDepartment] = useState("");
  const params = { from, to, department };
  const summary = useQuery({ queryKey: ["attendance", "summary", params], queryFn: () => get<AttendanceStats>("/attendance/summary", params) });
  const trend = useQuery({ queryKey: ["attendance", "trend", params], queryFn: () => get<{ period: string; percentage: number | null; present: number; late: number; absent: number; onLeave: number }[]>("/attendance/trend", params) });
  const depts = useQuery({ queryKey: ["attendance", "dept", params], queryFn: () => get<(AttendanceStats & { code: string; department: string })[]>("/attendance/department-stats", { from, to }) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        {role === "admin" && <div className="w-52"><AppSelect value={department} onChange={setDepartment} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} /></div>}
        <div className="ml-auto"><ExportMenu report="attendance" params={params} label="Export report" /></div>
      </div>
      <SummaryCards stats={summary.data} loading={summary.isLoading} />
      <div className="grid gap-6 xl:grid-cols-5">
        <SectionCard title="Daily attendance rate" description="Percentage of faculty present or late each day" className="xl:col-span-3">
          {trend.isLoading ? <ChartSkeleton /> : <AreaTrend data={(trend.data ?? []).map((t) => ({ ...t, day: formatDate(t.period, "d MMM") }))} xKey="day" series={[{ key: "percentage", label: "Attendance %" }]} unit="%" domain={[0, 100]} />}
        </SectionCard>
        <SectionCard title="Department-wise attendance" description="Attendance % in the selected range" className="xl:col-span-2">
          {depts.isLoading ? <ChartSkeleton /> : <BarChartView data={(depts.data ?? []).map((d) => ({ code: d.code, percentage: d.percentage ?? 0 }))} xKey="code" series={[{ key: "percentage", label: "Attendance %" }]} unit="%" horizontal height={280} />}
        </SectionCard>
      </div>
      <SectionCard title="Status breakdown by day" description="Stacked daily counts">
        {trend.isLoading ? <ChartSkeleton /> : (
          <BarChartView
            data={(trend.data ?? []).map((t) => ({ ...t, day: formatDate(t.period, "d MMM") }))}
            xKey="day"
            stacked
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
  );
}

function Records({ selfOnly }: { selfOnly?: boolean }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { role } = useAuth();
  const { data: faculty } = useFacultyOptions();
  const { data: departments } = useDepartments();
  const [from, setFrom] = useState(selfOnly ? "" : monthStart());
  const [to, setTo] = useState(todayInput());
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [fac, setFac] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [deleting, setDeleting] = useState<AttendanceRecord | null>(null);
  const filters = { from, to, status, faculty: fac, department, page, limit: 15 };
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["attendance", "list", filters], queryFn: () => getPage<AttendanceRecord>("/attendance", filters), placeholderData: keepPreviousData });
  const remove = useMutation({
    mutationFn: (r: AttendanceRecord) => del(`/attendance/${r._id}`),
    onSuccess: () => { toast.success("Record deleted"); qc.invalidateQueries({ queryKey: ["attendance"] }); setDeleting(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const p = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };

  return (
    <SectionCard bodyClassName="p-0" title={selfOnly ? "My attendance history" : undefined} actions={selfOnly ? <ExportMenu report="attendance" params={{ from, to }} size="sm" /> : undefined}>
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <DateRange from={from} to={to} onFrom={p(setFrom)} onTo={p(setTo)} />
        {!selfOnly && <div className="w-56"><Combobox value={fac} onChange={p(setFac)} clearable placeholder="All faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: f.facultyId }))} /></div>}
        {!selfOnly && role === "admin" && <div className="w-44"><AppSelect value={department} onChange={p(setDepartment)} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} /></div>}
        <div className="w-40"><AppSelect value={status} onChange={p(setStatus)} allLabel="All statuses" options={ATTENDANCE_STATUSES} /></div>
        {!selfOnly && <div className="ml-auto"><ExportMenu report="attendance" params={{ from, to, faculty: fac, department }} size="sm" /></div>}
      </div>
      <DataTable
        data={data?.items}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => refetch()}
        rowKey={(r) => r._id}
        meta={data?.meta}
        onPageChange={setPage}
        empty={{ icon: ListChecks, title: "No attendance records", description: "Try a different date range or filter." }}
        columns={[
          { key: "date", header: "Date", cell: (r) => <div><p className="font-medium">{formatDate(r.date, "d MMM yyyy")}</p><p className="text-xs text-muted-foreground">{formatDate(r.date, "EEEE")}</p></div> },
          ...(!selfOnly ? [{ key: "faculty", header: "Faculty", cell: (r: AttendanceRecord) => typeof r.faculty === "object" ? <div className="flex items-center gap-2.5"><UserAvatar name={`${r.faculty.firstName} ${r.faculty.lastName}`} photo={r.faculty.photo} className="size-8" /><div><p className="font-medium">{r.faculty.firstName} {r.faculty.lastName}</p><p className="text-xs text-muted-foreground">{r.faculty.facultyId}</p></div></div> : null }] : []),
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "in", header: "Check-in", cell: (r) => <span className="tabular">{r.checkIn ?? "—"}</span> },
          { key: "out", header: "Check-out", cell: (r) => <span className="tabular">{r.checkOut ?? "—"}</span> },
          { key: "source", header: "Source", cell: (r) => <span className="text-xs text-muted-foreground">{r.source === "self" ? "Self-reported" : r.source === "leave" ? "Approved leave" : `Marked by ${typeof r.markedBy === "object" ? r.markedBy.name : "staff"}`}</span> },
          { key: "remarks", header: "Remarks", cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.remarks || "—"}</span> },
          ...(!selfOnly ? [{
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-20 text-right", cell: (r: AttendanceRecord) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label="Edit record"><Pencil className="size-4" /></Button>
                {role === "admin" && <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)} aria-label="Delete record"><Trash2 className="size-4 text-rose-500" /></Button>}
              </div>
            ),
          }] : []),
        ]}
      />
      <EditAttendanceDialog record={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete attendance record?" description={`This removes the record for ${formatDate(deleting?.date)}. The day will show as not recorded.`} confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </SectionCard>
  );
}

function CalendarTab() {
  const { data: faculty } = useFacultyOptions();
  const [fac, setFac] = useState("");
  const selected = fac || faculty?.[0]?._id;
  return (
    <SectionCard title="Monthly attendance calendar" actions={<div className="w-64"><Combobox value={selected ?? ""} onChange={setFac} placeholder="Select faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: `${f.facultyId} · ${f.department?.code}` }))} /></div>}>
      {selected ? <AttendanceCalendar facultyId={selected} /> : <EmptyState icon={CalendarDays} title="Select a faculty member" />}
    </SectionCard>
  );
}

function FacultyAttendance() {
  const [from] = useState(monthStart());
  const month = useQuery({ queryKey: ["attendance", "summary", "me", from], queryFn: () => get<AttendanceStats>("/attendance/summary", { from }) });
  return (
    <div className="space-y-6">
      <CheckInCard />
      <SummaryCards stats={month.data} loading={month.isLoading} />
      <div className="grid gap-6 xl:grid-cols-5">
        <SectionCard title="Calendar" className="xl:col-span-3"><AttendanceCalendar /></SectionCard>
        <div className="xl:col-span-2"><Records selfOnly /></div>
      </div>
    </div>
  );
}

function AttendancePageInner() {
  const { role } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? (params.get("status") ? "records" : "overview");
  if (role === "faculty")
    return (
      <div>
        <PageHeader title="My Attendance" description="Check in, review your monthly calendar and download your attendance report." />
        <FacultyAttendance />
      </div>
    );
  return (
    <div>
      <PageHeader title="Attendance" description={role === "hod" ? "Monitor and record attendance for your department." : "Monitor and record faculty attendance across the institution."} />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/attendance?tab=${v}`)}>
        <TabsList>
          <TabsTrigger value="overview" className="px-3"><BarChart3 className="size-4" /> Overview</TabsTrigger>
          <TabsTrigger value="mark" className="px-3"><CalendarCheck className="size-4" /> Mark attendance</TabsTrigger>
          <TabsTrigger value="records" className="px-3"><ListChecks className="size-4" /> Records</TabsTrigger>
          <TabsTrigger value="calendar" className="px-3"><CalendarDays className="size-4" /> Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><Overview /></TabsContent>
        <TabsContent value="mark" className="mt-4"><MarkAttendance /></TabsContent>
        <TabsContent value="records" className="mt-4"><Records /></TabsContent>
        <TabsContent value="calendar" className="mt-4"><CalendarTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense>
      <AttendancePageInner />
    </Suspense>
  );
}

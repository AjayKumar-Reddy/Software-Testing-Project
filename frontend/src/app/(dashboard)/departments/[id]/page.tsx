"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, Clock, Crown, Mail, MapPin, Pencil, Phone, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { CardsSkeleton, ErrorState } from "@/components/shared/states";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ExportMenu } from "@/components/shared/export-menu";
import { BarChartView, DonutChart } from "@/components/charts/charts";
import { DepartmentDialog } from "@/components/forms/department-dialog";
import { useAuth } from "@/contexts/auth-context";
import { get } from "@/lib/api";
import { pct } from "@/lib/utils";
import type { AttendanceStats, Department } from "@/types";

interface DeptDetail extends Department {
  faculty: { _id: string; facultyId: string; fullName: string; designation: string; status: string; email: string; photo?: string; experienceYears: number }[];
  stats: {
    facultyCount: number;
    activeCount: number;
    byDesignation: { designation: string; count: number }[];
    subjectCount: number;
    courses: { _id: string; name: string; code: string; level: string }[];
    attendanceLast30Days: AttendanceStats;
    workload: { _id: string; name: string; hours: number }[];
    totalWeeklyHours: number;
  };
}

export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["department", id], queryFn: () => get<DeptDetail>(`/departments/${id}`) });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.name ?? "Department"}
        breadcrumb={data?.code}
        description={data && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{data.code}{data.establishedYear ? ` · Established ${data.establishedYear}` : ""}</span>
            {data.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{data.location}</span>}
            {data.email && <span className="flex items-center gap-1"><Mail className="size-3.5" />{data.email}</span>}
            {data.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" />{data.phone}</span>}
          </span>
        )}
        actions={
          <>
            <ExportMenu report="faculty-directory" params={{ department: id }} label="Faculty list" />
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
          </>
        }
      />
      {isLoading || !data ? (
        <CardsSkeleton />
      ) : (
        <>
          {data.description && <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">{data.description}</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Faculty" value={data.stats.facultyCount} icon={Users} tone="navy" hint={`${data.stats.activeCount} active`} />
            <StatCard label="Attendance (30 days)" value={pct(data.stats.attendanceLast30Days.percentage)} icon={CalendarCheck} tone="green" hint={`${data.stats.attendanceLast30Days.absent} absences recorded`} />
            <StatCard label="Subjects this year" value={data.stats.subjectCount} icon={BookOpen} tone="violet" hint={`${data.stats.courses.length} course(s)`} />
            <StatCard label="Weekly teaching hours" value={data.stats.totalWeeklyHours} icon={Clock} tone="amber" hint={`${data.stats.workload.length ? (data.stats.totalWeeklyHours / data.stats.workload.length).toFixed(1) : 0} avg per teaching faculty`} />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard title="Head of department">
              {data.head ? (
                <div className="flex items-center gap-3">
                  <UserAvatar name={`${data.head.firstName} ${data.head.lastName}`} photo={data.head.photo} className="size-12" />
                  <div>
                    <p className="font-medium">{data.head.firstName} {data.head.lastName}</p>
                    <p className="text-xs text-muted-foreground">{data.head.designation} · {data.head.email}</p>
                  </div>
                  <Crown className="ml-auto size-5 text-amber-500" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No head assigned{role === "admin" ? " — assign one from the Departments page." : "."}</p>
              )}
              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Courses offered</p>
                {data.stats.courses.map((c) => (
                  <div key={c._id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{c.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{c.level}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Faculty by designation">
              <DonutChart data={data.stats.byDesignation} nameKey="designation" valueKey="count" centerLabel="faculty" height={240} />
            </SectionCard>
            <SectionCard title="Workload by faculty" description="Weekly teaching hours (current year)">
              <BarChartView data={data.stats.workload.map((w) => ({ ...w, name: w.name.split(" ")[0] }))} xKey="name" series={[{ key: "hours", label: "Hours" }]} horizontal height={240} unit=" hrs" />
            </SectionCard>
          </div>
          <SectionCard title="Department faculty" description={`${data.faculty.length} members`} bodyClassName="p-0" actions={<Button size="sm" variant="outline" render={<Link href={`/faculty?department=${id}`} />}><UserCheck className="size-4" /> Manage</Button>}>
            <DataTable
              data={data.faculty}
              rowKey={(f) => f._id}
              onRowClick={(f) => router.push(`/faculty/${f._id}`)}
              columns={[
                { key: "name", header: "Name", cell: (f) => <div className="flex items-center gap-3"><UserAvatar name={f.fullName} photo={f.photo} /><div><p className="font-medium">{f.fullName}</p><p className="text-xs text-muted-foreground">{f.email}</p></div></div> },
                { key: "id", header: "ID", cell: (f) => <span className="font-mono text-xs">{f.facultyId}</span> },
                { key: "designation", header: "Designation", cell: (f) => f.designation },
                { key: "exp", header: "Experience", cell: (f) => `${f.experienceYears} yrs` },
                { key: "status", header: "Status", cell: (f) => <StatusBadge status={f.status} /> },
              ]}
            />
          </SectionCard>
        </>
      )}
      <DepartmentDialog open={editing} onOpenChange={setEditing} department={data} />
    </div>
  );
}

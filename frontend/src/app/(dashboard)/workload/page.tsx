"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BatteryLow, Clock, Gauge, Layers, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { AppSelect } from "@/components/shared/app-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { ChartSkeleton, EmptyState } from "@/components/shared/states";
import { BarChartView } from "@/components/charts/charts";
import { WorkloadDialog } from "@/components/forms/workload-dialog";
import { useDepartments } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { apiError, del, get, getPage } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import type { Workload, WorkloadSummaryRow } from "@/types";

interface Summary {
  academicYear: string;
  term: string;
  limits: { min: number; max: number };
  rows: WorkloadSummaryRow[];
  departments: { department: string; code: string; hours: number; faculty: number; overloaded: number; underutilized: number; average: number }[];
  totals: { faculty: number; hours: number; overloaded: number; underutilized: number; optimal: number };
}

export default function WorkloadPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { role } = useAuth();
  const isStaff = role !== "faculty";
  const { data: settings } = useSettings();
  const { data: departments } = useDepartments();
  const [term, setTerm] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Workload | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Workload | null>(null);
  const academicYear = year || settings?.academicYear;
  const t = term || settings?.currentSemester.toLowerCase() || "odd";

  const summary = useQuery({ queryKey: ["workload", "summary", academicYear, t, department], queryFn: () => get<Summary>("/workload/summary", { academicYear, term: t, department }), enabled: !!academicYear });
  const list = useQuery({ queryKey: ["workload", "list", academicYear, t, department, page], queryFn: () => getPage<Workload>("/workload", { academicYear, term: t, department, page, limit: 10 }), enabled: !!academicYear, placeholderData: keepPreviousData });
  const remove = useMutation({
    mutationFn: (w: Workload) => del(`/workload/${w._id}`),
    onSuccess: () => { toast.success("Allocation removed"); qc.invalidateQueries({ queryKey: ["workload"] }); setDeleting(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const s = summary.data;
  const alerts = (s?.rows ?? []).filter((r) => r.status !== "optimal");

  return (
    <div className="space-y-6">
      <PageHeader
        title={isStaff ? "Workload" : "My Workload"}
        description={`Weekly teaching hours for ${academicYear ?? ""} · ${titleCase(t)} semester. Institutional limits: ${s?.limits.min ?? "—"}–${s?.limits.max ?? "—"} hrs/week.`}
        actions={
          <>
            <div className="w-32"><AppSelect value={t} onChange={(v) => { setTerm(v); setPage(1); }} options={[{ value: "odd", label: "Odd sem" }, { value: "even", label: "Even sem" }, { value: "all", label: "Full year" }]} /></div>
            <div className="w-28"><AppSelect value={academicYear ?? ""} onChange={(v) => { setYear(v); setPage(1); }} options={["2025-26", "2026-27", "2027-28"].map((y) => ({ value: y, label: y }))} /></div>
            {role === "admin" && <div className="w-40"><AppSelect value={department} onChange={(v) => { setDepartment(v); setPage(1); }} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} /></div>}
            <ExportMenu report="workload" params={{ academicYear, term: t, department }} />
            {isStaff && <Button onClick={() => setEditing(null)}><Plus className="size-4" /> Allocate</Button>}
          </>
        }
      />

      {isStaff ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Faculty with load data" value={s?.totals.faculty ?? 0} icon={Users} tone="navy" loading={summary.isLoading} />
          <StatCard label="Total weekly hours" value={s?.totals.hours ?? 0} icon={Clock} tone="blue" loading={summary.isLoading} hint={s ? `${(s.totals.hours / Math.max(1, s.totals.faculty)).toFixed(1)} hrs average` : undefined} />
          <StatCard label="Overloaded" value={s?.totals.overloaded ?? 0} icon={AlertTriangle} tone="red" loading={summary.isLoading} hint={`Above ${s?.limits.max ?? "—"} hrs/week`} />
          <StatCard label="Underutilized" value={s?.totals.underutilized ?? 0} icon={BatteryLow} tone="amber" loading={summary.isLoading} hint={`Below ${s?.limits.min ?? "—"} hrs/week`} />
        </div>
      ) : (
        s?.rows[0] && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="My weekly hours" value={s.rows[0].hours} icon={Clock} tone={s.rows[0].status === "overloaded" ? "red" : "blue"} hint={<StatusBadge status={s.rows[0].status} />} />
            <StatCard label="Subjects" value={s.rows[0].subjectCount} icon={Layers} tone="violet" hint={`${s.rows[0].lecture} lecture · ${s.rows[0].lab} lab · ${s.rows[0].tutorial} tutorial hrs`} />
            <StatCard label="Utilization" value={`${s.rows[0].utilization}%`} icon={Gauge} tone="green" hint={`of the ${s.limits.max} hr maximum`} />
          </div>
        )
      )}

      {isStaff && (
        <div className="grid gap-6 xl:grid-cols-3">
          <SectionCard title="Workload distribution" description="Weekly hours per faculty member" className="xl:col-span-2">
            {summary.isLoading ? <ChartSkeleton /> : (
              <BarChartView
                data={(s?.rows ?? []).slice(0, 30).map((r) => ({ name: `${r.faculty.firstName} ${r.faculty.lastName[0]}.`, lecture: r.lecture, lab: r.lab, tutorial: r.tutorial }))}
                xKey="name"
                stacked
                unit=" hrs"
                series={[{ key: "lecture", label: "Lecture" }, { key: "lab", label: "Lab" }, { key: "tutorial", label: "Tutorial" }]}
                height={300}
              />
            )}
          </SectionCard>
          <SectionCard title="Workload alerts" description="Faculty outside the configured limits" bodyClassName="p-0">
            {!alerts.length ? (
              <EmptyState icon={Gauge} title="All faculty within limits" className="py-10" />
            ) : (
              <ul className="max-h-[330px] divide-y overflow-y-auto scrollbar-thin">
                {alerts.map((r) => (
                  <li key={r.faculty._id}>
                    <button type="button" onClick={() => router.push(`/faculty/${r.faculty._id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/50">
                      <span className={cn("flex size-8 items-center justify-center rounded-lg", r.status === "overloaded" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10")}>
                        {r.status === "overloaded" ? <AlertTriangle className="size-4" /> : <BatteryLow className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.faculty.fullName}</p>
                        <p className="text-xs text-muted-foreground">{r.faculty.department?.code} · {r.hours} hrs/week</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {role === "admin" && !!s?.departments.length && (
        <SectionCard title="Department workload" description="Total and average weekly hours by department">
          <BarChartView data={s.departments} xKey="code" series={[{ key: "hours", label: "Total hours" }, { key: "average", label: "Avg per faculty" }]} height={260} />
        </SectionCard>
      )}

      {isStaff && (
        <SectionCard title="Faculty workload summary" bodyClassName="p-0">
          <DataTable
            data={s?.rows}
            loading={summary.isLoading}
            error={summary.error}
            onRetry={() => summary.refetch()}
            rowKey={(r) => r.faculty._id}
            onRowClick={(r) => router.push(`/faculty/${r.faculty._id}`)}
            columns={[
              { key: "faculty", header: "Faculty", cell: (r) => <div className="flex items-center gap-2.5"><UserAvatar name={r.faculty.fullName} photo={r.faculty.photo} className="size-8" /><div><p className="font-medium">{r.faculty.fullName}</p><p className="text-xs text-muted-foreground">{r.faculty.designation} · {r.faculty.department?.code}</p></div></div> },
              { key: "subjects", header: "Subjects", cell: (r) => r.subjectCount },
              { key: "split", header: "Lecture / Lab / Tut.", cell: (r) => <span className="tabular text-xs">{r.lecture} / {r.lab} / {r.tutorial}</span> },
              { key: "hours", header: "Total", cell: (r) => <span className="font-semibold tabular">{r.hours} hrs</span> },
              { key: "util", header: "Utilization", className: "min-w-40", cell: (r) => <div className="flex items-center gap-2"><Progress value={Math.min(100, r.utilization)} className={cn("h-1.5 w-24", r.status === "overloaded" && "[&_[data-slot=progress-indicator]]:bg-rose-500")} /><span className="text-xs tabular">{r.utilization}%</span></div> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </SectionCard>
      )}

      <SectionCard title={isStaff ? "Allocations" : "My allocations"} description={`${list.data?.meta.total ?? 0} allocation(s) · ${list.data?.meta.totalHours ?? 0} hrs/week`} bodyClassName="p-0">
        <DataTable
          data={list.data?.items}
          loading={list.isLoading || list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(w) => w._id}
          meta={list.data?.meta}
          onPageChange={setPage}
          empty={{ icon: Layers, title: "No workload allocations", description: isStaff ? "Allocate subjects to faculty to build the workload plan." : "You have no allocations for this term." }}
          columns={[
            ...(isStaff ? [{ key: "faculty", header: "Faculty", cell: (w: Workload) => <span className="font-medium">{w.faculty.firstName} {w.faculty.lastName}</span> }] : []),
            { key: "subject", header: "Subject", cell: (w) => <div><p className="font-medium">{w.subject.name}</p><p className="text-xs text-muted-foreground">{w.subject.code} · {w.course?.code ?? w.department.code}</p></div> },
            { key: "sem", header: "Sem", cell: (w) => w.semester },
            { key: "section", header: "Section", cell: (w) => w.section },
            { key: "type", header: "Type", cell: (w) => <span className="capitalize">{w.type}</span> },
            { key: "hours", header: "Hrs/week", cell: (w) => <span className="font-semibold tabular">{w.weeklyHours}</span> },
            ...(isStaff ? [{
              key: "actions", header: <span className="sr-only">Actions</span>, className: "w-20 text-right", cell: (w: Workload) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(w)} aria-label="Edit allocation"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(w)} aria-label="Remove allocation"><Trash2 className="size-4 text-rose-500" /></Button>
                </div>
              ),
            }] : []),
          ]}
        />
      </SectionCard>
      <WorkloadDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} workload={editing} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Remove allocation?" description={`${deleting?.subject.code} (${deleting?.weeklyHours} hrs) for ${deleting?.faculty.firstName} ${deleting?.faculty.lastName}. The faculty member will be notified.`} confirmLabel="Remove" destructive loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </div>
  );
}

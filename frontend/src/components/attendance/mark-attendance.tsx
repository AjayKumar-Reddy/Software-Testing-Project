"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, Loader2, Save, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/shared/section-card";
import { AppSelect } from "@/components/shared/app-select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useDepartments } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, get, post } from "@/lib/api";
import { cn, todayInput, titleCase } from "@/lib/utils";
import type { AttendanceRecord, AttendanceStatus, FacultyOption } from "@/types";

interface Row {
  faculty: FacultyOption;
  record: (AttendanceRecord & { markedBy?: { name: string } }) | null;
  leave: { leaveType: string } | null;
}
interface Draft {
  status: AttendanceStatus | "";
  checkIn: string;
  checkOut: string;
  remarks: string;
}

const STATUS_BTNS: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "present", label: "Present", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "late", label: "Late", active: "bg-amber-500 text-white border-amber-500" },
  { value: "absent", label: "Absent", active: "bg-rose-600 text-white border-rose-600" },
];

export function MarkAttendance() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const { data: departments } = useDepartments();
  const [date, setDate] = useState(todayInput());
  const [department, setDepartment] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["attendance", "daily", date, department],
    queryFn: () => get<{ date: string; isWorkingDay: boolean; rows: Row[] }>("/attendance/daily", { date, department }),
  });

  useEffect(() => {
    if (!data) return;
    setDrafts(
      Object.fromEntries(
        data.rows.map((r) => [
          r.faculty._id,
          {
            status: r.leave ? "on_leave" : (r.record?.status ?? ""),
            checkIn: r.record?.checkIn ?? "",
            checkOut: r.record?.checkOut ?? "",
            remarks: r.record?.remarks ?? "",
          },
        ]),
      ),
    );
  }, [data]);

  const update = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const unmarked = useMemo(() => (data?.rows ?? []).filter((r) => !r.leave && !drafts[r.faculty._id]?.status), [data, drafts]);
  const changed = useMemo(
    () =>
      (data?.rows ?? []).filter((r) => {
        const d = drafts[r.faculty._id];
        if (!d?.status) return false;
        const rec = r.record;
        return !rec || rec.status !== d.status || (rec.checkIn ?? "") !== d.checkIn || (rec.checkOut ?? "") !== d.checkOut || (rec.remarks ?? "") !== d.remarks;
      }),
    [data, drafts],
  );

  const save = useMutation({
    mutationFn: () =>
      post<{ saved: number; skipped: { reason: string }[] }>("/attendance/bulk", {
        date,
        records: changed.map((r) => ({ faculty: r.faculty._id, ...drafts[r.faculty._id] })),
      }),
    onSuccess: (res) => {
      toast.success(res.message ?? "Attendance saved");
      res.data.skipped.forEach((s) => toast.warning(s.reason));
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const markAllPresent = () => {
    setDrafts((d) => {
      const next = { ...d };
      for (const r of unmarked) next[r.faculty._id] = { ...next[r.faculty._id], status: "present" };
      return next;
    });
  };

  return (
    <SectionCard
      title="Daily attendance register"
      description="Records are saved per faculty per day — re-saving updates the existing entry instead of creating a duplicate."
      bodyClassName="p-0"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={markAllPresent} disabled={!unmarked.length}>
            <CheckCheck className="size-4" /> Mark {unmarked.length} unmarked present
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!changed.length || save.isPending || data?.isWorkingDay === false}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save {changed.length ? `(${changed.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <div className="space-y-1.5">
          <label htmlFor="att-date" className="text-xs font-medium text-muted-foreground">Date</label>
          <Input id="att-date" type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value || todayInput())} className="h-9 w-44" />
        </div>
        {role === "admin" && (
          <div className="w-52 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Department</span>
            <AppSelect value={department} onChange={setDepartment} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} />
          </div>
        )}
        {data && (
          <p className="ml-auto text-xs text-muted-foreground">
            {data.rows.length} faculty · {data.rows.filter((r) => r.record).length} recorded · {data.rows.filter((r) => r.leave).length} on leave
          </p>
        )}
      </div>
      {data?.isWorkingDay === false && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="size-4" /> The selected date is not a configured working day. Attendance cannot be recorded.
        </div>
      )}
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.rows.length ? (
        <EmptyState icon={UserCheck} title="No active faculty in this scope" />
      ) : (
        <div className="divide-y">
          {data.rows.map((r) => {
            const d = drafts[r.faculty._id] ?? { status: "", checkIn: "", checkOut: "", remarks: "" };
            const timed = d.status === "present" || d.status === "late";
            return (
              <div key={r.faculty._id} className={cn("grid items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(220px,1.3fr)_auto_minmax(220px,1fr)_minmax(160px,1fr)]", !d.status && !r.leave && "bg-amber-50/40 dark:bg-amber-500/5")}>
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={r.faculty.fullName} photo={r.faculty.photo} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.faculty.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.faculty.facultyId} · {r.faculty.department?.code}
                      {r.record && <> · {r.record.source === "self" ? "Self-reported" : `by ${r.record.markedBy?.name ?? "staff"}`}</>}
                    </p>
                  </div>
                </div>
                {r.leave ? (
                  <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">On approved {titleCase(r.leave.leaveType)} leave</span>
                ) : (
                  <div className="flex gap-1" role="radiogroup" aria-label={`Status for ${r.faculty.fullName}`}>
                    {STATUS_BTNS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        role="radio"
                        aria-checked={d.status === b.value}
                        onClick={() => update(r.faculty._id, { status: b.value })}
                        className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition", d.status === b.value ? b.active : "bg-background hover:bg-muted")}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input type="time" aria-label="Check-in" value={d.checkIn} disabled={!timed} onChange={(e) => update(r.faculty._id, { checkIn: e.target.value })} className="h-8 w-[120px] text-xs" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="time" aria-label="Check-out" value={d.checkOut} disabled={!timed} onChange={(e) => update(r.faculty._id, { checkOut: e.target.value })} className="h-8 w-[120px] text-xs" />
                </div>
                <Input placeholder="Remarks" aria-label="Remarks" value={d.remarks} disabled={!!r.leave} onChange={(e) => update(r.faculty._id, { remarks: e.target.value })} className="h-8 text-xs" />
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

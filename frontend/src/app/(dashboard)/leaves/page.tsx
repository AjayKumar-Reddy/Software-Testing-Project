"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarMinus, CheckCircle2, ClipboardList, Eye, Hourglass, Paperclip, Plus, Scale, SlidersHorizontal, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { CardsSkeleton } from "@/components/shared/states";
import { ApplyLeaveDialog } from "@/components/leave/apply-leave-dialog";
import { ReviewLeaveDialog } from "@/components/leave/review-leave-dialog";
import { BalanceDialog, type BalanceTarget } from "@/components/leave/balance-dialog";
import { useDepartments, useFacultyOptions } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, get, getPage, patch } from "@/lib/api";
import { LEAVE_STATUSES, LEAVE_TYPES } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/utils";
import type { LeaveApplication, LeaveBalance } from "@/types";

function Applications({ mine, onReview }: { mine?: boolean; onReview: (l: LeaveApplication) => void }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { role, user } = useAuth();
  const { data: departments } = useDepartments();
  const { data: faculty } = useFacultyOptions();
  const [status, setStatus] = useState(mine ? "" : params.get("status") ?? "");
  const [leaveType, setLeaveType] = useState("");
  const [department, setDepartment] = useState("");
  const [fac, setFac] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<LeaveApplication | null>(null);
  const filters = { status, leaveType, department, faculty: fac, from, to, page, limit: 10, mine: mine ? "true" : undefined };
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["leaves", filters], queryFn: () => getPage<LeaveApplication>("/leaves", filters), placeholderData: keepPreviousData });
  const counts = (data?.meta?.statusCounts ?? {}) as Record<string, number>;

  const focus = params.get("focus");
  useEffect(() => {
    if (focus && data?.items) {
      const f = data.items.find((l) => l._id === focus);
      if (f) onReview(f);
    }
  }, [focus, data, onReview]);

  const cancel = useMutation({
    mutationFn: (l: LeaveApplication) => patch(`/leaves/${l._id}/cancel`),
    onSuccess: () => { toast.success("Leave cancelled"); qc.invalidateQueries({ queryKey: ["leaves"] }); qc.invalidateQueries({ queryKey: ["leave-balance"] }); setCancelling(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const p = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending" value={counts.pending ?? 0} icon={Hourglass} tone="amber" />
        <StatCard label="Approved" value={counts.approved ?? 0} icon={CheckCircle2} tone="green" />
        <StatCard label="Rejected" value={counts.rejected ?? 0} icon={XCircle} tone="red" />
        <StatCard label="Cancelled" value={counts.cancelled ?? 0} icon={CalendarMinus} tone="slate" />
      </div>
      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <div className="w-36"><AppSelect value={status} onChange={p(setStatus)} allLabel="All statuses" options={LEAVE_STATUSES} /></div>
          <div className="w-40"><AppSelect value={leaveType} onChange={p(setLeaveType)} allLabel="All types" options={LEAVE_TYPES} /></div>
          {!mine && role === "admin" && <div className="w-40"><AppSelect value={department} onChange={p(setDepartment)} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} /></div>}
          {!mine && <div className="w-56"><Combobox value={fac} onChange={p(setFac)} clearable placeholder="All faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: f.facultyId }))} /></div>}
          <Input type="date" aria-label="From" value={from} onChange={(e) => p(setFrom)(e.target.value)} className="h-9 w-38" />
          <Input type="date" aria-label="To" value={to} min={from} onChange={(e) => p(setTo)(e.target.value)} className="h-9 w-38" />
          <div className="ml-auto"><ExportMenu report="leave" params={{ status, department, faculty: mine ? user?.faculty?._id : fac, from, to }} size="sm" /></div>
        </div>
        <DataTable
          data={data?.items}
          loading={isLoading || isFetching}
          error={error}
          onRetry={() => refetch()}
          rowKey={(l) => l._id}
          onRowClick={onReview}
          meta={data?.meta}
          onPageChange={setPage}
          empty={{ icon: ClipboardList, title: "No leave applications", description: mine ? "Apply for leave to see it here." : "No applications match the current filters." }}
          columns={[
            ...(!mine ? [{ key: "faculty", header: "Faculty", cell: (l: LeaveApplication) => <div className="flex items-center gap-2.5"><UserAvatar name={`${l.faculty.firstName} ${l.faculty.lastName}`} photo={l.faculty.photo} className="size-8" /><div><p className="font-medium">{l.faculty.firstName} {l.faculty.lastName}</p><p className="text-xs text-muted-foreground">{l.department?.code} · {l.faculty.designation}</p></div></div> }] : []),
            { key: "type", header: "Type", cell: (l) => <span className="font-medium">{titleCase(l.leaveType)}</span> },
            { key: "period", header: "Period", cell: (l) => <span className="whitespace-nowrap">{formatDate(l.startDate, "d MMM")} – {formatDate(l.endDate, "d MMM yyyy")}</span> },
            { key: "days", header: "Days", cell: (l) => l.days },
            { key: "reason", header: "Reason", cell: (l) => <span className="line-clamp-1 max-w-[260px] text-xs text-muted-foreground">{l.document && <Paperclip className="mr-1 inline size-3" />}{l.reason}</span> },
            { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
            {
              key: "actions", header: <span className="sr-only">Actions</span>, className: "text-right", cell: (l) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {l.canReview ? (
                    <Button size="xs" onClick={() => onReview(l)}>Review</Button>
                  ) : (
                    <Button variant="ghost" size="icon-sm" onClick={() => onReview(l)} aria-label="View details"><Eye className="size-4" /></Button>
                  )}
                  {((l.status === "pending" && (mine || l.faculty._id === user?.faculty?._id || role === "admin")) || (l.status === "approved" && role === "admin" && l.startDate.slice(0, 10) > today)) && (
                    <Button variant="ghost" size="xs" className="text-rose-600" onClick={() => setCancelling(l)}>Cancel</Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </SectionCard>
      <ConfirmDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)} title="Cancel this leave?" description={cancelling?.status === "approved" ? "The approved leave will be withdrawn, its balance restored and the generated attendance entries removed." : "The pending application will be withdrawn."} confirmLabel="Cancel leave" destructive loading={cancel.isPending} onConfirm={() => cancelling && cancel.mutate(cancelling)} />
    </div>
  );
}

function MyBalance() {
  const { data, isLoading } = useQuery({ queryKey: ["leave-balance", "me"], queryFn: () => get<LeaveBalance[]>("/leaves/balance") });
  if (isLoading) return <CardsSkeleton count={5} className="xl:grid-cols-5" />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {data?.map((b) => (
        <div key={b.type} className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-[13px] font-medium text-muted-foreground">{titleCase(b.type)} leave</p>
          <p className="mt-1 font-heading text-2xl font-bold">{b.available}<span className="text-sm font-medium text-muted-foreground"> / {b.allocated} days</span></p>
          <Progress value={b.allocated ? ((b.used + b.pending) / b.allocated) * 100 : 0} className="mt-3 h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">{b.used} used · {b.pending} pending</p>
        </div>
      ))}
    </div>
  );
}

function Balances() {
  const { role } = useAuth();
  const { data: departments } = useDepartments();
  const [department, setDepartment] = useState("");
  const [target, setTarget] = useState<BalanceTarget | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["leaves", "balances", department],
    queryFn: async () => {
      const res = await getPage<{ faculty: BalanceTarget["faculty"] & { department: { code: string }; designation: string }; balances: LeaveBalance[] }>("/leaves/balances", { department });
      return res;
    },
  });
  const year = String(data?.meta?.academicYear ?? "");
  const types = ["casual", "sick", "earned", "medical", "other"] as const;
  return (
    <SectionCard bodyClassName="p-0" title="Leave balances" description={`Available / allocated days · ${year}`} actions={role === "admin" && <div className="w-44"><AppSelect value={department} onChange={setDepartment} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} /></div>}>
      <DataTable
        data={data?.items}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        rowKey={(r) => r.faculty._id}
        onRowClick={role === "admin" ? (r) => setTarget({ ...r, academicYear: year }) : undefined}
        columns={[
          { key: "faculty", header: "Faculty", cell: (r) => <div><p className="font-medium">{r.faculty.fullName}</p><p className="text-xs text-muted-foreground">{r.faculty.facultyId} · {r.faculty.department?.code}</p></div> },
          ...types.map((t) => ({
            key: t,
            header: titleCase(t),
            cell: (r: { balances: LeaveBalance[] }) => {
              const b = r.balances.find((x) => x.type === t);
              if (!b) return "—";
              const low = b.allocated > 0 && b.available / b.allocated < 0.25;
              return <span className={`tabular ${low ? "font-semibold text-rose-600" : ""}`}>{b.available}<span className="text-muted-foreground">/{b.allocated}</span>{b.pending ? <span className="ml-1 text-[11px] text-amber-600">({b.pending}p)</span> : null}</span>;
            },
          })),
          ...(role === "admin" ? [{ key: "edit", header: <span className="sr-only">Adjust</span>, className: "text-right", cell: () => <Button variant="ghost" size="xs"><Scale className="size-3.5" /> Adjust</Button> }] : []),
        ]}
      />
      <BalanceDialog target={target} onOpenChange={(o) => !o && setTarget(null)} />
    </SectionCard>
  );
}

function LeavesInner() {
  const { role, user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [applying, setApplying] = useState(params.get("apply") === "1");
  const [reviewing, setReviewing] = useState<LeaveApplication | null>(null);
  const tab = params.get("tab") ?? "applications";
  const isStaff = role !== "faculty";
  const canApplyForSelf = Boolean(user?.faculty) || role === "admin";

  return (
    <div>
      <PageHeader
        title={isStaff ? "Leave Management" : "My Leave"}
        description={isStaff ? "Review applications, monitor balances and track leave across your scope." : "Apply for leave, track approvals and monitor your balance."}
        actions={canApplyForSelf && <Button onClick={() => setApplying(true)}><Plus className="size-4" /> {role === "admin" && !user?.faculty ? "Record leave" : "Apply for leave"}</Button>}
      />
      {isStaff ? (
        <Tabs value={tab} onValueChange={(v) => router.replace(`/leaves?tab=${v}`)}>
          <TabsList>
            <TabsTrigger value="applications" className="px-3"><ClipboardList className="size-4" /> Applications</TabsTrigger>
            <TabsTrigger value="balances" className="px-3"><Scale className="size-4" /> Balances</TabsTrigger>
            {user?.faculty && <TabsTrigger value="mine" className="px-3"><User className="size-4" /> My leave</TabsTrigger>}
          </TabsList>
          <TabsContent value="applications" className="mt-4"><Applications onReview={setReviewing} /></TabsContent>
          <TabsContent value="balances" className="mt-4"><Balances /></TabsContent>
          {user?.faculty && (
            <TabsContent value="mine" className="mt-4 space-y-6">
              <MyBalance />
              <Applications mine onReview={setReviewing} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="space-y-6">
          <MyBalance />
          <Applications mine onReview={setReviewing} />
        </div>
      )}
      <ApplyLeaveDialog open={applying} onOpenChange={setApplying} />
      <ReviewLeaveDialog leave={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />
    </div>
  );
}

export default function LeavesPage() {
  return (
    <Suspense>
      <LeavesInner />
    </Suspense>
  );
}

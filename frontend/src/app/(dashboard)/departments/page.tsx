"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, Clock, Crown, MapPin, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { DepartmentDialog } from "@/components/forms/department-dialog";
import { AssignHeadDialog } from "@/components/forms/assign-head-dialog";
import { useDepartments } from "@/hooks/use-options";
import { useAuth } from "@/contexts/auth-context";
import { apiError, del } from "@/lib/api";
import type { Department } from "@/types";

const ACCENTS = ["from-blue-500 to-indigo-600", "from-sky-500 to-blue-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-violet-500 to-purple-600", "from-rose-500 to-pink-600", "from-cyan-500 to-sky-600"];

export default function DepartmentsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useDepartments();
  const [editing, setEditing] = useState<Department | null | undefined>(undefined);
  const [heading, setHeading] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const remove = useMutation({
    mutationFn: (d: Department) => del(`/departments/${d._id}`),
    onSuccess: () => {
      toast.success("Department deleted");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const totals = (data ?? []).reduce((a, d) => ({ faculty: a.faculty + d.facultyCount, subjects: a.subjects + d.subjectCount, hours: a.hours + d.weeklyHours }), { faculty: 0, subjects: 0, hours: 0 });

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Departments" : "My Department"}
        description={isAdmin ? `${data?.length ?? 0} departments · ${totals.faculty} faculty · ${totals.subjects} subjects · ${totals.hours} weekly teaching hours` : "Department overview and faculty"}
        actions={
          isAdmin && (
            <>
              <ExportMenu report="department-summary" />
              <Button onClick={() => setEditing(null)}>
                <Plus className="size-4" /> New department
              </Button>
            </>
          )
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardsSkeleton count={6} className="xl:grid-cols-3" />
      ) : !data?.length ? (
        <EmptyState icon={Building2} title="No departments yet" description="Create your first academic department." action={isAdmin && <Button onClick={() => setEditing(null)}><Plus className="size-4" /> New department</Button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((d, i) => (
            <div key={d._id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className={`h-1.5 bg-gradient-to-r ${ACCENTS[i % ACCENTS.length]}`} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/departments/${d._id}`} className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${ACCENTS[i % ACCENTS.length]}`}>{d.code.slice(0, 3)}</span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-heading text-[15px] leading-snug font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.code}{d.establishedYear ? ` · Est. ${d.establishedYear}` : ""}</p>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`} />}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setEditing(d)}><Pencil className="size-4" /> Edit details</DropdownMenuItem>
                        {isAdmin && <DropdownMenuItem onClick={() => setHeading(d)}><Crown className="size-4" /> Assign head</DropdownMenuItem>}
                      </DropdownMenuGroup>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(d)}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {d.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{d.description}</p>}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { icon: Users, label: "Faculty", value: d.facultyCount },
                    { icon: BookOpen, label: "Subjects", value: d.subjectCount },
                    { icon: Clock, label: "Hrs/week", value: d.weeklyHours },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><s.icon className="size-3" /> {s.label}</p>
                      <p className="font-heading text-lg font-bold tabular">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                  {d.head ? (
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar name={`${d.head.firstName} ${d.head.lastName}`} photo={d.head.photo} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{d.head.firstName} {d.head.lastName}</p>
                        <p className="text-[11px] text-muted-foreground">Head of Department</p>
                      </div>
                    </div>
                  ) : (
                    <button type="button" disabled={!isAdmin} onClick={() => setHeading(d)} className="text-xs font-medium text-amber-600 hover:underline disabled:no-underline">No head assigned{isAdmin ? " — assign" : ""}</button>
                  )}
                  {d.location && <span className="hidden items-center gap-1 truncate text-[11px] text-muted-foreground sm:flex"><MapPin className="size-3" />{d.location}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <DepartmentDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} department={editing} />
      <AssignHeadDialog department={heading} onOpenChange={(o) => !o && setHeading(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Departments can only be deleted when they have no faculty, subjects or courses. This cannot be undone."
        confirmLabel="Delete department"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

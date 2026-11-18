"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Eye, MoreHorizontal, Pencil, Power, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { AppSelect } from "@/components/shared/app-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { useDebounce } from "@/hooks/use-debounce";
import { useDepartments } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { apiError, del, getPage, patch } from "@/lib/api";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/utils";
import type { Faculty } from "@/types";

function FacultyList() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { data: departments } = useDepartments();
  const { data: settings } = useSettings();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [department, setDepartment] = useState(params.get("department") ?? "");
  const [designation, setDesignation] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [employmentType, setEmploymentType] = useState("");
  const [archived, setArchived] = useState("false");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ type: "archive" | "deactivate" | "restore"; faculty: Faculty } | null>(null);
  const q = useDebounce(search);

  const filters = { search: q, department, designation, status, employmentType, archived, sort, page, limit: 10 };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["faculty", filters],
    queryFn: () => getPage<Faculty>("/faculty", filters),
    placeholderData: keepPreviousData,
  });

  const action = useMutation({
    mutationFn: async ({ type, faculty }: { type: string; faculty: Faculty }) => {
      if (type === "archive") return del(`/faculty/${faculty._id}`);
      if (type === "restore") return patch(`/faculty/${faculty._id}/restore`);
      return patch(`/faculty/${faculty._id}/status`, { status: faculty.status === "inactive" ? "active" : "inactive" });
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "Updated");
      qc.invalidateQueries({ queryKey: ["faculty"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirm(null);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const activeFilters = [department, designation, status, employmentType].filter(Boolean).length + (archived !== "false" ? 1 : 0);
  const reset = () => {
    setDepartment("");
    setDesignation("");
    setStatus("");
    setEmploymentType("");
    setArchived("false");
    setSearch("");
    setPage(1);
  };
  const setter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  const columns = useMemo<Column<Faculty>[]>(
    () => [
      {
        key: "name",
        header: "Faculty member",
        sortKey: "firstName",
        cell: (f) => (
          <div className="flex items-center gap-3">
            <UserAvatar name={f.fullName} photo={f.photo} />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{f.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{f.email}</p>
            </div>
          </div>
        ),
      },
      { key: "facultyId", header: "ID", sortKey: "facultyId", cell: (f) => <span className="font-mono text-xs">{f.facultyId}</span> },
      {
        key: "department",
        header: "Department",
        cell: (f) => (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium" title={f.department?.name}>
            {f.department?.code}
          </span>
        ),
      },
      { key: "designation", header: "Designation", sortKey: "designation", cell: (f) => <span className="text-[13px]">{f.designation}</span> },
      { key: "type", header: "Type", cell: (f) => <span className="text-xs text-muted-foreground">{titleCase(f.employmentType)}</span> },
      { key: "experience", header: "Exp.", sortKey: "experienceYears", cell: (f) => <span className="tabular">{f.experienceYears ?? 0} yrs</span> },
      { key: "joined", header: "Joined", sortKey: "dateOfJoining", cell: (f) => <span className="text-xs text-muted-foreground">{formatDate(f.dateOfJoining)}</span> },
      { key: "status", header: "Status", cell: (f) => <StatusBadge status={f.isArchived ? "archived" : f.status} /> },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-10 text-right",
        cell: (f) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${f.fullName}`} />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push(`/faculty/${f._id}`)}>
                    <Eye className="size-4" /> View profile
                  </DropdownMenuItem>
                  {!f.isArchived && (
                    <DropdownMenuItem onClick={() => router.push(`/faculty/${f._id}/edit`)}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                  )}
                  {!f.isArchived && (
                    <DropdownMenuItem onClick={() => setConfirm({ type: "deactivate", faculty: f })}>
                      <Power className="size-4" /> {f.status === "inactive" ? "Reactivate" : "Deactivate"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    {f.isArchived ? (
                      <DropdownMenuItem onClick={() => setConfirm({ type: "restore", faculty: f })}>
                        <ArchiveRestore className="size-4" /> Restore
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem variant="destructive" onClick={() => setConfirm({ type: "archive", faculty: f })}>
                        <Archive className="size-4" /> Archive
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [router, isAdmin],
  );

  const confirmText = {
    archive: { title: "Archive faculty member?", description: "The record will be hidden from active lists, their login will be disabled and their timetable entries removed. History (attendance, leave, workload) is preserved and the record can be restored.", label: "Archive", destructive: true },
    deactivate: { title: confirm?.faculty.status === "inactive" ? "Reactivate faculty member?" : "Deactivate faculty member?", description: confirm?.faculty.status === "inactive" ? "Their status will be set to active and their login re-enabled." : "Their status will be set to inactive and they will no longer be able to sign in.", label: confirm?.faculty.status === "inactive" ? "Reactivate" : "Deactivate", destructive: confirm?.faculty.status !== "inactive" },
    restore: { title: "Restore faculty member?", description: "The record will be restored as active and their login re-enabled.", label: "Restore", destructive: false },
  };
  const ct = confirm ? confirmText[confirm.type] : null;

  return (
    <div>
      <PageHeader
        title={role === "hod" ? "Department Faculty" : "Faculty"}
        description="Manage faculty profiles, employment details and accounts."
        actions={
          <>
            <ExportMenu report="faculty-directory" params={{ department, status }} />
            <Button render={<Link href="/faculty/new" />}>
              <UserPlus className="size-4" /> Add faculty
            </Button>
          </>
        }
      />
      <SectionCard bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={setter(setSearch)} placeholder="Search name, email, ID…" className="lg:w-80" />
            <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-5">
              {isAdmin && (
                <AppSelect value={department} onChange={setter(setDepartment)} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} />
              )}
              <AppSelect value={designation} onChange={setter(setDesignation)} allLabel="All designations" options={(settings?.designations ?? []).map((d) => ({ value: d, label: d }))} />
              <AppSelect value={status} onChange={setter(setStatus)} allLabel="All statuses" options={EMPLOYMENT_STATUSES} />
              <AppSelect value={employmentType} onChange={setter(setEmploymentType)} allLabel="All types" options={EMPLOYMENT_TYPES} />
              <AppSelect
                value={archived}
                onChange={setter(setArchived)}
                options={[
                  { value: "false", label: "Current records" },
                  { value: "true", label: "Archived only" },
                  { value: "all", label: "Include archived" },
                ]}
              />
            </div>
          </div>
          {(activeFilters > 0 || search) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              {data?.meta.total ?? 0} result(s) with {activeFilters} filter(s)
              <Button variant="ghost" size="xs" onClick={reset}>
                <X className="size-3" /> Clear
              </Button>
            </div>
          )}
        </div>
        <DataTable
          columns={columns}
          data={data?.items}
          loading={isLoading || isFetching}
          error={error}
          onRetry={() => refetch()}
          rowKey={(f) => f._id}
          onRowClick={(f) => router.push(`/faculty/${f._id}`)}
          meta={data?.meta}
          onPageChange={setPage}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          empty={{ icon: Users, title: "No faculty found", description: "Try adjusting your filters or add a new faculty member.", action: <Button render={<Link href="/faculty/new" />}><UserPlus className="size-4" /> Add faculty</Button> }}
        />
      </SectionCard>
      {ct && confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={ct.title}
          description={<><span className="font-medium text-foreground">{confirm.faculty.fullName}</span> ({confirm.faculty.facultyId}). {ct.description}</>}
          confirmLabel={ct.label}
          destructive={ct.destructive}
          loading={action.isPending}
          onConfirm={() => action.mutate(confirm)}
        />
      )}
    </div>
  );
}

export default function FacultyPage() {
  return (
    <Suspense>
      <FacultyList />
    </Suspense>
  );
}

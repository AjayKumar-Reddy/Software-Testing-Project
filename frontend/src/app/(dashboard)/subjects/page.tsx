"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, GraduationCap, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { AppSelect } from "@/components/shared/app-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { SubjectDialog } from "@/components/forms/subject-dialog";
import { CourseDialog } from "@/components/forms/course-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useCourses, useDepartments } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { apiError, del, get, getPage } from "@/lib/api";
import { SEMESTERS } from "@/lib/constants";
import type { Course, Subject } from "@/types";

function FacultyAvatars({ list }: { list: Subject["assignedFaculty"] }) {
  if (!list.length) return <span className="text-xs text-rose-600">Unallocated</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((f) => (
        <span key={f._id} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          {f.firstName} {f.lastName}
        </span>
      ))}
    </div>
  );
}

function SubjectsTab({ onEdit }: { onEdit: (s: Subject | null) => void }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { role } = useAuth();
  const { data: departments } = useDepartments();
  const { data: settings } = useSettings();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [type, setType] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const q = useDebounce(search);
  const year = academicYear || settings?.academicYear;
  const filters = { search: q, department, semester, type, academicYear: year, page, limit: 15 };
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["subjects", filters], queryFn: () => getPage<Subject>("/subjects", filters), placeholderData: keepPreviousData, enabled: !!year });
  const remove = useMutation({
    mutationFn: (s: Subject) => del(`/subjects/${s._id}`),
    onSuccess: () => { toast.success("Subject deleted"); qc.invalidateQueries({ queryKey: ["subjects"] }); setDeleting(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const reset = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };
  const canManage = role !== "faculty";

  return (
    <SectionCard bodyClassName="p-0">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
        <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search name or code…" />
        <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
          {role === "admin" && <AppSelect value={department} onChange={reset(setDepartment)} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} />}
          <AppSelect value={semester} onChange={reset(setSemester)} allLabel="All semesters" options={SEMESTERS} />
          <AppSelect value={type} onChange={reset(setType)} allLabel="All types" options={[{ value: "theory", label: "Theory" }, { value: "lab", label: "Lab" }, { value: "elective", label: "Elective" }]} />
          <AppSelect value={academicYear || settings?.academicYear || ""} onChange={reset(setAcademicYear)} options={["2024-25", "2025-26", "2026-27", "2027-28"].map((y) => ({ value: y, label: y }))} />
        </div>
      </div>
      <DataTable
        data={data?.items}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => refetch()}
        rowKey={(s) => s._id}
        meta={data?.meta}
        onPageChange={setPage}
        empty={{ icon: BookOpen, title: role === "faculty" ? "No subjects assigned to you" : "No subjects found", description: canManage ? "Adjust filters or create a subject." : undefined }}
        columns={[
          { key: "code", header: "Code", cell: (s) => <span className="font-mono text-xs font-semibold">{s.code}</span> },
          { key: "name", header: "Subject", cell: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.course?.name ?? "—"}</p></div> },
          { key: "dept", header: "Dept", cell: (s) => <span className="rounded bg-muted px-2 py-0.5 text-xs">{s.department?.code}</span> },
          { key: "sem", header: "Sem", cell: (s) => s.semester },
          { key: "credits", header: "Credits", cell: (s) => s.credits },
          { key: "type", header: "Type", cell: (s) => <span className="text-xs capitalize">{s.type}</span> },
          { key: "faculty", header: "Faculty", cell: (s) => <FacultyAvatars list={s.assignedFaculty} /> },
          ...(canManage
            ? [{
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                className: "w-10",
                cell: (s: Subject) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.code}`} />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => onEdit(s)}><Pencil className="size-4" /> Edit / assign</DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleting(s)}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              }]
            : []),
        ]}
      />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.code}?`} description="Subjects with workload allocations or timetable entries cannot be deleted." confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </SectionCard>
  );
}

interface AllocationRow extends Subject {
  allocatedHours: number;
  status: "allocated" | "partial" | "unallocated";
}

function AllocationTab({ onEdit }: { onEdit: (s: Subject) => void }) {
  const { role } = useAuth();
  const { data: departments } = useDepartments();
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [allocation, setAllocation] = useState("");
  const { data: settings } = useSettings();
  const filters = { department, semester, academicYear: settings?.academicYear };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["allocation", filters],
    queryFn: async () => {
      const res = await get<AllocationRow[]>("/subjects/allocation", filters);
      return res;
    },
    enabled: !!settings,
  });
  const rows = (data ?? []).filter((r) => !allocation || r.status === allocation);
  const counts = { allocated: data?.filter((d) => d.status === "allocated").length ?? 0, partial: data?.filter((d) => d.status === "partial").length ?? 0, unallocated: data?.filter((d) => d.status === "unallocated").length ?? 0 };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {(["allocated", "partial", "unallocated"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setAllocation(allocation === k ? "" : k)} className={`rounded-xl border bg-card p-4 text-left shadow-card transition hover:shadow-card-hover ${allocation === k ? "ring-2 ring-blue-500" : ""}`}>
            <StatusBadge status={k} label={k === "partial" ? "Partially allocated" : undefined} />
            <p className="mt-2 font-heading text-2xl font-bold">{counts[k]}</p>
            <p className="text-xs text-muted-foreground">{k === "allocated" ? "Subjects with full weekly hours allocated" : k === "partial" ? "Faculty assigned but hours not fully allocated" : "No faculty assigned yet"}</p>
          </button>
        ))}
      </div>
      <SectionCard bodyClassName="p-0" title="Subject allocation" description={`Academic year ${settings?.academicYear ?? ""}`} actions={<ExportMenu report="subject-allocation" params={{ department }} size="sm" />}>
        <div className="grid grid-cols-2 gap-2 border-b p-4 md:grid-cols-4">
          {role === "admin" && <AppSelect value={department} onChange={setDepartment} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d._id, label: d.code }))} />}
          <AppSelect value={semester} onChange={setSemester} allLabel="All semesters" options={SEMESTERS} />
        </div>
        <DataTable
          data={rows}
          loading={isLoading}
          error={error}
          onRetry={() => refetch()}
          rowKey={(s) => s._id}
          onRowClick={onEdit}
          columns={[
            { key: "code", header: "Code", cell: (s) => <span className="font-mono text-xs font-semibold">{s.code}</span> },
            { key: "name", header: "Subject", cell: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.department?.code} · Sem {s.semester} · {s.credits} cr</p></div> },
            { key: "faculty", header: "Assigned faculty", cell: (s) => <FacultyAvatars list={s.assignedFaculty} /> },
            { key: "hours", header: "Hours (allocated / required)", cell: (s) => <span className="tabular">{s.allocatedHours} / {s.weeklyHours}</span> },
            { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
          empty={{ icon: BookOpen, title: "No subjects match these filters" }}
        />
      </SectionCard>
    </div>
  );
}

function CoursesTab({ onEdit }: { onEdit: (c: Course | null) => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useCourses();
  const [deleting, setDeleting] = useState<Course | null>(null);
  const remove = useMutation({
    mutationFn: (c: Course) => del(`/courses/${c._id}`),
    onSuccess: () => { toast.success("Course deleted"); qc.invalidateQueries({ queryKey: ["courses"] }); setDeleting(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <SectionCard bodyClassName="p-0">
      <DataTable
        data={data}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        rowKey={(c) => c._id}
        empty={{ icon: GraduationCap, title: "No courses yet" }}
        columns={[
          { key: "code", header: "Code", cell: (c) => <span className="font-mono text-xs font-semibold">{c.code}</span> },
          { key: "name", header: "Course", cell: (c) => <div><p className="font-medium">{c.name}</p><p className="line-clamp-1 text-xs text-muted-foreground">{c.description}</p></div> },
          { key: "dept", header: "Department", cell: (c) => c.department?.name },
          { key: "level", header: "Level", cell: (c) => <span className="rounded bg-muted px-2 py-0.5 text-xs">{c.level}</span> },
          { key: "dur", header: "Duration", cell: (c) => `${c.durationYears} yrs · ${c.totalSemesters} sem` },
          { key: "intake", header: "Intake", cell: (c) => c.intake },
          { key: "subjects", header: "Subjects", cell: (c) => c.subjectCount ?? 0 },
          {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24 text-right", cell: (c) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(c)} aria-label={`Edit ${c.code}`}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(c)} aria-label={`Delete ${c.code}`}><Trash2 className="size-4 text-rose-500" /></Button>
              </div>
            ),
          },
        ]}
      />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.name}?`} description="Courses that still have subjects cannot be deleted." confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </SectionCard>
  );
}

function SubjectsPageInner() {
  const { role } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "subjects";
  const [editingSubject, setEditingSubject] = useState<Subject | null | undefined>(undefined);
  const [editingCourse, setEditingCourse] = useState<Course | null | undefined>(undefined);
  const isFaculty = role === "faculty";

  return (
    <div>
      <PageHeader
        title={isFaculty ? "My Subjects" : "Subjects & Courses"}
        description={isFaculty ? "Subjects allocated to you this academic year." : "Define subjects and courses, and allocate them to faculty."}
        actions={
          !isFaculty && (
            tab === "courses" ? (
              <Button onClick={() => setEditingCourse(null)}><Plus className="size-4" /> New course</Button>
            ) : (
              <Button onClick={() => setEditingSubject(null)}><Plus className="size-4" /> New subject</Button>
            )
          )
        }
      />
      {isFaculty ? (
        <SubjectsTab onEdit={() => undefined} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => router.replace(`/subjects?tab=${v}`)}>
          <TabsList>
            <TabsTrigger value="subjects" className="px-3"><BookOpen className="size-4" /> Subjects</TabsTrigger>
            <TabsTrigger value="allocation" className="px-3"><Users className="size-4" /> Allocation</TabsTrigger>
            <TabsTrigger value="courses" className="px-3"><GraduationCap className="size-4" /> Courses</TabsTrigger>
          </TabsList>
          <TabsContent value="subjects" className="mt-4"><SubjectsTab onEdit={setEditingSubject} /></TabsContent>
          <TabsContent value="allocation" className="mt-4"><AllocationTab onEdit={setEditingSubject} /></TabsContent>
          <TabsContent value="courses" className="mt-4"><CoursesTab onEdit={setEditingCourse} /></TabsContent>
        </Tabs>
      )}
      <SubjectDialog open={editingSubject !== undefined} onOpenChange={(o) => !o && setEditingSubject(undefined)} subject={editingSubject} />
      <CourseDialog open={editingCourse !== undefined} onOpenChange={(o) => !o && setEditingCourse(undefined)} course={editingCourse} />
    </div>
  );
}

export default function SubjectsPage() {
  return (
    <Suspense>
      <SubjectsPageInner />
    </Suspense>
  );
}

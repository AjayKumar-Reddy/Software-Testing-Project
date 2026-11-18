"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MapPin, Plus, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AppSelect } from "@/components/shared/app-select";
import { Combobox } from "@/components/shared/combobox";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { TimetableDialog, type SlotDraft } from "@/components/forms/timetable-dialog";
import { useDepartments, useFacultyOptions } from "@/hooks/use-options";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/contexts/auth-context";
import { get, getPage } from "@/lib/api";
import { WEEKDAYS_SHORT, WEEKDAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TimeSlot, TimetableEntry } from "@/types";

const COLORS = [
  "border-l-blue-500 bg-blue-50 dark:bg-blue-500/10",
  "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
  "border-l-violet-500 bg-violet-50 dark:bg-violet-500/10",
  "border-l-amber-500 bg-amber-50 dark:bg-amber-500/10",
  "border-l-rose-500 bg-rose-50 dark:bg-rose-500/10",
  "border-l-sky-500 bg-sky-50 dark:bg-sky-500/10",
  "border-l-teal-500 bg-teal-50 dark:bg-teal-500/10",
];

type View = "department" | "faculty" | "section" | "room";

export default function TimetablePage() {
  const { role, user } = useAuth();
  const isStaff = role !== "faculty";
  const { data: settings } = useSettings();
  const { data: departments } = useDepartments();
  const { data: faculty } = useFacultyOptions();
  const [view, setView] = useState<View>(isStaff ? "department" : "faculty");
  const [department, setDepartment] = useState("");
  const [fac, setFac] = useState("");
  const [section, setSection] = useState("");
  const [room, setRoom] = useState("");
  const [draft, setDraft] = useState<SlotDraft | null>(null);

  const meta = useQuery({ queryKey: ["timetable", "meta"], queryFn: () => get<{ sections: string[]; rooms: string[]; slots: TimeSlot[]; workingDays: number[] }>("/timetable/meta"), enabled: isStaff });
  const dept = department || (role === "admin" ? departments?.[0]?._id ?? "" : user?.faculty?.department?._id ?? "");
  const params =
    !isStaff ? {} : view === "department" ? { department: dept } : view === "faculty" ? { faculty: fac } : view === "section" ? { section } : { room };
  const ready = !isStaff || Object.values(params).some(Boolean);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timetable", params],
    queryFn: () => getPage<TimetableEntry>("/timetable", params),
    enabled: ready,
  });

  const days = (settings?.workingDays ?? [1, 2, 3, 4, 5, 6]).filter((d) => d !== 0);
  const slots = settings?.timetableSlots ?? [];
  const subjectColor = useMemo(() => {
    const ids = [...new Set((data?.items ?? []).map((e) => e.subject._id))];
    return Object.fromEntries(ids.map((id, i) => [id, COLORS[i % COLORS.length]]));
  }, [data]);

  const entriesAt = (day: number, slot: TimeSlot) => (data?.items ?? []).filter((e) => e.dayOfWeek === day && e.startTime < slot.endTime && e.endTime > slot.startTime);
  const offSlot = (data?.items ?? []).filter((e) => !slots.some((s) => e.startTime < s.endTime && e.endTime > s.startTime));
  const totalHours = (data?.items ?? []).reduce((a, e) => a + (parseInt(e.endTime) * 60 + parseInt(e.endTime.slice(3)) - (parseInt(e.startTime) * 60 + parseInt(e.startTime.slice(3)))) / 60, 0);

  return (
    <div>
      <PageHeader
        title={isStaff ? "Timetable" : "My Timetable"}
        description={`Weekly schedule · ${settings?.academicYear ?? ""} · ${data?.items.length ?? 0} classes (${totalHours.toFixed(1)} contact hours)`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            {isStaff && <Button onClick={() => setDraft({ faculty: view === "faculty" ? fac : undefined, section: view === "section" ? section : undefined, room: view === "room" ? room : undefined })}><Plus className="size-4" /> Schedule class</Button>}
          </>
        }
      />
      {isStaff && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-card">
            {(["department", "faculty", "section", "room"] as View[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {v}
              </button>
            ))}
          </div>
          {view === "department" && role === "admin" && <div className="w-64"><AppSelect value={dept} onChange={setDepartment} options={(departments ?? []).map((d) => ({ value: d._id, label: d.name }))} /></div>}
          {view === "faculty" && <div className="w-64"><Combobox value={fac} onChange={setFac} placeholder="Select faculty" options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: `${f.facultyId} · ${f.department?.code}` }))} /></div>}
          {view === "section" && <div className="w-48"><Combobox value={section} onChange={setSection} placeholder="Select section" options={(meta.data?.sections ?? []).map((s) => ({ value: s, label: s }))} /></div>}
          {view === "room" && <div className="w-48"><Combobox value={room} onChange={setRoom} placeholder="Select room" options={(meta.data?.rooms ?? []).map((s) => ({ value: s, label: s }))} /></div>}
        </div>
      )}
      <SectionCard bodyClassName="p-0">
        {!ready ? (
          <EmptyState icon={CalendarClock} title={`Select a ${view} to view its timetable`} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={7} cols={6} />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-28 border-b bg-muted/40 px-3 py-2.5 text-left font-semibold text-muted-foreground">Time</th>
                  {days.map((d) => (
                    <th key={d} className={cn("border-b border-l bg-muted/40 px-3 py-2.5 text-left font-semibold", new Date().getDay() === d ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground")}>
                      {WEEKDAYS_SHORT[d]}
                      {new Date().getDay() === d && <span className="ml-1.5 rounded bg-blue-100 px-1 py-0.5 text-[10px] dark:bg-blue-500/20">Today</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => {
                  const isBreak = i > 0 && slots[i - 1].endTime !== slot.startTime;
                  return (
                    <tr key={slot.label} className={cn(isBreak && "border-t-4 border-t-muted")}>
                      <td className="border-b px-3 py-2 align-top">
                        <p className="font-semibold">{slot.label}</p>
                        <p className="text-muted-foreground tabular">{slot.startTime}–{slot.endTime}</p>
                      </td>
                      {days.map((d) => {
                        const items = entriesAt(d, slot);
                        return (
                          <td key={d} className="group h-20 border-b border-l p-1 align-top">
                            <div className="flex h-full flex-col gap-1">
                              {items.map((e) => (
                                <button
                                  key={e._id}
                                  type="button"
                                  disabled={!isStaff}
                                  onClick={() => setDraft({ entry: e })}
                                  className={cn("rounded-md border-l-[3px] px-2 py-1.5 text-left transition", subjectColor[e.subject._id], isStaff && "hover:shadow-md")}
                                  title={`${e.subject.name} · ${e.faculty.firstName} ${e.faculty.lastName} · ${e.room}`}
                                >
                                  <p className="truncate font-semibold text-foreground">{e.subject.code}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {view === "faculty" || !isStaff ? e.section : `${e.faculty.firstName} ${e.faculty.lastName[0]}.`}
                                  </p>
                                  <p className="flex items-center gap-0.5 truncate text-[10.5px] text-muted-foreground"><MapPin className="size-2.5" />{e.room}{view !== "faculty" && isStaff && view !== "section" ? ` · ${e.section}` : ""}</p>
                                </button>
                              ))}
                              {isStaff && !items.length && (
                                <button
                                  type="button"
                                  onClick={() => setDraft({ dayOfWeek: d, startTime: slot.startTime, endTime: slot.endTime, faculty: view === "faculty" ? fac : undefined, section: view === "section" ? section : undefined, room: view === "room" ? room : undefined })}
                                  className="no-print flex h-full min-h-14 items-center justify-center rounded-md border border-dashed border-transparent text-muted-foreground opacity-0 transition group-hover:border-border group-hover:opacity-100"
                                  aria-label={`Schedule a class on ${WEEKDAYS[d]} at ${slot.startTime}`}
                                >
                                  <Plus className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!!offSlot.length && <p className="border-t px-4 py-2 text-xs text-muted-foreground">{offSlot.length} class(es) outside the configured slots are not shown in the grid.</p>}
            {!data?.items.length && <EmptyState icon={Users} title="No classes scheduled" description={isStaff ? "Hover over a cell and click + to schedule a class." : "Your timetable has not been published yet."} className="py-8" />}
          </div>
        )}
      </SectionCard>
      <TimetableDialog draft={draft} onOpenChange={(o) => !o && setDraft(null)} />
    </div>
  );
}

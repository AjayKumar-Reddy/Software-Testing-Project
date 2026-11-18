"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { AppSelect } from "@/components/shared/app-select";
import { apiError, put } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { AttendanceRecord } from "@/types";

export function EditAttendanceDialog({ record, onOpenChange }: { record: AttendanceRecord | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [remarks, setRemarks] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (record) {
      setStatus(record.status);
      setCheckIn(record.checkIn ?? "");
      setCheckOut(record.checkOut ?? "");
      setRemarks(record.remarks ?? "");
      setErr("");
    }
  }, [record]);
  const timed = status === "present" || status === "late";
  const save = useMutation({
    mutationFn: () => put(`/attendance/${record!._id}`, { status, checkIn: timed ? checkIn : "", checkOut: timed ? checkOut : "", remarks }),
    onSuccess: () => {
      toast.success("Attendance updated");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const f = record && typeof record.faculty === "object" ? record.faculty : null;
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit attendance</DialogTitle>
          <DialogDescription>{f ? `${f.firstName} ${f.lastName}` : ""} · {formatDate(record?.date, "EEEE, d MMM yyyy")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Status" className="sm:col-span-2">
            <AppSelect value={status} onChange={setStatus} options={[{ value: "present", label: "Present" }, { value: "late", label: "Late" }, { value: "absent", label: "Absent" }, { value: "on_leave", label: "On leave (requires approved leave)" }]} />
          </FormField>
          <FormField label="Check-in"><Input type="time" value={checkIn} disabled={!timed} onChange={(e) => setCheckIn(e.target.value)} /></FormField>
          <FormField label="Check-out" error={err}><Input type="time" value={checkOut} disabled={!timed} onChange={(e) => setCheckOut(e.target.value)} /></FormField>
          <FormField label="Remarks" className="sm:col-span-2"><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              if (timed && checkIn && checkOut && checkOut <= checkIn) return setErr("Check-out must be after check-in");
              save.mutate();
            }}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

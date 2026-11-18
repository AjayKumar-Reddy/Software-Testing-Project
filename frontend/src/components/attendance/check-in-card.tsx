"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, Info, LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiError, get, post } from "@/lib/api";
import type { AttendanceRecord } from "@/types";

interface TodayInfo {
  date: string;
  record: AttendanceRecord | null;
  onLeave: boolean;
  selfCheckInEnabled: boolean;
  isWorkingDay: boolean;
  lateAfter?: string;
}

/** Self-service check-in/out. Records are labelled "self-reported", not verified. */
export function CheckInCard() {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const { data, isLoading } = useQuery({ queryKey: ["attendance", "today"], queryFn: () => get<TodayInfo>("/attendance/today") });
  const action = useMutation({
    mutationFn: (kind: "check-in" | "check-out") => post(`/attendance/${kind}`, {}),
    onSuccess: (res) => {
      toast.success(res.message ?? "Recorded");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const rec = data?.record;
  let body: React.ReactNode;
  if (isLoading) body = <Loader2 className="size-5 animate-spin text-white/70" />;
  else if (!data?.isWorkingDay) body = <p className="text-sm text-blue-100">Today is not a working day. Enjoy your break!</p>;
  else if (data.onLeave) body = <p className="text-sm text-blue-100">You are on approved leave today.</p>;
  else if (rec && rec.checkOut) body = <p className="text-sm text-blue-100">You checked in at {rec.checkIn} and out at {rec.checkOut}. Have a good evening!</p>;
  else if (rec && rec.checkIn)
    body = (
      <Button onClick={() => action.mutate("check-out")} disabled={action.isPending || !data.selfCheckInEnabled} className="bg-white text-blue-900 hover:bg-blue-50">
        {action.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Check out
      </Button>
    );
  else if (rec) body = <p className="text-sm text-blue-100">Your attendance for today was recorded by staff.</p>;
  else if (!data.selfCheckInEnabled) body = <p className="text-sm text-blue-100">Attendance is marked by your department. Self check-in is disabled.</p>;
  else
    body = (
      <Button onClick={() => action.mutate("check-in")} disabled={action.isPending} className="bg-white text-blue-900 hover:bg-blue-50">
        {action.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Check in now
      </Button>
    );

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#2563eb] p-5 text-white shadow-card">
      <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-blue-200">
            <Clock className="size-3.5" /> {format(now, "EEEE, d MMMM yyyy")}
          </p>
          <p className="mt-1 font-heading text-3xl font-bold tabular">{format(now, "HH:mm")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-blue-100">
            Today:
            {rec ? <StatusBadge status={rec.status} className="bg-white/90" /> : data?.onLeave ? <StatusBadge status="on_leave" className="bg-white/90" /> : <span className="font-medium">Not recorded</span>}
            {data?.lateAfter && <span className="text-blue-200/80">· Late after {data.lateAfter}</span>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">{body}</div>
      </div>
      {data?.selfCheckInEnabled && (
        <p className="relative mt-4 flex items-center gap-1.5 text-[11px] text-blue-200/80">
          <Info className="size-3" /> Self check-in is self-reported and is not biometric or location verified.
        </p>
      )}
    </div>
  );
}

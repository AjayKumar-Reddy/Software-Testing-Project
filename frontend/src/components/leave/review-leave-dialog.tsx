"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { apiError, download, patch } from "@/lib/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import type { LeaveApplication } from "@/types";

export function ReviewLeaveDialog({ leave, onOpenChange }: { leave: LeaveApplication | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setRemarks("");
    setError("");
  }, [leave]);

  const decide = useMutation({
    mutationFn: (action: "approve" | "reject") => patch(`/leaves/${leave!._id}/${action}`, { remarks }),
    onSuccess: (res) => {
      toast.success(res.message ?? "Done");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!leave) return null;
  const name = `${leave.faculty.firstName} ${leave.faculty.lastName}`;
  return (
    <Dialog open={!!leave} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Leave application</DialogTitle>
          <DialogDescription>Submitted {formatDateTime(leave.createdAt)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <UserAvatar name={name} photo={leave.faculty.photo} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{leave.faculty.designation} · {leave.department?.code} · {leave.faculty.facultyId}</p>
            </div>
            <StatusBadge status={leave.status} />
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Type</dt><dd className="font-medium">{titleCase(leave.leaveType)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Period</dt><dd className="font-medium">{formatDate(leave.startDate, "d MMM")} – {formatDate(leave.endDate, "d MMM yyyy")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Working days</dt><dd className="font-medium">{leave.days}</dd></div>
          </dl>
          <div>
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">{leave.reason}</p>
          </div>
          {leave.document && (
            <Button variant="outline" size="sm" onClick={() => download(`/leaves/${leave._id}/document`, {}, leave.documentName || "document").catch((e) => toast.error(apiError(e)))}>
              <Download className="size-4" /> {leave.documentName || "Supporting document"}
            </Button>
          )}
          {leave.reviewedBy && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Reviewed by {leave.reviewedBy.name} · {formatDateTime(leave.reviewedAt)}</p>
              {leave.reviewRemarks && <p className="mt-1">{leave.reviewRemarks}</p>}
            </div>
          )}
          {leave.canReview && (
            <FormField label="Remarks" hint="Required when rejecting." error={error}>
              <Textarea rows={2} value={remarks} onChange={(e) => { setRemarks(e.target.value); setError(""); }} placeholder="Add a note for the applicant" />
            </FormField>
          )}
        </div>
        {leave.canReview && (
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => {
                if (remarks.trim().length < 3) return setError("Please provide a reason for rejection");
                decide.mutate("reject");
              }}
            >
              {decide.isPending && decide.variables === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={decide.isPending} onClick={() => decide.mutate("approve")}>
              {decide.isPending && decide.variables === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

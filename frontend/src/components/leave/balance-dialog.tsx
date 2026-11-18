"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiError, put } from "@/lib/api";
import { titleCase } from "@/lib/utils";
import type { LeaveBalance } from "@/types";

export interface BalanceTarget {
  faculty: { _id: string; fullName: string; facultyId: string };
  balances: LeaveBalance[];
  academicYear: string;
}

export function BalanceDialog({ target, onOpenChange }: { target: BalanceTarget | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, number>>({});
  useEffect(() => setValues(Object.fromEntries((target?.balances ?? []).map((b) => [b.type, b.allocated]))), [target]);
  const save = useMutation({
    mutationFn: () => put(`/leaves/balances/${target!.faculty._id}`, { academicYear: target!.academicYear, balances: Object.entries(values).map(([type, allocated]) => ({ type, allocated })) }),
    onSuccess: () => {
      toast.success("Leave allocation updated");
      qc.invalidateQueries({ queryKey: ["leaves", "balances"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust leave allocation</DialogTitle>
          <DialogDescription>{target?.faculty.fullName} · {target?.academicYear}. Allocations cannot go below days already used.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {target?.balances.map((b) => (
            <div key={b.type} className="grid grid-cols-[1fr_96px] items-center gap-3">
              <div>
                <p className="text-sm font-medium">{titleCase(b.type)}</p>
                <p className="text-xs text-muted-foreground">{b.used} used · {b.pending} pending</p>
              </div>
              <Input type="number" min={b.used} max={365} value={values[b.type] ?? 0} onChange={(e) => setValues((v) => ({ ...v, [b.type]: Number(e.target.value) }))} aria-label={`${b.type} allocation`} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Save allocation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

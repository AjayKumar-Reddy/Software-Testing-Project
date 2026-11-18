"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/shared/combobox";
import { FormField } from "@/components/shared/form-field";
import { useFacultyOptions } from "@/hooks/use-options";
import { apiError, put } from "@/lib/api";
import type { Department } from "@/types";

export function AssignHeadDialog({ department, onOpenChange }: { department: Department | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: faculty } = useFacultyOptions(department?._id);
  const [value, setValue] = useState("");
  useEffect(() => setValue(department?.head?._id ?? ""), [department]);

  const save = useMutation({
    mutationFn: () => put(`/departments/${department!._id}/head`, { facultyId: value || null }),
    onSuccess: (res) => {
      toast.success(res.message ?? "Head updated");
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["department"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog open={!!department} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign department head</DialogTitle>
          <DialogDescription>
            The selected faculty member gets the HOD role for {department?.name}. The previous head returns to the faculty role.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Head of department">
          <Combobox
            value={value}
            onChange={setValue}
            clearable
            placeholder="Select a faculty member"
            options={(faculty ?? []).map((f) => ({ value: f._id, label: f.fullName, description: `${f.designation} · ${f.facultyId}` }))}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || value === (department?.head?._id ?? "")}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} {value ? "Assign head" : "Remove head"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/shared/section-card";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { AppSelect } from "@/components/shared/app-select";
import { FormField } from "@/components/shared/form-field";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/auth-context";
import { apiError, getPage, patch, post } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/navigation";
import { timeAgo } from "@/lib/utils";
import type { Role } from "@/types";

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string;
  faculty?: { facultyId: string; department?: { code: string } } | null;
}

const PW = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function UsersSection() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pw, setPw] = useState("");
  const q = useDebounce(search);
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["users", q, role, page], queryFn: () => getPage<UserRow>("/users", { search: q, role, page, limit: 12 }), placeholderData: keepPreviousData });
  const toggle = useMutation({
    mutationFn: (u: UserRow) => patch(`/users/${u._id}`, { isActive: !u.isActive }),
    onSuccess: () => { toast.success("Account updated"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const create = useMutation({
    mutationFn: () => post("/users", form),
    onSuccess: () => { toast.success("Administrator created"); qc.invalidateQueries({ queryKey: ["users"] }); setCreating(false); setForm({ name: "", email: "", password: "" }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const reset = useMutation({
    mutationFn: () => post(`/users/${resetting!._id}/reset-password`, { password: pw }),
    onSuccess: () => { toast.success("Password reset; existing sessions signed out"); setResetting(null); setPw(""); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <SectionCard title="User accounts" description="Faculty and HOD accounts are created with faculty records. HOD roles are assigned from the Departments page." bodyClassName="p-0" actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> New administrator</Button>}>
      <div className="flex flex-wrap gap-2 border-b p-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or email…" />
        <div className="w-44"><AppSelect value={role} onChange={(v) => { setRole(v); setPage(1); }} allLabel="All roles" options={(["admin", "hod", "faculty"] as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} /></div>
      </div>
      <DataTable
        data={data?.items}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => refetch()}
        rowKey={(u) => u._id}
        meta={data?.meta}
        onPageChange={setPage}
        columns={[
          { key: "name", header: "User", cell: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div> },
          { key: "role", header: "Role", cell: (u) => <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{u.role === "admin" && <ShieldCheck className="size-3" />}{ROLE_LABELS[u.role]}</span> },
          { key: "fac", header: "Faculty ID", cell: (u) => <span className="font-mono text-xs">{u.faculty?.facultyId ?? "—"}{u.faculty?.department ? ` · ${u.faculty.department.code}` : ""}</span> },
          { key: "login", header: "Last sign-in", cell: (u) => <span className="text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</span> },
          { key: "active", header: "Active", cell: (u) => <Switch checked={u.isActive} disabled={u._id === me?._id || toggle.isPending} onCheckedChange={() => toggle.mutate(u)} aria-label={`Toggle ${u.email}`} /> },
          { key: "reset", header: <span className="sr-only">Reset</span>, className: "text-right", cell: (u) => <Button variant="ghost" size="xs" onClick={() => setResetting(u)}><KeyRound className="size-3.5" /> Reset password</Button> },
        ]}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New administrator</DialogTitle><DialogDescription>Administrators have full access to FacultyHub.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <FormField label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
            <FormField label="Password" error={form.password && !PW.test(form.password) ? "At least 8 characters with a letter and a number" : undefined}><Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.name.length < 2 || !form.email.includes("@") || !PW.test(form.password)}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Set a new password for {resetting?.email}. They will be signed out everywhere.</DialogDescription></DialogHeader>
          <FormField label="New password" error={pw && !PW.test(pw) ? "At least 8 characters with a letter and a number" : undefined}><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>Cancel</Button>
            <Button onClick={() => reset.mutate()} disabled={reset.isPending || !PW.test(pw)}>{reset.isPending && <Loader2 className="size-4 animate-spin" />} Reset password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

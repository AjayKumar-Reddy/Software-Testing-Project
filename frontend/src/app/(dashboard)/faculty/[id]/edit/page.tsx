"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { FacultyForm } from "@/components/faculty/faculty-form";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { get } from "@/lib/api";
import type { Faculty } from "@/types";

export default function EditFacultyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["faculty", id], queryFn: () => get<Faculty>(`/faculty/${id}`) });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={data ? `Edit ${data.fullName}` : "Edit faculty"} description={data ? `${data.facultyId} · ${data.department?.name}` : undefined} breadcrumb="Edit" />
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !data ? <TableSkeleton rows={8} /> : <FacultyForm faculty={data} />}
    </div>
  );
}

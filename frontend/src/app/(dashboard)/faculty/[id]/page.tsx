"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { FacultyProfile, type FacultyDetail } from "@/components/faculty/faculty-profile";
import { get } from "@/lib/api";

export default function FacultyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["faculty", id], queryFn: () => get<FacultyDetail>(`/faculty/${id}`) });
  return (
    <div>
      <PageHeader title="Faculty profile" breadcrumb={data?.fullName ?? "Profile"} />
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !data ? <TableSkeleton rows={8} /> : <FacultyProfile faculty={data} canEdit />}
    </div>
  );
}

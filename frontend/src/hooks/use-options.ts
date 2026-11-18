"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Course, Department, FacultyOption, Subject } from "@/types";
import { getPage } from "@/lib/api";

export function useDepartments(all = false) {
  return useQuery({ queryKey: ["departments", { all }], queryFn: () => get<Department[]>("/departments", all ? { all: "true" } : undefined), staleTime: 60_000 });
}

export function useFacultyOptions(department?: string) {
  return useQuery({ queryKey: ["faculty-options", department ?? "all"], queryFn: () => get<FacultyOption[]>("/faculty/options", { department }), staleTime: 60_000 });
}

export function useCourses(department?: string) {
  return useQuery({ queryKey: ["courses", department ?? "all"], queryFn: () => get<Course[]>("/courses", { department }) });
}

export function useSubjectOptions(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["subject-options", params],
    queryFn: async () => (await getPage<Subject>("/subjects", { limit: 100, sort: "code", ...params })).items,
  });
}

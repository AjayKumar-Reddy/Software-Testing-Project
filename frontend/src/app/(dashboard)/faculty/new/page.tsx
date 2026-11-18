"use client";

import { PageHeader } from "@/components/shared/page-header";
import { FacultyForm } from "@/components/faculty/faculty-form";

export default function NewFacultyPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Add faculty member" description="Create a faculty record and, optionally, a login account." breadcrumb="New faculty" />
      <FacultyForm />
    </div>
  );
}

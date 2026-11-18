import type { Option } from "@/components/shared/app-select";

export const EMPLOYMENT_STATUSES: Option[] = [
  { value: "active", label: "Active" },
  { value: "probation", label: "Probation" },
  { value: "on_sabbatical", label: "On sabbatical" },
  { value: "inactive", label: "Inactive" },
  { value: "resigned", label: "Resigned" },
  { value: "retired", label: "Retired" },
];

export const EMPLOYMENT_TYPES: Option[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "visiting", label: "Visiting" },
];

export const GENDERS: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const LEAVE_TYPES: Option[] = [
  { value: "casual", label: "Casual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "earned", label: "Earned leave" },
  { value: "medical", label: "Medical leave" },
  { value: "other", label: "Other" },
];

export const LEAVE_STATUSES: Option[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export const ATTENDANCE_STATUSES: Option[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "on_leave", label: "On leave" },
];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const SEMESTERS: Option[] = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }));

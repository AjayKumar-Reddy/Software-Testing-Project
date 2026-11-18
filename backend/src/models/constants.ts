export const ROLES = ["admin", "hod", "faculty"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "visiting"] as const;
export const EMPLOYMENT_STATUSES = ["active", "probation", "on_sabbatical", "inactive", "resigned", "retired"] as const;
export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "on_leave"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_SOURCES = ["manual", "self", "leave"] as const;

export const LEAVE_TYPES = ["casual", "sick", "earned", "medical", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export const WORKLOAD_TYPES = ["lecture", "lab", "tutorial"] as const;
export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6] as const; // Mon–Sat

export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"] as const;
export const ANNOUNCEMENT_AUDIENCES = ["all", "departments"] as const;

export const NOTIFICATION_TYPES = ["announcement", "leave", "workload", "timetable", "system"] as const;

export const DEFAULT_DESIGNATIONS = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Lecturer",
  "Visiting Faculty",
  "Lab Instructor",
];

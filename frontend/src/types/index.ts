export type Role = "admin" | "hod" | "faculty";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PageMeta & Record<string, unknown>;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta & Record<string, unknown>;
}

export interface DepartmentRef {
  _id: string;
  name: string;
  code: string;
  head?: string | null;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string;
  faculty: {
    _id: string;
    facultyId: string;
    firstName: string;
    lastName: string;
    photo?: string;
    designation: string;
    status: string;
    department: DepartmentRef;
  } | null;
}

export type EmploymentStatus = "active" | "probation" | "on_sabbatical" | "inactive" | "resigned" | "retired";
export type EmploymentType = "full_time" | "part_time" | "contract" | "visiting";

export interface Faculty {
  _id: string;
  facultyId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photo?: string;
  gender?: string;
  dateOfBirth?: string;
  email: string;
  phone?: string;
  address?: { line1?: string; city?: string; state?: string; postalCode?: string; country?: string };
  emergencyContact?: { name?: string; relation?: string; phone?: string };
  department: DepartmentRef;
  designation: string;
  qualification?: string;
  specialization?: string;
  experienceYears?: number;
  dateOfJoining: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  courses?: { _id: string; name: string; code: string }[];
  isArchived: boolean;
  user?: { _id: string; role: Role; isActive: boolean; lastLoginAt?: string } | null;
  createdAt: string;
}

export interface FacultyOption {
  _id: string;
  facultyId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  designation: string;
  photo?: string;
  department: DepartmentRef;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  head?: { _id: string; firstName: string; lastName: string; designation: string; photo?: string; facultyId: string; email: string } | null;
  establishedYear?: number;
  email?: string;
  phone?: string;
  location?: string;
  isActive: boolean;
  facultyCount: number;
  activeFacultyCount: number;
  subjectCount: number;
  weeklyHours: number;
}

export interface Course {
  _id: string;
  name: string;
  code: string;
  department: DepartmentRef;
  level: "UG" | "PG" | "Diploma" | "PhD";
  durationYears: number;
  totalSemesters: number;
  intake: number;
  description?: string;
  isActive: boolean;
  subjectCount?: number;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  department: DepartmentRef;
  course?: { _id: string; name: string; code: string } | null;
  semester: number;
  academicYear: string;
  credits: number;
  type: "theory" | "lab" | "elective";
  weeklyHours: number;
  assignedFaculty: { _id: string; firstName: string; lastName: string; facultyId: string; designation: string; photo?: string }[];
  description?: string;
  isActive: boolean;
}

export type AttendanceStatus = "present" | "absent" | "late" | "on_leave";

export interface AttendanceRecord {
  _id: string;
  faculty: { _id: string; facultyId: string; firstName: string; lastName: string; photo?: string; designation: string } | string;
  department: DepartmentRef | string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  source: "manual" | "self" | "leave";
  remarks?: string;
  markedBy?: { _id: string; name: string; role: Role } | string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  percentage: number | null;
}

export type LeaveType = "casual" | "sick" | "earned" | "medical" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveApplication {
  _id: string;
  faculty: { _id: string; facultyId: string; firstName: string; lastName: string; photo?: string; designation: string };
  department: DepartmentRef;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  document?: string;
  documentName?: string;
  status: LeaveStatus;
  reviewedBy?: { _id: string; name: string; role: Role };
  reviewedAt?: string;
  reviewRemarks?: string;
  createdAt: string;
  canReview?: boolean;
}

export interface LeaveBalance {
  type: LeaveType;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

export interface Workload {
  _id: string;
  faculty: { _id: string; facultyId: string; firstName: string; lastName: string; designation: string; photo?: string };
  subject: { _id: string; name: string; code: string; credits: number; semester: number; type: string; weeklyHours: number };
  course?: { _id: string; name: string; code: string } | null;
  department: DepartmentRef;
  semester: number;
  academicYear: string;
  weeklyHours: number;
  type: "lecture" | "lab" | "tutorial";
  section: string;
  notes?: string;
}

export interface WorkloadSummaryRow {
  faculty: FacultyOption;
  hours: number;
  subjectCount: number;
  lecture: number;
  lab: number;
  tutorial: number;
  utilization: number;
  status: "overloaded" | "optimal" | "underutilized";
}

export interface TimetableEntry {
  _id: string;
  faculty: { _id: string; facultyId: string; firstName: string; lastName: string; designation: string };
  subject: { _id: string; name: string; code: string; type: string; semester: number };
  department: DepartmentRef;
  section: string;
  room: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  academicYear: string;
  semester: number;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  category: "general" | "event" | "academic" | "administrative";
  audience: "all" | "departments";
  departments: DepartmentRef[];
  publishAt: string;
  expiresAt?: string | null;
  eventDate?: string | null;
  isPinned: boolean;
  createdBy: { _id: string; name: string; role?: Role };
  canManage?: boolean;
  state?: "scheduled" | "expired" | "published";
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type: "announcement" | "leave" | "workload" | "timetable" | "system";
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  userName: string;
  role: string;
  action: string;
  module: string;
  recordId?: string | null;
  description: string;
  ip?: string;
  createdAt: string;
}

export interface TimeSlot {
  label: string;
  startTime: string;
  endTime: string;
}

export interface SystemSettings {
  _id: string;
  institutionName: string;
  institutionShortName: string;
  institutionLogo?: string;
  address?: string;
  contactEmail?: string;
  academicYear: string;
  currentSemester: "Odd" | "Even";
  semesterConfig: { oddStartMonth: number; evenStartMonth: number };
  workingDays: number[];
  designations: string[];
  timetableSlots: TimeSlot[];
  attendance: { workdayStart: string; workdayEnd: string; lateAfter: string; allowSelfCheckIn: boolean; hodCanMark: boolean; minAttendancePercent: number };
  leavePolicy: Record<LeaveType, number> & { maxConsecutiveDays: number; allowBackdatedDays: number };
  workload: { minWeeklyHours: number; maxWeeklyHours: number };
  notifications: { emailEnabled: boolean; emailOnLeaveDecision: boolean; emailOnAnnouncement: boolean; emailOnWorkload: boolean };
  emailConfigured?: boolean;
  updatedAt?: string;
}

export interface AcademicSession {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  semesters: { name: string; startDate: string; endDate: string }[];
}

export interface ReportData {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string; width?: number }[];
  rows: Record<string, string | number | null>[];
  summary?: { label: string; value: string | number }[];
  chart?: { type: "bar" | "pie" | "line"; xKey: string; series: { key: string; label: string }[]; data: Record<string, string | number>[] };
}

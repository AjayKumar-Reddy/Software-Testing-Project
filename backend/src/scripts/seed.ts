/**
 * Development seed: wipes the configured database and inserts realistic demo data.
 *   npm run seed
 * Demo accounts all use SEED_DEMO_PASSWORD (default "Demo@123"). Never run against production.
 */
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { addDays, format, subDays } from "date-fns";
import { connectDB, disconnectDB } from "../config/db";
import { env } from "../config/env";
import {
  User,
  Faculty,
  Department,
  Course,
  Subject,
  AcademicSession,
  Attendance,
  LeaveApplication,
  LeaveBalance,
  Workload,
  Timetable,
  Announcement,
  Notification,
  AuditLog,
  SystemSetting,
  RefreshToken,
  Counter,
} from "../models";
import { todayDateOnly, toDateOnly, workingDaysBetween } from "../utils/dates";

if (env.isProduction) {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

// Deterministic PRNG so every seed run produces the same dataset.
let state = 20261118;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const ACADEMIC_YEAR = "2026-27";
const PREV_YEAR = "2025-26";
const WORKING_DAYS = [1, 2, 3, 4, 5, 6];

const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science and Engineering", est: 1998, location: "Block A, 2nd Floor", desc: "Undergraduate and postgraduate programmes in computing, with research groups in machine learning, distributed systems and cybersecurity." },
  { code: "IT", name: "Information Technology", est: 2001, location: "Block A, 3rd Floor", desc: "Focuses on software engineering, cloud infrastructure, data management and enterprise information systems." },
  { code: "ECE", name: "Electronics and Communication", est: 1995, location: "Block B, 1st Floor", desc: "Covers VLSI design, embedded systems, signal processing and wireless communication." },
  { code: "ME", name: "Mechanical Engineering", est: 1992, location: "Block C", desc: "Thermal engineering, manufacturing, robotics and computational mechanics with fully equipped workshops." },
  { code: "CE", name: "Civil Engineering", est: 1992, location: "Block D", desc: "Structural, geotechnical, environmental and transportation engineering." },
  { code: "EE", name: "Electrical Engineering", est: 1996, location: "Block B, 2nd Floor", desc: "Power systems, electrical machines, control systems and renewable energy." },
  { code: "MBA", name: "Management Studies", est: 2005, location: "Admin Block, 4th Floor", desc: "Postgraduate management education in finance, marketing, HR and operations." },
];

// [firstName, lastName, gender, designation, qualification, specialization, experience]
type Row = [string, string, "male" | "female", string, string, string, number];
const FACULTY: Record<string, Row[]> = {
  CSE: [
    ["Rajesh", "Iyer", "male", "Professor", "Ph.D. (IIT Madras)", "Machine Learning", 22],
    ["Priya", "Sharma", "female", "Assistant Professor", "M.Tech, Ph.D. (pursuing)", "Data Structures & Algorithms", 6],
    ["Ananya", "Krishnan", "female", "Associate Professor", "Ph.D. (NIT Trichy)", "Distributed Systems", 13],
    ["Vikram", "Malhotra", "male", "Assistant Professor", "M.Tech (IIIT Hyderabad)", "Cybersecurity", 5],
    ["Sneha", "Kulkarni", "female", "Lecturer", "M.Tech", "Web Technologies", 3],
  ],
  IT: [
    ["Suresh", "Menon", "male", "Professor", "Ph.D. (Anna University)", "Software Engineering", 20],
    ["Kavya", "Reddy", "female", "Associate Professor", "Ph.D.", "Cloud Computing", 11],
    ["Arjun", "Nair", "male", "Assistant Professor", "M.Tech", "Database Systems", 7],
    ["Meera", "Joshi", "female", "Assistant Professor", "M.E.", "Computer Networks", 4],
  ],
  ECE: [
    ["Ramesh", "Pillai", "male", "Professor", "Ph.D. (IISc Bangalore)", "VLSI Design", 24],
    ["Deepa", "Rao", "female", "Associate Professor", "Ph.D.", "Signal Processing", 12],
    ["Karthik", "Subramanian", "male", "Assistant Professor", "M.Tech", "Embedded Systems", 6],
    ["Nisha", "Verma", "female", "Lab Instructor", "B.Tech", "Electronics Lab", 8],
  ],
  ME: [
    ["Anil", "Deshpande", "male", "Professor", "Ph.D. (IIT Bombay)", "Thermal Engineering", 25],
    ["Rohit", "Bansal", "male", "Associate Professor", "Ph.D.", "Manufacturing Processes", 14],
    ["Pooja", "Mehta", "female", "Assistant Professor", "M.Tech", "Robotics", 5],
    ["Sanjay", "Gupta", "male", "Visiting Faculty", "M.E.", "Automobile Engineering", 18],
  ],
  CE: [
    ["Venkatesh", "Rao", "male", "Professor", "Ph.D. (IIT Roorkee)", "Structural Engineering", 21],
    ["Lakshmi", "Narayanan", "female", "Associate Professor", "Ph.D.", "Geotechnical Engineering", 10],
    ["Amit", "Saxena", "male", "Assistant Professor", "M.Tech", "Transportation Engineering", 4],
  ],
  EE: [
    ["Mohan", "Chatterjee", "male", "Professor", "Ph.D. (IIT Kharagpur)", "Power Systems", 23],
    ["Divya", "Agarwal", "female", "Associate Professor", "Ph.D.", "Control Systems", 9],
    ["Harish", "Kumar", "male", "Assistant Professor", "M.Tech", "Renewable Energy", 6],
  ],
  MBA: [
    ["Neha", "Kapoor", "female", "Professor", "Ph.D. (IIM Ahmedabad)", "Strategic Management", 19],
    ["Rahul", "Sinha", "male", "Associate Professor", "Ph.D., CFA", "Corporate Finance", 12],
    ["Shalini", "Bose", "female", "Assistant Professor", "MBA, UGC-NET", "Marketing", 5],
  ],
};

const COURSES: Record<string, { code: string; name: string; level: "UG" | "PG"; years: number }> = {
  CSE: { code: "BTECH-CSE", name: "B.Tech Computer Science and Engineering", level: "UG", years: 4 },
  IT: { code: "BTECH-IT", name: "B.Tech Information Technology", level: "UG", years: 4 },
  ECE: { code: "BTECH-ECE", name: "B.Tech Electronics and Communication", level: "UG", years: 4 },
  ME: { code: "BTECH-ME", name: "B.Tech Mechanical Engineering", level: "UG", years: 4 },
  CE: { code: "BTECH-CE", name: "B.Tech Civil Engineering", level: "UG", years: 4 },
  EE: { code: "BTECH-EE", name: "B.Tech Electrical Engineering", level: "UG", years: 4 },
  MBA: { code: "MBA", name: "Master of Business Administration", level: "PG", years: 2 },
};

// [code, name, semester, credits, type, weeklyHours, [faculty indexes within dept], hours each]
type SubjRow = [string, string, number, number, "theory" | "lab" | "elective", number, number[]];
const SUBJECTS: Record<string, SubjRow[]> = {
  CSE: [
    ["CS301", "Data Structures and Algorithms", 3, 4, "theory", 4, [1]],
    ["CS303", "Database Management Systems", 3, 4, "theory", 4, [2]],
    ["CS305", "Object Oriented Programming Lab", 3, 2, "lab", 4, [1, 4]],
    ["CS501", "Machine Learning", 5, 4, "theory", 4, [0]],
    ["CS503", "Computer Networks", 5, 3, "theory", 3, [3]],
    ["CS701", "Cloud and Distributed Systems", 7, 3, "elective", 3, [2]],
    ["CS705", "Information Security", 7, 3, "theory", 3, [3]],
    ["CS307", "Web Technologies", 3, 3, "theory", 3, [4]],
  ],
  IT: [
    ["IT301", "Software Engineering", 3, 3, "theory", 3, [0]],
    ["IT303", "Web Application Development", 3, 3, "lab", 4, [3]],
    ["IT501", "Cloud Computing", 5, 4, "theory", 4, [1]],
    ["IT503", "Advanced Database Systems", 5, 3, "theory", 3, [2]],
    ["IT305", "Computer Networks", 3, 3, "theory", 3, [3]],
  ],
  ECE: [
    ["EC301", "Analog Electronic Circuits", 3, 4, "theory", 4, [1]],
    ["EC501", "VLSI Design", 5, 4, "theory", 4, [0]],
    ["EC503", "Embedded Systems Lab", 5, 2, "lab", 4, [2, 3]],
    ["EC305", "Microprocessors and Interfacing", 3, 3, "theory", 3, [2]],
  ],
  ME: [
    ["ME301", "Thermodynamics", 3, 4, "theory", 4, [0]],
    ["ME501", "Manufacturing Technology", 5, 3, "theory", 3, [1]],
    ["ME503", "Robotics and Automation", 5, 3, "elective", 3, [2]],
    ["ME705", "Automobile Engineering", 7, 3, "elective", 3, [3]],
  ],
  CE: [
    ["CE301", "Structural Analysis", 3, 4, "theory", 4, [0]],
    ["CE501", "Geotechnical Engineering", 5, 3, "theory", 3, [1]],
    ["CE503", "Transportation Engineering", 5, 3, "theory", 3, [2]],
  ],
  EE: [
    ["EE301", "Electrical Machines", 3, 4, "theory", 4, [0]],
    ["EE501", "Control Systems", 5, 4, "theory", 4, [1]],
    ["EE503", "Renewable Energy Systems", 5, 3, "elective", 3, [2]],
  ],
  MBA: [
    ["MB101", "Principles of Management", 1, 3, "theory", 3, [0]],
    ["MB103", "Financial Accounting", 1, 3, "theory", 3, [1]],
    ["MB301", "Marketing Management", 3, 3, "theory", 3, [2]],
  ],
};

async function main() {
  await connectDB();
  console.log("[seed] clearing collections…");
  await Promise.all(
    [User, Faculty, Department, Course, Subject, AcademicSession, Attendance, LeaveApplication, LeaveBalance, Workload, Timetable, Announcement, Notification, AuditLog, SystemSetting, RefreshToken, Counter].map((m) =>
      (m as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({}),
    ),
  );
  // Ensure indexes (unique constraints) exist before inserting.
  await Promise.all([User, Faculty, Attendance, Workload, LeaveBalance, Department, Subject].map((m) => (m as unknown as { syncIndexes: () => Promise<unknown> }).syncIndexes()));

  const passwordHash = await bcrypt.hash(env.seedPassword, 12);
  const today = todayDateOnly();

  // ---------- Settings & sessions ----------
  await SystemSetting.create({
    key: "global",
    institutionName: "Northbridge Institute of Technology",
    institutionShortName: "NIT",
    address: "12 University Road, Bengaluru, Karnataka 560001",
    contactEmail: "office@northbridge.edu",
    academicYear: ACADEMIC_YEAR,
    currentSemester: "Odd",
    workingDays: WORKING_DAYS,
  });
  await AcademicSession.insertMany([
    { name: "2024-25", startDate: toDateOnly("2024-07-01"), endDate: toDateOnly("2025-06-30"), isCurrent: false, semesters: [{ name: "Odd", startDate: toDateOnly("2024-07-15"), endDate: toDateOnly("2024-12-15") }, { name: "Even", startDate: toDateOnly("2025-01-06"), endDate: toDateOnly("2025-05-31") }] },
    { name: PREV_YEAR, startDate: toDateOnly("2025-07-01"), endDate: toDateOnly("2026-06-30"), isCurrent: false, semesters: [{ name: "Odd", startDate: toDateOnly("2025-07-14"), endDate: toDateOnly("2025-12-13") }, { name: "Even", startDate: toDateOnly("2026-01-05"), endDate: toDateOnly("2026-05-30") }] },
    { name: ACADEMIC_YEAR, startDate: toDateOnly("2026-07-01"), endDate: toDateOnly("2027-06-30"), isCurrent: true, semesters: [{ name: "Odd", startDate: toDateOnly("2026-07-13"), endDate: toDateOnly("2026-12-12") }, { name: "Even", startDate: toDateOnly("2027-01-04"), endDate: toDateOnly("2027-05-29") }] },
  ]);

  // ---------- Admin ----------
  const admin = await User.create({ name: "Dr. Aditi Rao", email: "admin@facultyhub.com", password: passwordHash, role: "admin" });
  // The pre-save hook hashed our hash; store the single hash directly instead.
  await User.collection.updateOne({ _id: admin._id }, { $set: { password: passwordHash } });

  // ---------- Departments, courses, faculty ----------
  const deptDocs: Record<string, InstanceType<typeof Department>> = {};
  const courseDocs: Record<string, InstanceType<typeof Course>> = {};
  const facultyByDept: Record<string, InstanceType<typeof Faculty>[]> = {};
  let seq = 0;

  for (const d of DEPARTMENTS) {
    const dept = await Department.create({ name: d.name, code: d.code, description: d.desc, establishedYear: d.est, location: d.location, email: `${d.code.toLowerCase()}@northbridge.edu`, phone: `+91 80 4567 ${1000 + d.est % 1000}` });
    deptDocs[d.code] = dept;
    const c = COURSES[d.code];
    courseDocs[d.code] = await Course.create({ name: c.name, code: c.code, department: dept._id, level: c.level, durationYears: c.years, totalSemesters: c.years * 2, intake: c.level === "PG" ? 60 : 120, description: `${c.name} offered by the Department of ${d.name}.` });

    facultyByDept[d.code] = [];
    for (let i = 0; i < FACULTY[d.code].length; i++) {
      const [firstName, lastName, gender, designation, qualification, specialization, exp] = FACULTY[d.code][i];
      seq++;
      let email = `${firstName}.${lastName}`.toLowerCase() + "@northbridge.edu";
      if (d.code === "CSE" && i === 0) email = "hod@facultyhub.com";
      if (d.code === "CSE" && i === 1) email = "faculty@facultyhub.com";
      const joined = subDays(today, Math.round((Math.min(exp, 15) * 0.7 + rand() * 2) * 365));
      const status = d.code === "ME" && i === 3 ? "active" : d.code === "IT" && i === 3 ? "probation" : "active";
      const fac = await Faculty.create({
        facultyId: `FAC${String(seq).padStart(4, "0")}`,
        firstName,
        lastName,
        gender,
        dateOfBirth: toDateOnly(format(subDays(today, Math.round((exp + 26 + rand() * 4) * 365)), "yyyy-MM-dd")),
        email,
        phone: `+91 9${Math.floor(100000000 + rand() * 899999999)}`,
        address: { line1: `${Math.floor(rand() * 200) + 1}, ${pick(["MG Road", "Residency Road", "Indiranagar 2nd Stage", "Koramangala 5th Block", "Jayanagar 4th Block", "HSR Layout Sector 2"])}`, city: "Bengaluru", state: "Karnataka", postalCode: `5600${Math.floor(10 + rand() * 89)}`, country: "India" },
        emergencyContact: { name: `${pick(["Sunita", "Ravi", "Lata", "Prakash", "Asha", "Gopal"])} ${lastName}`, relation: pick(["Spouse", "Parent", "Sibling"]), phone: `+91 9${Math.floor(100000000 + rand() * 899999999)}` },
        department: dept._id,
        designation,
        qualification,
        specialization,
        experienceYears: exp,
        dateOfJoining: toDateOnly(format(joined, "yyyy-MM-dd")),
        employmentType: designation === "Visiting Faculty" ? "visiting" : designation === "Lab Instructor" ? "contract" : "full_time",
        status,
        courses: [courseDocs[d.code]._id],
      });
      facultyByDept[d.code].push(fac);
    }
  }
  await Counter.create({ _id: "facultyId", seq });

  // Extra non-active records for status reports.
  const extra = await Faculty.create({
    facultyId: `FAC${String(++seq).padStart(4, "0")}`, firstName: "Gopal", lastName: "Srinivasan", gender: "male", email: "gopal.srinivasan@northbridge.edu", phone: "+91 9845012345",
    department: deptDocs.ME._id, designation: "Professor", qualification: "Ph.D.", specialization: "Fluid Mechanics", experienceYears: 34, dateOfJoining: toDateOnly("1994-08-01"), employmentType: "full_time", status: "retired",
  });
  const extra2 = await Faculty.create({
    facultyId: `FAC${String(++seq).padStart(4, "0")}`, firstName: "Ritu", lastName: "Chawla", gender: "female", email: "ritu.chawla@northbridge.edu", phone: "+91 9845098765",
    department: deptDocs.IT._id, designation: "Assistant Professor", qualification: "M.Tech", specialization: "Mobile Computing", experienceYears: 3, dateOfJoining: toDateOnly("2023-07-10"), employmentType: "contract", status: "resigned",
  });
  await Counter.updateOne({ _id: "facultyId" }, { seq });

  // ---------- Users for every faculty ----------
  const allFaculty = Object.values(facultyByDept).flat();
  const userDocs = await User.insertMany(
    [...allFaculty, extra, extra2].map((f, idx) => ({
      name: `${f.firstName} ${f.lastName}`,
      email: f.email,
      password: passwordHash,
      role: Object.values(facultyByDept).some((list) => list[0]._id.equals(f._id)) ? "hod" : "faculty",
      faculty: f._id,
      isActive: idx < allFaculty.length,
      lastLoginAt: subDays(new Date(), Math.floor(rand() * 10)),
    })),
  );
  for (const u of userDocs) await Faculty.updateOne({ _id: u.faculty }, { user: u._id });
  for (const code of Object.keys(deptDocs)) await Department.updateOne({ _id: deptDocs[code]._id }, { head: facultyByDept[code][0]._id });
  const userOf = (facId: Types.ObjectId) => userDocs.find((u) => String(u.faculty) === String(facId))!;

  // ---------- Subjects, workload ----------
  const subjects: InstanceType<typeof Subject>[] = [];
  const workloadRows: Record<string, unknown>[] = [];
  for (const [code, rows] of Object.entries(SUBJECTS)) {
    for (const [scode, name, sem, credits, type, hours, idxs] of rows) {
      const assigned = idxs.map((i) => facultyByDept[code][i]._id);
      const s = await Subject.create({
        name, code: scode, department: deptDocs[code]._id, course: courseDocs[code]._id, semester: sem, academicYear: ACADEMIC_YEAR, credits, type, weeklyHours: hours, assignedFaculty: assigned,
        description: `${name} – core ${type} course for semester ${sem} of ${COURSES[code].name}.`,
      });
      subjects.push(s);
      // Theory: each assigned faculty teaches two sections. Lab: split hours between instructors.
      idxs.forEach((i, k) => {
        const fac = facultyByDept[code][i];
        const sections = type === "lab" ? ["A"] : code === "CSE" || code === "IT" ? ["A", "B"] : ["A"];
        for (const section of sections) {
          workloadRows.push({
            faculty: fac._id, subject: s._id, course: courseDocs[code]._id, department: deptDocs[code]._id, semester: sem, academicYear: ACADEMIC_YEAR,
            weeklyHours: type === "lab" ? hours / idxs.length + (k === 0 ? 0 : 0) : hours, type: type === "lab" ? "lab" : "lecture", section, assignedBy: admin._id,
          });
        }
      });
    }
  }
  // Tutorials to create realistic spread (some overloaded faculty).
  const cs301 = subjects.find((s) => s.code === "CS301")!;
  workloadRows.push({ faculty: facultyByDept.CSE[1]._id, subject: cs301._id, course: courseDocs.CSE._id, department: deptDocs.CSE._id, semester: 3, academicYear: ACADEMIC_YEAR, weeklyHours: 2, type: "tutorial", section: "A", assignedBy: admin._id });
  const cs705 = subjects.find((s) => s.code === "CS705")!;
  workloadRows.push({ faculty: facultyByDept.CSE[3]._id, subject: cs705._id, course: courseDocs.CSE._id, department: deptDocs.CSE._id, semester: 7, academicYear: ACADEMIC_YEAR, weeklyHours: 2, type: "tutorial", section: "A", assignedBy: admin._id });

  // Top up each faculty member to a realistic weekly load by adding further sections
  // (and tutorials) of subjects they already teach. A few are deliberately left
  // under- or over-loaded so workload alerts have something to show.
  const LOAD_TARGET: Record<string, number> = { "CSE:2": 21, "IT:1": 19, "CSE:0": 8, "ME:3": 6, "ECE:3": 4 };
  const SECTION_NAMES = ["B", "C", "D", "E"];
  for (const [code, list] of Object.entries(facultyByDept)) {
    list.forEach((fac, i) => {
      const target = LOAD_TARGET[`${code}:${i}`] ?? 11 + Math.floor(rand() * 6); // 11–16 hrs
      const mine = workloadRows.filter((w) => String(w.faculty) === String(fac._id));
      let hours = mine.reduce((a, w) => a + Number(w.weeklyHours), 0);
      const theory = mine.filter((w) => w.type === "lecture");
      let n = 0;
      while (hours < target && theory.length && n < 12) {
        const base = theory[n % theory.length];
        const used = new Set(workloadRows.filter((w) => String(w.faculty) === String(fac._id) && String(w.subject) === String(base.subject)).map((w) => `${w.type}:${w.section}`));
        const remaining = target - hours;
        let row: Record<string, unknown> | null = null;
        if (remaining <= 2) {
          const sec = ["A", ...SECTION_NAMES].find((x) => !used.has(`tutorial:${x}`));
          if (sec) row = { ...base, weeklyHours: Math.min(2, remaining), type: "tutorial", section: sec };
        } else {
          const sec = SECTION_NAMES.find((x) => !used.has(`lecture:${x}`));
          if (sec) row = { ...base, weeklyHours: Math.min(Number(base.weeklyHours), remaining), section: sec };
        }
        if (row) {
          workloadRows.push(row);
          hours += Number(row.weeklyHours);
        }
        n++;
      }
    });
  }
  await Workload.insertMany(workloadRows);

  // Previous-year subjects & workload (teaching history).
  const prevSubjects = [
    ["CS402", "Operating Systems", "CSE", 4, [0, 1]],
    ["CS404", "Theory of Computation", "CSE", 4, [2]],
    ["IT402", "Data Mining", "IT", 4, [1]],
    ["EC402", "Digital Signal Processing", "ECE", 4, [1]],
  ] as const;
  for (const [code, name, dep, sem, idxs] of prevSubjects) {
    const s = await Subject.create({ name, code, department: deptDocs[dep]._id, course: courseDocs[dep]._id, semester: sem, academicYear: PREV_YEAR, credits: 4, type: "theory", weeklyHours: 4, assignedFaculty: idxs.map((i) => facultyByDept[dep][i]._id), description: `${name} (archived ${PREV_YEAR} offering).` });
    await Workload.insertMany(idxs.map((i) => ({ faculty: facultyByDept[dep][i]._id, subject: s._id, course: courseDocs[dep]._id, department: deptDocs[dep]._id, semester: sem, academicYear: PREV_YEAR, weeklyHours: 4, type: "lecture", section: "A", assignedBy: admin._id })));
  }

  // ---------- Timetable (conflict-free greedy placement) ----------
  const SLOTS = [["09:00", "09:55"], ["09:55", "10:50"], ["11:05", "12:00"], ["12:00", "12:55"], ["13:45", "14:40"], ["14:40", "15:35"], ["15:35", "16:30"]];
  const busy = new Set<string>();
  const ttRows: Record<string, unknown>[] = [];
  const allWl = await Workload.find({ academicYear: ACADEMIC_YEAR }).populate("subject", "code semester department type").lean();
  let roomCounter = 0;
  for (const wl of allWl) {
    const subj = wl.subject as unknown as { _id: Types.ObjectId; code: string; semester: number; department: Types.ObjectId; type: string };
    const dep = Object.values(deptDocs).find((d) => d._id.equals(subj.department))!;
    const section = `${dep.code}-${subj.semester}${wl.section}`;
    const room = subj.type === "lab" ? `${dep.code}-LAB${(roomCounter % 2) + 1}` : `${dep.code.slice(0, 2)}-${101 + (roomCounter % 6)}`;
    roomCounter++;
    let toPlace = Math.min(4, Math.ceil(wl.weeklyHours));
    for (let attempt = 0; attempt < 120 && toPlace > 0; attempt++) {
      const day = WORKING_DAYS[(attempt * 2 + roomCounter) % 6];
      const slotIdx = (attempt * 3 + roomCounter) % SLOTS.length;
      const keys = [`f:${wl.faculty}:${day}:${slotIdx}`, `r:${room}:${day}:${slotIdx}`, `s:${section}:${day}:${slotIdx}`];
      if (keys.some((k) => busy.has(k))) continue;
      keys.forEach((k) => busy.add(k));
      ttRows.push({ faculty: wl.faculty, subject: subj._id, department: dep._id, section, room, dayOfWeek: day, startTime: SLOTS[slotIdx][0], endTime: SLOTS[slotIdx][1], academicYear: ACADEMIC_YEAR, semester: subj.semester, createdBy: admin._id });
      toPlace--;
    }
  }
  await Timetable.insertMany(ttRows);

  // ---------- Leave applications ----------
  const leaveRows: Record<string, unknown>[] = [];
  const mkLeave = (fac: InstanceType<typeof Faculty>, type: string, startOffset: number, len: number, status: string, reason: string, remarks = "") => {
    const start = addDays(today, startOffset);
    const days = workingDaysBetween(start, addDays(start, len - 1), WORKING_DAYS);
    if (!days.length) return;
    const s = days[0];
    const e = days[days.length - 1];
    const reviewer = status === "approved" || status === "rejected" ? (fac._id.equals(facultyByDept[Object.keys(facultyByDept).find((k) => facultyByDept[k].some((f) => f._id.equals(fac._id)))!][0]._id) ? admin._id : userOf(facultyByDept[Object.keys(facultyByDept).find((k) => facultyByDept[k].some((f) => f._id.equals(fac._id)))!][0]._id)._id) : undefined;
    leaveRows.push({
      faculty: fac._id, department: fac.department, leaveType: type, startDate: s, endDate: e, days: days.length, reason, status, academicYear: ACADEMIC_YEAR, appliedBy: userOf(fac._id)._id,
      reviewedBy: reviewer, reviewedAt: reviewer ? subDays(s, 2) : undefined, reviewRemarks: remarks, cancelledAt: status === "cancelled" ? subDays(s, 1) : undefined,
      createdAt: subDays(s, 5),
    });
  };
  const F = facultyByDept;
  mkLeave(F.CSE[1], "casual", -40, 2, "approved", "Attending a family wedding in Mysuru.", "Approved. Arrange substitute classes.");
  mkLeave(F.CSE[1], "sick", -12, 1, "approved", "Viral fever, doctor advised rest.", "Get well soon.");
  mkLeave(F.CSE[1], "earned", 9, 3, "pending", "Presenting a paper at the IEEE ICDS conference, Pune.");
  mkLeave(F.CSE[1], "casual", -25, 1, "rejected", "Personal work.", "Mid-semester examinations are scheduled; please reschedule.");
  mkLeave(F.CSE[2], "medical", -60, 5, "approved", "Minor surgery and recovery period.", "Approved with medical certificate.");
  mkLeave(F.CSE[3], "casual", 5, 1, "pending", "Bank and property registration work.");
  mkLeave(F.CSE[4], "sick", -5, 2, "approved", "Seasonal flu.", "");
  mkLeave(F.CSE[4], "other", 14, 2, "cancelled", "Visa appointment (rescheduled).");
  mkLeave(F.IT[1], "earned", -30, 4, "approved", "Annual family vacation.", "Enjoy your break.");
  mkLeave(F.IT[2], "casual", 3, 2, "pending", "Sister's engagement ceremony.");
  mkLeave(F.IT[3], "sick", -2, 1, "approved", "Migraine.", "");
  mkLeave(F.ECE[1], "casual", -18, 1, "approved", "Child's school annual day.", "");
  mkLeave(F.ECE[2], "earned", 20, 5, "pending", "Faculty development programme at NIT Surathkal.");
  mkLeave(F.ME[1], "medical", -45, 6, "approved", "Knee injury, physiotherapy sessions.", "Approved on medical grounds.");
  mkLeave(F.ME[2], "casual", -8, 1, "rejected", "Personal reasons.", "Insufficient notice during lab examinations.");
  mkLeave(F.CE[1], "casual", 1, 1, "pending", "Home renovation contractor meeting.");
  mkLeave(F.EE[2], "sick", -20, 2, "approved", "Food poisoning.", "");
  mkLeave(F.MBA[2], "other", -15, 1, "approved", "Jury duty summons.", "Approved – civic duty.");
  mkLeave(F.MBA[1], "earned", 10, 4, "pending", "Speaking at the CFA Institute India forum.");
  mkLeave(F.CSE[0], "casual", 7, 1, "pending", "Thesis viva examination at IISc (external examiner).");
  await LeaveApplication.insertMany(leaveRows);
  const leaves = await LeaveApplication.find().sort({ createdAt: 1 });

  // Leave balances reflecting approved leaves.
  const policy = { casual: 12, sick: 10, earned: 15, medical: 20, other: 5 };
  await LeaveBalance.insertMany(
    allFaculty.map((f) => ({
      faculty: f._id,
      academicYear: ACADEMIC_YEAR,
      balances: (Object.keys(policy) as (keyof typeof policy)[]).map((t) => ({
        type: t,
        allocated: policy[t],
        used: leaves.filter((l) => l.faculty.equals(f._id) && l.status === "approved" && l.leaveType === t).reduce((a, l) => a + l.days, 0),
      })),
    })),
  );

  // ---------- Attendance (last ~100 days) ----------
  const attStart = subDays(today, 100);
  const days = workingDaysBetween(attStart, today, WORKING_DAYS);
  const approved = leaves.filter((l) => l.status === "approved");
  const attRows: Record<string, unknown>[] = [];
  const hodUser = userOf(F.CSE[0]._id);
  const demoFaculty = F.CSE[1];
  allFaculty.forEach((f, fi) => {
    // Each faculty gets a reliability profile so percentages differ realistically.
    const reliability = fi % 9 === 4 ? 0.8 : fi % 7 === 2 ? 0.88 : 0.95;
    for (const date of days) {
      if (f.dateOfJoining > date) continue;
      const isToday = date.getTime() === today.getTime();
      if (isToday && (f._id.equals(demoFaculty._id) || fi % 6 === 5)) continue; // leave some unmarked today (demo self check-in)
      const leave = approved.find((l) => l.faculty.equals(f._id) && l.startDate <= date && l.endDate >= date);
      const deptCode = Object.keys(F).find((k) => F[k].some((x) => x._id.equals(f._id)))!;
      const marker = deptCode === "CSE" ? hodUser._id : admin._id;
      if (leave) {
        attRows.push({ faculty: f._id, department: f.department, date, status: "on_leave", source: "leave", leave: leave._id, remarks: "Approved leave", markedBy: marker });
        continue;
      }
      const r = rand();
      let status: string;
      if (r < reliability - 0.06) status = "present";
      else if (r < reliability) status = "late";
      else status = "absent";
      const inMin = status === "late" ? 9 * 60 + 16 + Math.floor(rand() * 40) : 8 * 60 + 40 + Math.floor(rand() * 34);
      const outMin = 16 * 60 + 30 + Math.floor(rand() * 75);
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const self = rand() < 0.35 && status !== "absent";
      attRows.push({
        faculty: f._id, department: f.department, date, status,
        checkIn: status === "absent" ? undefined : hhmm(inMin),
        checkOut: status === "absent" || isToday ? undefined : hhmm(outMin),
        source: self ? "self" : "manual",
        remarks: status === "absent" ? pick(["Absent without prior intimation", "Informed by phone", ""]) : status === "late" ? pick(["Traffic delay", "", "Public transport delay"]) : "",
        markedBy: self ? userOf(f._id)._id : marker,
      });
    }
  });
  await Attendance.insertMany(attRows);

  // ---------- Announcements ----------
  const ann = await Announcement.insertMany([
    { title: "Odd Semester End-Term Examination Schedule", content: "The end-term examinations for the odd semester will begin on 8 December. All faculty must submit question papers to the examination cell by 25 November. Invigilation duty rosters will be shared by department heads.", priority: "important", category: "academic", audience: "all", publishAt: subDays(new Date(), 2), isPinned: true, createdBy: admin._id },
    { title: "National Conference on Emerging Technologies (NCET 2026)", content: "The institute is hosting NCET 2026 in the main auditorium. Faculty are encouraged to attend the keynote sessions and chair technical tracks. Registration is free for staff.", priority: "normal", category: "event", audience: "all", publishAt: subDays(new Date(), 6), eventDate: addDays(today, 9), createdBy: admin._id },
    { title: "Faculty Development Programme: Outcome-Based Education", content: "A five-day FDP on outcome-based education and NBA accreditation readiness will be conducted by the IQAC. Nominations from each department are due this Friday.", priority: "normal", category: "event", audience: "all", publishAt: subDays(new Date(), 4), eventDate: addDays(today, 16), createdBy: admin._id },
    { title: "Mandatory: Update Your Faculty Profile", content: "As part of the NAAC data collection drive, all faculty members are requested to verify their qualifications, specialisation and contact information in FacultyHub before 30 November.", priority: "urgent", category: "administrative", audience: "all", publishAt: subDays(new Date(), 1), expiresAt: addDays(today, 12), createdBy: admin._id },
    { title: "CSE Department Meeting – Curriculum Review", content: "All CSE faculty are requested to attend the curriculum review meeting in the department seminar hall. Please bring your course outcome mapping sheets.", priority: "important", category: "event", audience: "departments", departments: [deptDocs.CSE._id], publishAt: subDays(new Date(), 1), eventDate: addDays(today, 3), createdBy: hodUser._id },
    { title: "Campus Network Maintenance", content: "The campus network will be unavailable on Sunday from 06:00 to 10:00 for core switch upgrades. Please plan any online assessments accordingly.", priority: "normal", category: "general", audience: "all", publishAt: subDays(new Date(), 10), createdBy: admin._id },
    { title: "Annual Sports Meet – Faculty Volunteers Needed", content: "The physical education department is looking for faculty volunteers to coordinate events during the annual sports meet. Contact the sports office to sign up.", priority: "normal", category: "event", audience: "all", publishAt: subDays(new Date(), 3), eventDate: addDays(today, 24), createdBy: admin._id },
    { title: "Winter Vacation Schedule (Upcoming)", content: "Winter vacation for faculty will be from 24 December to 1 January. Department heads will publish duty rosters for the examination evaluation period.", priority: "normal", category: "administrative", audience: "all", publishAt: addDays(new Date(), 5), createdBy: admin._id },
  ]);

  // ---------- Notifications ----------
  const demoUser = userOf(demoFaculty._id);
  const notifRows: Record<string, unknown>[] = [];
  for (const u of userDocs.filter((x) => x.isActive)) {
    notifRows.push({ user: u._id, type: "announcement", title: ann[0].title, message: ann[0].content.slice(0, 160), link: "/announcements", isRead: rand() < 0.5, createdAt: subDays(new Date(), 2) });
    notifRows.push({ user: u._id, type: "announcement", title: `Urgent: ${ann[3].title}`, message: ann[3].content.slice(0, 160), link: "/announcements", isRead: false, createdAt: subDays(new Date(), 1) });
  }
  notifRows.push(
    { user: demoUser._id, type: "leave", title: "Leave approved", message: "Your sick leave was approved. Remarks: Get well soon.", link: "/leaves", isRead: false, createdAt: subDays(new Date(), 11) },
    { user: demoUser._id, type: "workload", title: "New workload allocation", message: "CS301 – Data Structures and Algorithms: 2 hrs/week (tutorial, section A).", link: "/workload", isRead: false, createdAt: subDays(new Date(), 20) },
    { user: demoUser._id, type: "timetable", title: "Timetable updated", message: "Your timetable for the odd semester has been published.", link: "/timetable", isRead: true, createdAt: subDays(new Date(), 30) },
    { user: hodUser._id, type: "leave", title: "New leave application", message: "Priya Sharma applied for 3 day(s) of earned leave.", link: "/leaves", isRead: false, createdAt: subDays(new Date(), 1) },
    { user: admin._id, type: "leave", title: "New leave application", message: "Rajesh Iyer applied for 1 day of casual leave.", link: "/leaves", isRead: false, createdAt: subDays(new Date(), 1) },
    { user: admin._id, type: "system", title: "Welcome to FacultyHub", message: "Demo data has been loaded. Explore faculty, attendance, leave and workload modules.", link: "/dashboard", isRead: false, createdAt: new Date() },
  );
  await Notification.insertMany(notifRows);

  // ---------- Audit trail ----------
  const auditRows: Record<string, unknown>[] = [
    { user: null, userName: "System", role: "system", action: "SEED", module: "system", description: "Database seeded with demo data", createdAt: subDays(new Date(), 0) },
  ];
  allFaculty.slice(-6).forEach((f, i) => auditRows.push({ user: admin._id, userName: admin.name, role: "admin", action: "CREATE", module: "faculty", recordId: String(f._id), description: `Created faculty ${f.facultyId} – ${f.firstName} ${f.lastName}`, createdAt: subDays(new Date(), 20 - i) }));
  leaves.filter((l) => l.status === "approved" || l.status === "rejected").slice(0, 8).forEach((l) => auditRows.push({ user: l.reviewedBy, userName: String(l.reviewedBy) === String(admin._id) ? admin.name : "Department Head", role: String(l.reviewedBy) === String(admin._id) ? "admin" : "hod", action: l.status === "approved" ? "APPROVE" : "REJECT", module: "leave", recordId: String(l._id), description: `${l.status === "approved" ? "Approved" : "Rejected"} ${l.leaveType} leave (${l.days} days)`, createdAt: l.reviewedAt }));
  auditRows.push({ user: admin._id, userName: admin.name, role: "admin", action: "UPDATE", module: "settings", description: "Updated system settings (workload, leavePolicy)", createdAt: subDays(new Date(), 15) });
  auditRows.push({ user: admin._id, userName: admin.name, role: "admin", action: "CREATE", module: "workload", description: "Allocated odd-semester teaching workload", createdAt: subDays(new Date(), 25) });
  auditRows.push({ user: admin._id, userName: admin.name, role: "admin", action: "STATUS_CHANGE", module: "faculty", recordId: String(extra2._id), description: `Set ${extra2.facultyId} status to resigned (login disabled)`, createdAt: subDays(new Date(), 40) });
  await AuditLog.insertMany(auditRows);

  console.log(`[seed] done:
  departments ${DEPARTMENTS.length}, faculty ${allFaculty.length + 2}, subjects ${subjects.length + prevSubjects.length},
  workload ${workloadRows.length}, timetable ${ttRows.length}, attendance ${attRows.length}, leaves ${leaves.length}, announcements ${ann.length}

  Demo accounts (password: ${env.seedPassword})
    admin@facultyhub.com   – Administrator
    hod@facultyhub.com     – HOD, Computer Science and Engineering
    faculty@facultyhub.com – Faculty, Computer Science and Engineering`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error("[seed] failed", err);
  await disconnectDB();
  process.exit(1);
});

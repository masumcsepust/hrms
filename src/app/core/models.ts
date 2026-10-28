// ---------------------------------------------------------------------------
// Domain models for the HRM System (SRS revision 2)
// ---------------------------------------------------------------------------

export type ID = string;
export type YesNo = boolean;
export type GroupType = 'Worker' | 'Officer';
export type SeparationType = 'Resigned' | 'Released' | 'Normal Separation';
export type DayType = 'Workday' | 'Holiday' | 'Adjustment' | 'WeeklyOff' | 'Weekend';
export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'On Leave'
  | 'Holiday'
  | 'Weekend'
  | 'Incomplete';

export interface Company {
  id: ID;
  name: string;
  code: string;
  active: boolean;
}

export interface EmployeeType {
  id: ID;
  name: string;
  code: string;
  active: boolean;
  /** EST-3: non-permanent types are reported as "Temporary". */
  permanent: boolean;
}

export interface Department {
  id: ID;
  name: string;
  active: boolean;
}

export interface Section {
  id: ID;
  name: string;
  active: boolean;
}

export interface Designation {
  id: ID;
  name: string;
  active: boolean;
}

export interface WorkGroup {
  id: ID;
  code: string;
  name: string;
  /** WRG-2 (proposed): mandatory, drives every Worker/Officer rule. */
  groupType: GroupType;
  active: boolean;
}

export interface LeaveType {
  id: ID;
  name: string;
  code: string;
  annualDays: number;
  /** LVE-3: max days carried into the next year (0 = not carried). */
  carryForward: number;
  /** ERN-1: earned leave is calculated, not granted up-front. */
  calculated: boolean;
  /** LVE-7: a supporting document is mandatory for this type. */
  attachmentRequired: boolean;
  active: boolean;
}

export interface ShiftPolicy {
  id: ID;
  name: string;
  /** HH:mm — recurring time of day (SRS marks the DateTime detail TBC). */
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** SHP-2 / exempt time: grace minutes after shift start. */
  exemptMinutes: number;
  shiftType: string;
  active: boolean;
}

export interface DutyRoster {
  id: ID;
  code: string;
  startDate: string;
  endDate: string;
  /** ROS-2: roster for a work group. */
  workGroupId: ID | null;
  /** ROS-4 (proposed): individual assignment, takes precedence. */
  employeeId: ID | null;
  shiftPolicyId: ID;
  /** 0 = Sunday … 6 = Saturday. */
  weekDays: number[];
  active: boolean;
}

export interface CalendarDay {
  id: ID;
  /** ISO date yyyy-mm-dd */
  date: string;
  dayType: DayType;
  comment: string;
  /** CAL-4: calendar is maintained per work group (null = all groups). */
  workGroupId: ID | null;
}

export interface Separation {
  type: SeparationType;
  date: string;
  comment: string;
}

export interface Employee {
  id: ID; // EMP-2: manually entered, unique
  fullName: string;
  photo: string | null;
  dob: string;
  gender: string;
  companyId: ID;
  employeeTypeId: ID;
  departmentId: ID;
  sectionId: ID;
  designationId: ID;
  joiningDate: string;
  workGroupId: ID;
  active: boolean; // EMP-5
  separation: Separation | null; // EMP-6
  leaveTypeIds: ID[]; // EMP-3
  degree: string;
  institute: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  presentAddress: string;
  permanentAddress: string;
  maritalStatus: string;
  nid: string;
  referenceBy: string;
  referenceRemark: string;
  // EMP-11 / NFR-8 — payroll-authorised permission only
  bankAccountNo: string;
  joiningSalary: number;
  presentSalary: number;
  /** Approver for this employee (ESS-2). */
  approverId: ID | null;
}

export interface Punch {
  id: ID;
  employeeId: ID;
  /** ISO date */
  date: string;
  /** HH:mm */
  time: string;
  source: 'Device' | 'Manual' | 'Corrected';
  /** ATT-02: mandatory remark for manual entries and corrections. */
  remark: string;
  deviceId: string;
}

export interface LeaveApplication {
  id: ID;
  employeeId: ID;
  leaveTypeId: ID;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  attachmentName: string | null;
  status: 'Applied' | 'Approved' | 'Rejected' | 'Settled';
  /** LVE-6: leave without pay, requires prior management approval. */
  isLwp: boolean;
  /** LVE-6: considered leave, requires prior management approval. */
  isCnl: boolean;
  managementApproved: boolean;
  /** LVE-8: weekend days counted into the leave for a Worker. */
  sandwichDays: number;
  appliedAt: string;
  decidedBy: ID | null;
  decidedAt: string | null;
  decisionRemark: string;
}

export interface ElPayoff {
  id: ID;
  employeeId: ID;
  year: number;
  days: number;
  amount: number;
  at: string;
  by: string;
  remark: string;
}

export interface AuditEntry {
  id: ID;
  at: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
}

export interface User {
  id: ID;
  name: string;
  email: string;
  role: 'HR' | 'Payroll' | 'Employee' | 'Approver' | 'Management';
  /** HR users may be linked to a specific employee record. */
  employeeId: ID | null;
}

export interface Db {
  companies: Company[];
  employeeTypes: EmployeeType[];
  departments: Department[];
  sections: Section[];
  designations: Designation[];
  workGroups: WorkGroup[];
  leaveTypes: LeaveType[];
  shiftPolicies: ShiftPolicy[];
  dutyRosters: DutyRoster[];
  calendar: CalendarDay[];
  employees: Employee[];
  punches: Punch[];
  leaveApplications: LeaveApplication[];
  elPayoffs: ElPayoff[];
  audit: AuditEntry[];
  users: User[];
  currentUserId: ID;
  /** NFR-7: single configured time zone for all punch times and dates. */
  timeZone: string;
}

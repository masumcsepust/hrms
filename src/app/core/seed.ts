import {
  CalendarDay,
  Company,
  Db,
  Department,
  Designation,
  DutyRoster,
  Employee,
  EmployeeType,
  LeaveApplication,
  LeaveType,
  Punch,
  Section,
  ShiftPolicy,
  User,
  WorkGroup,
} from './models';
import { addDays, toDate, todayIso, weekdayOf } from './calc';

// deterministic PRNG so the demo data is stable between reloads
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

const FIRST_M = [
  'Md. Rahim', 'Md. Karim', 'Md. Jahangir', 'Md. Selim', 'Md. Rubel', 'Md. Hasan',
  'Md. Jamal', 'Md. Rezaul', 'Md. Kamrul', 'Md. Sohel', 'Md. Nasir', 'Md. Rafiqul',
  'Md. Anwar', 'Md. Billal', 'Md. Sazzad', 'Md. Touhid', 'Md. Habib', 'Md. Salam',
  'Md. Mizanur', 'Md. Ashraful', 'Md. Emon', 'Md. Rifat', 'Md. Sajib', 'Md. Al-amin',
];
const FIRST_F = [
  'Roksana', 'Shahnaz', 'Rahima', 'Karima', 'Nasrin', 'Farida', 'Shirin', 'Hasina',
  'Rehana', 'Ayesha', 'Rumana', 'Sharmin', 'Jannatul', 'Mitu', 'Runa', 'Morjina',
];
const LAST = [
  'Islam', 'Hossain', 'Rahman', 'Ahmed', 'Uddin', 'Akter', 'Begum', 'Khatun',
  'Miah', 'Sarkar', 'Chowdhury', 'Bhuiyan', 'Molla', 'Khan', 'Talukder', 'Mondal',
  'Haque', 'Sheikh', 'Alam', 'Khan', 'Bhowmik', 'Das', 'Ghosh', 'Roy',
];

export const WEEKLY_OFF_DAY = 5; // Friday (2.3: standard week is Saturday to Thursday)

export function buildSeed(): Db {
  const rnd = mulberry32(20260101);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const today = todayIso();
  const year = Number(today.slice(0, 4));

  const companies: Company[] = [
    { id: 'co-1', name: 'Hana Bike Company Ltd.', code: 'HBCL', active: true },
    { id: 'co-2', name: 'Hana Apparel Ltd.', code: 'HAL', active: true },
  ];

  const employeeTypes: EmployeeType[] = [
    { id: 'et-1', name: 'Permanent', code: 'PERM', active: true, permanent: true },
    { id: 'et-2', name: 'Probationary', code: 'PROB', active: true, permanent: false },
    { id: 'et-3', name: 'Contractual', code: 'CON', active: true, permanent: false },
    { id: 'et-4', name: 'Temporary', code: 'TMP', active: true, permanent: false },
  ];

  const departments: Department[] = [
    { id: 'dp-1', name: 'Production', active: true },
    { id: 'dp-2', name: 'HR & Admin', active: true },
    { id: 'dp-3', name: 'Accounts', active: true },
    { id: 'dp-4', name: 'Quality Control', active: true },
    { id: 'dp-5', name: 'Purchase & Store', active: true },
    { id: 'dp-6', name: 'Export & Marketing', active: true },
    { id: 'dp-7', name: 'IT', active: true },
  ];

  const sections: Section[] = [
    { id: 'se-1', name: 'Cutting', active: true },
    { id: 'se-2', name: 'Stitching', active: true },
    { id: 'se-3', name: 'Finishing', active: true },
    { id: 'se-4', name: 'Quality', active: true },
    { id: 'se-5', name: 'Store', active: true },
    { id: 'se-6', name: 'Purchase', active: true },
    { id: 'se-7', name: 'Export', active: true },
    { id: 'se-8', name: 'Accounts', active: true },
  ];

  const designations: Designation[] = [
    { id: 'ds-1', name: 'General Manager', active: true },
    { id: 'ds-2', name: 'Deputy Manager', active: true },
    { id: 'ds-3', name: 'Assistant Manager', active: true },
    { id: 'ds-4', name: 'Executive Officer', active: true },
    { id: 'ds-5', name: 'Junior Officer', active: true },
    { id: 'ds-6', name: 'Supervisor', active: true },
    { id: 'ds-7', name: 'Senior Technician', active: true },
    { id: 'ds-8', name: 'Technician', active: true },
    { id: 'ds-9', name: 'Machine Operator', active: true },
    { id: 'ds-10', name: 'Helper', active: true },
    { id: 'ds-11', name: 'Accounts Officer', active: true },
  ];

  const workGroups: WorkGroup[] = [
    { id: 'wg-1', code: 'HOOFF', name: 'HO Officer', groupType: 'Officer', active: true },
    { id: 'wg-2', code: 'FACOFF', name: 'Factory Officer', groupType: 'Officer', active: true },
    { id: 'wg-3', code: 'WRK', name: 'Worker', groupType: 'Worker', active: true },
    { id: 'wg-4', code: 'SKILLED', name: 'Skilled Worker', groupType: 'Worker', active: true },
  ];

  const leaveTypes: LeaveType[] = [
    { id: 'lt-1', name: 'Sick', code: 'SL', annualDays: 14, carryForward: 0, calculated: false, attachmentRequired: true, active: true },
    { id: 'lt-2', name: 'Casual', code: 'CL', annualDays: 10, carryForward: 0, calculated: false, attachmentRequired: false, active: true },
    { id: 'lt-3', name: 'Maternity', code: 'ML', annualDays: 120, carryForward: 0, calculated: false, attachmentRequired: true, active: true },
    { id: 'lt-4', name: 'Earned', code: 'EL', annualDays: 0, carryForward: 15, calculated: true, attachmentRequired: false, active: true },
  ];

  const shiftPolicies: ShiftPolicy[] = [
    { id: 'sh-1', name: 'General Shift (8:00 - 16:00)', startTime: '08:00', endTime: '16:00', breakMinutes: 60, exemptMinutes: 10, shiftType: 'Day', active: true },
    { id: 'sh-2', name: 'Production Shift (6:00 - 14:00)', startTime: '06:00', endTime: '14:00', breakMinutes: 30, exemptMinutes: 10, shiftType: 'Day', active: true },
    { id: 'sh-3', name: 'Night Shift (22:00 - 06:00)', startTime: '22:00', endTime: '06:00', breakMinutes: 45, exemptMinutes: 15, shiftType: 'Night', active: true },
    { id: 'sh-4', name: 'Officer Shift (9:00 - 17:00)', startTime: '09:00', endTime: '17:00', breakMinutes: 60, exemptMinutes: 15, shiftType: 'Day', active: true },
  ];

  const allWeek = [6, 0, 1, 2, 3, 4]; // Sat..Thu, Friday is the weekly holiday
  const dutyRosters: DutyRoster[] = [
    { id: 'ro-1', code: 'R-WG1-2026', startDate: `${year - 1}-01-01`, endDate: `${year + 1}-12-31`, workGroupId: 'wg-1', employeeId: null, shiftPolicyId: 'sh-4', weekDays: allWeek, active: true },
    { id: 'ro-2', code: 'R-WG2-2026', startDate: `${year - 1}-01-01`, endDate: `${year + 1}-12-31`, workGroupId: 'wg-2', employeeId: null, shiftPolicyId: 'sh-1', weekDays: allWeek, active: true },
    { id: 'ro-3', code: 'R-WG3-2026', startDate: `${year - 1}-01-01`, endDate: `${year + 1}-12-31`, workGroupId: 'wg-3', employeeId: null, shiftPolicyId: 'sh-2', weekDays: allWeek, active: true },
    { id: 'ro-4', code: 'R-WG4-2026', startDate: `${year - 1}-01-01`, endDate: `${year + 1}-12-31`, workGroupId: 'wg-4', employeeId: null, shiftPolicyId: 'sh-2', weekDays: allWeek, active: true },
  ];

  // --- calendar ------------------------------------------------------------
  const calendar: CalendarDay[] = [];
  const holidays: [string, string][] = [
    [`${year}-01-01`, "English New Year"],
    [`${year}-03-17`, 'Sheikh Mujibur Rahman Day'],
    [`${year}-03-26`, 'Independence Day'],
    [`${year}-05-01`, 'May Day'],
    [`${year}-08-15`, 'National Mourning Day'],
    [`${year}-12-16`, 'Victory Day'],
    [`${year}-12-25`, 'Christmas Day'],
    [`${year}-03-21`, 'Eid ul-Fitr (declared)'],
    [`${year}-03-22`, 'Eid ul-Fitr (declared)'],
    [`${year}-06-08`, 'Eid ul-Adha (declared)'],
    [`${year}-06-09`, 'Eid ul-Adha (declared)'],
  ];
  for (const [d, c] of holidays) {
    calendar.push({ id: `cal-${d}-all`, date: d, dayType: 'Holiday', comment: c, workGroupId: null });
  }
  for (const d of ['14', '15', '16']) {
    const date = `${year}-04-${d}`;
    calendar.push({
      id: `cal-${date}-wg-3`,
      date,
      dayType: 'Adjustment',
      comment: 'Bengali New Year — factory working day',
      workGroupId: 'wg-3',
    });
  }

  // --- employees -----------------------------------------------------------
  const employees: Employee[] = [];
  const groupPlan: { wg: string; count: number }[] = [
    { wg: 'wg-1', count: 6 },
    { wg: 'wg-2', count: 8 },
    { wg: 'wg-3', count: 20 },
    { wg: 'wg-4', count: 8 },
  ];
  let empNo = 1000;
  for (const plan of groupPlan) {
    for (let i = 0; i < plan.count; i++) {
      empNo += 1;
      const female = rnd() < 0.28;
      const name = `${female ? pick(FIRST_F) : pick(FIRST_M)} ${pick(LAST)}`;
      const officer = plan.wg === 'wg-1' || plan.wg === 'wg-2';
      const joiningYear = year - Math.floor(rnd() * 6);
      const joiningMonth = 1 + Math.floor(rnd() * 12);
      const joiningDay = 1 + Math.floor(rnd() * 27);
      const joining = `${joiningYear}-${String(joiningMonth).padStart(2, '0')}-${String(joiningDay).padStart(2, '0')}`;
      const type: string = rnd() < 0.62 ? 'et-1' : rnd() < 0.5 ? 'et-2' : rnd() < 0.6 ? 'et-3' : 'et-4';
      const dept = officer
        ? pick(['dp-2', 'dp-3', 'dp-4', 'dp-5', 'dp-6', 'dp-7'])
        : pick(['dp-1', 'dp-1', 'dp-1', 'dp-4', 'dp-5']);
      const section = officer ? pick(['se-4', 'se-5', 'se-6', 'se-7', 'se-8']) : pick(['se-1', 'se-2', 'se-2', 'se-3', 'se-5']);
      const desig = officer
        ? pick(['ds-1', 'ds-2', 'ds-3', 'ds-4', 'ds-5', 'ds-6', 'ds-11'])
        : pick(['ds-6', 'ds-7', 'ds-8', 'ds-9', 'ds-9', 'ds-10']);
      const base = 22000 + Math.floor(rnd() * 38000);
      const current = base + Math.floor(rnd() * 30000);
      const separated = rnd() < 0.12;
      const sepDate = separated ? addDays(today, -Math.floor(rnd() * 120)) : '';
      const sepType = pick(['Resigned', 'Released', 'Normal Separation'] as const);
      const company = rnd() < 0.68 ? 'co-1' : 'co-2';
      const leaveSet = type === 'et-4' ? ['lt-1', 'lt-2'] : ['lt-1', 'lt-2', 'lt-3', 'lt-4'];
      employees.push({
        id: `HB-${empNo}`,
        fullName: name,
        photo: null,
        dob: `${joiningYear - 20 - Math.floor(rnd() * 15)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`,
        gender: female ? 'Female' : 'Male',
        companyId: company,
        employeeTypeId: type,
        departmentId: dept,
        sectionId: section,
        designationId: desig,
        joiningDate: joining,
        workGroupId: plan.wg,
        active: !separated, // EMP-9: separation does not deactivate automatically
        separation: separated
          ? { type: sepType, date: sepDate, comment: sepType === 'Resigned' ? 'Resigned for personal reasons' : sepType === 'Released' ? 'Released on disciplinary ground' : 'Retired on completion of service' }
          : null,
        leaveTypeIds: leaveSet,
        degree: pick(['Graduation', 'Masters', 'Other', 'Higher Secondary']),
        institute: pick(['University of Dhaka', 'BUET', 'Jahangirnagar University', 'BRAC University', 'Daffodil International University', 'HSC']),
        phone: `01${pick(['3', '4', '5', '6', '7', '8'])}${String(Math.floor(rnd() * 100000000)).padStart(8, '0')}`,
        emergencyPhone: `01${pick(['3', '4', '5', '6', '7', '8'])}${String(Math.floor(rnd() * 100000000)).padStart(8, '0')}`,
        email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}.${empNo}@hanabike.com.bd`,
        presentAddress: `House ${10 + Math.floor(rnd() * 90)}, Road ${1 + Math.floor(rnd() * 20)}, ${pick(['Dhaka', 'Gazipur', 'Savar', 'Narayanganj', 'Tangail'])}`,
        permanentAddress: `Village ${pick(['Daudkandi', 'Sreemangal', 'Manikganj', 'Faridpur', 'Comilla'])}, ${pick(['Dhaka', 'Sylhet', 'Barishal', 'Rajshahi'])}`,
        maritalStatus: pick(['Single', 'Married', 'Widowed']),
        nid: String(Math.floor(rnd() * 900000000) + 100000000),
        referenceBy: '',
        referenceRemark: '',
        bankAccountNo: `00${pick(['10', '20', '30'])}${String(Math.floor(rnd() * 1000000000)).padStart(10, '0')}`,
        joiningSalary: base,
        presentSalary: current,
        approverId: null,
      });
    }
  }

  // approver assignment — the HO manager approves everybody
  const approver = employees.find((e) => e.workGroupId === 'wg-1' && e.designationId === 'ds-1') ?? employees[0];
  for (const e of employees) e.approverId = approver.id;

  // --- leave applications ---------------------------------------------------
  const leaveApplications: LeaveApplication[] = [];
  const reasons = [
    'Fever and body pain, medical leave advised by doctor.',
    'Family function at home.',
    'Village travel, urgent family matter.',
    'Severe cold and cough.',
    'Personal work at home.',
    'Medical check-up at city diagnostic.',
  ];
  for (let i = 0; i < 34; i++) {
    const emp = pick(employees.filter((e) => !e.separation));
    const lt = pick(leaveTypes);
    const days = lt.id === 'lt-3' ? 90 + Math.floor(rnd() * 30) : 1 + Math.floor(rnd() * 3);
    const from = addDays(today, -Math.floor(rnd() * 110) - 3);
    const to = addDays(from, days - 1);
    const r = rnd();
    const status: LeaveApplication['status'] = r < 0.62 ? 'Settled' : r < 0.78 ? 'Approved' : r < 0.9 ? 'Applied' : 'Rejected';
    leaveApplications.push({
      id: uid('lv'),
      employeeId: emp.id,
      leaveTypeId: lt.id,
      fromDate: from,
      toDate: to,
      days,
      reason: pick(reasons),
      attachmentName: lt.attachmentRequired ? `medical-certificate-${emp.id}.pdf` : null,
      status,
      isLwp: false,
      isCnl: false,
      managementApproved: true,
      sandwichDays: 0,
      appliedAt: `${addDays(from, -2)} 09:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`,
      decidedBy: status === 'Applied' ? null : emp.approverId,
      decidedAt: status === 'Applied' ? null : `${addDays(from, -1)} 11:20`,
      decisionRemark: status === 'Rejected' ? 'Insufficient balance for the requested period.' : '',
    });
  }

  // --- punches (last 90 days) ---------------------------------------------
  const punches: Punch[] = [];
  const shiftByGroup: Record<string, ShiftPolicy> = {
    'wg-1': shiftPolicies[3],
    'wg-2': shiftPolicies[1],
    'wg-3': shiftPolicies[1],
    'wg-4': shiftPolicies[1],
  };
  const calendarMap = new Map(calendar.map((c) => [c.date, c]));

  const start = addDays(today, -89);
  for (const emp of employees) {
    if (emp.separation) continue;
    const shift = shiftByGroup[emp.workGroupId];
    const isOfficer = shiftByGroup[emp.workGroupId].id === 'sh-4' || emp.workGroupId === 'wg-2';
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (weekdayOf(d) === WEEKLY_OFF_DAY) continue;
      const cal = calendarMap.get(d);
      if (cal && cal.dayType === 'Holiday') continue;
      // an approved leave day has no punches
      const onLeave = leaveApplications.some(
        (l) =>
          l.employeeId === emp.id &&
          l.fromDate <= d &&
          l.toDate >= d &&
          (l.status === 'Approved' || l.status === 'Settled'),
      );
      if (onLeave) continue;
      const r = rnd();
      if (r < 0.05) continue; // absent
      const sMin = toMinLocal(shift.startTime);
      const eMin = toMinLocal(shift.endTime);
      const late = isOfficer ? rnd() * 0.18 : rnd() * 0.3;
      const inMin = sMin + Math.round((rnd() - 0.45) * 25 + late * 40);
      const ot = rnd() < 0.42 ? Math.round(rnd() * 110) : 0;
      const outMin = eMin + ot + Math.round((rnd() - 0.6) * 18);
      const inTime = fmtLocal(inMin);
      const outTime = fmtLocal(outMin);
      punches.push({ id: uid('pu'), employeeId: emp.id, date: d, time: inTime, source: 'Device', remark: '', deviceId: 'ZK-01' });
      if (rnd() < 0.55) {
        // mid-shift tea break punch
        const tea = sMin + Math.round((eMin - sMin) * 0.45);
        punches.push({ id: uid('pu'), employeeId: emp.id, date: d, time: fmtLocal(tea), source: 'Device', remark: '', deviceId: 'ZK-01' });
      }
      punches.push({ id: uid('pu'), employeeId: emp.id, date: d, time: outTime, source: 'Device', remark: '', deviceId: 'ZK-01' });
      if (rnd() < 0.04) {
        // a manual correction with a mandatory remark (ATT-02)
        punches.push({ id: uid('pu'), employeeId: emp.id, date: d, time: fmtLocal(outMin + 6), source: 'Corrected', remark: 'Out time corrected by supervisor', deviceId: 'ZK-01' });
      }
    }
  }

  const users: User[] = [
    { id: 'u-1', name: 'Ashraful Akand', email: 'ashraful.akand@hanabike.com.bd', role: 'HR', employeeId: approver.id },
    { id: 'u-2', name: 'Nusrat Jahan', email: 'nusrat.jahan@hanabike.com.bd', role: 'Payroll', employeeId: null },
    { id: 'u-3', name: 'Shahidul Islam', email: 'shahidul.islam@hanabike.com.bd', role: 'Management', employeeId: null },
    { id: 'u-4', name: 'Rumana Ahmed', email: 'rumana.ahmed@hanabike.com.bd', role: 'Employee', employeeId: employees[12]?.id ?? null },
    { id: 'u-5', name: 'Tanvir Hasan', email: 'tanvir.hasan@hanabike.com.bd', role: 'Approver', employeeId: approver.id },
  ];

  return {
    companies,
    employeeTypes,
    departments,
    sections,
    designations,
    workGroups,
    leaveTypes,
    shiftPolicies,
    dutyRosters,
    calendar,
    employees,
    punches,
    leaveApplications,
    elPayoffs: [],
    audit: [],
    users,
    currentUserId: 'u-1',
    timeZone: 'Asia/Dhaka',
  };
}

function toMinLocal(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fmtLocal(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

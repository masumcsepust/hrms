# Hana HRM — Human Resource Management System (Angular 20)

বাংলায় সারাংশ: এই repository-তে SRS revision 2-এর সব module Angular 20-এ তৈরি করা হয়েছে —
employee master data, shift & roster planning, attendance (delay / OT calculation), leave
management (application → approval → settle), earned leave, ১০টি report, ID card, employee
self-service এবং audit trail। Calculation engine-টি SRS-এর worked example দিয়ে যাচাই করা
(44টি check, সব pass)।

---

## 1. Running it

```bash
npm install

# development server (hot reload)
npm start                 # http://localhost:4200

# production build
npm run build             # -> dist/hrms/browser
npm run postbuild         # adds 404.html for deep links on a plain static host
npm run serve             # serves the build on http://localhost:4200

# verification of the calculation engine against the SRS examples
npm run verify
```

### Deployment

| Target | Command |
| --- | --- |
| GitHub Pages (`/hrms/`) | `ng build --base-href /hrms/` then `npm run postbuild:pages` |
| Root of a host (`/`) | `npm run build` then `npm run postbuild` |

`.github/workflows/deploy.yml` builds the application, runs the calculation
verification and publishes it to GitHub Pages on every push to `main`.
The `404.html` fallback keeps deep links such as `/hrms/attendance/job-card`
working on a static host that does not rewrite unknown paths.

No backend is required. Data lives in a signal store and is persisted in `localStorage`
(key `hrms-db-v3`). **Reset demo data** in the sidebar rebuilds the seed dataset.

### Signed-in users (NFR-1 role based access)

Use the switcher in the top right corner to change the signed-in user and see the
role behaviour:

| User | Role | What changes |
| --- | --- | --- |
| Ashraful Akand | HR | full access to setup, attendance, leave processing and reports |
| Nusrat Jahan | Payroll | as HR **plus** the restricted bank and salary fields |
| Shahidul Islam | Management | prior approval for LWP / CNL, no HR screens |
| Rumana Ahmed | Employee | own profile and own leave only |
| Tanvir Hasan | Approver | approve or reject leave |

---

## 2. Requirement traceability

Every clause of the SRS is mapped to a screen or a service function.

### 3.1 Dashboard — `features/dashboard/dashboard.component.ts`
| Clause | Implementation |
| --- | --- |
| DSH-1 | total active headcount + company-wise breakdown |
| DSH-2 | day status (Present / On Leave) total and company-wise |
| DSH-3 | absence split into informed (a leave record exists for the day) and not informed |
| DSH-4 | separations of the current month split Resigned / Released / Normal Separation |

### 3.2 Employees — `features/employees/*`
| Clause | Implementation |
| --- | --- |
| EMP-1 | create / view / edit with the full data dictionary |
| EMP-2 | manual employee ID with a uniqueness check |
| EMP-3 | company, type, department, section, designation, work group and leave types from setup lists |
| EMP-4 | work group drives the default shift; an individual roster overrides it |
| EMP-5 | Active flag |
| EMP-6 | separation type (radio), date and comment |
| EMP-7 | education, contact and other information |
| EMP-8 | one tab per data dictionary group (Base data, Separation, Leave types, Education, Contact, Other information, Payroll information) |
| EMP-9 | recording a separation does **not** deactivate the employee — deactivation is a separate explicit action |
| EMP-10 | rejoining is an update of the existing record |
| EMP-11 | bank account no, joining salary and present salary, visible only with the payroll permission |

### 3.3 ID card — `features/employees/id-card.component.ts`
CRD-1 printable ID card, CRD-2 the template follows the employee's company (colour, mark and name).

### 3.4 Setup masters — `features/setup/setup.component.ts`
EMT-1/2, DPT-1/2, SEC-1/2, DSG-1/2, WRG-1/2 (code, name, mandatory Group type, status),
plus companies and leave types. Every list is create / edit / delete with a status flag and
a uniqueness rule.

### 3.5 Shift policy — `features/shift/shift-policy.component.ts`
SHP-1/2 name, start, end, break and exempt time; SHP-3 an end time before the start time is
treated as a night shift and the card says so.

### 3.6 Duty roster — `features/shift/duty-roster.component.ts`
ROS-1 working days as check boxes, ROS-2 a work group roster for a period, ROS-3 the system
refuses a second overlapping active roster for the same work group, ROS-4 an individual
employee assignment that takes precedence over the group roster.

### 3.7 Work / holiday calendar — `features/shift/calendar.component.ts`
CAL-1 month grid, CAL-2 declare a day as holiday / workday / adjustment by clicking it,
CAL-3 comment, CAL-4 per work group, CAL-5 colour coding, CAL-6 every change is logged.

### 3.8 Attendance — `core/attendance.service.ts`, `core/calc.ts`, `features/attendance/*`
| Clause | Implementation |
| --- | --- |
| ATT-01 | device punches are modelled (`source: 'Device'`, device id) and read by the attendance service |
| ATT-02 | manual entry and correction with a **mandatory** remark |
| ATT-03 | manual and corrected records are highlighted in the job card |
| ATT-11 | the first punch of a day is the in time, the last is the out time |
| ATT-12 | a single punch is flagged as *Incomplete* and highlighted in the punch count report |
| ATT-13 | no punch on a workday without approved leave is recorded as *Absent* |
| ATT-04/05 | Worker delay from shift start + exempt time, with the delay → OT adjustment table |
| ATT-06 | Officer delay, same base, no OT deduction (assumption A2) |
| ATT-07 | three delays in a calendar month raise an alert on the employee profile |
| ATT-08/09 | Worker overtime = check-out − shift end, less the delay adjustment, then rounded |
| ATT-10 | Officer overtime (assumption A2) |

**Delay adjustment (3.8.2)**

| Delay | OT adjustment |
| --- | --- |
| up to 30 minutes | 30 minutes |
| more than 30 minutes | 30 minutes + every minute beyond 30 |

**Overtime rounding (3.8.3)**

| Minutes in the hour | Counted |
| --- | --- |
| 0 – 25 | 0 minutes |
| 26 – 55 | 30 minutes |
| 56 – 60 | 60 minutes |

### 3.9 Job card — `features/attendance/job-card.component.ts`
JOB-1 employee and date range, JOB-2 all thirteen columns, JOB-3 delay / absence / leave are
highlighted, JOB-4 the summary strip, JOB-5 the work group rules drive delay and overtime,
JOB-6 export to PDF and Excel with the highlights preserved.

### 3.10 – 3.13 Daily reports
EDR (employee daily report), DAR (work group manpower, present count and present ratio),
DPC (punch count) and DLR (delay ratio) — `features/reports/report-page.component.ts` and
`features/attendance/daily-attendance.component.ts`.

### 3.14 – 3.15 EIR and EST
EIR filters on company, department, section, work group, employee type, active status, service
length range and a joining or separation date range; tenure is shown in years, months and days;
the bank and salary columns appear only for a payroll-authorised user and a report run is
logged (NFR-9). EST breaks the headcount down by company → work group → permanent / temporary
with per-company subtotals and a grand total.

### 3.16 – 3.18 Leave
| Clause | Implementation |
| --- | --- |
| LVE-1 | a limit per leave type, reduced by approved leave |
| LVE-2 | the new year entitlement is added at year end (`Balances & year end`) |
| LVE-3 | sick and casual are not carried forward, earned leave carries up to 15 days |
| LVE-4 | mid-year joiners get a proportional entitlement (total ÷ 12) × remaining months |
| LVE-5 | a zero balance makes the type not normally applicable |
| LVE-6 | LWP / CNL require prior management approval |
| LVE-7 | sick leave requires a mandatory attachment |
| LVE-8 | a weekend between leave days counts as leave for the Worker group and is excluded for the Officer group |
| ERN-3 | Worker earned leave = total work days ÷ 18 |
| ERN-4 | Officer earned leave = total work days ÷ (18 + sick days taken + 50 % of casual days taken) |
| ERN-5 | earned leave becomes usable one year after the joining date |
| ERN-6/7 | calendar year, carry forward up to 15 days, the excess may be paid out |
| ERN-8 | the pay-off is deducted from the balance and logged |
| ESS-1..4 | own profile, apply → approver → approved → settle, e-mail notification hooks, leave summary and history |

### 3.19 – 3.21 Leave and earned leave reports
LRP (one row per employee, January to December, with the balance), ELI (one row per month:
work days, earned, taken, paid, balance plus the yearly totals) and ELD (per employee earned
leave with work days, earned, taken, paid, carried forward and balance).

### 4. Non-functional requirements
| Clause | Implementation |
| --- | --- |
| NFR-1 | role based access, route guard on every HR screen, employees see only their own data |
| NFR-2 | audit trail for manual punches, calendar changes, separations and earned leave pay-offs |
| NFR-3 | notification hooks on apply / approve / reject (`core/leave.service.ts`) |
| NFR-4 | every report exports to PDF (jsPDF + autoTable) and Excel (xlsx-js-style) |
| NFR-5 | punches carry a device id and a source, so a device pull cannot duplicate a record |
| NFR-6 | delay, absence, leave, manual entry and overtime are colour coded everywhere |
| NFR-7 | a single configured time zone, Asia/Dhaka, in `core/calc.ts` |
| NFR-8 | bank and salary fields hidden in forms and reports without the payroll permission |
| NFR-9 | salary edits and Employee Information Report runs are logged with user and time |

---

## 3. Assumption register

The SRS marks several rules as **TBD** or **TBC**. Each one is implemented with an explicit,
documented assumption; the register lives in `core/calc.ts` (`ASSUMPTIONS`).

| Id | Clause | Assumption |
| --- | --- | --- |
| A1 | ATT-04 / ATT-08 | Delay is measured from the scheduled shift start; the exempt time is added to the start, so the first N minutes are grace. The worked examples in the delay table (a shift starting at 8:00 AM) therefore describe a shift with zero exempt time. |
| A2 | ATT-06 / ATT-10 (TBD) | Officer delay uses the same base as the Worker group but triggers no overtime deduction, because the deduction is a Worker rule. Officer overtime is the time actually worked beyond the scheduled shift length. |
| A3 | ATT-09 | The overtime rounding table is written for the Worker group; the same rounding is applied to Officer overtime. |
| A4 | LVE-4 (TBC) | A pro-rated entitlement is rounded down to whole days. |
| A5 | ERN-4 (TBC) | "Taken" means settled leave days in the calculation year; the officer denominator is rounded to one decimal place. |
| A6 | ERN-5 | Earned leave becomes usable one full year after the joining date, counted from the joining date. |

### Open questions for the business

1. **ATT-06 / ATT-10** — the Officer delay and overtime rules are still TBD. A2 is a placeholder.
2. **LVE-3** — the carry forward of *Maternity* leave is TBC; it is currently treated as 0.
3. **LVE-4** — the rounding of the pro-rated entitlement is TBC; currently rounded down.
4. **ERN-4** — the meaning of "taken" (settled only, or also approved) is TBC.
5. **DAR-5** — the field list has to be extracted from the SharePoint sheet and screen capture.
6. **ATT-07** — the recipient list and the repeat behaviour of the three-delay e-mail alert are TBC.
7. **Section 2.2** — the role list is inferred from the source and should be confirmed.
8. **Dar-5 / EIR-2** — the reference screens and sheets are on SharePoint and need access
   permission; they should be attached to the repository as images.

---

## 4. Architecture

```
src/app
├── core
│   ├── models.ts              domain types
│   ├── calc.ts                delay, overtime, earned leave, tenure, sandwich leave  ← the engine
│   ├── seed.ts                deterministic demo dataset
│   ├── store.ts               signal store with a typed collection per entity
│   ├── auth.ts                roles and permissions
│   ├── guards.ts              HR route guard
│   ├── scheduling.service.ts  duty roster and work calendar resolution
│   ├── attendance.service.ts  attendance days, job card and attendance reports
│   ├── leave.service.ts       entitlement, balance, application, approval, settlement
│   ├── export.service.ts      Excel and PDF export with the highlights preserved
│   └── toast.service.ts       notifications
├── shared                     page header, kpi, chip, icon, table, report view
└── features
    ├── dashboard
    ├── setup
    ├── employees               list, tabbed form, ID card
    ├── shift                   shift policy, duty roster, calendar
    ├── attendance              daily attendance, manual punch, job card
    ├── leave                   apply, approvals, balances and year end
    ├── reports                 report centre and the report engine
    ├── self-service            my profile, my leave
    └── audit                   audit trail
```

Data flows one way: a screen asks a service, the service reads the store and returns plain
objects, the screen renders them with signals. No service writes to another service's state.

---

## 5. Verification

`npm run verify` bundles the calculation engine with esbuild and runs **44 assertions** taken
straight from the SRS:

* the delay measurement and the exempt time (ATT-04),
* the delay → OT adjustment table including the 8:00 AM worked examples,
* the overtime rounding table, hour by hour,
* the night shift span (SHP-3),
* the officer overtime assumption (A2),
* the pro-rated entitlement of a mid-year joiner (LVE-4),
* the worker and officer earned leave formulas (ERN-3 / ERN-4),
* the one-year rule for earned leave (ERN-5),
* the tenure calculation (EIR-4),
* the sandwich leave rule for both group types (LVE-8).

The build is type checked with `tsc --noEmit` and compiled with the Angular production
compiler; every screen was loaded in a headless browser to confirm that it renders and that
no runtime error is raised.

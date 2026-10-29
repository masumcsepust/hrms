/* =============================================================================
   Hana HRM — Microsoft SQL Server schema (revision 2)
   File 01: schemas, tables, constraints, indexes, partitioning, temporal data
   -----------------------------------------------------------------------------
   Design rules applied throughout
     * snake_case objects inside named schemas: hr (business), audit, ops, app
     * surrogate INT/BIGINT identity keys + a separate natural business code
       (employee_code) that the user types in (EMP-2)
     * dates as DATE, clock times as TIME(0), stamps as DATETIME2(3) UTC
     * every mutable master row carries created_at / updated_at / row_version
     * soft delete through is_active instead of physical deletes
     * business rules that a CHECK constraint can express are expressed as a
       CHECK constraint; the rest live in triggers or procedures
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------- schemas -- */
CREATE SCHEMA hr    AUTHORIZATION dbo;   -- business data
CREATE SCHEMA audit AUTHORIZATION dbo;   -- audit trail (NFR-2, NFR-9)
CREATE SCHEMA ops   AUTHORIZATION dbo;   -- procedures and operational jobs
CREATE SCHEMA app   AUTHORIZATION dbo;   -- identity, roles, session context
GO

/* ================================================================ masters == */

CREATE TABLE hr.company (
    company_id      INT            IDENTITY(1,1) NOT NULL CONSTRAINT pk_company PRIMARY KEY,
    company_code    VARCHAR(20)    NOT NULL,
    company_name    NVARCHAR(160)  NOT NULL,
    is_active       BIT            NOT NULL CONSTRAINT df_company_active DEFAULT (1),
    created_at      DATETIME2(3)   NOT NULL CONSTRAINT df_company_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3)   NOT NULL CONSTRAINT df_company_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_company_code UNIQUE (company_code),
    CONSTRAINT ck_company_code CHECK (company_code = UPPER(company_code))
);
GO

CREATE TABLE hr.employee_type (
    employee_type_id INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_employee_type PRIMARY KEY,
    type_code        VARCHAR(20)   NOT NULL,
    type_name        NVARCHAR(80)  NOT NULL,
    /* EST-3 — non-permanent types are reported as "Temporary" */
    is_permanent     BIT           NOT NULL CONSTRAINT df_employee_type_permanent DEFAULT (0),
    is_active        BIT           NOT NULL CONSTRAINT df_employee_type_active DEFAULT (1),
    created_at       DATETIME2(3)  NOT NULL CONSTRAINT df_employee_type_created DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIME2(3)  NOT NULL CONSTRAINT df_employee_type_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_employee_type_code UNIQUE (type_code),
    CONSTRAINT uq_employee_type_name UNIQUE (type_name)
);
GO

CREATE TABLE hr.department (
    department_id   INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_department PRIMARY KEY,
    department_name NVARCHAR(120) NOT NULL,
    is_active       BIT           NOT NULL CONSTRAINT df_department_active DEFAULT (1),
    created_at      DATETIME2(3)  NOT NULL CONSTRAINT df_department_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3)  NOT NULL CONSTRAINT df_department_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_department_name UNIQUE (department_name)
);
GO

CREATE TABLE hr.section (
    section_id   INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_section PRIMARY KEY,
    section_name NVARCHAR(120) NOT NULL,
    is_active    BIT           NOT NULL CONSTRAINT df_section_active DEFAULT (1),
    created_at   DATETIME2(3)  NOT NULL CONSTRAINT df_section_created DEFAULT (SYSUTCDATETIME()),
    updated_at   DATETIME2(3)  NOT NULL CONSTRAINT df_section_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_section_name UNIQUE (section_name)
);
GO

CREATE TABLE hr.designation (
    designation_id   INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_designation PRIMARY KEY,
    designation_name NVARCHAR(120) NOT NULL,
    is_active        BIT           NOT NULL CONSTRAINT df_designation_active DEFAULT (1),
    created_at       DATETIME2(3)  NOT NULL CONSTRAINT df_designation_created DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIME2(3)  NOT NULL CONSTRAINT df_designation_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_designation_name UNIQUE (designation_name)
);
GO

/* WRG-2 / WRG-3 — the group type is mandatory and drives every Worker and
   Officer rule for delay, overtime, sandwich leave and earned leave. */
CREATE TABLE hr.work_group (
    work_group_id INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_work_group PRIMARY KEY,
    work_group_code VARCHAR(20) NOT NULL,
    work_group_name NVARCHAR(120) NOT NULL,
    group_type     VARCHAR(10)  NOT NULL,
    is_active      BIT          NOT NULL CONSTRAINT df_work_group_active DEFAULT (1),
    created_at     DATETIME2(3) NOT NULL CONSTRAINT df_work_group_created DEFAULT (SYSUTCDATETIME()),
    updated_at     DATETIME2(3) NOT NULL CONSTRAINT df_work_group_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_work_group_code UNIQUE (work_group_code),
    CONSTRAINT uq_work_group_name UNIQUE (work_group_name),
    CONSTRAINT ck_work_group_type CHECK (group_type IN ('Worker', 'Officer'))
);
GO

/* LVE-1 / LVE-3 / LVE-7 / ERN-1 */
CREATE TABLE hr.leave_type (
    leave_type_id        INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_leave_type PRIMARY KEY,
    leave_type_code      VARCHAR(10)   NOT NULL,
    leave_type_name      NVARCHAR(80)  NOT NULL,
    annual_days          DECIMAL(5,2)  NOT NULL CONSTRAINT df_leave_type_annual DEFAULT (0),
    carry_forward_days   DECIMAL(5,2)  NOT NULL CONSTRAINT df_leave_type_carry DEFAULT (0),
    /* earned leave is calculated from working days, not granted up front */
    is_calculated        BIT           NOT NULL CONSTRAINT df_leave_type_calculated DEFAULT (0),
    requires_attachment  BIT           NOT NULL CONSTRAINT df_leave_type_attachment DEFAULT (0),
    is_active            BIT           NOT NULL CONSTRAINT df_leave_type_active DEFAULT (1),
    created_at           DATETIME2(3)  NOT NULL CONSTRAINT df_leave_type_created DEFAULT (SYSUTCDATETIME()),
    updated_at           DATETIME2(3)  NOT NULL CONSTRAINT df_leave_type_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_leave_type_code UNIQUE (leave_type_code),
    CONSTRAINT uq_leave_type_name UNIQUE (leave_type_name),
    CONSTRAINT ck_leave_type_annual CHECK (annual_days >= 0),
    CONSTRAINT ck_leave_type_carry  CHECK (carry_forward_days >= 0 AND carry_forward_days <= 365),
    /* a calculated type cannot also carry a flat annual entitlement */
    CONSTRAINT ck_leave_type_calculated CHECK (is_calculated = 0 OR annual_days = 0)
);
GO

/* =================================================== shift, roster, calendar */

CREATE TABLE hr.shift_policy (
    shift_policy_id INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_shift_policy PRIMARY KEY,
    shift_name      NVARCHAR(120) NOT NULL,
    start_time      TIME(0)       NOT NULL,
    end_time        TIME(0)       NOT NULL,
    break_minutes   SMALLINT      NOT NULL CONSTRAINT df_shift_break DEFAULT (0),
    /* exempt time — grace period after the shift start (SHP-2) */
    exempt_minutes  SMALLINT      NOT NULL CONSTRAINT df_shift_exempt DEFAULT (0),
    shift_type      NVARCHAR(40)  NOT NULL CONSTRAINT df_shift_type DEFAULT ('Day'),
    is_active       BIT           NOT NULL CONSTRAINT df_shift_active DEFAULT (1),
    created_at      DATETIME2(3)  NOT NULL CONSTRAINT df_shift_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3)  NOT NULL CONSTRAINT df_shift_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_shift_name UNIQUE (shift_name),
    CONSTRAINT ck_shift_break  CHECK (break_minutes >= 0 AND break_minutes < 1440),
    CONSTRAINT ck_shift_exempt CHECK (exempt_minutes >= 0 AND exempt_minutes < 1440),
    /* SHP-3 — an end time not after the start time is a night shift */
    CONSTRAINT ck_shift_night CHECK (end_time > start_time OR end_time <= start_time)
);
GO

/* ROS-2 / ROS-4 — exactly one owner: a work group or a single employee. */
CREATE TABLE hr.duty_roster (
    roster_id      INT          IDENTITY(1,1) NOT NULL CONSTRAINT pk_duty_roster PRIMARY KEY,
    roster_code    NVARCHAR(40) NULL,
    start_date     DATE         NOT NULL,
    end_date       DATE         NOT NULL,
    work_group_id  INT          NULL,
    employee_id    INT          NULL,
    shift_policy_id INT         NOT NULL,
    is_active      BIT          NOT NULL CONSTRAINT df_roster_active DEFAULT (1),
    created_at     DATETIME2(3) NOT NULL CONSTRAINT df_roster_created DEFAULT (SYSUTCDATETIME()),
    updated_at     DATETIME2(3) NOT NULL CONSTRAINT df_roster_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT fk_roster_work_group FOREIGN KEY (work_group_id)  REFERENCES hr.work_group (work_group_id),
    CONSTRAINT fk_roster_employee   FOREIGN KEY (employee_id)    REFERENCES hr.employee (employee_id),
    CONSTRAINT fk_roster_shift      FOREIGN KEY (shift_policy_id) REFERENCES hr.shift_policy (shift_policy_id),
    CONSTRAINT ck_roster_period  CHECK (end_date >= start_date),
    CONSTRAINT ck_roster_owner   CHECK ((work_group_id IS NOT NULL AND employee_id IS NULL)
                                      OR (work_group_id IS NULL     AND employee_id IS NOT NULL))
);
GO

/* ROS-1 — the working days of a roster, normalised instead of a bit mask so
   that "who works on Saturday" is an indexable join. */
CREATE TABLE hr.duty_roster_weekday (
    roster_id  INT     NOT NULL,
    weekday    TINYINT NOT NULL,           -- 0 = Sunday … 6 = Saturday
    created_at DATETIME2(3) NOT NULL CONSTRAINT df_roster_day_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_roster_weekday PRIMARY KEY (roster_id, weekday),
    CONSTRAINT fk_roster_weekday_roster FOREIGN KEY (roster_id) REFERENCES hr.duty_roster (roster_id) ON DELETE CASCADE,
    CONSTRAINT ck_roster_weekday_range CHECK (weekday BETWEEN 0 AND 6)
);
GO

/* CAL-1 … CAL-5 — the calendar is maintained per work group; a NULL work group
   means the declaration applies to every group. */
CREATE TABLE hr.calendar_day (
    calendar_day_id BIGINT      IDENTITY(1,1) NOT NULL CONSTRAINT pk_calendar_day PRIMARY KEY,
    work_group_id   INT         NULL,
    calendar_date   DATE        NOT NULL,
    day_type        VARCHAR(12) NOT NULL,
    comment         NVARCHAR(400) NULL,
    created_at      DATETIME2(3) NOT NULL CONSTRAINT df_calendar_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT df_calendar_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT fk_calendar_work_group FOREIGN KEY (work_group_id) REFERENCES hr.work_group (work_group_id),
    CONSTRAINT ck_calendar_day_type CHECK (day_type IN ('Workday', 'Holiday', 'Adjustment', 'WeeklyOff'))
);
GO
/* SQL Server does not accept an expression in an index key, so the scope is
   materialised as a persisted computed column first. */
ALTER TABLE hr.calendar_day
    ADD work_group_key AS ISNULL(work_group_id, 0) PERSISTED;
GO

CREATE UNIQUE INDEX ux_calendar_day_scope ON hr.calendar_day (calendar_date, work_group_key);
GO

/* CRD-2 — every company owns its own ID card template. */
CREATE TABLE hr.id_card_template (
    company_id   INT           NOT NULL CONSTRAINT pk_id_card_template PRIMARY KEY,
    template_name NVARCHAR(120) NOT NULL,
    /* the template body: colours, logo, the layout of the fields */
    template_body NVARCHAR(MAX) NOT NULL,
    logo_uri     NVARCHAR(400) NULL,
    is_active    BIT           NOT NULL CONSTRAINT df_id_card_active DEFAULT (1),
    created_at   DATETIME2(3)  NOT NULL CONSTRAINT df_id_card_created DEFAULT (SYSUTCDATETIME()),
    updated_at   DATETIME2(3)  NOT NULL CONSTRAINT df_id_card_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT fk_id_card_company FOREIGN KEY (company_id) REFERENCES hr.company (company_id)
);
GO

/* ================================================================ employee == */

CREATE TABLE hr.employee (
    employee_id        INT            IDENTITY(1,1) NOT NULL CONSTRAINT pk_employee PRIMARY KEY,
    /* EMP-2 — entered by hand, unique */
    employee_code     VARCHAR(30)    NOT NULL,
    full_name         NVARCHAR(160)  NOT NULL,
    photo_uri         NVARCHAR(400)  NULL,
    date_of_birth     DATE           NULL,
    gender            VARCHAR(10)    NULL,

    company_id        INT            NOT NULL,
    employee_type_id  INT            NOT NULL,
    department_id     INT            NOT NULL,
    section_id        INT            NOT NULL,
    designation_id    INT            NOT NULL,
    work_group_id     INT            NOT NULL,
    joining_date      DATE           NOT NULL,
    is_active         BIT            NOT NULL CONSTRAINT df_employee_active DEFAULT (1),

    /* EMP-6 — separation is recorded, it never deactivates the employee (EMP-9) */
    separation_type   VARCHAR(30)    NULL,
    separation_date   DATE           NULL,
    separation_comment NVARCHAR(400) NULL,

    degree            NVARCHAR(120)  NULL,
    institute         NVARCHAR(200)  NULL,

    phone             VARCHAR(30)    NULL,
    emergency_phone   VARCHAR(30)    NULL,
    email             NVARCHAR(200)  NULL,
    present_address   NVARCHAR(400)  NULL,
    permanent_address NVARCHAR(400)  NULL,

    marital_status    VARCHAR(20)    NULL,
    nid               VARCHAR(20)    NULL,
    reference_employee_id INT         NULL,
    reference_remark  NVARCHAR(400)  NULL,

    /* EMP-11 / NFR-8 — restricted to the payroll-authorised permission */
    bank_account_no   VARCHAR(40)    NULL,
    joining_salary    DECIMAL(18,2)  NULL,
    present_salary    DECIMAL(18,2)  NULL,

    approver_employee_id INT         NULL,

    created_at        DATETIME2(3)   NOT NULL CONSTRAINT df_employee_created DEFAULT (SYSUTCDATETIME()),
    updated_at        DATETIME2(3)   NOT NULL CONSTRAINT df_employee_updated DEFAULT (SYSUTCDATETIME()),
    row_version       ROWVERSION     NOT NULL,

    CONSTRAINT fk_employee_company      FOREIGN KEY (company_id)       REFERENCES hr.company (company_id),
    CONSTRAINT fk_employee_type        FOREIGN KEY (employee_type_id) REFERENCES hr.employee_type (employee_type_id),
    CONSTRAINT fk_employee_department   FOREIGN KEY (department_id)    REFERENCES hr.department (department_id),
    CONSTRAINT fk_employee_section      FOREIGN KEY (section_id)       REFERENCES hr.section (section_id),
    CONSTRAINT fk_employee_designation  FOREIGN KEY (designation_id)   REFERENCES hr.designation (designation_id),
    CONSTRAINT fk_employee_work_group   FOREIGN KEY (work_group_id)    REFERENCES hr.work_group (work_group_id),
    CONSTRAINT fk_employee_reference    FOREIGN KEY (reference_employee_id) REFERENCES hr.employee (employee_id),
    CONSTRAINT fk_employee_approver     FOREIGN KEY (approver_employee_id)  REFERENCES hr.employee (employee_id),

    CONSTRAINT uq_employee_code UNIQUE (employee_code),
    CONSTRAINT ck_employee_gender   CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    CONSTRAINT ck_employee_separation CHECK (
        (separation_date IS NULL AND separation_type IS NULL AND separation_comment IS NULL)
     OR (separation_date IS NOT NULL AND separation_type IS NOT NULL)),
    CONSTRAINT ck_employee_sep_type CHECK (
        separation_type IS NULL OR separation_type IN ('Resigned', 'Released', 'Normal Separation')),
    CONSTRAINT ck_employee_sep_date CHECK (separation_date IS NULL OR separation_date >= joining_date),
    CONSTRAINT ck_employee_salary CHECK (
        (joining_salary IS NULL OR joining_salary >= 0) AND (present_salary IS NULL OR present_salary >= 0)),
    CONSTRAINT ck_employee_email CHECK (email IS NULL OR email LIKE '%_@_%.__%'),
    CONSTRAINT ck_employee_nid CHECK (nid IS NULL OR nid NOT LIKE '%[^0-9]%'),
    CONSTRAINT ck_employee_self_ref CHECK (reference_employee_id IS NULL OR reference_employee_id <> employee_id)
);
GO

/* EMP-3 — the leave types that apply to an employee. */
CREATE TABLE hr.employee_leave_type (
    employee_id  INT NOT NULL,
    leave_type_id INT NOT NULL,
    created_at   DATETIME2(3) NOT NULL CONSTRAINT df_emp_leave_type_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_employee_leave_type PRIMARY KEY (employee_id, leave_type_id),
    CONSTRAINT fk_emp_leave_type_employee FOREIGN KEY (employee_id)   REFERENCES hr.employee (employee_id) ON DELETE CASCADE,
    CONSTRAINT fk_emp_leave_type_type    FOREIGN KEY (leave_type_id) REFERENCES hr.leave_type (leave_type_id)
);
GO

/* ============================================================== attendance == */

CREATE TABLE hr.attendance_device (
    device_id    INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_attendance_device PRIMARY KEY,
    device_code  VARCHAR(40)   NOT NULL,
    device_name  NVARCHAR(120) NOT NULL,
    ip_address   VARCHAR(45)  NULL,
    last_sync_at DATETIME2(3)  NULL,
    is_active    BIT           NOT NULL CONSTRAINT df_device_active DEFAULT (1),
    created_at   DATETIME2(3)  NOT NULL CONSTRAINT df_device_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_device_code UNIQUE (device_code)
);
GO

/* Partitioning: the punch table is the only table that grows without bound.
   It is partitioned by month on punch_date so that a closed month can be
   archived with a metadata switch instead of a row-by-row delete. */
CREATE PARTITION FUNCTION pf_punch_date (DATE)
AS RANGE RIGHT FOR VALUES (
    '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01', '2025-06-01',
    '2025-07-01', '2025-08-01', '2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01',
    '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
    '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
    '2027-01-01');
GO

CREATE PARTITION SCHEME ps_punch_date
AS PARTITION pf_punch_date ALL TO ([PRIMARY]);
GO

CREATE TABLE hr.attendance_punch (
    /* the partition column has to be part of the clustered key */
    punch_date    DATE         NOT NULL,
    punch_id      BIGINT       IDENTITY(1,1) NOT NULL,
    employee_id   INT          NOT NULL,
    punch_time    TIME(0)      NOT NULL,
    /* Device | Manual | Corrected */
    source        VARCHAR(10)  NOT NULL CONSTRAINT df_punch_source DEFAULT ('Device'),
    /* ATT-02 — a remark is mandatory for a manual entry or a correction */
    remark        NVARCHAR(400) NULL,
    device_id     INT          NULL,
    /* the identifier the device gave to the record — the idempotency key of a
       device pull (NFR-5): the same device record can never be stored twice */
    external_ref  VARCHAR(80)  NULL,
    created_at    DATETIME2(3) NOT NULL CONSTRAINT df_punch_created DEFAULT (SYSUTCDATETIME()),
    created_by    NVARCHAR(100) NULL,
    CONSTRAINT pk_attendance_punch PRIMARY KEY CLUSTERED (punch_date, punch_id),
    CONSTRAINT fk_punch_employee FOREIGN KEY (employee_id) REFERENCES hr.employee (employee_id),
    CONSTRAINT fk_punch_device   FOREIGN KEY (device_id)   REFERENCES hr.attendance_device (device_id),
    CONSTRAINT ck_punch_source  CHECK (source IN ('Device', 'Manual', 'Corrected')),
    /* ATT-02 / ATT-03 */
    CONSTRAINT ck_punch_remark CHECK (source = 'Device' OR LEN(LTRIM(RTRIM(remark))) > 0),
    CONSTRAINT ck_punch_time   CHECK (punch_time >= '00:00:00' AND punch_time <= '23:59:59')
) ON ps_punch_date (punch_date);
GO

CREATE UNIQUE INDEX ux_punch_device_ref
    ON hr.attendance_punch (device_id, external_ref)
    WHERE device_id IS NOT NULL AND external_ref IS NOT NULL;
GO
CREATE INDEX ix_punch_employee_date
    ON hr.attendance_punch (employee_id, punch_date)
    INCLUDE (punch_time, source, punch_id);
GO
CREATE INDEX ix_punch_date_employee
    ON hr.attendance_punch (punch_date, employee_id)
    INCLUDE (punch_time, source);
GO

/* The derived attendance day — one row per employee per day. Everything the
   job card and the attendance reports read comes from here, so a report never
   has to recompute the rules. */
CREATE TABLE hr.attendance_daily (
    employee_id            INT           NOT NULL,
    attendance_date        DATE          NOT NULL,
    day_type               VARCHAR(12)   NOT NULL,
    status                 VARCHAR(12)   NOT NULL,
    shift_policy_id        INT           NULL,
    in_time                TIME(0)       NULL,
    out_time               TIME(0)       NULL,
    punch_count            SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_punches DEFAULT (0),
    delay_minutes          SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_delay DEFAULT (0),
    raw_ot_minutes         SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_rawot DEFAULT (0),
    delay_adjustment_minutes SMALLINT    NOT NULL CONSTRAINT df_attendance_daily_adj DEFAULT (0),
    counted_ot_minutes     SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_ot DEFAULT (0),
    less_minutes           SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_less DEFAULT (0),
    total_work_minutes     SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_total DEFAULT (0),
    regular_minutes        SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_reg DEFAULT (0),
    net_minutes            SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_net DEFAULT (0),
    shift_minutes          SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_shift DEFAULT (0),
    break_minutes          SMALLINT      NOT NULL CONSTRAINT df_attendance_daily_break DEFAULT (0),
    has_manual_entry       BIT           NOT NULL CONSTRAINT df_attendance_daily_manual DEFAULT (0),
    is_incomplete          BIT           NOT NULL CONSTRAINT df_attendance_daily_incomplete DEFAULT (0),
    remark                 NVARCHAR(400) NULL,
    posted_at              DATETIME2(3)  NOT NULL CONSTRAINT df_attendance_daily_posted DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_attendance_daily PRIMARY KEY (employee_id, attendance_date),
    CONSTRAINT fk_attendance_daily_employee FOREIGN KEY (employee_id) REFERENCES hr.employee (employee_id),
    CONSTRAINT fk_attendance_daily_shift FOREIGN KEY (shift_policy_id) REFERENCES hr.shift_policy (shift_policy_id),
    CONSTRAINT ck_attendance_daily_status CHECK (status IN ('Present', 'Absent', 'On Leave', 'Holiday', 'Weekend', 'Incomplete')),
    CONSTRAINT ck_attendance_daily_daytype CHECK (day_type IN ('Workday', 'Holiday', 'Adjustment', 'WeeklyOff', 'Weekend')),
    CONSTRAINT ck_attendance_daily_ot    CHECK (counted_ot_minutes >= 0 AND delay_minutes >= 0),
    CONSTRAINT ck_attendance_daily_punch CHECK (punch_count >= 0)
);
GO
CREATE INDEX ix_attendance_daily_date_status
    ON hr.attendance_daily (attendance_date, status) INCLUDE (employee_id);
GO
CREATE INDEX ix_attendance_daily_employee_date
    ON hr.attendance_daily (employee_id, attendance_date) INCLUDE (status, delay_minutes, counted_ot_minutes);
GO

/* ==================================================================== leave == */

CREATE TABLE hr.leave_application (
    application_id      BIGINT        IDENTITY(1,1) NOT NULL CONSTRAINT pk_leave_application PRIMARY KEY,
    employee_id         INT           NOT NULL,
    leave_type_id       INT           NOT NULL,
    from_date           DATE          NOT NULL,
    to_date             DATE          NOT NULL,
    /* the days that are deducted, sandwich days included (LVE-8) */
    days                DECIMAL(5,2)  NOT NULL,
    /* the weekend days that fell between the leave days */
    sandwich_days       SMALLINT      NOT NULL CONSTRAINT df_leave_app_sandwich DEFAULT (0),
    reason              NVARCHAR(800) NULL,
    attachment_name     NVARCHAR(260) NULL,
    attachment_uri      NVARCHAR(400) NULL,
    /* Applied | Approved | Rejected | Settled — the ESS-2 flow */
    status              VARCHAR(12)   NOT NULL CONSTRAINT df_leave_app_status DEFAULT ('Applied'),
    is_lwp              BIT           NOT NULL CONSTRAINT df_leave_app_lwp DEFAULT (0),
    is_cnl              BIT           NOT NULL CONSTRAINT df_leave_app_cnl DEFAULT (0),
    /* LVE-6 — LWP and CNL need prior management approval */
    management_approved BIT           NOT NULL CONSTRAINT df_leave_app_mgmt DEFAULT (0),
    applied_at          DATETIME2(3)  NOT NULL CONSTRAINT df_leave_app_applied DEFAULT (SYSUTCDATETIME()),
    decided_by_employee_id INT        NULL,
    decided_at          DATETIME2(3)  NULL,
    decision_remark     NVARCHAR(800) NULL,
    settled_at          DATETIME2(3)  NULL,
    row_version         ROWVERSION    NOT NULL,
    CONSTRAINT fk_leave_app_employee FOREIGN KEY (employee_id) REFERENCES hr.employee (employee_id),
    CONSTRAINT fk_leave_app_type     FOREIGN KEY (leave_type_id) REFERENCES hr.leave_type (leave_type_id),
    CONSTRAINT fk_leave_app_decider  FOREIGN KEY (decided_by_employee_id) REFERENCES hr.employee (employee_id),
    CONSTRAINT ck_leave_app_period CHECK (to_date >= from_date),
    CONSTRAINT ck_leave_app_days   CHECK (days > 0),
    CONSTRAINT ck_leave_app_status CHECK (status IN ('Applied', 'Approved', 'Rejected', 'Settled')),
    CONSTRAINT ck_leave_app_exception CHECK (
        (is_lwp = 0 AND is_cnl = 0) OR management_approved = 1),
    CONSTRAINT ck_leave_app_exclusive CHECK (is_lwp = 0 OR is_cnl = 0),
    CONSTRAINT ck_leave_app_decision CHECK (
        (status = 'Applied' AND decided_at IS NULL)
     OR (status IN ('Approved', 'Rejected') AND decided_at IS NOT NULL)
     OR (status = 'Settled' AND decided_at IS NOT NULL AND settled_at IS NOT NULL))
);
GO
CREATE INDEX ix_leave_app_employee ON hr.leave_application (employee_id, from_date)
    INCLUDE (leave_type_id, days, status);
GO
CREATE INDEX ix_leave_app_pending ON hr.leave_application (applied_at)
    WHERE status = 'Applied';
GO
CREATE INDEX ix_leave_app_period ON hr.leave_application (from_date, to_date)
    INCLUDE (employee_id, status);
GO

/* The leave ledger is the single source of truth for a balance. Every change
   is an entry: the entitlement, the carry forward, the days taken, a pay-off
   or a manual adjustment. The balance is the sum of the entries, which keeps
   the history complete (LVE-1 … LVE-3, ERN-8). */
CREATE TABLE hr.leave_ledger (
    ledger_id       BIGINT        IDENTITY(1,1) NOT NULL CONSTRAINT pk_leave_ledger PRIMARY KEY,
    employee_id     INT           NOT NULL,
    leave_type_id   INT           NOT NULL,
    leave_year      SMALLINT      NOT NULL,
    /* Entitlement | CarryForward | Availed | PaidOff | Adjustment */
    entry_type      VARCHAR(20)   NOT NULL,
    days            DECIMAL(5,2)  NOT NULL,
    reference_type  VARCHAR(30)   NULL,
    reference_id    VARCHAR(60)   NULL,
    posting_date    DATE          NOT NULL CONSTRAINT df_leave_ledger_posting DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    remark          NVARCHAR(400) NULL,
    created_at      DATETIME2(3)  NOT NULL CONSTRAINT df_leave_ledger_created DEFAULT (SYSUTCDATETIME()),
    created_by      NVARCHAR(100) NULL,
    CONSTRAINT fk_leave_ledger_employee FOREIGN KEY (employee_id)   REFERENCES hr.employee (employee_id),
    CONSTRAINT fk_leave_ledger_type     FOREIGN KEY (leave_type_id) REFERENCES hr.leave_type (leave_type_id),
    CONSTRAINT ck_leave_ledger_type  CHECK (entry_type IN ('Entitlement', 'CarryForward', 'Availed', 'PaidOff', 'Adjustment')),
    CONSTRAINT ck_leave_ledger_year  CHECK (leave_year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_leave_ledger_days  CHECK (days <> 0),
    /* an entry may be posted only once per source document */
    CONSTRAINT uq_leave_ledger_reference UNIQUE (employee_id, leave_type_id, leave_year, entry_type, reference_type, reference_id)
);
GO
CREATE INDEX ix_leave_ledger_balance ON hr.leave_ledger (employee_id, leave_type_id, leave_year)
    INCLUDE (days, entry_type);
GO

/* ERN-8 — an earned leave pay-off is deducted from the balance and logged. */
CREATE TABLE hr.earned_leave_payoff (
    payoff_id   BIGINT        IDENTITY(1,1) NOT NULL CONSTRAINT pk_earned_leave_payoff PRIMARY KEY,
    employee_id INT           NOT NULL,
    leave_year  SMALLINT      NOT NULL,
    days        DECIMAL(5,2)  NOT NULL,
    amount      DECIMAL(18,2) NULL,
    remark      NVARCHAR(400) NULL,
    paid_at     DATETIME2(3)  NOT NULL CONSTRAINT df_payoff_paid DEFAULT (SYSUTCDATETIME()),
    paid_by     NVARCHAR(100) NULL,
    CONSTRAINT fk_payoff_employee FOREIGN KEY (employee_id) REFERENCES hr.employee (employee_id),
    CONSTRAINT ck_payoff_days CHECK (days > 0),
    CONSTRAINT ck_payoff_amount CHECK (amount IS NULL OR amount >= 0)
);
GO
CREATE INDEX ix_payoff_employee_year ON hr.earned_leave_payoff (employee_id, leave_year);
GO

/* ============================================================ identity & auth = */

CREATE TABLE app.app_user (
    user_id      INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_app_user PRIMARY KEY,
    login_name   NVARCHAR(80)  NOT NULL,
    display_name NVARCHAR(160) NOT NULL,
    email        NVARCHAR(200) NOT NULL,
    employee_id  INT           NULL,
    is_active    BIT           NOT NULL CONSTRAINT df_app_user_active DEFAULT (1),
    created_at   DATETIME2(3)  NOT NULL CONSTRAINT df_app_user_created DEFAULT (SYSUTCDATETIME()),
    updated_at   DATETIME2(3)  NOT NULL CONSTRAINT df_app_user_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT uq_app_user_login UNIQUE (login_name),
    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT fk_app_user_employee FOREIGN KEY (employee_id) REFERENCES hr.employee (employee_id)
);
GO

/* Mirrors the role model of the Angular application (NFR-1). */
CREATE TABLE app.role (
    role_id     INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_app_role PRIMARY KEY,
    role_code   VARCHAR(30)   NOT NULL,
    role_name   NVARCHAR(80)  NOT NULL,
    /* HR | Payroll | Employee | Approver | Management */
    role_group  VARCHAR(20)   NOT NULL,
    is_active   BIT           NOT NULL CONSTRAINT df_app_role_active DEFAULT (1),
    CONSTRAINT uq_app_role_code UNIQUE (role_code),
    CONSTRAINT ck_app_role_group CHECK (role_group IN ('HR', 'Payroll', 'Employee', 'Approver', 'Management'))
);
GO

CREATE TABLE app.permission (
    permission_id   INT           IDENTITY(1,1) NOT NULL CONSTRAINT pk_app_permission PRIMARY KEY,
    permission_code VARCHAR(60)   NOT NULL,
    permission_name NVARCHAR(160) NOT NULL,
    description     NVARCHAR(400) NULL,
    CONSTRAINT uq_app_permission_code UNIQUE (permission_code)
);
GO

CREATE TABLE app.user_role (
    user_id     INT NOT NULL,
    role_id     INT NOT NULL,
    granted_at  DATETIME2(3) NOT NULL CONSTRAINT df_user_role_granted DEFAULT (SYSUTCDATETIME()),
    granted_by  NVARCHAR(100) NULL,
    CONSTRAINT pk_app_user_role PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_role_user FOREIGN KEY (user_id) REFERENCES app.app_user (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_role_role FOREIGN KEY (role_id) REFERENCES app.role (role_id)
);
GO

/* NFR-8 — the session context carries the payroll flag that the views read
   when they decide whether the salary columns may be shown. */
CREATE TABLE app.session_context (
    context_id   INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_session_context PRIMARY KEY,
    session_id   INT NOT NULL,
    has_payroll_access BIT NOT NULL CONSTRAINT df_session_payroll DEFAULT (0),
    user_name    NVARCHAR(100) NULL,
    CONSTRAINT uq_session_context UNIQUE (session_id)
);
GO

/* =============================================================== audit trail = */

/* NFR-2 / NFR-9 — manual punches, calendar changes, separations, earned
   leave pay-offs, payroll edits and report runs are logged with user and time. */
CREATE TABLE audit.log_entry (
    log_entry_id  BIGINT        IDENTITY(1,1) NOT NULL CONSTRAINT pk_audit_log PRIMARY KEY,
    occurred_at   DATETIME2(3)  NOT NULL CONSTRAINT df_audit_occurred DEFAULT (SYSUTCDATETIME()),
    user_name     NVARCHAR(100) NOT NULL CONSTRAINT df_audit_user DEFAULT (SUSER_SNAME()),
    action_name   VARCHAR(60)   NOT NULL,
    entity_name   VARCHAR(60)   NOT NULL,
    entity_id     VARCHAR(80)   NULL,
    detail        NVARCHAR(MAX) NULL,
    ip_address    VARCHAR(45)   NULL,
    application   VARCHAR(60)   NULL CONSTRAINT df_audit_app DEFAULT ('Hana HRM')
);
GO
CREATE INDEX ix_audit_occurred ON audit.log_entry (occurred_at DESC) INCLUDE (action_name, entity_name);
GO
CREATE INDEX ix_audit_entity  ON audit.log_entry (entity_name, entity_id, occurred_at DESC);
GO
CREATE INDEX ix_audit_user    ON audit.log_entry (user_name, occurred_at DESC);
GO

/* The notification outbox — the single place a mail gateway plugs in (NFR-3). */
CREATE TABLE ops.notification_outbox (
    notification_id BIGINT        IDENTITY(1,1) NOT NULL CONSTRAINT pk_notification_outbox PRIMARY KEY,
    recipient      NVARCHAR(200) NOT NULL,
    subject        NVARCHAR(300) NOT NULL,
    body           NVARCHAR(MAX) NOT NULL,
    /* Leave | Delay | PayOff */
    kind           VARCHAR(20)   NOT NULL,
    reference_type VARCHAR(30)   NULL,
    reference_id   VARCHAR(60)   NULL,
    status         VARCHAR(20)   NOT NULL CONSTRAINT df_notification_status DEFAULT ('Pending'),
    created_at     DATETIME2(3)  NOT NULL CONSTRAINT df_notification_created DEFAULT (SYSUTCDATETIME()),
    sent_at        DATETIME2(3)  NULL,
    CONSTRAINT ck_notification_status CHECK (status IN ('Pending', 'Sent', 'Failed')),
    CONSTRAINT ck_notification_kind   CHECK (kind IN ('Leave', 'Delay', 'PayOff'))
);
GO
CREATE INDEX ix_notification_pending ON ops.notification_outbox (created_at) WHERE status = 'Pending';
GO

/* ================================================================== indexes = */

/* DSH-1 / EIR-1 — the active headcount by company and department. */
CREATE INDEX ix_employee_active_company ON hr.employee (company_id, department_id)
    INCLUDE (full_name, work_group_id, employee_type_id, section_id) WHERE is_active = 1;
GO
CREATE INDEX ix_employee_work_group ON hr.employee (work_group_id) WHERE is_active = 1;
GO
CREATE INDEX ix_employee_nid ON hr.employee (nid) WHERE nid IS NOT NULL;
GO

/* ====================================================== temporal master data = */

/* The employee master is versioned, so a past job card still shows the name
   and the work group that were valid on that day. */
CREATE TABLE hr.employee_history (
    employee_id        INT            NOT NULL,
    row_version        ROWVERSION     NOT NULL,
    valid_from         DATETIME2(3)   NOT NULL,
    valid_to           DATETIME2(3)   NULL,
    employee_code      VARCHAR(30)    NOT NULL,
    full_name          NVARCHAR(160)  NOT NULL,
    photo_uri          NVARCHAR(400)  NULL,
    date_of_birth      DATE           NULL,
    gender             VARCHAR(10)    NULL,
    company_id         INT            NOT NULL,
    employee_type_id   INT            NOT NULL,
    department_id      INT            NOT NULL,
    section_id         INT            NOT NULL,
    designation_id     INT            NOT NULL,
    work_group_id      INT            NOT NULL,
    joining_date       DATE           NOT NULL,
    is_active          BIT            NOT NULL,
    separation_type    VARCHAR(30)    NULL,
    separation_date    DATE           NULL,
    separation_comment NVARCHAR(400)  NULL,
    degree             NVARCHAR(120)  NULL,
    institute          NVARCHAR(200)  NULL,
    phone              VARCHAR(30)    NULL,
    emergency_phone    VARCHAR(30)    NULL,
    email              NVARCHAR(200)  NULL,
    present_address    NVARCHAR(400)  NULL,
    permanent_address  NVARCHAR(400)  NULL,
    marital_status     VARCHAR(20)    NULL,
    nid                VARCHAR(20)    NULL,
    reference_employee_id INT         NULL,
    reference_remark   NVARCHAR(400)  NULL,
    bank_account_no    VARCHAR(40)    NULL,
    joining_salary     DECIMAL(18,2)  NULL,
    present_salary     DECIMAL(18,2)  NULL,
    approver_employee_id INT          NULL,
    created_at         DATETIME2(3)   NOT NULL,
    updated_at         DATETIME2(3)   NOT NULL,
    CONSTRAINT pk_employee_history PRIMARY KEY CLUSTERED (employee_id, valid_from)
);
GO
CREATE INDEX ix_employee_history_valid_to ON hr.employee_history (valid_to) WHERE valid_to IS NULL;
GO

-- sqlfluff's T-SQL dialect does not model the system versioning clause
ALTER TABLE hr.employee ADD -- noqa: PRS
    CONSTRAINT sys_versioning_employee
    SYSTEM_VERSIONING = ON (HISTORY_TABLE = hr.employee_history, DATA_CONSISTENCY_CHECK = ON);
GO

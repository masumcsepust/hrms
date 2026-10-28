import { Injectable, computed, signal } from '@angular/core';
import {
  AuditEntry,
  CalendarDay,
  Company,
  Db,
  Department,
  Designation,
  DutyRoster,
  ElPayoff,
  Employee,
  EmployeeType,
  ID,
  LeaveApplication,
  LeaveType,
  Punch,
  Section,
  ShiftPolicy,
  User,
  WorkGroup,
} from './models';
import { buildSeed, uid } from './seed';

const STORAGE_KEY = 'hrms-db-v3';

/** A live, typed collection bound to the store signal. */
export class Coll<T extends { id: ID }> {
  constructor(
    private readonly read: () => T[],
    private readonly write: (v: T[]) => void,
  ) {}

  all = computed(() => this.read());
  count = computed(() => this.read().length);

  byId(id: ID | null | undefined): T | undefined {
    if (!id) return undefined;
    return this.read().find((x) => x.id === id);
  }

  where(pred: (x: T) => boolean): T[] {
    return this.read().filter(pred);
  }

  upsert(item: T): T {
    const arr = this.read();
    const i = arr.findIndex((x) => x.id === item.id);
    const next = i >= 0 ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item];
    this.write(next);
    return item;
  }

  patch(id: ID, changes: Partial<T>): T | undefined {
    const cur = this.byId(id);
    if (!cur) return undefined;
    return this.upsert({ ...cur, ...changes });
  }

  remove(id: ID): void {
    this.write(this.read().filter((x) => x.id !== id));
  }
}

@Injectable({ providedIn: 'root' })
export class Store {
  private readonly state = signal<Db>(this.load());
  readonly db = this.state.asReadonly();

  readonly companies = new Coll<Company>(() => this.state().companies, (v) => this.set('companies', v));
  readonly employeeTypes = new Coll<EmployeeType>(() => this.state().employeeTypes, (v) => this.set('employeeTypes', v));
  readonly departments = new Coll<Department>(() => this.state().departments, (v) => this.set('departments', v));
  readonly sections = new Coll<Section>(() => this.state().sections, (v) => this.set('sections', v));
  readonly designations = new Coll<Designation>(() => this.state().designations, (v) => this.set('designations', v));
  readonly workGroups = new Coll<WorkGroup>(() => this.state().workGroups, (v) => this.set('workGroups', v));
  readonly leaveTypes = new Coll<LeaveType>(() => this.state().leaveTypes, (v) => this.set('leaveTypes', v));
  readonly shiftPolicies = new Coll<ShiftPolicy>(() => this.state().shiftPolicies, (v) => this.set('shiftPolicies', v));
  readonly dutyRosters = new Coll<DutyRoster>(() => this.state().dutyRosters, (v) => this.set('dutyRosters', v));
  readonly calendar = new Coll<CalendarDay>(() => this.state().calendar, (v) => this.set('calendar', v));
  readonly employees = new Coll<Employee>(() => this.state().employees, (v) => this.set('employees', v));
  readonly punches = new Coll<Punch>(() => this.state().punches, (v) => this.set('punches', v));
  readonly leaveApplications = new Coll<LeaveApplication>(() => this.state().leaveApplications, (v) => this.set('leaveApplications', v));
  readonly elPayoffs = new Coll<ElPayoff>(() => this.state().elPayoffs, (v) => this.set('elPayoffs', v));
  readonly users = new Coll<User>(() => this.state().users, (v) => this.set('users', v));
  readonly audit = new Coll<AuditEntry>(() => this.state().audit, (v) => this.set('audit', v));

  get currentUserId(): ID {
    return this.state().currentUserId;
  }

  readonly employeesById = computed(() => {
    const map = new Map<string, Employee>();
    for (const e of this.state().employees) map.set(e.id, e);
    return map;
  });

  readonly activeEmployees = computed(() =>
    this.state().employees.filter((e) => e.active),
  );

  readonly separatedEmployees = computed(() =>
    this.state().employees.filter((e) => !!e.separation),
  );

  readonly currentUser = computed(() => {
    const db = this.state();
    return db.users.find((u) => u.id === db.currentUserId) ?? db.users[0];
  });

  private set<K extends keyof Db>(key: K, value: Db[K]): void {
    this.state.update((db) => ({ ...db, [key]: value }));
    this.persist();
  }

  private load(): Db {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Db;
        if (parsed && parsed.employees?.length) return parsed;
      }
    } catch {
      /* fall through to a fresh seed */
    }
    return buildSeed();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      /* quota — the app keeps working from memory */
    }
  }

  /** Restore the demo dataset. */
  reset(): void {
    const fresh = buildSeed();
    this.state.set(fresh);
    this.persist();
  }

  setCurrentUser(id: ID): void {
    this.set('currentUserId', id);
  }

  /** NFR-2 / NFR-9: audit trail with user and time. */
  log(action: string, entity: string, entityId: string, detail: string): void {
    const user = this.currentUser()?.name ?? 'system';
    const entry: AuditEntry = {
      id: uid('au'),
      at: new Date().toISOString(),
      user,
      action,
      entity,
      entityId,
      detail,
    };
    this.set('audit', [entry, ...this.state().audit].slice(0, 500));
  }
}

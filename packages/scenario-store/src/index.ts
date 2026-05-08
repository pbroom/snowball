import type {
  AuditEvent,
  EntityRef,
  EntityType,
  Relationship,
  RelationshipRelation,
  Scenario,
  Task,
  ValidationIssue
} from "@snowball/task-core";

const STORAGE_KEY = "snowball.task-workbench.scenarios";
const NOW = "2026-01-01T12:00:00.000Z";

export const seedScenario: Scenario = {
  id: "task-primitive-lab",
  name: "Task Primitive Lab",
  description:
    "A clean starter world for modeling task shells, org membership, relationship-driven permissions, restricted resources, and audit history.",
  policyVersion: "local-task-primitive-v0.1",
  users: [
    { id: "user-avery", displayName: "Avery Stone", title: "Platform Analyst", primaryOrgId: "org-platform" },
    { id: "user-blake", displayName: "Blake Chen", title: "Operations Reviewer", primaryOrgId: "org-operations" },
    { id: "user-casey", displayName: "Casey Rivera", title: "Records Officer", primaryOrgId: "org-records" },
    { id: "user-morgan", displayName: "Morgan Lee", title: "Executive Sponsor", primaryOrgId: "org-executive" }
  ],
  orgs: [
    { id: "org-root", name: "Snowball Prototype", abbreviation: "ROOT" },
    { id: "org-platform", name: "Platform Team", abbreviation: "PLAT", parentOrgId: "org-root" },
    { id: "org-operations", name: "Operations Team", abbreviation: "OPS", parentOrgId: "org-root" },
    { id: "org-records", name: "Records Management", abbreviation: "REC", parentOrgId: "org-root" },
    { id: "org-executive", name: "Executive Office", abbreviation: "EXEC", parentOrgId: "org-root" }
  ],
  groups: [
    {
      id: "group-records-stewards",
      name: "Records Stewards",
      description: "Users allowed to inspect restricted records and ATO evidence resources."
    }
  ],
  tasks: [
    createSeedTask({
      id: "task-platform-shell",
      type: "workspace",
      title: "Define the task primitive shell",
      owningOrgId: "org-platform",
      createdByUserId: "user-avery",
      status: "in_progress"
    }),
    createSeedTask({
      id: "task-rebac-policy",
      type: "policy_experiment",
      title: "Model relationship-based access rules",
      parentTaskId: "task-platform-shell",
      owningOrgId: "org-platform",
      createdByUserId: "user-avery",
      status: "open"
    }),
    createSeedTask({
      id: "task-ops-review",
      type: "review",
      title: "Operations review of the task shell",
      parentTaskId: "task-platform-shell",
      owningOrgId: "org-platform",
      createdByUserId: "user-blake",
      status: "open"
    }),
    createSeedTask({
      id: "task-records-audit",
      type: "audit_readiness",
      title: "Map audit and records obligations",
      parentTaskId: "task-platform-shell",
      owningOrgId: "org-records",
      createdByUserId: "user-casey",
      status: "blocked"
    })
  ],
  resources: [
    {
      id: "resource-shell-brief",
      taskId: "task-platform-shell",
      kind: "note",
      title: "Primitive design brief",
      createdByUserId: "user-avery",
      createdAt: NOW,
      payload: {
        summary: "Tasks are abstract shells; resources and relationships carry workflow details."
      }
    },
    {
      id: "resource-ato-evidence",
      taskId: "task-records-audit",
      kind: "attachment",
      title: "ATO evidence checklist",
      createdByUserId: "user-casey",
      createdAt: NOW,
      payload: {
        classification: "restricted prototype data"
      }
    }
  ],
  relationships: [
    relationship("rel-avery-platform", "user", "user-avery", "member_of", "org", "org-platform"),
    relationship("rel-blake-operations", "user", "user-blake", "member_of", "org", "org-operations"),
    relationship("rel-casey-records", "user", "user-casey", "member_of", "org", "org-records"),
    relationship("rel-morgan-exec", "user", "user-morgan", "member_of", "org", "org-executive"),
    relationship("rel-casey-records-stewards", "user", "user-casey", "member_of", "group", "group-records-stewards"),
    relationship("rel-platform-root", "org", "org-platform", "child_of", "org", "org-root"),
    relationship("rel-ops-root", "org", "org-operations", "child_of", "org", "org-root"),
    relationship("rel-records-root", "org", "org-records", "child_of", "org", "org-root"),
    relationship("rel-exec-root", "org", "org-executive", "child_of", "org", "org-root"),
    relationship("rel-shell-owned-platform", "task", "task-platform-shell", "owned_by", "org", "org-platform"),
    relationship("rel-shell-viewer-exec", "task", "task-platform-shell", "viewer", "org", "org-executive"),
    relationship("rel-policy-parent-shell", "task", "task-rebac-policy", "parent", "task", "task-platform-shell"),
    relationship(
      "rel-policy-inherits-shell",
      "task",
      "task-rebac-policy",
      "inherits_access_from",
      "task",
      "task-platform-shell"
    ),
    relationship("rel-ops-parent-shell", "task", "task-ops-review", "parent", "task", "task-platform-shell"),
    relationship("rel-ops-assigned", "task", "task-ops-review", "assigned_to", "org", "org-operations"),
    relationship("rel-audit-parent-shell", "task", "task-records-audit", "parent", "task", "task-platform-shell"),
    relationship("rel-audit-owned-records", "task", "task-records-audit", "owned_by", "org", "org-records"),
    relationship("rel-audit-resource-restricted", "resource", "resource-ato-evidence", "restricted_to", "group", "group-records-stewards")
  ],
  auditEvents: [
    auditEvent({
      id: "audit-seed-created",
      action: "scenario.created",
      target: { type: "task", id: "task-platform-shell" },
      summary: "Seed scenario created for task primitive milestone work."
    }),
    auditEvent({
      id: "audit-resource-restricted",
      action: "relationship.created",
      actorUserId: "user-casey",
      effectiveUserId: "user-casey",
      target: { type: "resource", id: "resource-ato-evidence" },
      summary: "ATO evidence checklist restricted to records stewards.",
      metadata: { relationshipId: "rel-audit-resource-restricted" }
    })
  ]
};

export function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

export function createEmptyScenario(): Scenario {
  return {
    id: `scenario-${crypto.randomUUID()}`,
    name: "Untitled Task Scenario",
    description: "A blank task primitive modeling scenario.",
    policyVersion: "local-task-primitive-v0.1",
    users: [],
    orgs: [],
    groups: [],
    tasks: [],
    resources: [],
    relationships: [],
    auditEvents: []
  };
}

export function loadScenarios(): Scenario[] {
  if (typeof localStorage === "undefined") {
    return [cloneScenario(seedScenario)];
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [cloneScenario(seedScenario)];
  }

  try {
    const parsed = JSON.parse(stored) as Scenario[];
    return parsed.length > 0 ? parsed : [cloneScenario(seedScenario)];
  } catch {
    return [cloneScenario(seedScenario)];
  }
}

export function saveScenarios(scenarios: Scenario[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios, null, 2));
}

export function exportScenario(scenario: Scenario): string {
  return JSON.stringify(scenario, null, 2);
}

export function importScenario(raw: string): Scenario {
  const parsed = JSON.parse(raw) as Scenario;
  const issues = validateScenario(parsed).filter((issue) => issue.level === "error");
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("\n"));
  }

  return parsed;
}

export function validateScenario(scenario: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const idsByType = new Map<EntityType, Set<string>>([
    ["user", new Set(scenario.users.map((user) => user.id))],
    ["org", new Set(scenario.orgs.map((org) => org.id))],
    ["group", new Set(scenario.groups.map((group) => group.id))],
    ["task", new Set(scenario.tasks.map((task) => task.id))],
    ["resource", new Set(scenario.resources.map((resource) => resource.id))]
  ]);

  for (const relationshipItem of scenario.relationships) {
    if (!idsByType.get(relationshipItem.subjectType)?.has(relationshipItem.subjectId)) {
      issues.push({
        level: "error",
        message: `Relationship ${relationshipItem.id} references missing ${relationshipItem.subjectType} subject ${relationshipItem.subjectId}.`,
        relationshipId: relationshipItem.id
      });
    }

    if (!idsByType.get(relationshipItem.objectType)?.has(relationshipItem.objectId)) {
      issues.push({
        level: "error",
        message: `Relationship ${relationshipItem.id} references missing ${relationshipItem.objectType} object ${relationshipItem.objectId}.`,
        relationshipId: relationshipItem.id
      });
    }
  }

  for (const task of scenario.tasks) {
    if (!idsByType.get("org")?.has(task.owningOrgId)) {
      issues.push({ level: "error", message: `Task ${task.id} references missing owning org ${task.owningOrgId}.` });
    }

    if (!idsByType.get("user")?.has(task.createdByUserId)) {
      issues.push({ level: "error", message: `Task ${task.id} references missing creator ${task.createdByUserId}.` });
    }

    if (task.parentTaskId && !idsByType.get("task")?.has(task.parentTaskId)) {
      issues.push({ level: "error", message: `Task ${task.id} references missing parent task ${task.parentTaskId}.` });
    }
  }

  for (const resource of scenario.resources) {
    if (!idsByType.get("task")?.has(resource.taskId)) {
      issues.push({ level: "error", message: `Resource ${resource.id} references missing task ${resource.taskId}.` });
    }

    if (!idsByType.get("user")?.has(resource.createdByUserId)) {
      issues.push({ level: "error", message: `Resource ${resource.id} references missing creator ${resource.createdByUserId}.` });
    }
  }

  issues.push(...validateOrgTree(scenario));
  return issues;
}

export function buildAuditEvent(input: {
  action: AuditEvent["action"];
  actorUserId?: string;
  effectiveUserId?: string;
  target: EntityRef;
  summary: string;
  metadata?: Record<string, unknown>;
}): AuditEvent {
  return auditEvent({
    id: `audit-${crypto.randomUUID()}`,
    action: input.action,
    actorUserId: input.actorUserId,
    effectiveUserId: input.effectiveUserId,
    target: input.target,
    summary: input.summary,
    metadata: input.metadata,
    occurredAt: new Date().toISOString()
  });
}

function createSeedTask(task: Omit<Task, "createdAt" | "updatedAt">): Task {
  return {
    ...task,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function relationship(
  id: string,
  subjectType: EntityType,
  subjectId: string,
  relation: RelationshipRelation,
  objectType: EntityType,
  objectId: string
): Relationship {
  return { id, subjectType, subjectId, relation, objectType, objectId };
}

function auditEvent(input: Omit<AuditEvent, "occurredAt"> & { occurredAt?: string }): AuditEvent {
  return {
    ...input,
    occurredAt: input.occurredAt ?? NOW
  };
}

function validateOrgTree(scenario: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(scenario.orgs.map((org) => [org.id, org]));

  for (const org of scenario.orgs) {
    if (org.parentOrgId && !byId.has(org.parentOrgId)) {
      issues.push({ level: "error", message: `Org ${org.id} references missing parent org ${org.parentOrgId}.` });
    }

    const seen = new Set<string>();
    let cursor = org.parentOrgId;
    while (cursor) {
      if (seen.has(cursor)) {
        issues.push({ level: "error", message: `Org tree contains a cycle at ${org.id}.` });
        break;
      }

      seen.add(cursor);
      cursor = byId.get(cursor)?.parentOrgId;
    }
  }

  return issues;
}

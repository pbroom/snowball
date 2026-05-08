import type { EntityType, Scenario, ValidationIssue } from "@snowball/task-core";

const STORAGE_KEY = "snowball.rebac-workbench.scenarios";

export const seedScenario: Scenario = {
  id: "basic-bureau-clearance",
  name: "Basic Bureau Clearance",
  description:
    "A starter world for testing owning org access, assigned org clearance, parent inheritance, and restricted subresources.",
  policyVersion: "local-v0.1",
  users: [
    { id: "user-peter", name: "Peter Grant", title: "AF Package Drafter" },
    { id: "user-jane", name: "Jane Rivera", title: "EUR Clearance Officer" },
    { id: "user-bob", name: "Bob Chen", title: "S/ES Approver" },
    { id: "user-maya", name: "Maya Thomas", title: "Records Reviewer" },
    { id: "user-asha", name: "Asha Williams", title: "Records Reviewer" }
  ],
  orgs: [
    { id: "org-state", name: "Department of State", abbreviation: "State" },
    { id: "org-af", name: "Bureau of African Affairs", abbreviation: "AF", parentOrgId: "org-state" },
    { id: "org-af-ex", name: "AF Executive Office", abbreviation: "AF/EX", parentOrgId: "org-af" },
    { id: "org-af-fo", name: "AF Front Office", abbreviation: "AF/FO", parentOrgId: "org-af" },
    { id: "org-eur", name: "Bureau of European Affairs", abbreviation: "EUR", parentOrgId: "org-state" },
    { id: "org-eur-ex", name: "EUR Executive Office", abbreviation: "EUR/EX", parentOrgId: "org-eur" },
    { id: "org-ses", name: "Executive Secretariat", abbreviation: "S/ES", parentOrgId: "org-state" },
    { id: "org-records", name: "Records Management", abbreviation: "Records", parentOrgId: "org-state" }
  ],
  groups: [
    { id: "group-front-office", name: "Front Office Staff" },
    { id: "group-records-reviewers", name: "Records Reviewers" }
  ],
  tasks: [
    {
      id: "task-trip",
      title: "Secretary Trip to Brussels",
      taskType: "trip",
      description: "Parent trip task for testing explicit inheritance.",
      owningOrgId: "org-ses",
      createdByUserId: "user-bob",
      status: "in_review"
    },
    {
      id: "task-stop",
      title: "Brussels Stop",
      taskType: "trip_stop",
      description: "Stop task nested under the trip.",
      parentTaskId: "task-trip",
      owningOrgId: "org-ses",
      createdByUserId: "user-bob",
      status: "in_review"
    },
    {
      id: "task-package",
      title: "Trip Memo Package",
      taskType: "package_submission",
      description: "Package owned by AF and assigned to EUR for clearance.",
      parentTaskId: "task-stop",
      owningOrgId: "org-af",
      createdByUserId: "user-peter",
      status: "assigned"
    },
    {
      id: "task-clearance-eur",
      title: "EUR Clearance",
      taskType: "clearance",
      description: "Child task assigned to EUR.",
      parentTaskId: "task-package",
      owningOrgId: "org-af",
      createdByUserId: "user-peter",
      status: "assigned"
    },
    {
      id: "task-approval-ses",
      title: "S/ES Approval",
      taskType: "approval",
      description: "Approval task restricted to S/ES approvers.",
      parentTaskId: "task-package",
      owningOrgId: "org-ses",
      createdByUserId: "user-bob",
      status: "draft"
    },
    {
      id: "task-records",
      title: "Records Review",
      taskType: "records_review",
      description: "Records review with group-based access.",
      parentTaskId: "task-package",
      owningOrgId: "org-records",
      createdByUserId: "user-maya",
      status: "draft"
    }
  ],
  relationships: [
    { id: "rel-peter-af-ex", subjectType: "user", subjectId: "user-peter", relation: "member_of", objectType: "org", objectId: "org-af-ex" },
    { id: "rel-jane-eur-ex", subjectType: "user", subjectId: "user-jane", relation: "member_of", objectType: "org", objectId: "org-eur-ex" },
    { id: "rel-bob-ses", subjectType: "user", subjectId: "user-bob", relation: "member_of", objectType: "org", objectId: "org-ses" },
    { id: "rel-maya-records", subjectType: "user", subjectId: "user-maya", relation: "member_of", objectType: "org", objectId: "org-records" },
    { id: "rel-asha-records", subjectType: "user", subjectId: "user-asha", relation: "member_of", objectType: "org", objectId: "org-records" },
    { id: "rel-bob-front-office", subjectType: "user", subjectId: "user-bob", relation: "member_of", objectType: "group", objectId: "group-front-office" },
    { id: "rel-maya-records-group", subjectType: "user", subjectId: "user-maya", relation: "member_of", objectType: "group", objectId: "group-records-reviewers" },
    { id: "rel-asha-records-group", subjectType: "user", subjectId: "user-asha", relation: "member_of", objectType: "group", objectId: "group-records-reviewers" },
    { id: "rel-af-ex-af", subjectType: "org", subjectId: "org-af-ex", relation: "child_of", objectType: "org", objectId: "org-af" },
    { id: "rel-af-fo-af", subjectType: "org", subjectId: "org-af-fo", relation: "child_of", objectType: "org", objectId: "org-af" },
    { id: "rel-af-state", subjectType: "org", subjectId: "org-af", relation: "child_of", objectType: "org", objectId: "org-state" },
    { id: "rel-eur-ex-eur", subjectType: "org", subjectId: "org-eur-ex", relation: "child_of", objectType: "org", objectId: "org-eur" },
    { id: "rel-eur-state", subjectType: "org", subjectId: "org-eur", relation: "child_of", objectType: "org", objectId: "org-state" },
    { id: "rel-ses-state", subjectType: "org", subjectId: "org-ses", relation: "child_of", objectType: "org", objectId: "org-state" },
    { id: "rel-records-state", subjectType: "org", subjectId: "org-records", relation: "child_of", objectType: "org", objectId: "org-state" },
    { id: "rel-trip-owned-ses", subjectType: "task", subjectId: "task-trip", relation: "owned_by", objectType: "org", objectId: "org-ses" },
    { id: "rel-stop-parent-trip", subjectType: "task", subjectId: "task-stop", relation: "parent", objectType: "task", objectId: "task-trip" },
    { id: "rel-stop-inherits-trip", subjectType: "task", subjectId: "task-stop", relation: "inherits_access_from", objectType: "task", objectId: "task-trip" },
    { id: "rel-package-parent-stop", subjectType: "task", subjectId: "task-package", relation: "parent", objectType: "task", objectId: "task-stop" },
    { id: "rel-package-owned-af", subjectType: "task", subjectId: "task-package", relation: "owned_by", objectType: "org", objectId: "org-af" },
    { id: "rel-package-assigned-eur", subjectType: "task", subjectId: "task-package", relation: "assigned_to", objectType: "org", objectId: "org-eur" },
    { id: "rel-package-editor-peter", subjectType: "task", subjectId: "task-package", relation: "editor", objectType: "user", objectId: "user-peter" },
    { id: "rel-clearance-parent-package", subjectType: "task", subjectId: "task-clearance-eur", relation: "parent", objectType: "task", objectId: "task-package" },
    { id: "rel-clearance-owned-af", subjectType: "task", subjectId: "task-clearance-eur", relation: "owned_by", objectType: "org", objectId: "org-af" },
    { id: "rel-clearance-assigned-eur", subjectType: "task", subjectId: "task-clearance-eur", relation: "assigned_to", objectType: "org", objectId: "org-eur" },
    { id: "rel-approval-parent-package", subjectType: "task", subjectId: "task-approval-ses", relation: "parent", objectType: "task", objectId: "task-package" },
    { id: "rel-approval-owned-ses", subjectType: "task", subjectId: "task-approval-ses", relation: "owned_by", objectType: "org", objectId: "org-ses" },
    { id: "rel-approval-approver-bob", subjectType: "task", subjectId: "task-approval-ses", relation: "approver", objectType: "user", objectId: "user-bob" },
    { id: "rel-records-parent-package", subjectType: "task", subjectId: "task-records", relation: "parent", objectType: "task", objectId: "task-package" },
    { id: "rel-records-owned-records", subjectType: "task", subjectId: "task-records", relation: "owned_by", objectType: "org", objectId: "org-records" },
    { id: "rel-records-viewer-group", subjectType: "task", subjectId: "task-records", relation: "viewer", objectType: "group", objectId: "group-records-reviewers" }
  ]
};

export function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

export function createEmptyScenario(): Scenario {
  return {
    id: `scenario-${crypto.randomUUID()}`,
    name: "Untitled Scenario",
    description: "A blank ReBAC modeling scenario.",
    policyVersion: "local-v0.1",
    users: [],
    orgs: [],
    groups: [],
    tasks: [],
    relationships: []
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
    throw new Error(issues.map((issue) => issue.message).join("\\n"));
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
    ["artifact", new Set()],
    ["note", new Set()]
  ]);

  for (const relationship of scenario.relationships) {
    if (!idsByType.get(relationship.subjectType)?.has(relationship.subjectId)) {
      issues.push({
        level: "error",
        message: `Relationship ${relationship.id} references missing ${relationship.subjectType} subject ${relationship.subjectId}.`,
        relationshipId: relationship.id
      });
    }

    if (!idsByType.get(relationship.objectType)?.has(relationship.objectId)) {
      issues.push({
        level: "error",
        message: `Relationship ${relationship.id} references missing ${relationship.objectType} object ${relationship.objectId}.`,
        relationshipId: relationship.id
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

  issues.push(...validateOrgTree(scenario));
  return issues;
}

function validateOrgTree(scenario: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(scenario.orgs.map((org) => [org.id, org]));

  for (const org of scenario.orgs) {
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

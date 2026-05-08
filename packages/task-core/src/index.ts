export type EntityType = "user" | "org" | "group" | "task" | "artifact" | "note";

export type TaskPermission =
  | "task.view"
  | "task.edit"
  | "task.comment"
  | "task.assign"
  | "task.clear"
  | "task.approve"
  | "task.manageAccess";

export const TASK_PERMISSIONS: readonly TaskPermission[] = [
  "task.view",
  "task.edit",
  "task.comment",
  "task.assign",
  "task.clear",
  "task.approve",
  "task.manageAccess"
] as const;

export type TaskStatus = "draft" | "assigned" | "in_review" | "blocked" | "complete";

export type TaskType =
  | "package_submission"
  | "clearance"
  | "approval"
  | "trip"
  | "trip_stop"
  | "event"
  | "records_review";

export interface EntityRef {
  type: EntityType;
  id: string;
}

export interface User {
  id: string;
  name: string;
  title?: string;
}

export interface Org {
  id: string;
  name: string;
  abbreviation?: string;
  parentOrgId?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export interface Task {
  id: string;
  title: string;
  taskType: TaskType;
  description?: string;
  parentTaskId?: string;
  owningOrgId: string;
  createdByUserId: string;
  status: TaskStatus;
}

export type RelationshipRelation =
  | "member_of"
  | "child_of"
  | "owned_by"
  | "assigned_to"
  | "created_by"
  | "participant"
  | "viewer"
  | "editor"
  | "approver"
  | "parent"
  | "inherits_access_from"
  | "restricted_to";

export interface Relationship {
  id: string;
  subjectType: EntityType;
  subjectId: string;
  relation: RelationshipRelation;
  objectType: EntityType;
  objectId: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  policyVersion: string;
  users: User[];
  orgs: Org[];
  groups: Group[];
  tasks: Task[];
  relationships: Relationship[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  relationshipId?: string;
}

export function getEntityLabel(scenario: Scenario, ref: EntityRef): string {
  switch (ref.type) {
    case "user":
      return scenario.users.find((user) => user.id === ref.id)?.name ?? ref.id;
    case "org": {
      const org = scenario.orgs.find((item) => item.id === ref.id);
      return org?.abbreviation ?? org?.name ?? ref.id;
    }
    case "group":
      return scenario.groups.find((group) => group.id === ref.id)?.name ?? ref.id;
    case "task":
      return scenario.tasks.find((task) => task.id === ref.id)?.title ?? ref.id;
    case "artifact":
      return ref.id;
    case "note":
      return ref.id;
    default: {
      const _exhaustive: never = ref.type;
      return _exhaustive;
    }
  }
}

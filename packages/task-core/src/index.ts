export type EntityType = "user" | "org" | "group" | "task" | "resource";

export type TaskPermission =
  | "task.view"
  | "task.edit"
  | "task.comment"
  | "task.assign"
  | "task.complete"
  | "task.manageAccess";

export type ResourcePermission = "resource.view" | "resource.edit" | "resource.manageAccess";

export type Permission = TaskPermission | ResourcePermission;

export const TASK_PERMISSIONS: readonly TaskPermission[] = [
  "task.view",
  "task.edit",
  "task.comment",
  "task.assign",
  "task.complete",
  "task.manageAccess"
] as const;

export const RESOURCE_PERMISSIONS: readonly ResourcePermission[] = [
  "resource.view",
  "resource.edit",
  "resource.manageAccess"
] as const;

export const PERMISSIONS: readonly Permission[] = [...TASK_PERMISSIONS, ...RESOURCE_PERMISSIONS] as const;

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";

export type ResourceKind = "attachment" | "comment" | "note" | "field_set";

export interface EntityRef {
  type: EntityType;
  id: string;
}

export interface User {
  id: string;
  displayName: string;
  title?: string;
  primaryOrgId?: string;
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
  type: string;
  title: string;
  parentTaskId?: string;
  owningOrgId: string;
  createdByUserId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskResource {
  id: string;
  taskId: string;
  kind: ResourceKind;
  title: string;
  createdByUserId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
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
  | "manager"
  | "parent"
  | "inherits_access_from"
  | "contains"
  | "restricted_to";

export interface Relationship {
  id: string;
  subjectType: EntityType;
  subjectId: string;
  relation: RelationshipRelation;
  objectType: EntityType;
  objectId: string;
}

export type AuditAction =
  | "scenario.created"
  | "identity.created"
  | "identity.updated"
  | "identity.deleted"
  | "org.created"
  | "org.updated"
  | "org.deleted"
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "resource.created"
  | "relationship.created"
  | "relationship.deleted"
  | "authz.checked"
  | "user.switched";

export interface AuditDecisionSnapshot {
  allowed: boolean;
  permission: Permission;
  policyVersion: string;
  reason: string;
  path: string[];
}

export interface AuditEvent {
  id: string;
  action: AuditAction;
  actorUserId?: string;
  effectiveUserId?: string;
  target: EntityRef;
  occurredAt: string;
  summary: string;
  decision?: AuditDecisionSnapshot;
  metadata?: Record<string, unknown>;
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
  resources: TaskResource[];
  relationships: Relationship[];
  auditEvents: AuditEvent[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  relationshipId?: string;
}

export function isTaskPermission(permission: Permission): permission is TaskPermission {
  return permission.startsWith("task.");
}

export function isResourcePermission(permission: Permission): permission is ResourcePermission {
  return permission.startsWith("resource.");
}

export function getEntityLabel(scenario: Scenario, ref: EntityRef): string {
  switch (ref.type) {
    case "user":
      return scenario.users.find((user) => user.id === ref.id)?.displayName ?? ref.id;
    case "org": {
      const org = scenario.orgs.find((item) => item.id === ref.id);
      return org?.abbreviation ?? org?.name ?? ref.id;
    }
    case "group":
      return scenario.groups.find((group) => group.id === ref.id)?.name ?? ref.id;
    case "task":
      return scenario.tasks.find((task) => task.id === ref.id)?.title ?? ref.id;
    case "resource":
      return scenario.resources.find((resource) => resource.id === ref.id)?.title ?? ref.id;
    default: {
      const _exhaustive: never = ref.type;
      return _exhaustive;
    }
  }
}

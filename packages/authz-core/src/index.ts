import {
  PERMISSIONS,
  RESOURCE_PERMISSIONS,
  TASK_PERMISSIONS,
  getEntityLabel,
  isResourcePermission,
  isTaskPermission,
  type EntityRef,
  type Permission,
  type Relationship,
  type RelationshipRelation,
  type ResourcePermission,
  type Scenario,
  type Task,
  type TaskPermission,
  type TaskResource
} from "@snowball/task-core";

export type ResourceType = "task" | "resource";

export interface AuthzCheckInput {
  scenario: Scenario;
  userId: string;
  permission: Permission;
  resourceType: ResourceType;
  resourceId: string;
}

export interface ListPermissionsInput {
  scenario: Scenario;
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
}

export interface VisibleTasksInput {
  scenario: Scenario;
  userId: string;
}

export interface VisibleResourcesInput {
  scenario: Scenario;
  userId: string;
  taskId: string;
}

export interface AuthzPathStep {
  from: EntityRef;
  relation: RelationshipRelation | "created_by_field" | "resource_task";
  to: EntityRef;
  relationshipId?: string;
}

export interface AuthzResult {
  allowed: boolean;
  permission: Permission;
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  reason: string;
  ruleId?: string;
  path: AuthzPathStep[];
}

export interface AuthorizationService {
  check(input: AuthzCheckInput): AuthzResult;
  explain(input: AuthzCheckInput): AuthzResult;
  listPermissions(input: ListPermissionsInput): Permission[];
  listVisibleTasks(input: VisibleTasksInput): Task[];
  listVisibleResources(input: VisibleResourcesInput): TaskResource[];
}

interface RuleMatch {
  ruleId: string;
  reason: string;
  path: AuthzPathStep[];
}

interface RestrictionMatch {
  allowed: boolean;
  reason: string;
  path: AuthzPathStep[];
}

export class LocalAuthorizationService implements AuthorizationService {
  check(input: AuthzCheckInput): AuthzResult {
    return this.explain(input);
  }

  explain(input: AuthzCheckInput): AuthzResult {
    if (input.resourceType === "task") {
      if (!isTaskPermission(input.permission)) {
        return deny(input, `${input.permission} cannot be checked against a task.`);
      }

      const task = input.scenario.tasks.find((candidate) => candidate.id === input.resourceId);
      if (!task) {
        return deny(input, `Task ${input.resourceId} was not found in this scenario.`);
      }

      const match = this.evaluateTaskPermission(input.scenario, input.userId, input.permission, task, new Set());
      return match ? allow(input, match) : deny(input, deniedReason(input.permission));
    }

    if (!isResourcePermission(input.permission)) {
      return deny(input, `${input.permission} cannot be checked against a resource.`);
    }

    const resource = input.scenario.resources.find((candidate) => candidate.id === input.resourceId);
    if (!resource) {
      return deny(input, `Resource ${input.resourceId} was not found in this scenario.`);
    }

    const task = input.scenario.tasks.find((candidate) => candidate.id === resource.taskId);
    if (!task) {
      return deny(input, `Resource ${resource.id} belongs to missing task ${resource.taskId}.`);
    }

    const match = this.evaluateResourcePermission(input.scenario, input.userId, input.permission, resource, task);
    return match ? allow(input, match) : deny(input, deniedReason(input.permission));
  }

  listPermissions(input: ListPermissionsInput): Permission[] {
    const permissions = input.resourceType === "task" ? TASK_PERMISSIONS : RESOURCE_PERMISSIONS;
    return permissions.filter((permission) =>
      this.check({
        scenario: input.scenario,
        userId: input.userId,
        permission,
        resourceType: input.resourceType,
        resourceId: input.resourceId
      }).allowed
    );
  }

  listVisibleTasks(input: VisibleTasksInput): Task[] {
    return input.scenario.tasks.filter((task) =>
      this.check({
        scenario: input.scenario,
        userId: input.userId,
        permission: "task.view",
        resourceType: "task",
        resourceId: task.id
      }).allowed
    );
  }

  listVisibleResources(input: VisibleResourcesInput): TaskResource[] {
    return input.scenario.resources.filter(
      (resource) =>
        resource.taskId === input.taskId &&
        this.check({
          scenario: input.scenario,
          userId: input.userId,
          permission: "resource.view",
          resourceType: "resource",
          resourceId: resource.id
        }).allowed
    );
  }

  private evaluateTaskPermission(
    scenario: Scenario,
    userId: string,
    permission: TaskPermission,
    task: Task,
    visitedTaskIds: Set<string>
  ): RuleMatch | undefined {
    switch (permission) {
      case "task.view":
        return (
          this.createdByRule(userId, task) ??
          this.directRelationRule(scenario, userId, { type: "task", id: task.id }, ["viewer", "participant", "editor", "manager"], permission) ??
          this.taskOrgRule(scenario, userId, task, "owned_by", permission) ??
          this.taskOrgRule(scenario, userId, task, "assigned_to", permission) ??
          this.inheritedParentRule(scenario, userId, task, visitedTaskIds)
        );
      case "task.edit":
        return (
          this.createdByRule(userId, task) ??
          this.directRelationRule(scenario, userId, { type: "task", id: task.id }, ["editor", "manager"], permission) ??
          this.taskOrgRule(scenario, userId, task, "owned_by", permission)
        );
      case "task.comment":
        return (
          this.directRelationRule(scenario, userId, { type: "task", id: task.id }, ["participant", "editor", "manager"], permission) ??
          this.taskOrgRule(scenario, userId, task, "owned_by", permission) ??
          this.taskOrgRule(scenario, userId, task, "assigned_to", permission)
        );
      case "task.assign":
      case "task.manageAccess":
        return (
          this.createdByRule(userId, task) ??
          this.directRelationRule(scenario, userId, { type: "task", id: task.id }, ["manager"], permission) ??
          this.taskOrgRule(scenario, userId, task, "owned_by", permission)
        );
      case "task.complete":
        return (
          this.directRelationRule(scenario, userId, { type: "task", id: task.id }, ["editor", "manager"], permission) ??
          this.taskOrgRule(scenario, userId, task, "owned_by", permission) ??
          this.taskOrgRule(scenario, userId, task, "assigned_to", permission)
        );
      default: {
        const _exhaustive: never = permission;
        return _exhaustive;
      }
    }
  }

  private evaluateResourcePermission(
    scenario: Scenario,
    userId: string,
    permission: ResourcePermission,
    resource: TaskResource,
    task: Task
  ): RuleMatch | undefined {
    const restriction = this.resourceRestrictionRule(scenario, userId, resource);
    if (!restriction.allowed) {
      return undefined;
    }

    const resourceRef: EntityRef = { type: "resource", id: resource.id };
    const restrictionPath = restriction.path;
    switch (permission) {
      case "resource.view": {
        const direct =
          this.directRelationRule(scenario, userId, resourceRef, ["viewer", "editor", "manager"], permission) ??
          this.resourceTaskRule(scenario, userId, permission, resource, task, "task.view");
        return direct ? { ...direct, path: [...restrictionPath, ...direct.path] } : undefined;
      }
      case "resource.edit": {
        const direct =
          this.directRelationRule(scenario, userId, resourceRef, ["editor", "manager"], permission) ??
          this.resourceTaskRule(scenario, userId, permission, resource, task, "task.edit");
        return direct ? { ...direct, path: [...restrictionPath, ...direct.path] } : undefined;
      }
      case "resource.manageAccess": {
        const direct =
          this.directRelationRule(scenario, userId, resourceRef, ["manager"], permission) ??
          this.resourceTaskRule(scenario, userId, permission, resource, task, "task.manageAccess");
        return direct ? { ...direct, path: [...restrictionPath, ...direct.path] } : undefined;
      }
      default: {
        const _exhaustive: never = permission;
        return _exhaustive;
      }
    }
  }

  private createdByRule(userId: string, task: Task): RuleMatch | undefined {
    if (task.createdByUserId !== userId) {
      return undefined;
    }

    return {
      ruleId: "task.creator",
      reason: "The user created this task.",
      path: [
        {
          from: { type: "user", id: userId },
          relation: "created_by_field",
          to: { type: "task", id: task.id }
        }
      ]
    };
  }

  private directRelationRule(
    scenario: Scenario,
    userId: string,
    resource: EntityRef,
    relations: RelationshipRelation[],
    permission: Permission
  ): RuleMatch | undefined {
    for (const relation of relations) {
      const directUserGrant = scenario.relationships.find(
        (candidate) =>
          candidate.subjectType === resource.type &&
          candidate.subjectId === resource.id &&
          candidate.relation === relation &&
          candidate.objectType === "user" &&
          candidate.objectId === userId
      );

      if (directUserGrant) {
        return {
          ruleId: `${resource.type}.${relation}`,
          reason: `The ${resource.type} has a direct ${relation} grant for this user.`,
          path: [stepFromRelationship(directUserGrant)]
        };
      }

      const groupGrant = scenario.relationships.find(
        (candidate) =>
          candidate.subjectType === resource.type &&
          candidate.subjectId === resource.id &&
          candidate.relation === relation &&
          candidate.objectType === "group"
      );

      if (groupGrant) {
        const groupPath = this.userInGroupPath(scenario, userId, groupGrant.objectId);
        if (groupPath) {
          return {
            ruleId: `${resource.type}.${relation}.group`,
            reason: `The user belongs to a group with ${permission} access through ${relation}.`,
            path: [...groupPath, stepFromRelationship(groupGrant)]
          };
        }
      }

      const orgGrant = scenario.relationships.find(
        (candidate) =>
          candidate.subjectType === resource.type &&
          candidate.subjectId === resource.id &&
          candidate.relation === relation &&
          candidate.objectType === "org"
      );

      if (orgGrant) {
        const orgPath = this.userInOrgPath(scenario, userId, orgGrant.objectId);
        if (orgPath) {
          return {
            ruleId: `${resource.type}.${relation}.org`,
            reason: `The user belongs to an org with ${permission} access through ${relation}.`,
            path: [...orgPath, stepFromRelationship(orgGrant)]
          };
        }
      }
    }

    return undefined;
  }

  private taskOrgRule(
    scenario: Scenario,
    userId: string,
    task: Task,
    relation: "owned_by" | "assigned_to",
    permission: TaskPermission
  ): RuleMatch | undefined {
    const orgGrants = this.taskOrgRelationships(scenario, task, relation);
    for (const orgGrant of orgGrants) {
      const membershipPath = this.userInOrgPath(scenario, userId, orgGrant.objectId);
      if (!membershipPath) {
        continue;
      }

      const orgLabel = getEntityLabel(scenario, { type: "org", id: orgGrant.objectId });
      const reason =
        relation === "owned_by"
          ? `The user belongs to ${orgLabel}, which owns this task.`
          : `The user belongs to ${orgLabel}, which is assigned to this task.`;

      return {
        ruleId: `task.${relation}.${permission}`,
        reason,
        path: [...membershipPath, stepFromRelationship(orgGrant, true)]
      };
    }

    return undefined;
  }

  private inheritedParentRule(
    scenario: Scenario,
    userId: string,
    task: Task,
    visitedTaskIds: Set<string>
  ): RuleMatch | undefined {
    if (visitedTaskIds.has(task.id)) {
      return undefined;
    }

    visitedTaskIds.add(task.id);
    const inheritanceGrant = scenario.relationships.find(
      (relationship) =>
        relationship.subjectType === "task" &&
        relationship.subjectId === task.id &&
        relationship.relation === "inherits_access_from" &&
        relationship.objectType === "task"
    );
    if (!inheritanceGrant) {
      return undefined;
    }

    const parent = scenario.tasks.find((candidate) => candidate.id === inheritanceGrant.objectId);
    if (!parent) {
      return undefined;
    }

    const parentMatch = this.evaluateTaskPermission(scenario, userId, "task.view", parent, visitedTaskIds);
    if (!parentMatch) {
      return undefined;
    }

    return {
      ruleId: "task.parent-inheritance",
      reason: "This task explicitly inherits view access from another task.",
      path: [...parentMatch.path, stepFromRelationship(inheritanceGrant)]
    };
  }

  private resourceTaskRule(
    scenario: Scenario,
    userId: string,
    permission: ResourcePermission,
    resource: TaskResource,
    task: Task,
    taskPermission: TaskPermission
  ): RuleMatch | undefined {
    const taskMatch = this.evaluateTaskPermission(scenario, userId, taskPermission, task, new Set());
    if (!taskMatch) {
      return undefined;
    }

    return {
      ruleId: `resource.inherits.${taskPermission}`,
      reason: `${permission} is allowed because the resource belongs to a task where the user has ${taskPermission}.`,
      path: [
        ...taskMatch.path,
        {
          from: { type: "resource", id: resource.id },
          relation: "resource_task",
          to: { type: "task", id: task.id }
        }
      ]
    };
  }

  private resourceRestrictionRule(scenario: Scenario, userId: string, resource: TaskResource): RestrictionMatch {
    const restrictions = scenario.relationships.filter(
      (candidate) =>
        candidate.subjectType === "resource" &&
        candidate.subjectId === resource.id &&
        candidate.relation === "restricted_to"
    );

    if (restrictions.length === 0) {
      return { allowed: true, reason: "The resource has no explicit restriction.", path: [] };
    }

    for (const restriction of restrictions) {
      const path = this.userMatchesObjectPath(scenario, userId, restriction);
      if (path) {
        return {
          allowed: true,
          reason: "The user satisfies an explicit resource restriction.",
          path: [...path, stepFromRelationship(restriction)]
        };
      }
    }

    return { allowed: false, reason: "The resource is restricted and the user does not match any restriction.", path: [] };
  }

  private taskOrgRelationships(
    scenario: Scenario,
    task: Task,
    relation: "owned_by" | "assigned_to"
  ): Relationship[] {
    const relationships = scenario.relationships.filter(
      (candidate) =>
        candidate.subjectType === "task" &&
        candidate.subjectId === task.id &&
        candidate.relation === relation &&
        candidate.objectType === "org"
    );

    if (relation === "owned_by" && relationships.length === 0) {
      return [
        {
          id: `implicit-${task.id}-owned-by-${task.owningOrgId}`,
          subjectType: "task",
          subjectId: task.id,
          relation: "owned_by",
          objectType: "org",
          objectId: task.owningOrgId
        }
      ];
    }

    return relationships;
  }

  private userMatchesObjectPath(
    scenario: Scenario,
    userId: string,
    relationship: Relationship
  ): AuthzPathStep[] | undefined {
    switch (relationship.objectType) {
      case "user":
        return relationship.objectId === userId ? [stepFromUser(userId)] : undefined;
      case "org":
        return this.userInOrgPath(scenario, userId, relationship.objectId);
      case "group":
        return this.userInGroupPath(scenario, userId, relationship.objectId);
      case "task":
      case "resource":
        return undefined;
      default: {
        const _exhaustive: never = relationship.objectType;
        return _exhaustive;
      }
    }
  }

  private userInGroupPath(scenario: Scenario, userId: string, groupId: string): AuthzPathStep[] | undefined {
    const relationship = scenario.relationships.find(
      (candidate) =>
        candidate.subjectType === "user" &&
        candidate.subjectId === userId &&
        candidate.relation === "member_of" &&
        candidate.objectType === "group" &&
        candidate.objectId === groupId
    );

    return relationship ? [stepFromRelationship(relationship)] : undefined;
  }

  private userInOrgPath(scenario: Scenario, userId: string, targetOrgId: string): AuthzPathStep[] | undefined {
    const directMemberships = scenario.relationships.filter(
      (candidate) =>
        candidate.subjectType === "user" &&
        candidate.subjectId === userId &&
        candidate.relation === "member_of" &&
        candidate.objectType === "org"
    );

    for (const membership of directMemberships) {
      if (membership.objectId === targetOrgId) {
        return [stepFromRelationship(membership)];
      }

      const ancestorPath = this.orgAncestorPath(scenario, membership.objectId, targetOrgId);
      if (ancestorPath) {
        return [stepFromRelationship(membership), ...ancestorPath];
      }
    }

    return undefined;
  }

  private orgAncestorPath(scenario: Scenario, sourceOrgId: string, targetOrgId: string): AuthzPathStep[] | undefined {
    const path: AuthzPathStep[] = [];
    const seen = new Set<string>();
    let cursor = sourceOrgId;

    while (!seen.has(cursor)) {
      seen.add(cursor);
      const relationship = this.orgParentRelationship(scenario, cursor);
      if (!relationship) {
        return undefined;
      }

      path.push(stepFromRelationship(relationship));
      if (relationship.objectId === targetOrgId) {
        return path;
      }

      cursor = relationship.objectId;
    }

    return undefined;
  }

  private orgParentRelationship(scenario: Scenario, orgId: string): Relationship | undefined {
    const relationship = scenario.relationships.find(
      (candidate) =>
        candidate.subjectType === "org" &&
        candidate.subjectId === orgId &&
        candidate.relation === "child_of" &&
        candidate.objectType === "org"
    );
    if (relationship) {
      return relationship;
    }

    const org = scenario.orgs.find((candidate) => candidate.id === orgId);
    if (!org?.parentOrgId) {
      return undefined;
    }

    return {
      id: `implicit-${org.id}-child-of-${org.parentOrgId}`,
      subjectType: "org",
      subjectId: org.id,
      relation: "child_of",
      objectType: "org",
      objectId: org.parentOrgId
    };
  }
}

export function formatPath(scenario: Scenario, path: AuthzPathStep[]): string {
  return path
    .map((step) => {
      const from = getEntityLabel(scenario, step.from);
      const to = getEntityLabel(scenario, step.to);
      return `${from} -> ${step.relation} -> ${to}`;
    })
    .join(" -> ");
}

export function formatPathSteps(scenario: Scenario, path: AuthzPathStep[]): string[] {
  return path.map((step) => {
    const from = getEntityLabel(scenario, step.from);
    const to = getEntityLabel(scenario, step.to);
    return `${from} -> ${step.relation} -> ${to}`;
  });
}

function allow(input: AuthzCheckInput, match: RuleMatch): AuthzResult {
  return {
    allowed: true,
    permission: input.permission,
    userId: input.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    reason: match.reason,
    ruleId: match.ruleId,
    path: match.path
  };
}

function deny(input: AuthzCheckInput, reason: string): AuthzResult {
  return {
    allowed: false,
    permission: input.permission,
    userId: input.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    reason,
    path: []
  };
}

function deniedReason(permission: Permission): string {
  if (PERMISSIONS.includes(permission)) {
    return `No relationship path grants ${permission}.`;
  }

  return `Unknown permission ${permission}.`;
}

function stepFromRelationship(relationship: Relationship, reverse = false): AuthzPathStep {
  if (reverse) {
    return {
      from: { type: relationship.objectType, id: relationship.objectId },
      relation: relationship.relation,
      to: { type: relationship.subjectType, id: relationship.subjectId },
      relationshipId: relationship.id
    };
  }

  return {
    from: { type: relationship.subjectType, id: relationship.subjectId },
    relation: relationship.relation,
    to: { type: relationship.objectType, id: relationship.objectId },
    relationshipId: relationship.id
  };
}

function stepFromUser(userId: string): AuthzPathStep {
  return {
    from: { type: "user", id: userId },
    relation: "viewer",
    to: { type: "user", id: userId }
  };
}

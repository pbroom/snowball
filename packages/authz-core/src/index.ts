import {
  TASK_PERMISSIONS,
  getEntityLabel,
  type EntityRef,
  type Relationship,
  type RelationshipRelation,
  type Scenario,
  type Task,
  type TaskPermission
} from "@snowball/task-core";

export type ResourceType = "task" | "artifact" | "note";

export interface AuthzCheckInput {
  scenario: Scenario;
  userId: string;
  permission: TaskPermission;
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

export interface AuthzPathStep {
  from: EntityRef;
  relation: RelationshipRelation | "created_by_field";
  to: EntityRef;
  relationshipId?: string;
}

export interface AuthzResult {
  allowed: boolean;
  permission: TaskPermission;
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
  listPermissions(input: ListPermissionsInput): TaskPermission[];
  listVisibleTasks(input: VisibleTasksInput): Task[];
}

interface RuleMatch {
  ruleId: string;
  reason: string;
  path: AuthzPathStep[];
}

export class LocalAuthorizationService implements AuthorizationService {
  check(input: AuthzCheckInput): AuthzResult {
    return this.explain(input);
  }

  explain(input: AuthzCheckInput): AuthzResult {
    if (input.resourceType !== "task") {
      return deny(input, `${input.resourceType} permissions are not modeled in the local evaluator yet.`);
    }

    const task = input.scenario.tasks.find((candidate) => candidate.id === input.resourceId);
    if (!task) {
      return deny(input, `Task ${input.resourceId} was not found in this scenario.`);
    }

    const match = this.evaluateTaskPermission(input.scenario, input.userId, input.permission, task, new Set());
    if (!match) {
      return deny(input, deniedReason(input.permission));
    }

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

  listPermissions(input: ListPermissionsInput): TaskPermission[] {
    return TASK_PERMISSIONS.filter(
      (permission) =>
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
          this.directTaskRelationRule(scenario, userId, task, ["viewer", "participant", "editor", "approver"], "task.view") ??
          this.taskOrgRule(scenario, userId, task, "owned_by", "task.view") ??
          this.taskOrgRule(scenario, userId, task, "assigned_to", "task.view") ??
          this.inheritedParentRule(scenario, userId, task, visitedTaskIds)
        );
      case "task.edit":
        return (
          this.createdByRule(userId, task) ??
          this.directTaskRelationRule(scenario, userId, task, ["editor"], "task.edit") ??
          this.taskOrgRule(scenario, userId, task, "owned_by", "task.edit")
        );
      case "task.comment":
        return (
          this.directTaskRelationRule(scenario, userId, task, ["participant", "editor"], "task.comment") ??
          this.taskOrgRule(scenario, userId, task, "owned_by", "task.comment") ??
          this.taskOrgRule(scenario, userId, task, "assigned_to", "task.comment")
        );
      case "task.assign":
      case "task.manageAccess":
        return (
          this.createdByRule(userId, task) ??
          this.directTaskRelationRule(scenario, userId, task, ["editor"], permission) ??
          this.taskOrgRule(scenario, userId, task, "owned_by", permission)
        );
      case "task.clear":
        return this.taskOrgRule(scenario, userId, task, "assigned_to", "task.clear");
      case "task.approve":
        return (
          this.directTaskRelationRule(scenario, userId, task, ["approver"], "task.approve") ??
          this.taskOrgRule(scenario, userId, task, "owned_by", "task.approve")
        );
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

  private directTaskRelationRule(
    scenario: Scenario,
    userId: string,
    task: Task,
    relations: RelationshipRelation[],
    permission: TaskPermission
  ): RuleMatch | undefined {
    for (const relation of relations) {
      const directUserGrant = scenario.relationships.find(
        (candidate) =>
          candidate.subjectType === "task" &&
          candidate.subjectId === task.id &&
          candidate.relation === relation &&
          candidate.objectType === "user" &&
          candidate.objectId === userId
      );

      if (directUserGrant) {
        return {
          ruleId: `task.${relation}`,
          reason: `The task has a direct ${relation} grant for this user.`,
          path: [stepFromRelationship(directUserGrant)]
        };
      }

      const groupGrants = scenario.relationships.filter(
        (candidate) =>
          candidate.subjectType === "task" &&
          candidate.subjectId === task.id &&
          candidate.relation === relation &&
          candidate.objectType === "group"
      );

      for (const groupGrant of groupGrants) {
        const groupPath = this.userInGroupPath(scenario, userId, groupGrant.objectId);
        if (groupPath) {
          return {
            ruleId: `task.${relation}.group`,
            reason: `The user belongs to a group with ${permission} access through ${relation}.`,
            path: [...groupPath, stepFromRelationship(groupGrant)]
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
      reason: "This task explicitly inherits view access from its parent task.",
      path: [...parentMatch.path, stepFromRelationship(inheritanceGrant)]
    };
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

function deniedReason(permission: TaskPermission): string {
  switch (permission) {
    case "task.view":
      return "No creator, participant, viewer, owning org, assigned org, or explicit parent inheritance path grants view access.";
    case "task.edit":
      return "Edit requires creator, explicit editor, or membership in the owning org.";
    case "task.comment":
      return "Comment requires participant/editor access or membership in the owning or assigned org.";
    case "task.assign":
      return "Assign requires creator, explicit editor, or membership in the owning org.";
    case "task.clear":
      return "Clear requires membership in an org assigned to the task.";
    case "task.approve":
      return "Approve requires an explicit approver grant or membership in the owning org.";
    case "task.manageAccess":
      return "Manage access requires creator, explicit editor, or membership in the owning org.";
    default: {
      const _exhaustive: never = permission;
      return _exhaustive;
    }
  }
}

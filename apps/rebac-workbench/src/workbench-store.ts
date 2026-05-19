import { buildAuditEvent, cloneScenario, loadScenarios, seedScenario } from "@snowball/scenario-store";
import {
  getEntityLabel,
  type EntityType,
  type Org,
  type Permission,
  type Relationship,
  type RelationshipRelation,
  type Scenario,
  type Task,
  type TaskStatus,
  type User
} from "@snowball/task-core";
import { create } from "zustand";

export type EntityOption = {
  id: string;
  label: string;
};

export type RelationshipDraft = {
  subjectType: EntityType;
  subjectId: string;
  relation: RelationshipRelation;
  objectType: EntityType;
  objectId: string;
};

export type BuilderDraft = {
  taskTitle: string;
  taskType: string;
  taskOwnerOrgId: string;
  taskParentId: string;
};

export type FormErrors = Partial<Record<"task" | "relationship" | "org", string>>;
export type PendingDelete =
  | { type: "relationship"; id: string }
  | { type: "user"; id: string }
  | { type: "org"; id: string }
  | undefined;
export type PendingRename = { type: "user" | "org"; id: string; value: string } | undefined;

type ParsedIdentityKey = { type: "org" | "user"; id: string };

type WorkbenchState = {
  scenarios: Scenario[];
  selectedScenarioId: string;
  currentUserId: string;
  selectedTaskId: string;
  selectedPermission: Permission;
  relationshipDraft: RelationshipDraft;
  builderDraft: BuilderDraft;
  saveState: string;
  formErrors: FormErrors;
  pendingDelete: PendingDelete;
  pendingRename: PendingRename;
  selectedOrgId: string | undefined;
};

type WorkbenchActions = {
  markAutosaved: (label: string) => void;
  reconcileSelectedOrg: () => void;
  setSelectedOrgId: (orgId: string | undefined) => void;
  setSelectedTaskId: (taskId: string) => void;
  setSelectedPermission: (permission: Permission) => void;
  setBuilderDraft: (updater: (draft: BuilderDraft) => BuilderDraft) => void;
  setRelationshipDraft: (updater: (draft: RelationshipDraft) => RelationshipDraft) => void;
  clearFormError: (field: keyof FormErrors) => void;
  cancelDelete: () => void;
  cancelRename: () => void;
  updatePendingRename: (value: string) => void;
  selectUser: (user: User) => void;
  addTask: () => void;
  addRelationship: () => void;
  deleteRelationship: (relationship: Relationship) => void;
  deleteUser: (userId: string) => void;
  deleteOrg: (orgId: string) => void;
  moveIdentityNode: (sourceKey: string, targetOrgId: string | undefined) => void;
  addOrgFromIdentity: (sourceKey: string) => void;
  addUserFromIdentity: (sourceKey: string) => void;
  startRenameIdentity: (sourceKey: string) => void;
  commitRenameIdentity: () => void;
  updateTaskStatus: (task: Task, status: TaskStatus) => void;
};

export type WorkbenchStore = WorkbenchState & WorkbenchActions;

const initialScenarios = loadScenarios();
const initialScenario = getScenarioFromState({
  scenarios: initialScenarios,
  selectedScenarioId: initialScenarios[0]?.id ?? seedScenario.id
});

export const useWorkbenchStore = create<WorkbenchStore>((set) => ({
  scenarios: initialScenarios,
  selectedScenarioId: initialScenario.id,
  currentUserId: initialScenario.users[0]?.id ?? "",
  selectedTaskId: initialScenario.tasks[0]?.id ?? "",
  selectedPermission: "task.view",
  relationshipDraft: firstRelationshipDraft(initialScenario),
  builderDraft: firstBuilderDraft(initialScenario),
  saveState: "Autosaved",
  formErrors: {},
  pendingDelete: undefined,
  pendingRename: undefined,
  selectedOrgId: undefined,

  markAutosaved: (label) => set({ saveState: label }),
  reconcileSelectedOrg: () =>
    set((state) => {
      const scenario = getScenarioFromState(state);
      return state.selectedOrgId && !scenario.orgs.some((org) => org.id === state.selectedOrgId) ? { selectedOrgId: undefined } : {};
    }),
  setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
  setSelectedPermission: (permission) => set({ selectedPermission: permission }),
  setBuilderDraft: (updater) => set((state) => ({ builderDraft: updater(state.builderDraft) })),
  setRelationshipDraft: (updater) => set((state) => ({ relationshipDraft: updater(state.relationshipDraft) })),
  clearFormError: (field) => set((state) => ({ formErrors: { ...state.formErrors, [field]: undefined } })),
  cancelDelete: () => set({ pendingDelete: undefined }),
  cancelRename: () => set({ pendingRename: undefined }),
  updatePendingRename: (value) =>
    set((state) => ({ pendingRename: state.pendingRename ? { ...state.pendingRename, value } : state.pendingRename })),

  selectUser: (user) =>
    set((state) => {
      const previousUserId = getEffectiveUserId(state);
      if (user.id === previousUserId) {
        return {};
      }

      return { currentUserId: user.id, selectedOrgId: undefined };
    }),

  addTask: () =>
    set((state) => {
      const scenario = getScenarioFromState(state);
      const effectiveUserId = getEffectiveUserId(state);
      const title = state.builderDraft.taskTitle.trim();
      const type = state.builderDraft.taskType.trim() || "task";
      const parentTaskId = state.builderDraft.taskParentId;
      const ownerOrgExists = scenario.orgs.some((org) => org.id === state.builderDraft.taskOwnerOrgId);
      const parentTaskExists = !parentTaskId || scenario.tasks.some((task) => task.id === parentTaskId);
      if (!title || !ownerOrgExists || !parentTaskExists || !effectiveUserId) {
        return {
          formErrors: {
            ...state.formErrors,
            task: !title
              ? "Enter a task title before creating the task."
              : !ownerOrgExists
                ? "Choose the org that owns this task."
                : !parentTaskExists
                  ? "Choose an existing parent task or clear the parent field."
                : "Select a current user so the creator relationship can be recorded."
          }
        };
      }

      const id = uniqueId("task", title, scenario.tasks.map((task) => task.id));
      return updateScenarioState(
        state,
        (draft) => {
          const now = new Date().toISOString();
          draft.tasks.push({
            id,
            type,
            title,
            parentTaskId: parentTaskId || undefined,
            owningOrgId: state.builderDraft.taskOwnerOrgId,
            createdByUserId: effectiveUserId,
            status: "open",
            createdAt: now,
            updatedAt: now
          });
          draft.relationships.push({
            id: `rel-${id}-owned-by-${state.builderDraft.taskOwnerOrgId}`,
            subjectType: "task",
            subjectId: id,
            relation: "owned_by",
            objectType: "org",
            objectId: state.builderDraft.taskOwnerOrgId
          });
          draft.relationships.push({
            id: `rel-${id}-created-by-${effectiveUserId}`,
            subjectType: "task",
            subjectId: id,
            relation: "created_by",
            objectType: "user",
            objectId: effectiveUserId
          });
          if (parentTaskId) {
            draft.relationships.push({
              id: `rel-${id}-parent-${parentTaskId}`,
              subjectType: "task",
              subjectId: id,
              relation: "parent",
              objectType: "task",
              objectId: parentTaskId
            });
          }
          appendAudit(draft, effectiveUserId, `Created task ${title}.`, "task.created", "task", id);
        },
        {
          selectedTaskId: id,
          builderDraft: { ...state.builderDraft, taskTitle: "" },
          formErrors: { ...state.formErrors, task: undefined }
        }
      );
    }),

  addRelationship: () =>
    set((state) => {
      const scenario = getScenarioFromState(state);
      const subjectExists = entityOptions(scenario, state.relationshipDraft.subjectType).some(
        (option) => option.id === state.relationshipDraft.subjectId
      );
      const objectExists = entityOptions(scenario, state.relationshipDraft.objectType).some(
        (option) => option.id === state.relationshipDraft.objectId
      );
      if (!subjectExists || !objectExists) {
        return {
          formErrors: {
            ...state.formErrors,
            relationship: "Choose existing entities for both ends of the edge."
          }
        };
      }

      const id = uniqueId(
        "rel",
        `${state.relationshipDraft.subjectId}-${state.relationshipDraft.relation}-${state.relationshipDraft.objectId}`,
        scenario.relationships.map((relationshipItem) => relationshipItem.id)
      );
      return updateScenarioState(
        state,
        (draft) => {
          draft.relationships.push({ id, ...state.relationshipDraft });
          appendAudit(
            draft,
            getEffectiveUserId(state),
            `Created relationship ${state.relationshipDraft.subjectId} ${state.relationshipDraft.relation} ${state.relationshipDraft.objectId}.`,
            "relationship.created",
            state.relationshipDraft.subjectType,
            state.relationshipDraft.subjectId
          );
        },
        { formErrors: { ...state.formErrors, relationship: undefined } }
      );
    }),

  deleteRelationship: (relationship) =>
    set((state) => {
      if (state.pendingDelete?.type !== "relationship" || state.pendingDelete.id !== relationship.id) {
        return { pendingDelete: { type: "relationship", id: relationship.id } };
      }

      return updateScenarioState(
        state,
        (draft) => {
          draft.relationships = draft.relationships.filter((candidate) => candidate.id !== relationship.id);
          appendAudit(draft, getEffectiveUserId(state), `Deleted relationship ${relationship.id}.`, "relationship.deleted", relationship.subjectType, relationship.subjectId);
        },
        { pendingDelete: undefined }
      );
    }),

  deleteUser: (userId) =>
    set((state) => {
      if (state.pendingDelete?.type !== "user" || state.pendingDelete.id !== userId) {
        return { pendingDelete: { type: "user", id: userId } };
      }

      const scenario = getScenarioFromState(state);
      const nextUserId = state.currentUserId === userId ? scenario.users.find((user) => user.id !== userId)?.id ?? "" : state.currentUserId;
      return updateScenarioState(
        state,
        (draft) => {
          draft.users = draft.users.filter((user) => user.id !== userId);
          draft.relationships = draft.relationships.filter(
            (relationshipItem) =>
              !(relationshipItem.subjectType === "user" && relationshipItem.subjectId === userId) &&
              !(relationshipItem.objectType === "user" && relationshipItem.objectId === userId)
          );
          appendAudit(draft, getEffectiveUserId(state), `Deleted user ${userId}.`, "identity.deleted", "user", userId);
        },
        { currentUserId: nextUserId, pendingDelete: undefined }
      );
    }),

  deleteOrg: (orgId) =>
    set((state) => {
      if (state.pendingDelete?.type !== "org" || state.pendingDelete.id !== orgId) {
        return {
          pendingDelete: { type: "org", id: orgId },
          formErrors: { ...state.formErrors, org: undefined }
        };
      }

      const scenario = getScenarioFromState(state);
      if (scenario.tasks.some((task) => task.owningOrgId === orgId)) {
        return {
          pendingDelete: undefined,
          formErrors: {
            ...state.formErrors,
            org: "Cannot delete an org that still owns tasks. Reassign or remove those tasks first."
          }
        };
      }

      return updateScenarioState(
        state,
        (draft) => {
          draft.orgs = draft.orgs.filter((org) => org.id !== orgId);
          draft.relationships = draft.relationships.filter(
            (relationshipItem) =>
              !(relationshipItem.subjectType === "org" && relationshipItem.subjectId === orgId) &&
              !(relationshipItem.objectType === "org" && relationshipItem.objectId === orgId)
          );
          for (const org of draft.orgs) {
            if (org.parentOrgId === orgId) {
              org.parentOrgId = undefined;
            }
          }
          for (const user of draft.users) {
            if (user.primaryOrgId === orgId) {
              user.primaryOrgId = undefined;
            }
          }
          appendAudit(draft, getEffectiveUserId(state), `Deleted org ${orgId}.`, "org.deleted", "org", orgId);
        },
        { pendingDelete: undefined, formErrors: { ...state.formErrors, org: undefined } }
      );
    }),

  moveIdentityNode: (sourceKey, targetOrgId) =>
    set((state) => {
      const source = parseIdentityKey(sourceKey);
      if (!source) {
        return {};
      }

      const scenario = getScenarioFromState(state);
      if (source.type === "user") {
        const user = scenario.users.find((candidate) => candidate.id === source.id);
        if (!user || !targetOrgId || !scenario.orgs.some((org) => org.id === targetOrgId) || getUserOrgId(scenario, user) === targetOrgId) {
          return {};
        }
      } else {
        const org = scenario.orgs.find((candidate) => candidate.id === source.id);
        if (!org || org.parentOrgId === targetOrgId || org.id === targetOrgId) {
          return {};
        }

        if (targetOrgId) {
          const targetOrg = scenario.orgs.find((candidate) => candidate.id === targetOrgId);
          if (!targetOrg || isDescendantOrg(scenario, org.id, targetOrg.id)) {
            return {};
          }
        }
      }

      return updateScenarioState(
        state,
        (draft) => {
          if (source.type === "user") {
            if (!targetOrgId || !draft.orgs.some((org) => org.id === targetOrgId)) {
              return;
            }

            const user = draft.users.find((candidate) => candidate.id === source.id);
            const targetOrg = draft.orgs.find((org) => org.id === targetOrgId);
            if (!user || !targetOrg || getUserOrgId(draft, user) === targetOrgId) {
              return;
            }

            user.primaryOrgId = targetOrgId;
            draft.relationships = draft.relationships.filter(
              (relationshipItem) =>
                !(
                  relationshipItem.subjectType === "user" &&
                  relationshipItem.subjectId === user.id &&
                  relationshipItem.relation === "member_of" &&
                  relationshipItem.objectType === "org"
                )
            );
            draft.relationships.push({
              id: uniqueRelationshipId(draft, `rel-${user.id}-member-of-${targetOrgId}`),
              subjectType: "user",
              subjectId: user.id,
              relation: "member_of",
              objectType: "org",
              objectId: targetOrgId
            });
            appendAudit(draft, getEffectiveUserId(state), `Moved ${user.displayName} to ${targetOrg.name}.`, "relationship.created", "user", user.id);
            return;
          }

          const org = draft.orgs.find((candidate) => candidate.id === source.id);
          if (!org || org.parentOrgId === targetOrgId || org.id === targetOrgId) {
            return;
          }

          if (targetOrgId) {
            const targetOrg = draft.orgs.find((candidate) => candidate.id === targetOrgId);
            if (!targetOrg || isDescendantOrg(draft, org.id, targetOrg.id)) {
              return;
            }
          }

          org.parentOrgId = targetOrgId;
          draft.relationships = draft.relationships.filter(
            (relationshipItem) =>
              !(
                relationshipItem.subjectType === "org" &&
                relationshipItem.subjectId === org.id &&
                relationshipItem.relation === "child_of" &&
                relationshipItem.objectType === "org"
              )
          );
          if (targetOrgId) {
            draft.relationships.push({
              id: uniqueRelationshipId(draft, `rel-${org.id}-child-of-${targetOrgId}`),
              subjectType: "org",
              subjectId: org.id,
              relation: "child_of",
              objectType: "org",
              objectId: targetOrgId
            });
          }
          appendAudit(
            draft,
            getEffectiveUserId(state),
            targetOrgId ? `Moved org ${org.name} under ${getEntityLabel(draft, { type: "org", id: targetOrgId })}.` : `Moved org ${org.name} to the root.`,
            "relationship.created",
            "org",
            org.id
          );
        },
        { pendingDelete: undefined }
      );
    }),

  addOrgFromIdentity: (sourceKey) =>
    set((state) => {
      const source = parseIdentityKey(sourceKey);
      if (!source) {
        return {};
      }

      const scenario = getScenarioFromState(state);
      const parentOrgId = source.type === "org" ? source.id : getUserParentOrgId(scenario, source.id);
      const name = nextPlaceholderName("New org", scenario.orgs.map((org) => org.name));
      const id = uniqueId("org", name, scenario.orgs.map((org) => org.id));
      return updateScenarioState(
        state,
        (draft) => {
          draft.orgs.push({
            id,
            name,
            abbreviation: abbreviation(name),
            parentOrgId
          });
          if (parentOrgId) {
            draft.relationships.push({
              id: uniqueRelationshipId(draft, `rel-${id}-child-of-${parentOrgId}`),
              subjectType: "org",
              subjectId: id,
              relation: "child_of",
              objectType: "org",
              objectId: parentOrgId
            });
          }
          appendAudit(
            draft,
            getEffectiveUserId(state),
            parentOrgId ? `Created org ${name} under ${getEntityLabel(draft, { type: "org", id: parentOrgId })}.` : `Created org ${name}.`,
            "org.created",
            "org",
            id
          );
        },
        { pendingDelete: undefined, pendingRename: { type: "org", id, value: name } }
      );
    }),

  addUserFromIdentity: (sourceKey) =>
    set((state) => {
      const source = parseIdentityKey(sourceKey);
      if (!source) {
        return {};
      }

      const scenario = getScenarioFromState(state);
      const parentOrgId = source.type === "org" ? source.id : getUserParentOrgId(scenario, source.id);
      if (!parentOrgId) {
        return {};
      }

      const displayName = nextPlaceholderName("New user", scenario.users.map((user) => user.displayName));
      const id = uniqueId("user", displayName, scenario.users.map((user) => user.id));
      return updateScenarioState(
        state,
        (draft) => {
          draft.users.push({
            id,
            displayName,
            primaryOrgId: parentOrgId
          });
          draft.relationships.push({
            id: uniqueRelationshipId(draft, `rel-${id}-member-of-${parentOrgId}`),
            subjectType: "user",
            subjectId: id,
            relation: "member_of",
            objectType: "org",
            objectId: parentOrgId
          });
          appendAudit(
            draft,
            getEffectiveUserId(state),
            `Created user ${displayName} in ${getEntityLabel(draft, { type: "org", id: parentOrgId })}.`,
            "identity.created",
            "user",
            id
          );
        },
        { pendingDelete: undefined, pendingRename: { type: "user", id, value: displayName } }
      );
    }),

  startRenameIdentity: (sourceKey) =>
    set((state) => {
      const source = parseIdentityKey(sourceKey);
      if (!source) {
        return {};
      }

      const scenario = getScenarioFromState(state);
      if (source.type === "org") {
        const org = scenario.orgs.find((candidate) => candidate.id === source.id);
        return org ? { pendingDelete: undefined, pendingRename: { type: "org", id: org.id, value: org.name } } : {};
      }

      const user = scenario.users.find((candidate) => candidate.id === source.id);
      return user ? { pendingDelete: undefined, pendingRename: { type: "user", id: user.id, value: user.displayName } } : {};
    }),

  commitRenameIdentity: () =>
    set((state) => {
      const rename = state.pendingRename;
      const name = rename?.value.trim();
      if (!rename || !name) {
        return {};
      }

      const scenario = getScenarioFromState(state);
      if (rename.type === "org") {
        const org = scenario.orgs.find((candidate) => candidate.id === rename.id);
        if (!org || org.name === name) {
          return { pendingRename: undefined };
        }
      } else {
        const user = scenario.users.find((candidate) => candidate.id === rename.id);
        if (!user || user.displayName === name) {
          return { pendingRename: undefined };
        }
      }

      return updateScenarioState(
        state,
        (draft) => {
          if (rename.type === "org") {
            const org = draft.orgs.find((candidate) => candidate.id === rename.id);
            if (!org || org.name === name) {
              return;
            }
            const previousName = org.name;
            org.name = name;
            org.abbreviation = abbreviation(name);
            appendAudit(draft, getEffectiveUserId(state), `Renamed org ${previousName} to ${name}.`, "org.updated", "org", org.id);
            return;
          }

          const user = draft.users.find((candidate) => candidate.id === rename.id);
          if (!user || user.displayName === name) {
            return;
          }
          const previousName = user.displayName;
          user.displayName = name;
          appendAudit(draft, getEffectiveUserId(state), `Renamed user ${previousName} to ${name}.`, "identity.updated", "user", user.id);
        },
        { pendingRename: undefined }
      );
    }),

  updateTaskStatus: (task, status) =>
    set((state) =>
      updateScenarioState(state, (draft) => {
        const editableTask = draft.tasks.find((candidate) => candidate.id === task.id);
        if (!editableTask) {
          return;
        }

        editableTask.status = status;
        editableTask.updatedAt = new Date().toISOString();
        appendAudit(draft, getEffectiveUserId(state), `Updated ${task.title} to ${status}.`, "task.updated", "task", task.id);
      })
    )
}));

function getScenarioFromState(state: Pick<WorkbenchState, "scenarios" | "selectedScenarioId">): Scenario {
  return state.scenarios.find((candidate) => candidate.id === state.selectedScenarioId) ?? state.scenarios[0] ?? cloneScenario(seedScenario);
}

export function selectCurrentScenario(state: Pick<WorkbenchState, "scenarios" | "selectedScenarioId">): Scenario {
  return getScenarioFromState(state);
}

function getEffectiveUserId(state: Pick<WorkbenchState, "scenarios" | "selectedScenarioId" | "currentUserId">): string {
  const scenario = getScenarioFromState(state);
  return scenario.users.find((user) => user.id === state.currentUserId)?.id ?? scenario.users[0]?.id ?? "";
}

function updateScenarioState(state: WorkbenchState, mutator: (draft: Scenario) => void, extraState: Partial<WorkbenchState> = {}): Partial<WorkbenchState> {
  const scenario = getScenarioFromState(state);
  return {
    scenarios: state.scenarios.map((item) => {
      if (item.id !== scenario.id) {
        return item;
      }

      const draft = cloneScenario(item);
      mutator(draft);
      return draft;
    }),
    saveState: "Saving changes",
    ...extraState
  };
}

function appendAudit(
  draft: Scenario,
  effectiveUserId: string,
  summary: string,
  action: Parameters<typeof buildAuditEvent>[0]["action"],
  targetType: EntityType,
  targetId: string
) {
  draft.auditEvents.unshift(
    buildAuditEvent({
      action,
      actorUserId: effectiveUserId || undefined,
      effectiveUserId: effectiveUserId || undefined,
      target: { type: targetType, id: targetId },
      summary
    })
  );
}

export function parseIdentityKey(key: string): ParsedIdentityKey | undefined {
  const value = String(key);
  if (value.startsWith("org:")) {
    return { type: "org", id: value.slice(4) };
  }
  if (value.startsWith("user:")) {
    return { type: "user", id: value.slice(5) };
  }
  return undefined;
}

export function getUserOrgId(scenario: Scenario, user: User): string | undefined {
  return (
    scenario.relationships.find(
      (relationship) =>
        relationship.subjectType === "user" &&
        relationship.subjectId === user.id &&
        relationship.relation === "member_of" &&
        relationship.objectType === "org"
    )?.objectId ?? user.primaryOrgId
  );
}

function getUserParentOrgId(scenario: Scenario, userId: string): string | undefined {
  const user = scenario.users.find((candidate) => candidate.id === userId);
  return user ? getUserOrgId(scenario, user) : undefined;
}

export function getIdentityMoveTargets(scenario: Scenario, item: { type: "org"; org: Org } | { type: "user"; user: User }): Org[] {
  const orgs = uniqueById(scenario.orgs);

  if (item.type === "user") {
    const currentOrgId = getUserOrgId(scenario, item.user);
    return orgs.filter((org) => org.id !== currentOrgId);
  }

  return orgs.filter((org) => org.id !== item.org.id && org.id !== item.org.parentOrgId && !isDescendantOrg(scenario, item.org.id, org.id));
}

export function firstRelationshipDraft(scenario: Scenario): RelationshipDraft {
  return {
    subjectType: "task",
    subjectId: firstEntityId(scenario, "task"),
    relation: "viewer",
    objectType: "user",
    objectId: firstEntityId(scenario, "user")
  };
}

export function firstBuilderDraft(scenario: Scenario): BuilderDraft {
  return {
    taskTitle: "",
    taskType: "task",
    taskOwnerOrgId: scenario.orgs[0]?.id ?? "",
    taskParentId: ""
  };
}

export function firstEntityId(scenario: Scenario, type: EntityType): string {
  return entityOptions(scenario, type)[0]?.id ?? "";
}

export function entityOptions(scenario: Scenario, type: EntityType): EntityOption[] {
  switch (type) {
    case "user":
      return scenario.users.map((user) => ({ id: user.id, label: user.displayName }));
    case "org":
      return scenario.orgs.map((org) => ({ id: org.id, label: org.abbreviation ?? org.name }));
    case "group":
      return scenario.groups.map((group) => ({ id: group.id, label: group.name }));
    case "task":
      return scenario.tasks.map((task) => ({ id: task.id, label: task.title }));
    case "resource":
      return scenario.resources.map((resource) => ({ id: resource.id, label: resource.title }));
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function uniqueId(prefix: string, label: string, existingIds: string[]): string {
  const base = `${prefix}-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  let candidate = base || `${prefix}-${crypto.randomUUID()}`;
  let index = 2;

  while (existingIds.includes(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function nextPlaceholderName(base: string, existingNames: string[]): string {
  if (!existingNames.includes(base)) {
    return base;
  }

  let index = 2;
  let candidate = `${base} ${index}`;
  while (existingNames.includes(candidate)) {
    index += 1;
    candidate = `${base} ${index}`;
  }
  return candidate;
}

function uniqueRelationshipId(scenario: Scenario, base: string): string {
  if (!scenario.relationships.some((relationship) => relationship.id === base)) {
    return base;
  }

  return uniqueId("rel", base.replace(/^rel-/, ""), scenario.relationships.map((relationship) => relationship.id));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function isDescendantOrg(scenario: Scenario, ancestorOrgId: string, orgId: string): boolean {
  let candidate = scenario.orgs.find((org) => org.id === orgId);
  const seen = new Set<string>();

  while (candidate?.parentOrgId && !seen.has(candidate.id)) {
    if (candidate.parentOrgId === ancestorOrgId) {
      return true;
    }
    seen.add(candidate.id);
    candidate = scenario.orgs.find((org) => org.id === candidate?.parentOrgId);
  }

  return false;
}

function abbreviation(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

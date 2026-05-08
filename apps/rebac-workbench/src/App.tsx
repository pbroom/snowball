import { LocalAuthorizationService, formatPathSteps, type AuthzResult, type ResourceType } from "@snowball/authz-core";
import {
  buildAuditEvent,
  cloneScenario,
  loadScenarios,
  saveScenarios,
  seedScenario,
  validateScenario
} from "@snowball/scenario-store";
import {
  PERMISSIONS,
  getEntityLabel,
  type EntityType,
  type Permission,
  type Relationship,
  type RelationshipRelation,
  type Scenario,
  type Task,
  type TaskStatus,
  type User
} from "@snowball/task-core";
import { useMemo, useState, type FormEvent } from "react";

const authz = new LocalAuthorizationService();

const ENTITY_TYPES: readonly EntityType[] = ["user", "org", "group", "task", "resource"] as const;
const RELATIONS: readonly RelationshipRelation[] = [
  "member_of",
  "child_of",
  "owned_by",
  "assigned_to",
  "created_by",
  "participant",
  "viewer",
  "editor",
  "manager",
  "parent",
  "inherits_access_from",
  "contains",
  "restricted_to"
] as const;
const TASK_STATUSES: readonly TaskStatus[] = ["open", "in_progress", "blocked", "done"] as const;

type EntityOption = {
  id: string;
  label: string;
};

type RelationshipDraft = {
  subjectType: EntityType;
  subjectId: string;
  relation: RelationshipRelation;
  objectType: EntityType;
  objectId: string;
};

type BuilderDraft = {
  orgName: string;
  orgParentId: string;
  userName: string;
  userOrgId: string;
  taskTitle: string;
  taskType: string;
  taskOwnerOrgId: string;
  taskParentId: string;
};

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => loadScenarios());
  const [selectedScenarioId, setSelectedScenarioId] = useState(() => scenarios[0]?.id ?? seedScenario.id);
  const scenario = scenarios.find((candidate) => candidate.id === selectedScenarioId) ?? scenarios[0] ?? cloneScenario(seedScenario);
  const [currentUserId, setCurrentUserId] = useState(() => scenario.users[0]?.id ?? "");
  const currentUser = scenario.users.find((user) => user.id === currentUserId) ?? scenario.users[0];
  const effectiveUserId = currentUser?.id ?? "";
  const visibleTasks = useMemo(
    () => (effectiveUserId ? authz.listVisibleTasks({ scenario, userId: effectiveUserId }) : []),
    [effectiveUserId, scenario]
  );
  const [selectedTaskId, setSelectedTaskId] = useState(() => scenario.tasks[0]?.id ?? "");
  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? scenario.tasks[0];
  const [selectedPermission, setSelectedPermission] = useState<Permission>("task.view");
  const [relationshipDraft, setRelationshipDraft] = useState<RelationshipDraft>(() => firstRelationshipDraft(scenario));
  const [builderDraft, setBuilderDraft] = useState<BuilderDraft>(() => firstBuilderDraft(scenario));
  const [saveState, setSaveState] = useState("Not saved this session");
  const validationIssues = useMemo(() => validateScenario(scenario), [scenario]);

  const selectedResourceType: ResourceType = selectedPermission.startsWith("resource.") ? "resource" : "task";
  const selectedResourceId =
    selectedResourceType === "task"
      ? selectedTask?.id ?? ""
      : scenario.resources.find((resource) => resource.taskId === selectedTask?.id)?.id ?? "";
  const decision = useMemo<AuthzResult | undefined>(() => {
    if (!effectiveUserId || !selectedResourceId) {
      return undefined;
    }

    return authz.explain({
      scenario,
      userId: effectiveUserId,
      permission: selectedPermission,
      resourceType: selectedResourceType,
      resourceId: selectedResourceId
    });
  }, [effectiveUserId, scenario, selectedPermission, selectedResourceId, selectedResourceType]);
  const selectedTaskResources = selectedTask
    ? authz.listVisibleResources({ scenario, userId: effectiveUserId, taskId: selectedTask.id })
    : [];
  const permissionsForTask =
    selectedTask && effectiveUserId
      ? authz.listPermissions({ scenario, userId: effectiveUserId, resourceType: "task", resourceId: selectedTask.id })
      : [];

  function updateScenario(mutator: (draft: Scenario) => void) {
    setScenarios((current) =>
      current.map((item) => {
        if (item.id !== scenario.id) {
          return item;
        }

        const draft = cloneScenario(item);
        mutator(draft);
        return draft;
      })
    );
    setSaveState("Unsaved changes");
  }

  function appendAudit(draft: Scenario, summary: string, action: Parameters<typeof buildAuditEvent>[0]["action"], targetType: EntityType, targetId: string) {
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

  function selectUser(user: User) {
    setCurrentUserId(user.id);
    updateScenario((draft) => {
      appendAudit(draft, `Workbench switched to ${user.displayName}.`, "user.switched", "user", user.id);
    });
  }

  function addOrg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = builderDraft.orgName.trim();
    if (!name) {
      return;
    }

    const id = uniqueId("org", name, scenario.orgs.map((org) => org.id));
    updateScenario((draft) => {
      draft.orgs.push({
        id,
        name,
        abbreviation: abbreviation(name),
        parentOrgId: builderDraft.orgParentId || undefined
      });
      if (builderDraft.orgParentId) {
        draft.relationships.push({
          id: `rel-${id}-child-of-${builderDraft.orgParentId}`,
          subjectType: "org",
          subjectId: id,
          relation: "child_of",
          objectType: "org",
          objectId: builderDraft.orgParentId
        });
      }
      appendAudit(draft, `Created org ${name}.`, "org.created", "org", id);
    });
    setBuilderDraft((draft) => ({ ...draft, orgName: "" }));
  }

  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = builderDraft.userName.trim();
    if (!displayName || !builderDraft.userOrgId) {
      return;
    }

    const id = uniqueId("user", displayName, scenario.users.map((user) => user.id));
    updateScenario((draft) => {
      draft.users.push({
        id,
        displayName,
        primaryOrgId: builderDraft.userOrgId
      });
      draft.relationships.push({
        id: `rel-${id}-member-of-${builderDraft.userOrgId}`,
        subjectType: "user",
        subjectId: id,
        relation: "member_of",
        objectType: "org",
        objectId: builderDraft.userOrgId
      });
      appendAudit(draft, `Created user ${displayName}.`, "identity.created", "user", id);
    });
    setBuilderDraft((draft) => ({ ...draft, userName: "" }));
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = builderDraft.taskTitle.trim();
    const type = builderDraft.taskType.trim() || "task";
    if (!title || !builderDraft.taskOwnerOrgId || !effectiveUserId) {
      return;
    }

    const id = uniqueId("task", title, scenario.tasks.map((task) => task.id));
    updateScenario((draft) => {
      const now = new Date().toISOString();
      draft.tasks.push({
        id,
        type,
        title,
        parentTaskId: builderDraft.taskParentId || undefined,
        owningOrgId: builderDraft.taskOwnerOrgId,
        createdByUserId: effectiveUserId,
        status: "open",
        createdAt: now,
        updatedAt: now
      });
      draft.relationships.push({
        id: `rel-${id}-owned-by-${builderDraft.taskOwnerOrgId}`,
        subjectType: "task",
        subjectId: id,
        relation: "owned_by",
        objectType: "org",
        objectId: builderDraft.taskOwnerOrgId
      });
      if (builderDraft.taskParentId) {
        draft.relationships.push({
          id: `rel-${id}-parent-${builderDraft.taskParentId}`,
          subjectType: "task",
          subjectId: id,
          relation: "parent",
          objectType: "task",
          objectId: builderDraft.taskParentId
        });
      }
      appendAudit(draft, `Created task ${title}.`, "task.created", "task", id);
    });
    setSelectedTaskId(id);
    setBuilderDraft((draft) => ({ ...draft, taskTitle: "" }));
  }

  function addRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!relationshipDraft.subjectId || !relationshipDraft.objectId) {
      return;
    }

    const id = uniqueId(
      "rel",
      `${relationshipDraft.subjectId}-${relationshipDraft.relation}-${relationshipDraft.objectId}`,
      scenario.relationships.map((relationshipItem) => relationshipItem.id)
    );
    updateScenario((draft) => {
      draft.relationships.push({ id, ...relationshipDraft });
      appendAudit(
        draft,
        `Created relationship ${relationshipDraft.subjectId} ${relationshipDraft.relation} ${relationshipDraft.objectId}.`,
        "relationship.created",
        relationshipDraft.subjectType,
        relationshipDraft.subjectId
      );
    });
  }

  function deleteRelationship(relationship: Relationship) {
    updateScenario((draft) => {
      draft.relationships = draft.relationships.filter((candidate) => candidate.id !== relationship.id);
      appendAudit(draft, `Deleted relationship ${relationship.id}.`, "relationship.deleted", relationship.subjectType, relationship.subjectId);
    });
  }

  function deleteUser(userId: string) {
    updateScenario((draft) => {
      draft.users = draft.users.filter((user) => user.id !== userId);
      draft.relationships = draft.relationships.filter(
        (relationshipItem) =>
          !(relationshipItem.subjectType === "user" && relationshipItem.subjectId === userId) &&
          !(relationshipItem.objectType === "user" && relationshipItem.objectId === userId)
      );
      appendAudit(draft, `Deleted user ${userId}.`, "identity.deleted", "user", userId);
    });
    if (currentUserId === userId) {
      setCurrentUserId(scenario.users.find((user) => user.id !== userId)?.id ?? "");
    }
  }

  function deleteOrg(orgId: string) {
    updateScenario((draft) => {
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
      appendAudit(draft, `Deleted org ${orgId}.`, "org.deleted", "org", orgId);
    });
  }

  function updateTaskStatus(task: Task, status: TaskStatus) {
    updateScenario((draft) => {
      const editableTask = draft.tasks.find((candidate) => candidate.id === task.id);
      if (!editableTask) {
        return;
      }

      editableTask.status = status;
      editableTask.updatedAt = new Date().toISOString();
      appendAudit(draft, `Updated ${task.title} to ${status}.`, "task.updated", "task", task.id);
    });
  }

  function saveCurrentScenarios() {
    saveScenarios(scenarios);
    setSaveState(`Saved ${new Date().toLocaleTimeString()}`);
  }

  function resetSeedScenario() {
    const fresh = cloneScenario(seedScenario);
    setScenarios([fresh]);
    setSelectedScenarioId(fresh.id);
    setCurrentUserId(fresh.users[0]?.id ?? "");
    setSelectedTaskId(fresh.tasks[0]?.id ?? "");
    setRelationshipDraft(firstRelationshipDraft(fresh));
    setBuilderDraft(firstBuilderDraft(fresh));
    setSaveState("Reset to seed; save to persist");
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Task primitive milestone 1</p>
          <h1>Boring task shell, explainable access graph.</h1>
          <p className="lede">
            Build tiny org worlds, switch users instantly, edit relationship edges, and inspect what the current user can see.
          </p>
        </div>
        <div className="hero-actions">
          <select
            aria-label="Scenario"
            value={scenario.id}
            onChange={(event) => setSelectedScenarioId(event.target.value)}
          >
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={saveCurrentScenarios}>
            Save
          </button>
          <button type="button" className="secondary" onClick={resetSeedScenario}>
            Reset
          </button>
          <span className="save-state">{saveState}</span>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="panel identity-panel" aria-label="Organizations and users">
          <PanelHeading eyebrow="Identity graph" title="Orgs and users" />
          <OrgTree
            scenario={scenario}
            currentUserId={effectiveUserId}
            onSelectUser={selectUser}
            onDeleteUser={deleteUser}
            onDeleteOrg={deleteOrg}
          />
        </aside>

        <section className="panel builder-panel" aria-label="Scenario builders">
          <PanelHeading eyebrow="Create" title="Minimal primitives" />
          <div className="builder-grid">
            <form onSubmit={addOrg} className="mini-form">
              <label>
                Org name
                <input
                  value={builderDraft.orgName}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, orgName: event.target.value }))}
                  placeholder="Policy Team"
                />
              </label>
              <label>
                Parent org
                <select
                  value={builderDraft.orgParentId}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, orgParentId: event.target.value }))}
                >
                  <option value="">No parent</option>
                  {scenario.orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.abbreviation ?? org.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Add org</button>
            </form>

            <form onSubmit={addUser} className="mini-form">
              <label>
                User name
                <input
                  value={builderDraft.userName}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, userName: event.target.value }))}
                  placeholder="Jordan Smith"
                />
              </label>
              <label>
                Member of
                <select
                  value={builderDraft.userOrgId}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, userOrgId: event.target.value }))}
                >
                  {scenario.orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.abbreviation ?? org.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Add user</button>
            </form>

            <form onSubmit={addTask} className="mini-form">
              <label>
                Task title
                <input
                  value={builderDraft.taskTitle}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, taskTitle: event.target.value }))}
                  placeholder="Draft API shell"
                />
              </label>
              <label>
                Type
                <input
                  value={builderDraft.taskType}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, taskType: event.target.value }))}
                  placeholder="task"
                />
              </label>
              <label>
                Owning org
                <select
                  value={builderDraft.taskOwnerOrgId}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, taskOwnerOrgId: event.target.value }))}
                >
                  {scenario.orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.abbreviation ?? org.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Parent task
                <select
                  value={builderDraft.taskParentId}
                  onChange={(event) => setBuilderDraft((draft) => ({ ...draft, taskParentId: event.target.value }))}
                >
                  <option value="">No parent</option>
                  {scenario.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Add task</button>
            </form>
          </div>
        </section>

        <section className="panel app-panel" aria-label="Authenticated task view">
          <PanelHeading
            eyebrow="Authenticated view"
            title={currentUser ? currentUser.displayName : "No user selected"}
            detail={currentUser?.title}
          />
          <div className="task-list">
            {visibleTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={task.id === selectedTask?.id ? "task-card selected" : "task-card"}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <span className="task-type">{task.type}</span>
                <strong>{task.title}</strong>
                <span>{task.status.replace("_", " ")}</span>
              </button>
            ))}
            {visibleTasks.length === 0 ? <p className="empty-state">This user has no visible tasks yet.</p> : null}
          </div>
        </section>

        <section className="panel config-panel" aria-label="ReBAC configuration">
          <PanelHeading eyebrow="ReBAC config" title="Relationship edges" />
          <form onSubmit={addRelationship} className="relationship-form">
            <EntityPicker
              label="Subject"
              scenario={scenario}
              type={relationshipDraft.subjectType}
              id={relationshipDraft.subjectId}
              onTypeChange={(type) =>
                setRelationshipDraft((draft) => ({
                  ...draft,
                  subjectType: type,
                  subjectId: firstEntityId(scenario, type)
                }))
              }
              onIdChange={(id) => setRelationshipDraft((draft) => ({ ...draft, subjectId: id }))}
            />
            <label>
              Relation
              <select
                value={relationshipDraft.relation}
                onChange={(event) =>
                  setRelationshipDraft((draft) => ({ ...draft, relation: event.target.value as RelationshipRelation }))
                }
              >
                {RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>
            </label>
            <EntityPicker
              label="Object"
              scenario={scenario}
              type={relationshipDraft.objectType}
              id={relationshipDraft.objectId}
              onTypeChange={(type) =>
                setRelationshipDraft((draft) => ({
                  ...draft,
                  objectType: type,
                  objectId: firstEntityId(scenario, type)
                }))
              }
              onIdChange={(id) => setRelationshipDraft((draft) => ({ ...draft, objectId: id }))}
            />
            <button type="submit">Add edge</button>
          </form>
          <div className="relationship-list">
            {scenario.relationships.map((relationship) => (
              <div key={relationship.id} className="relationship-row">
                <span>
                  {getEntityLabel(scenario, { type: relationship.subjectType, id: relationship.subjectId })}{" "}
                  <strong>{relationship.relation}</strong>{" "}
                  {getEntityLabel(scenario, { type: relationship.objectType, id: relationship.objectId })}
                </span>
                <button type="button" className="ghost" onClick={() => deleteRelationship(relationship)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel inspector-panel" aria-label="Task and authorization inspector">
          <PanelHeading eyebrow="Inspector" title={selectedTask?.title ?? "No task selected"} detail={selectedTask?.type} />
          {selectedTask ? (
            <>
              <div className="task-detail-grid">
                <label>
                  Status
                  <select value={selectedTask.status} onChange={(event) => updateTaskStatus(selectedTask, event.target.value as TaskStatus)}>
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="meta-label">Allowed task permissions</span>
                  <div className="pill-row">
                    {permissionsForTask.map((permission) => (
                      <span key={permission} className="pill">
                        {permission}
                      </span>
                    ))}
                    {permissionsForTask.length === 0 ? <span className="muted">None</span> : null}
                  </div>
                </div>
              </div>

              <div className="resource-section">
                <h3>Visible resources</h3>
                {selectedTaskResources.map((resource) => (
                  <div key={resource.id} className="resource-row">
                    <span>{resource.kind}</span>
                    <strong>{resource.title}</strong>
                  </div>
                ))}
                {selectedTaskResources.length === 0 ? <p className="empty-state">No visible resources for this user.</p> : null}
              </div>

              <div className="decision-card">
                <label>
                  Explain permission
                  <select value={selectedPermission} onChange={(event) => setSelectedPermission(event.target.value as Permission)}>
                    {PERMISSIONS.map((permission) => (
                      <option key={permission} value={permission}>
                        {permission}
                      </option>
                    ))}
                  </select>
                </label>
                {decision ? <DecisionView scenario={scenario} decision={decision} /> : <p className="empty-state">Pick a user and task.</p>}
              </div>
            </>
          ) : (
            <p className="empty-state">No task exists in this scenario.</p>
          )}
        </section>

        <section className="panel audit-panel" aria-label="Audit log">
          <PanelHeading eyebrow="Audit" title="Append-only history" />
          {validationIssues.length > 0 ? (
            <div className="validation-box">
              {validationIssues.map((issue) => (
                <p key={issue.message}>{issue.message}</p>
              ))}
            </div>
          ) : null}
          <div className="audit-list">
            {scenario.auditEvents.slice(0, 12).map((event) => (
              <article key={event.id} className="audit-event">
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                <strong>{event.action}</strong>
                <p>{event.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function PanelHeading(props: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="panel-heading">
      <p className="eyebrow">{props.eyebrow}</p>
      <h2>{props.title}</h2>
      {props.detail ? <span>{props.detail}</span> : null}
    </div>
  );
}

function OrgTree(props: {
  scenario: Scenario;
  currentUserId: string;
  onSelectUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onDeleteOrg: (orgId: string) => void;
}) {
  const rootOrgs = props.scenario.orgs.filter((org) => !org.parentOrgId);

  return (
    <div className="org-tree">
      {rootOrgs.map((org) => (
        <OrgNode key={org.id} orgId={org.id} depth={0} {...props} />
      ))}
    </div>
  );
}

function OrgNode(props: {
  scenario: Scenario;
  currentUserId: string;
  orgId: string;
  depth: number;
  onSelectUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onDeleteOrg: (orgId: string) => void;
}) {
  const org = props.scenario.orgs.find((candidate) => candidate.id === props.orgId);
  if (!org) {
    return null;
  }

  const children = props.scenario.orgs.filter((candidate) => candidate.parentOrgId === org.id);
  const users = props.scenario.users.filter((user) =>
    props.scenario.relationships.some(
      (relationship) =>
        relationship.subjectType === "user" &&
        relationship.subjectId === user.id &&
        relationship.relation === "member_of" &&
        relationship.objectType === "org" &&
        relationship.objectId === org.id
    )
  );
  const hasTaskDependency = props.scenario.tasks.some((task) => task.owningOrgId === org.id);

  return (
    <div className="org-node" style={{ marginLeft: props.depth * 14 }}>
      <div className="org-row">
        <strong>{org.abbreviation ?? org.name}</strong>
        <button type="button" className="ghost" disabled={hasTaskDependency} onClick={() => props.onDeleteOrg(org.id)}>
          Delete
        </button>
      </div>
      {users.map((user) => (
        <div key={user.id} className="user-row">
          <button
            type="button"
            className={user.id === props.currentUserId ? "user-button selected" : "user-button"}
            onClick={() => props.onSelectUser(user)}
          >
            {user.displayName}
          </button>
          <button type="button" className="ghost" onClick={() => props.onDeleteUser(user.id)}>
            Delete
          </button>
        </div>
      ))}
      {children.map((child) => (
        <OrgNode key={child.id} {...props} orgId={child.id} depth={props.depth + 1} />
      ))}
    </div>
  );
}

function EntityPicker(props: {
  label: string;
  scenario: Scenario;
  type: EntityType;
  id: string;
  onTypeChange: (type: EntityType) => void;
  onIdChange: (id: string) => void;
}) {
  const options = entityOptions(props.scenario, props.type);

  return (
    <div className="entity-picker">
      <label>
        {props.label} type
        <select value={props.type} onChange={(event) => props.onTypeChange(event.target.value as EntityType)}>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        {props.label}
        <select value={props.id} onChange={(event) => props.onIdChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function DecisionView(props: { scenario: Scenario; decision: AuthzResult }) {
  const path = formatPathSteps(props.scenario, props.decision.path);

  return (
    <div className={props.decision.allowed ? "decision allowed" : "decision denied"}>
      <strong>{props.decision.allowed ? "Allowed" : "Denied"}</strong>
      <p>{props.decision.reason}</p>
      {path.length > 0 ? (
        <ol>
          {path.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function firstRelationshipDraft(scenario: Scenario): RelationshipDraft {
  return {
    subjectType: "task",
    subjectId: firstEntityId(scenario, "task"),
    relation: "viewer",
    objectType: "user",
    objectId: firstEntityId(scenario, "user")
  };
}

function firstBuilderDraft(scenario: Scenario): BuilderDraft {
  return {
    orgName: "",
    orgParentId: scenario.orgs[0]?.id ?? "",
    userName: "",
    userOrgId: scenario.orgs[0]?.id ?? "",
    taskTitle: "",
    taskType: "task",
    taskOwnerOrgId: scenario.orgs[0]?.id ?? "",
    taskParentId: ""
  };
}

function firstEntityId(scenario: Scenario, type: EntityType): string {
  return entityOptions(scenario, type)[0]?.id ?? "";
}

function entityOptions(scenario: Scenario, type: EntityType): EntityOption[] {
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

function abbreviation(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileJson,
  GitBranch,
  KeyRound,
  Plus,
  RotateCcw,
  Save,
  ShieldQuestion,
  Trash2,
  Upload,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  LocalAuthorizationService,
  formatPath,
  type AuthzResult
} from "@snowball/authz-core";
import {
  TASK_PERMISSIONS,
  getEntityLabel,
  type EntityType,
  type Relationship,
  type RelationshipRelation,
  type Scenario,
  type Task
} from "@snowball/task-core";
import {
  cloneScenario,
  createEmptyScenario,
  exportScenario,
  importScenario,
  loadScenarios,
  saveScenarios,
  seedScenario,
  validateScenario
} from "@snowball/scenario-store";

const authz = new LocalAuthorizationService();

const taskTypeOptions: Task["taskType"][] = [
  "package_submission",
  "clearance",
  "approval",
  "trip",
  "trip_stop",
  "event",
  "records_review"
];

const taskStatusOptions: Task["status"][] = ["draft", "assigned", "in_review", "blocked", "complete"];

const entityTypes: EntityType[] = ["user", "org", "group", "task", "artifact", "note"];

const relationshipOptions: RelationshipRelation[] = [
  "member_of",
  "child_of",
  "owned_by",
  "assigned_to",
  "created_by",
  "participant",
  "viewer",
  "editor",
  "approver",
  "parent",
  "inherits_access_from",
  "restricted_to"
];

interface DraftRelationship {
  subjectType: EntityType;
  subjectId: string;
  relation: RelationshipRelation;
  objectType: EntityType;
  objectId: string;
}

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => loadScenarios());
  const [activeScenarioId, setActiveScenarioId] = useState(() => scenarios[0]?.id ?? seedScenario.id);
  const [selectedUserId, setSelectedUserId] = useState(() => scenarios[0]?.users[0]?.id ?? "");
  const [selectedTaskId, setSelectedTaskId] = useState(() => scenarios[0]?.tasks[0]?.id ?? "");
  const [selectedOrgId, setSelectedOrgId] = useState(() => scenarios[0]?.orgs[0]?.id ?? "");
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState("");
  const [message, setMessage] = useState("Loaded seed scenario.");

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? cloneScenario(seedScenario);
  const selectedUser = activeScenario.users.find((user) => user.id === selectedUserId) ?? activeScenario.users[0];
  const rawSelectedTask = activeScenario.tasks.find((task) => task.id === selectedTaskId) ?? activeScenario.tasks[0];
  const validationIssues = useMemo(() => validateScenario(activeScenario), [activeScenario]);

  const visibleTasks = useMemo(() => {
    if (!selectedUser) {
      return [];
    }

    return authz.listVisibleTasks({ scenario: activeScenario, userId: selectedUser.id });
  }, [activeScenario, selectedUser]);

  const selectedTask = visibleTasks.some((task) => task.id === rawSelectedTask?.id) ? rawSelectedTask : visibleTasks[0];

  const permissionResults = useMemo(() => {
    if (!selectedUser || !selectedTask) {
      return [];
    }

    return TASK_PERMISSIONS.map((permission) =>
      authz.explain({
        scenario: activeScenario,
        userId: selectedUser.id,
        permission,
        resourceType: "task",
        resourceId: selectedTask.id
      })
    );
  }, [activeScenario, selectedTask, selectedUser]);

  function updateActiveScenario(updater: (scenario: Scenario) => Scenario) {
    setScenarios((currentScenarios) =>
      currentScenarios.map((scenario) => (scenario.id === activeScenario.id ? updater(cloneScenario(scenario)) : scenario))
    );
  }

  function persistScenarios(nextScenarios = scenarios) {
    saveScenarios(nextScenarios);
    setMessage("Scenario saved to local browser storage.");
  }

  function handleScenarioChange(scenarioId: string) {
    const nextScenario = scenarios.find((scenario) => scenario.id === scenarioId);
    if (!nextScenario) {
      return;
    }

    setActiveScenarioId(nextScenario.id);
    setSelectedUserId(nextScenario.users[0]?.id ?? "");
    setSelectedTaskId(nextScenario.tasks[0]?.id ?? "");
    setSelectedOrgId(nextScenario.orgs[0]?.id ?? "");
    setMessage(`Switched to ${nextScenario.name}.`);
  }

  function createScenario() {
    const nextScenario = createEmptyScenario();
    const nextScenarios = [...scenarios, nextScenario];
    setScenarios(nextScenarios);
    setActiveScenarioId(nextScenario.id);
    setSelectedUserId("");
    setSelectedTaskId("");
    setSelectedOrgId("");
    persistScenarios(nextScenarios);
  }

  function duplicateScenario() {
    const duplicate = {
      ...cloneScenario(activeScenario),
      id: `scenario-${crypto.randomUUID()}`,
      name: `${activeScenario.name} Copy`
    };
    const nextScenarios = [...scenarios, duplicate];
    setScenarios(nextScenarios);
    setActiveScenarioId(duplicate.id);
    persistScenarios(nextScenarios);
  }

  function resetScenario() {
    const nextScenarios = scenarios.map((scenario) =>
      scenario.id === activeScenario.id ? cloneScenario(seedScenario) : scenario
    );
    setScenarios(nextScenarios);
    setActiveScenarioId(seedScenario.id);
    setSelectedUserId(seedScenario.users[0]?.id ?? "");
    setSelectedTaskId(seedScenario.tasks[0]?.id ?? "");
    setSelectedOrgId(seedScenario.orgs[0]?.id ?? "");
    persistScenarios(nextScenarios);
  }

  function handleExport() {
    setExportText(exportScenario(activeScenario));
    setMessage("Scenario exported as JSON.");
  }

  function handleImport() {
    try {
      const imported = importScenario(importText);
      const scenario = { ...imported, id: imported.id || `scenario-${crypto.randomUUID()}` };
      const nextScenarios = [...scenarios.filter((candidate) => candidate.id !== scenario.id), scenario];
      setScenarios(nextScenarios);
      setActiveScenarioId(scenario.id);
      setSelectedUserId(scenario.users[0]?.id ?? "");
      setSelectedTaskId(scenario.tasks[0]?.id ?? "");
      setSelectedOrgId(scenario.orgs[0]?.id ?? "");
      persistScenarios(nextScenarios);
      setMessage(`Imported ${scenario.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  }

  function addUser() {
    const id = `user-${crypto.randomUUID()}`;
    updateActiveScenario((scenario) => ({
      ...scenario,
      users: [...scenario.users, { id, name: "New User", title: "Scenario user" }]
    }));
    setSelectedUserId(id);
  }

  function updateUser(userId: string, patch: Partial<Scenario["users"][number]>) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      users: scenario.users.map((user) => (user.id === userId ? { ...user, ...patch } : user))
    }));
  }

  function deleteUser(userId: string) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      users: scenario.users.filter((user) => user.id !== userId),
      relationships: scenario.relationships.filter(
        (relationship) =>
          !(relationship.subjectType === "user" && relationship.subjectId === userId) &&
          !(relationship.objectType === "user" && relationship.objectId === userId)
      )
    }));
    setSelectedUserId(activeScenario.users.find((user) => user.id !== userId)?.id ?? "");
  }

  function addOrg() {
    const id = `org-${crypto.randomUUID()}`;
    updateActiveScenario((scenario) => ({
      ...scenario,
      orgs: [...scenario.orgs, { id, name: "New Org", abbreviation: "ORG" }]
    }));
    setSelectedOrgId(id);
  }

  function updateOrg(orgId: string, patch: Partial<Scenario["orgs"][number]>) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      orgs: scenario.orgs.map((org) => (org.id === orgId ? { ...org, ...patch } : org))
    }));
  }

  function deleteOrg(orgId: string) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      orgs: scenario.orgs.filter((org) => org.id !== orgId),
      relationships: scenario.relationships.filter(
        (relationship) =>
          !(relationship.subjectType === "org" && relationship.subjectId === orgId) &&
          !(relationship.objectType === "org" && relationship.objectId === orgId)
      )
    }));
    setSelectedOrgId(activeScenario.orgs.find((org) => org.id !== orgId)?.id ?? "");
  }

  function addTask() {
    const firstOrgId = activeScenario.orgs[0]?.id ?? "";
    const firstUserId = activeScenario.users[0]?.id ?? "";
    const id = `task-${crypto.randomUUID()}`;
    updateActiveScenario((scenario) => ({
      ...scenario,
      tasks: [
        ...scenario.tasks,
        {
          id,
          title: "New Task",
          taskType: "package_submission",
          owningOrgId: firstOrgId,
          createdByUserId: firstUserId,
          status: "draft"
        }
      ]
    }));
    setSelectedTaskId(id);
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      tasks: scenario.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task))
    }));
  }

  function deleteTask(taskId: string) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      tasks: scenario.tasks.filter((task) => task.id !== taskId),
      relationships: scenario.relationships.filter(
        (relationship) =>
          !(relationship.subjectType === "task" && relationship.subjectId === taskId) &&
          !(relationship.objectType === "task" && relationship.objectId === taskId)
      )
    }));
    setSelectedTaskId(activeScenario.tasks.find((task) => task.id !== taskId)?.id ?? "");
  }

  function addRelationship(draft: DraftRelationship) {
    const relationship: Relationship = {
      id: `rel-${crypto.randomUUID()}`,
      ...draft
    };
    updateActiveScenario((scenario) => ({
      ...scenario,
      relationships: [...scenario.relationships, relationship]
    }));
  }

  function deleteRelationship(relationshipId: string) {
    updateActiveScenario((scenario) => ({
      ...scenario,
      relationships: scenario.relationships.filter((relationship) => relationship.id !== relationshipId)
    }));
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Authorization Workbench</p>
          <h1>ReBAC Task Workbench</h1>
        </div>
        <div className="scenario-controls" aria-label="Scenario controls">
          <label>
            Scenario
            <select value={activeScenario.id} onChange={(event) => handleScenarioChange(event.target.value)}>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={createScenario}>
            <Plus size={16} aria-hidden="true" />
            New
          </button>
          <button type="button" onClick={duplicateScenario}>
            <Copy size={16} aria-hidden="true" />
            Duplicate
          </button>
          <button type="button" onClick={() => persistScenarios()}>
            <Save size={16} aria-hidden="true" />
            Save
          </button>
          <button type="button" onClick={resetScenario}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <section className="status-strip" aria-live="polite">
        <span>{message}</span>
        <span>{activeScenario.policyVersion}</span>
        <span>{validationIssues.length === 0 ? "Scenario valid" : `${validationIssues.length} validation issue(s)`}</span>
      </section>

      <div className="workbench-grid">
        <aside className="left-panel" aria-label="Scenario directory">
          <DirectoryPanel
            scenario={activeScenario}
            selectedOrgId={selectedOrgId}
            selectedUserId={selectedUser?.id ?? ""}
            onSelectOrg={setSelectedOrgId}
            onSelectUser={setSelectedUserId}
          />
          <PolicySummary scenario={activeScenario} />
        </aside>

        <section className="main-panel" aria-label="Simulated application">
          <SimulatedAppView
            scenario={activeScenario}
            userId={selectedUser?.id ?? ""}
            selectedTaskId={selectedTask?.id ?? ""}
            visibleTasks={visibleTasks}
            permissionResults={permissionResults}
            onSelectTask={setSelectedTaskId}
          />
          <PermissionMatrix scenario={activeScenario} selectedTaskId={selectedTask?.id ?? ""} />
        </section>

        <aside className="right-panel" aria-label="Scenario editor">
          <ScenarioEditor
            scenario={activeScenario}
            selectedUserId={selectedUser?.id ?? ""}
            selectedOrgId={selectedOrgId}
            selectedTaskId={selectedTask?.id ?? ""}
            importText={importText}
            exportText={exportText}
            onScenarioPatch={(patch) => updateActiveScenario((scenario) => ({ ...scenario, ...patch }))}
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            onAddOrg={addOrg}
            onUpdateOrg={updateOrg}
            onDeleteOrg={deleteOrg}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onAddRelationship={addRelationship}
            onDeleteRelationship={deleteRelationship}
            onImportTextChange={setImportText}
            onExport={handleExport}
            onImport={handleImport}
          />
        </aside>
      </div>
    </main>
  );
}

interface DirectoryPanelProps {
  scenario: Scenario;
  selectedOrgId: string;
  selectedUserId: string;
  onSelectOrg: (orgId: string) => void;
  onSelectUser: (userId: string) => void;
}

function DirectoryPanel({ scenario, selectedOrgId, selectedUserId, onSelectOrg, onSelectUser }: DirectoryPanelProps) {
  const rootOrgs = scenario.orgs.filter((org) => !org.parentOrgId);

  return (
    <section className="card">
      <div className="card-heading">
        <GitBranch size={18} aria-hidden="true" />
        <h2>Org Tree</h2>
      </div>
      <div className="tree-list">
        {rootOrgs.map((org) => (
          <OrgNode
            key={org.id}
            scenario={scenario}
            orgId={org.id}
            selectedOrgId={selectedOrgId}
            onSelectOrg={onSelectOrg}
          />
        ))}
      </div>

      <div className="section-heading">
        <KeyRound size={16} aria-hidden="true" />
        <h3>Click User To Impersonate</h3>
      </div>
      <div className="identity-list">
        {scenario.users.map((user) => (
          <button
            key={user.id}
            type="button"
            className={user.id === selectedUserId ? "identity-item selected" : "identity-item"}
            onClick={() => onSelectUser(user.id)}
          >
            <span>{user.name}</span>
            <small>{user.title ?? "No title"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

interface OrgNodeProps {
  scenario: Scenario;
  orgId: string;
  selectedOrgId: string;
  onSelectOrg: (orgId: string) => void;
}

function OrgNode({ scenario, orgId, selectedOrgId, onSelectOrg }: OrgNodeProps) {
  const org = scenario.orgs.find((candidate) => candidate.id === orgId);
  if (!org) {
    return null;
  }

  const childOrgs = scenario.orgs.filter((candidate) => candidate.parentOrgId === org.id);

  return (
    <div className="tree-node">
      <button
        type="button"
        className={org.id === selectedOrgId ? "tree-button selected" : "tree-button"}
        onClick={() => onSelectOrg(org.id)}
      >
        {org.abbreviation ?? org.name}
      </button>
      {childOrgs.length > 0 ? (
        <div className="tree-children">
          {childOrgs.map((childOrg) => (
            <OrgNode
              key={childOrg.id}
              scenario={scenario}
              orgId={childOrg.id}
              selectedOrgId={selectedOrgId}
              onSelectOrg={onSelectOrg}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PolicySummary({ scenario }: { scenario: Scenario }) {
  return (
    <section className="card">
      <div className="card-heading">
        <ShieldQuestion size={18} aria-hidden="true" />
        <h2>Policy Summary</h2>
      </div>
      <ul className="rule-list">
        <li>View: creator, direct grants, owning org, assigned org, or explicit parent inheritance.</li>
        <li>Edit/manage: creator, direct editor, or owning org.</li>
        <li>Clear: membership in an assigned org.</li>
        <li>Approve: explicit approver or owning org.</li>
      </ul>
      <dl className="stats-grid">
        <div>
          <dt>Users</dt>
          <dd>{scenario.users.length}</dd>
        </div>
        <div>
          <dt>Orgs</dt>
          <dd>{scenario.orgs.length}</dd>
        </div>
        <div>
          <dt>Tasks</dt>
          <dd>{scenario.tasks.length}</dd>
        </div>
        <div>
          <dt>Relationships</dt>
          <dd>{scenario.relationships.length}</dd>
        </div>
      </dl>
    </section>
  );
}

interface SimulatedAppViewProps {
  scenario: Scenario;
  userId: string;
  selectedTaskId: string;
  visibleTasks: Task[];
  permissionResults: AuthzResult[];
  onSelectTask: (taskId: string) => void;
}

function SimulatedAppView({
  scenario,
  userId,
  selectedTaskId,
  visibleTasks,
  permissionResults,
  onSelectTask
}: SimulatedAppViewProps) {
  const user = scenario.users.find((candidate) => candidate.id === userId);
  const selectedTask = scenario.tasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0];
  const allowed = permissionResults.filter((result) => result.allowed);
  const denied = permissionResults.filter((result) => !result.allowed);

  return (
    <section className="card app-card">
      <div className="simulated-header">
        <div>
          <p className="eyebrow">Simulated Session</p>
          <h2>{user ? `Viewing as ${user.name}` : "No user selected"}</h2>
          <p>{user?.title ?? "Select a user from the directory to impersonate."}</p>
        </div>
        <span className="badge">Authenticated UI</span>
      </div>

      <div className="app-layout">
        <div>
          <h3>Visible Tasks</h3>
          <div className="task-list">
            {visibleTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={task.id === selectedTask?.id ? "task-item selected" : "task-item"}
                onClick={() => onSelectTask(task.id)}
              >
                <span>{task.title}</span>
                <small>
                  {task.taskType} · {task.status}
                </small>
              </button>
            ))}
            {visibleTasks.length === 0 ? <p className="empty-state">This user cannot see any tasks.</p> : null}
          </div>
        </div>

        <div className="task-detail">
          {selectedTask ? (
            <>
              <div className="detail-heading">
                <div>
                  <h3>{selectedTask.title}</h3>
                  <p>{selectedTask.description ?? "No description."}</p>
                </div>
                <span className="badge">{selectedTask.taskType}</span>
              </div>
              <dl className="metadata-grid">
                <div>
                  <dt>Owning Org</dt>
                  <dd>{getEntityLabel(scenario, { type: "org", id: selectedTask.owningOrgId })}</dd>
                </div>
                <div>
                  <dt>Creator</dt>
                  <dd>{getEntityLabel(scenario, { type: "user", id: selectedTask.createdByUserId })}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedTask.status}</dd>
                </div>
                <div>
                  <dt>Parent</dt>
                  <dd>
                    {selectedTask.parentTaskId
                      ? getEntityLabel(scenario, { type: "task", id: selectedTask.parentTaskId })
                      : "None"}
                  </dd>
                </div>
              </dl>

              <h3>Available Actions</h3>
              <div className="permission-list">
                {allowed.map((result) => (
                  <PermissionRow key={result.permission} scenario={scenario} result={result} />
                ))}
              </div>

              <h3>Denied Actions</h3>
              <div className="permission-list">
                {denied.map((result) => (
                  <PermissionRow key={result.permission} scenario={scenario} result={result} />
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Select a task to inspect permissions.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PermissionRow({ scenario, result }: { scenario: Scenario; result: AuthzResult }) {
  return (
    <article className={result.allowed ? "permission-row allowed" : "permission-row denied"}>
      <div className="permission-title">
        {result.allowed ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
        <strong>{result.permission}</strong>
      </div>
      <p>{result.reason}</p>
      {result.path.length > 0 ? <code>{formatPath(scenario, result.path)}</code> : null}
    </article>
  );
}

function PermissionMatrix({ scenario, selectedTaskId }: { scenario: Scenario; selectedTaskId: string }) {
  const task = scenario.tasks.find((candidate) => candidate.id === selectedTaskId);
  if (!task) {
    return null;
  }

  return (
    <section className="card matrix-card">
      <div className="card-heading">
        <Eye size={18} aria-hidden="true" />
        <h2>Permission Matrix</h2>
      </div>
      <div className="matrix-scroll">
        <table>
          <caption>Effective permissions for {task.title}</caption>
          <thead>
            <tr>
              <th>User</th>
              {TASK_PERMISSIONS.map((permission) => (
                <th key={permission}>{permission.replace("task.", "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.users.map((user) => (
              <tr key={user.id}>
                <th>{user.name}</th>
                {TASK_PERMISSIONS.map((permission) => {
                  const result = authz.check({
                    scenario,
                    userId: user.id,
                    permission,
                    resourceType: "task",
                    resourceId: task.id
                  });
                  return (
                    <td key={permission} className={result.allowed ? "matrix-allowed" : "matrix-denied"}>
                      {result.allowed ? "Yes" : "No"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ScenarioEditorProps {
  scenario: Scenario;
  selectedUserId: string;
  selectedOrgId: string;
  selectedTaskId: string;
  importText: string;
  exportText: string;
  onScenarioPatch: (patch: Partial<Scenario>) => void;
  onAddUser: () => void;
  onUpdateUser: (userId: string, patch: Partial<Scenario["users"][number]>) => void;
  onDeleteUser: (userId: string) => void;
  onAddOrg: () => void;
  onUpdateOrg: (orgId: string, patch: Partial<Scenario["orgs"][number]>) => void;
  onDeleteOrg: (orgId: string) => void;
  onAddTask: () => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddRelationship: (draft: DraftRelationship) => void;
  onDeleteRelationship: (relationshipId: string) => void;
  onImportTextChange: (value: string) => void;
  onExport: () => void;
  onImport: () => void;
}

function ScenarioEditor({
  scenario,
  selectedUserId,
  selectedOrgId,
  selectedTaskId,
  importText,
  exportText,
  onScenarioPatch,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onAddOrg,
  onUpdateOrg,
  onDeleteOrg,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddRelationship,
  onDeleteRelationship,
  onImportTextChange,
  onExport,
  onImport
}: ScenarioEditorProps) {
  const selectedUser = scenario.users.find((user) => user.id === selectedUserId);
  const selectedOrg = scenario.orgs.find((org) => org.id === selectedOrgId);
  const selectedTask = scenario.tasks.find((task) => task.id === selectedTaskId);

  return (
    <div className="editor-stack">
      <section className="card">
        <div className="card-heading">
          <FileJson size={18} aria-hidden="true" />
          <h2>Scenario</h2>
        </div>
        <label>
          Name
          <input value={scenario.name} onChange={(event) => onScenarioPatch({ name: event.target.value })} />
        </label>
        <label>
          Description
          <textarea
            value={scenario.description}
            onChange={(event) => onScenarioPatch({ description: event.target.value })}
          />
        </label>
        <label>
          Policy version
          <input
            value={scenario.policyVersion}
            onChange={(event) => onScenarioPatch({ policyVersion: event.target.value })}
          />
        </label>
        <div className="button-row">
          <button type="button" onClick={onExport}>
            <Download size={16} aria-hidden="true" />
            Export
          </button>
          <button type="button" onClick={onImport}>
            <Upload size={16} aria-hidden="true" />
            Import
          </button>
        </div>
        <textarea
          className="json-box"
          aria-label="Scenario JSON import export"
          placeholder="Exported or imported scenario JSON"
          value={exportText || importText}
          onChange={(event) => onImportTextChange(event.target.value)}
        />
      </section>

      <section className="card">
        <EditorHeading title="Users" onAdd={onAddUser} />
        {selectedUser ? (
          <div className="form-grid">
            <label>
              Name
              <input value={selectedUser.name} onChange={(event) => onUpdateUser(selectedUser.id, { name: event.target.value })} />
            </label>
            <label>
              Title
              <input
                value={selectedUser.title ?? ""}
                onChange={(event) => onUpdateUser(selectedUser.id, { title: event.target.value })}
              />
            </label>
            <DeleteButton label="Delete user" onClick={() => onDeleteUser(selectedUser.id)} />
          </div>
        ) : (
          <p className="empty-state">Select or create a user.</p>
        )}
      </section>

      <section className="card">
        <EditorHeading title="Orgs" onAdd={onAddOrg} />
        {selectedOrg ? (
          <div className="form-grid">
            <label>
              Name
              <input value={selectedOrg.name} onChange={(event) => onUpdateOrg(selectedOrg.id, { name: event.target.value })} />
            </label>
            <label>
              Abbreviation
              <input
                value={selectedOrg.abbreviation ?? ""}
                onChange={(event) => onUpdateOrg(selectedOrg.id, { abbreviation: event.target.value })}
              />
            </label>
            <label>
              Parent org
              <select
                value={selectedOrg.parentOrgId ?? ""}
                onChange={(event) => onUpdateOrg(selectedOrg.id, { parentOrgId: event.target.value || undefined })}
              >
                <option value="">None</option>
                {scenario.orgs
                  .filter((org) => org.id !== selectedOrg.id)
                  .map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.abbreviation ?? org.name}
                    </option>
                  ))}
              </select>
            </label>
            <DeleteButton label="Delete org" onClick={() => onDeleteOrg(selectedOrg.id)} />
          </div>
        ) : (
          <p className="empty-state">Select or create an org.</p>
        )}
      </section>

      <section className="card">
        <EditorHeading title="Tasks" onAdd={onAddTask} />
        {selectedTask ? (
          <TaskEditor scenario={scenario} task={selectedTask} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} />
        ) : (
          <p className="empty-state">Select or create a task.</p>
        )}
      </section>

      <RelationshipEditor scenario={scenario} onAdd={onAddRelationship} onDelete={onDeleteRelationship} />
    </div>
  );
}

function EditorHeading({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="editor-heading">
      <h2>{title}</h2>
      <button type="button" onClick={onAdd}>
        <Plus size={16} aria-hidden="true" />
        Add
      </button>
    </div>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="danger-button" onClick={onClick}>
      <Trash2 size={16} aria-hidden="true" />
      {label}
    </button>
  );
}

function TaskEditor({
  scenario,
  task,
  onUpdateTask,
  onDeleteTask
}: {
  scenario: Scenario;
  task: Task;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  return (
    <div className="form-grid">
      <label>
        Title
        <input value={task.title} onChange={(event) => onUpdateTask(task.id, { title: event.target.value })} />
      </label>
      <label>
        Description
        <textarea value={task.description ?? ""} onChange={(event) => onUpdateTask(task.id, { description: event.target.value })} />
      </label>
      <label>
        Task type
        <select value={task.taskType} onChange={(event) => onUpdateTask(task.id, { taskType: event.target.value as Task["taskType"] })}>
          {taskTypeOptions.map((taskType) => (
            <option key={taskType} value={taskType}>
              {taskType}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={task.status} onChange={(event) => onUpdateTask(task.id, { status: event.target.value as Task["status"] })}>
          {taskStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Owning org
        <select value={task.owningOrgId} onChange={(event) => onUpdateTask(task.id, { owningOrgId: event.target.value })}>
          {scenario.orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.abbreviation ?? org.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Creator
        <select value={task.createdByUserId} onChange={(event) => onUpdateTask(task.id, { createdByUserId: event.target.value })}>
          {scenario.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Parent task
        <select value={task.parentTaskId ?? ""} onChange={(event) => onUpdateTask(task.id, { parentTaskId: event.target.value || undefined })}>
          <option value="">None</option>
          {scenario.tasks
            .filter((candidate) => candidate.id !== task.id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
        </select>
      </label>
      <DeleteButton label="Delete task" onClick={() => onDeleteTask(task.id)} />
    </div>
  );
}

function RelationshipEditor({
  scenario,
  onAdd,
  onDelete
}: {
  scenario: Scenario;
  onAdd: (draft: DraftRelationship) => void;
  onDelete: (relationshipId: string) => void;
}) {
  const [draft, setDraft] = useState<DraftRelationship>({
    subjectType: "user",
    subjectId: scenario.users[0]?.id ?? "",
    relation: "member_of",
    objectType: "org",
    objectId: scenario.orgs[0]?.id ?? ""
  });

  function patchDraft(patch: Partial<DraftRelationship>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <section className="card">
      <EditorHeading title="Relationships" onAdd={() => onAdd(draft)} />
      <div className="relationship-builder">
        <EntitySelect
          label="Subject type"
          value={draft.subjectType}
          options={entityTypes}
          onChange={(value) => patchDraft({ subjectType: value, subjectId: firstEntityId(scenario, value) })}
        />
        <EntityIdSelect
          label="Subject"
          scenario={scenario}
          type={draft.subjectType}
          value={draft.subjectId}
          onChange={(value) => patchDraft({ subjectId: value })}
        />
        <label>
          Relation
          <select value={draft.relation} onChange={(event) => patchDraft({ relation: event.target.value as RelationshipRelation })}>
            {relationshipOptions.map((relation) => (
              <option key={relation} value={relation}>
                {relation}
              </option>
            ))}
          </select>
        </label>
        <EntitySelect
          label="Object type"
          value={draft.objectType}
          options={entityTypes}
          onChange={(value) => patchDraft({ objectType: value, objectId: firstEntityId(scenario, value) })}
        />
        <EntityIdSelect
          label="Object"
          scenario={scenario}
          type={draft.objectType}
          value={draft.objectId}
          onChange={(value) => patchDraft({ objectId: value })}
        />
      </div>

      <div className="relationship-list">
        {scenario.relationships.map((relationship) => (
          <article key={relationship.id} className="relationship-item">
            <code>
              {getEntityLabel(scenario, { type: relationship.subjectType, id: relationship.subjectId })} {relationship.relation}{" "}
              {getEntityLabel(scenario, { type: relationship.objectType, id: relationship.objectId })}
            </code>
            <button type="button" aria-label={`Delete ${relationship.id}`} onClick={() => onDelete(relationship.id)}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function EntitySelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: EntityType;
  options: EntityType[];
  onChange: (value: EntityType) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as EntityType)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EntityIdSelect({
  label,
  scenario,
  type,
  value,
  onChange
}: {
  label: string;
  scenario: Scenario;
  type: EntityType;
  value: string;
  onChange: (value: string) => void;
}) {
  const entities = entitiesForType(scenario, type);

  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">None</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function firstEntityId(scenario: Scenario, type: EntityType): string {
  return entitiesForType(scenario, type)[0]?.id ?? "";
}

function entitiesForType(scenario: Scenario, type: EntityType): { id: string; label: string }[] {
  switch (type) {
    case "user":
      return scenario.users.map((user) => ({ id: user.id, label: user.name }));
    case "org":
      return scenario.orgs.map((org) => ({ id: org.id, label: org.abbreviation ?? org.name }));
    case "group":
      return scenario.groups.map((group) => ({ id: group.id, label: group.name }));
    case "task":
      return scenario.tasks.map((task) => ({ id: task.id, label: task.title }));
    case "artifact":
    case "note":
      return [];
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

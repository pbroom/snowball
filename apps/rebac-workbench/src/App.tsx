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

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

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

/** Radix Select requires non-empty values; map to "" in state for optional parents. */
const SELECT_NONE = "__none__";

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
    <main className="min-h-screen bg-muted/30 p-6">
      <Card className="mb-4 shadow-md shadow-black/[0.06] ring-border/60">
        <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-primary">Task primitive milestone 1</p>
            <h1 className="font-heading max-w-[760px] text-[clamp(2rem,4vw,4rem)] font-medium leading-[0.96] tracking-tight">
              Boring task shell, explainable access graph.
            </h1>
            <p className="max-w-[760px] text-base leading-relaxed text-muted-foreground">
              Build tiny org worlds, switch users instantly, edit relationship edges, and inspect what the current user can see.
            </p>
          </div>
          <div className="flex w-full min-w-[260px] flex-col gap-2.5 sm:w-auto">
            <ThemeToggle />
            <Label htmlFor="scenario-select" className="sr-only">
              Scenario
            </Label>
            <Select value={scenario.id} onValueChange={setSelectedScenarioId}>
              <SelectTrigger id="scenario-select" className="w-full" aria-label="Scenario">
                <SelectValue placeholder="Scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {scenarios.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" onClick={saveCurrentScenarios}>
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={resetSeedScenario}>
              Reset
            </Button>
            <p className="text-sm text-muted-foreground">{saveState}</p>
          </div>
        </CardContent>
      </Card>

      <div className="workspace-grid">
        <Card className="identity-panel min-h-0 shadow-md shadow-black/[0.06] ring-border/60" aria-label="Organizations and users">
          <PanelHeading eyebrow="Identity graph" title="Orgs and users" />
          <CardContent className="pt-0">
            <OrgTree
              scenario={scenario}
              currentUserId={effectiveUserId}
              onSelectUser={selectUser}
              onDeleteUser={deleteUser}
              onDeleteOrg={deleteOrg}
            />
          </CardContent>
        </Card>

        <Card className="builder-panel min-h-0 shadow-md shadow-black/[0.06] ring-border/60" aria-label="Scenario builders">
          <PanelHeading eyebrow="Create" title="Minimal primitives" />
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-3">
              <form onSubmit={addOrg} className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/50 p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="org-name">Org name</Label>
                  <Input
                    id="org-name"
                    value={builderDraft.orgName}
                    onChange={(event) => setBuilderDraft((draft) => ({ ...draft, orgName: event.target.value }))}
                    placeholder="Policy Team"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="org-parent">Parent org</Label>
                  <Select
                    value={builderDraft.orgParentId || SELECT_NONE}
                    onValueChange={(value) =>
                      setBuilderDraft((draft) => ({ ...draft, orgParentId: value === SELECT_NONE ? "" : value }))
                    }
                  >
                    <SelectTrigger id="org-parent" className="w-full">
                      <SelectValue placeholder="No parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={SELECT_NONE}>No parent</SelectItem>
                        {scenario.orgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.abbreviation ?? org.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">Add org</Button>
              </form>

              <form onSubmit={addUser} className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/50 p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="user-name">User name</Label>
                  <Input
                    id="user-name"
                    value={builderDraft.userName}
                    onChange={(event) => setBuilderDraft((draft) => ({ ...draft, userName: event.target.value }))}
                    placeholder="Jordan Smith"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="user-org">Member of</Label>
                  <Select
                    value={builderDraft.userOrgId}
                    onValueChange={(value) => setBuilderDraft((draft) => ({ ...draft, userOrgId: value }))}
                  >
                    <SelectTrigger id="user-org" className="w-full">
                      <SelectValue placeholder="Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {scenario.orgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.abbreviation ?? org.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">Add user</Button>
              </form>

              <form onSubmit={addTask} className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/50 p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-title">Task title</Label>
                  <Input
                    id="task-title"
                    value={builderDraft.taskTitle}
                    onChange={(event) => setBuilderDraft((draft) => ({ ...draft, taskTitle: event.target.value }))}
                    placeholder="Draft API shell"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-type">Type</Label>
                  <Input
                    id="task-type"
                    value={builderDraft.taskType}
                    onChange={(event) => setBuilderDraft((draft) => ({ ...draft, taskType: event.target.value }))}
                    placeholder="task"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-owning-org">Owning org</Label>
                  <Select
                    value={builderDraft.taskOwnerOrgId}
                    onValueChange={(value) => setBuilderDraft((draft) => ({ ...draft, taskOwnerOrgId: value }))}
                  >
                    <SelectTrigger id="task-owning-org" className="w-full">
                      <SelectValue placeholder="Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {scenario.orgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.abbreviation ?? org.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-parent">Parent task</Label>
                  <Select
                    value={builderDraft.taskParentId || SELECT_NONE}
                    onValueChange={(value) =>
                      setBuilderDraft((draft) => ({ ...draft, taskParentId: value === SELECT_NONE ? "" : value }))
                    }
                  >
                    <SelectTrigger id="task-parent" className="w-full">
                      <SelectValue placeholder="No parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={SELECT_NONE}>No parent</SelectItem>
                        {scenario.tasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">Add task</Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="app-panel min-h-0 shadow-md shadow-black/[0.06] ring-border/60" aria-label="Authenticated task view">
          <PanelHeading
            eyebrow="Authenticated view"
            title={currentUser ? currentUser.displayName : "No user selected"}
            detail={currentUser?.title}
          />
          <CardContent className="pt-0">
            <div className="flex flex-col gap-2">
              {visibleTasks.map((task) => (
                <Button
                  key={task.id}
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto min-h-[94px] w-full flex-col items-start gap-1.5 py-3 font-normal shadow-none",
                    task.id === selectedTask?.id && "border-primary bg-accent"
                  )}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <span className="text-[0.76rem] font-black uppercase tracking-wider text-muted-foreground">{task.type}</span>
                  <strong className="text-base font-semibold">{task.title}</strong>
                  <span className="text-sm text-muted-foreground">{task.status.replace("_", " ")}</span>
                </Button>
              ))}
              {visibleTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">This user has no visible tasks yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="config-panel min-h-0 shadow-md shadow-black/[0.06] ring-border/60" aria-label="ReBAC configuration">
          <PanelHeading eyebrow="ReBAC config" title="Relationship edges" />
          <CardContent className="pt-0">
            <form
              onSubmit={addRelationship}
              className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.2fr_minmax(150px,0.7fr)_1.2fr_auto] lg:items-end"
            >
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="relation-select">Relation</Label>
                <Select
                  value={relationshipDraft.relation}
                  onValueChange={(value) =>
                    setRelationshipDraft((draft) => ({ ...draft, relation: value as RelationshipRelation }))
                  }
                >
                  <SelectTrigger id="relation-select" className="w-full">
                    <SelectValue placeholder="Relation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {RELATIONS.map((relation) => (
                        <SelectItem key={relation} value={relation}>
                          {relation}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
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
              <Button type="submit" className="w-full lg:w-auto">
                Add edge
              </Button>
            </form>
            <Separator className="my-4" />
            <ScrollArea className="h-[340px] rounded-xl border border-border/80 pr-3">
              <div className="flex flex-col gap-2 pb-2">
                {scenario.relationships.map((relationship) => (
                  <div
                    key={relationship.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {getEntityLabel(scenario, { type: relationship.subjectType, id: relationship.subjectId })}{" "}
                      <strong className="font-semibold">{relationship.relation}</strong>{" "}
                      {getEntityLabel(scenario, { type: relationship.objectType, id: relationship.objectId })}
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => deleteRelationship(relationship)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="inspector-panel min-h-0 shadow-md shadow-black/[0.06] ring-border/60" aria-label="Task and authorization inspector">
          <PanelHeading eyebrow="Inspector" title={selectedTask?.title ?? "No task selected"} detail={selectedTask?.type} />
          <CardContent className="pt-0">
            {selectedTask ? (
              <>
                <div className="grid gap-4 md:grid-cols-[190px_1fr] md:items-start">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="task-status">Status</Label>
                    <Select value={selectedTask.status} onValueChange={(value) => updateTaskStatus(selectedTask, value as TaskStatus)}>
                      <SelectTrigger id="task-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TASK_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.76rem] font-black uppercase tracking-wider text-muted-foreground">Allowed task permissions</span>
                    <div className="flex flex-wrap gap-2">
                      {permissionsForTask.map((permission) => (
                        <Badge key={permission} variant="secondary">
                          {permission}
                        </Badge>
                      ))}
                      {permissionsForTask.length === 0 ? <span className="text-sm text-muted-foreground">None</span> : null}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold tracking-tight">Visible resources</h3>
                  <div className="flex flex-col gap-2">
                    {selectedTaskResources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{resource.kind}</span>
                        <strong className="font-semibold">{resource.title}</strong>
                      </div>
                    ))}
                    {selectedTaskResources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No visible resources for this user.</p>
                    ) : null}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="explain-permission">Explain permission</Label>
                    <Select value={selectedPermission} onValueChange={(value) => setSelectedPermission(value as Permission)}>
                      <SelectTrigger id="explain-permission" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PERMISSIONS.map((permission) => (
                            <SelectItem key={permission} value={permission}>
                              {permission}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  {decision ? (
                    <DecisionView scenario={scenario} decision={decision} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Pick a user and task.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No task exists in this scenario.</p>
            )}
          </CardContent>
        </Card>

        <Card className="audit-panel min-h-0 shadow-md shadow-black/[0.06] ring-border/60" aria-label="Audit log">
          <PanelHeading eyebrow="Audit" title="Append-only history" />
          <CardContent className="pt-0">
            {validationIssues.length > 0 ? (
              <Alert className="mb-4 border-amber-500/35 bg-amber-50 dark:bg-amber-950/35">
                <AlertTitle>Validation issues</AlertTitle>
                <AlertDescription className="flex flex-col gap-1">
                  {validationIssues.map((issue) => (
                    <p key={issue.message}>{issue.message}</p>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}
            <ScrollArea className="h-[min(520px,55vh)] rounded-xl border border-border/80 pr-3">
              <div className="flex flex-col gap-2 pb-2">
                {scenario.auditEvents.slice(0, 12).map((event) => (
                  <article key={event.id} className="flex flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2">
                    <span className="text-[0.76rem] text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</span>
                    <strong className="text-sm font-semibold">{event.action}</strong>
                    <p className="m-0 text-sm text-muted-foreground">{event.summary}</p>
                  </article>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function PanelHeading(props: { eyebrow: string; title: string; detail?: string }) {
  return (
    <CardHeader className="border-b pb-4">
      <div className="flex flex-row flex-wrap items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-primary">{props.eyebrow}</p>
          <h2 className="font-heading text-base font-medium tracking-tight">{props.title}</h2>
          {props.detail ? <p className="text-sm text-muted-foreground">{props.detail}</p> : null}
        </div>
      </div>
    </CardHeader>
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
    <div className="flex flex-col gap-2">
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
    <div className="mb-2 flex flex-col gap-1.5" style={{ marginLeft: props.depth * 14 }}>
      <div className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-muted px-2 py-1">
        <strong className="text-sm font-semibold">{org.abbreviation ?? org.name}</strong>
        <Button type="button" variant="ghost" size="sm" disabled={hasTaskDependency} onClick={() => props.onDeleteOrg(org.id)}>
          Delete
        </Button>
      </div>
      {users.map((user) => (
        <div key={user.id} className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant={user.id === props.currentUserId ? "secondary" : "ghost"}
            className={cn(
              "h-auto min-h-8 flex-1 justify-start px-3 py-2 text-left font-semibold",
              user.id === props.currentUserId && "border border-primary"
            )}
            onClick={() => props.onSelectUser(user)}
          >
            {user.displayName}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => props.onDeleteUser(user.id)}>
            Delete
          </Button>
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
  const typeId = `${props.label}-entity-type`.toLowerCase().replace(/\s+/g, "-");
  const entityId = `${props.label}-entity-id`.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[120px_1fr] lg:gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={typeId}>{props.label} type</Label>
        <Select value={props.type} onValueChange={(value) => props.onTypeChange(value as EntityType)}>
          <SelectTrigger id={typeId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={entityId}>{props.label}</Label>
        <Select value={props.id} onValueChange={props.onIdChange}>
          <SelectTrigger id={entityId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DecisionView(props: { scenario: Scenario; decision: AuthzResult }) {
  const path = formatPathSteps(props.scenario, props.decision.path);

  return (
    <Alert
      className={cn(
        props.decision.allowed
          ? "border-green-600/30 bg-green-50 dark:border-green-500/35 dark:bg-green-950/40"
          : "border-destructive/35 bg-destructive/5"
      )}
    >
      <AlertTitle>{props.decision.allowed ? "Allowed" : "Denied"}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{props.decision.reason}</p>
        {path.length > 0 ? (
          <ol className="m-0 list-decimal pl-5">
            {path.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
      </AlertDescription>
    </Alert>
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

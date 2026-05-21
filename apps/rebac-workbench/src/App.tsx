import { LocalAuthorizationService, formatPathSteps, type AuthzResult, type ResourceType } from "@snowball/authz-core";
import { saveScenarios, validateScenario } from "@snowball/scenario-store";
import {
  PERMISSIONS,
  getEntityLabel,
  type EntityType,
  type Org,
  type Permission,
  type Relationship,
  type RelationshipRelation,
  type Scenario,
  type TaskStatus,
  type User
} from "@snowball/task-core";
import { hierarchy, tree as d3Tree, type HierarchyPointLink } from "d3";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Building02Icon,
  Delete02Icon,
  Edit02Icon,
  MoreHorizontalIcon,
  UserAdd01Icon
} from "@hugeicons/core-free-icons";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button as AriaButton,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
  type Selection
} from "react-aria-components";
import { useShallow } from "zustand/react/shallow";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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
import {
  entityOptions,
  firstEntityId,
  getIdentityMoveTargets,
  getUserOrgId,
  identityTreeFingerprint,
  parseIdentityKey,
  selectCurrentScenario,
  uniqueById,
  useWorkbenchStore,
  type PendingDelete,
  type PendingRename
} from "@/workbench-store";

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

export function App() {
  const [
    scenarios,
    currentUserId,
    selectedTaskId,
    selectedPermission,
    relationshipDraft,
    builderDraft,
    saveState,
    formErrors,
    pendingDelete,
    pendingRename,
    selectedOrgId
  ] = useWorkbenchStore(
    useShallow((state) => [
      state.scenarios,
      state.currentUserId,
      state.selectedTaskId,
      state.selectedPermission,
      state.relationshipDraft,
      state.builderDraft,
      state.saveState,
      state.formErrors,
      state.pendingDelete,
      state.pendingRename,
      state.selectedOrgId
    ])
  );
  const scenario = useWorkbenchStore(selectCurrentScenario);
  const [
    markAutosaved,
    reconcileSelectedOrg,
    setSelectedOrgId,
    setSelectedTaskId,
    setSelectedPermission,
    setBuilderDraft,
    setRelationshipDraft,
    clearFormError,
    cancelDelete,
    cancelRename,
    updatePendingRename,
    selectUser,
    addTask,
    addRelationship,
    deleteRelationship,
    deleteUser,
    deleteOrg,
    moveIdentityNode,
    addOrgFromIdentity,
    addUserFromIdentity,
    startRenameIdentity,
    commitRenameIdentity,
    updateTaskStatus
  ] = useWorkbenchStore(
    useShallow((state) => [
      state.markAutosaved,
      state.reconcileSelectedOrg,
      state.setSelectedOrgId,
      state.setSelectedTaskId,
      state.setSelectedPermission,
      state.setBuilderDraft,
      state.setRelationshipDraft,
      state.clearFormError,
      state.cancelDelete,
      state.cancelRename,
      state.updatePendingRename,
      state.selectUser,
      state.addTask,
      state.addRelationship,
      state.deleteRelationship,
      state.deleteUser,
      state.deleteOrg,
      state.moveIdentityNode,
      state.addOrgFromIdentity,
      state.addUserFromIdentity,
      state.startRenameIdentity,
      state.commitRenameIdentity,
      state.updateTaskStatus
    ])
  );
  const currentUser = scenario.users.find((user) => user.id === currentUserId) ?? scenario.users[0];
  const effectiveUserId = currentUser?.id ?? "";
  const visibleTasks = useMemo(
    () => (effectiveUserId ? authz.listVisibleTasks({ scenario, userId: effectiveUserId }) : []),
    [effectiveUserId, scenario]
  );
  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0];
  const validationIssues = useMemo(() => validateScenario(scenario), [scenario]);
  const identityFingerprint = identityTreeFingerprint(scenario);
  const identityTreeItems = useMemo(() => buildIdentityTree(scenario), [identityFingerprint]);
  const highlightedOrgId =
    selectedOrgId ?? (currentUser ? getUserOrgId(scenario, currentUser) : undefined);

  const selectedResourceType: ResourceType = selectedPermission.startsWith("resource.") ? "resource" : "task";
  const selectedTaskResources = useMemo(
    () => (selectedTask ? authz.listVisibleResources({ scenario, userId: effectiveUserId, taskId: selectedTask.id }) : []),
    [effectiveUserId, scenario, selectedTask]
  );
  const selectedResourceId =
    selectedResourceType === "task"
      ? selectedTask?.id ?? ""
      : selectedTaskResources[0]?.id ?? "";
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
  const permissionsForTask = useMemo(
    () =>
      selectedTask && effectiveUserId
        ? authz.listPermissions({ scenario, userId: effectiveUserId, resourceType: "task", resourceId: selectedTask.id })
        : [],
    [effectiveUserId, scenario, selectedTask]
  );

  useEffect(() => {
    saveScenarios(scenarios);
    markAutosaved(`Autosaved ${new Date().toLocaleTimeString()}`);
  }, [markAutosaved, scenarios]);

  useEffect(() => {
    if (!selectedOrgId) {
      return;
    }
    reconcileSelectedOrg();
  }, [identityFingerprint, reconcileSelectedOrg, selectedOrgId]);

  return (
    <main className="min-h-screen bg-muted/30 p-3 sm:p-4 xl:p-6">
      <header className="mb-3 flex min-w-0 items-center justify-between gap-3 px-1 py-1 text-xs/relaxed text-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            S
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Snowball</p>
            <p className="truncate text-muted-foreground">{saveState}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <ThemeToggle variant="icon" />
        </div>
      </header>

      <div className="workspace-grid">
        <Card className="identity-panel min-h-0 ring-border/60" aria-label="Organizations and users">
          <PanelHeading eyebrow="Identity graph" title="Orgs and users" />
          <CardContent className="px-0 pt-0">
            <OrgTree
              scenario={scenario}
              identityFingerprint={identityFingerprint}
              treeItems={identityTreeItems}
              currentUserId={effectiveUserId}
              selectedOrgId={selectedOrgId}
              pendingDelete={pendingDelete}
              pendingRename={pendingRename}
              onSelectOrg={setSelectedOrgId}
              onCancelDelete={cancelDelete}
              onCancelRename={cancelRename}
              onRenameValueChange={updatePendingRename}
              onCommitRename={commitRenameIdentity}
              onSelectUser={selectUser}
              onAddOrg={addOrgFromIdentity}
              onAddUser={addUserFromIdentity}
              onStartRename={startRenameIdentity}
              onDeleteUser={deleteUser}
              onDeleteOrg={deleteOrg}
              onMoveIdentity={moveIdentityNode}
            />
            <FormError id="org-form-error" message={formErrors.org} className="px-4 pt-3" />
            <FormError id="user-form-error" message={formErrors.user} className="px-4 pt-1" />
          </CardContent>
        </Card>

        <Card className="builder-panel min-h-0 ring-border/60" aria-label="Scenario builders">
          <PanelHeading eyebrow="Create" title="Minimal primitives" />
          <CardContent className="pt-0">
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.95fr)_minmax(280px,1.05fr)]">
              <IdentityOrgChart items={identityTreeItems} currentUserId={effectiveUserId} highlightedOrgId={highlightedOrgId} />

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  addTask();
                }}
                className="flex min-w-0 flex-col gap-2.5 border-t border-border/80 pt-3"
              >
                <fieldset className="contents">
                  <legend className="mb-1 text-sm font-semibold">Task</legend>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-title">Task title</Label>
                  <Input
                    id="task-title"
                    value={builderDraft.taskTitle}
                    onChange={(event) => {
                      setBuilderDraft((draft) => ({ ...draft, taskTitle: event.target.value }));
                      clearFormError("task");
                    }}
                    placeholder="Draft API shell"
                    autoComplete="off"
                    aria-invalid={Boolean(formErrors.task)}
                    aria-describedby={formErrors.task ? "task-form-error" : undefined}
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
                    onValueChange={(value) => {
                      setBuilderDraft((draft) => ({ ...draft, taskOwnerOrgId: value }));
                      clearFormError("task");
                    }}
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
                <FormError id="task-form-error" message={formErrors.task} />
                <Button type="submit">Add task</Button>
                </fieldset>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="app-panel min-h-0 ring-border/60" aria-label="Authenticated task view">
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

        <Card className="config-panel min-h-0 ring-border/60" aria-label="ReBAC configuration">
          <PanelHeading
            eyebrow="ReBAC config"
            title="Relationship edges"
            detail="Edges read left to right: a subject gains context through a relation to an object."
          />
          <CardContent className="pt-0">
            <Alert className="mb-4 border-primary/25 bg-primary/5">
              <AlertTitle>How to read an edge</AlertTitle>
              <AlertDescription>
                Use relationships to explain access: user member_of org, task owned_by org, resource contained by task. Permission checks follow these
                links and show the path below.
              </AlertDescription>
            </Alert>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                addRelationship();
              }}
              className="flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[1.2fr_minmax(150px,0.7fr)_1.2fr_auto] lg:items-end"
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
            <FormError id="relationship-form-error" message={formErrors.relationship} className="mt-3" />
            <Separator className="my-4" />
            <ScrollArea className="h-[340px] rounded-xl border border-border/80 pr-3">
              <div className="flex flex-col gap-2 pb-2">
                {scenario.relationships.map((relationship) => {
                  const label = relationshipLabel(scenario, relationship);
                  const isPending = pendingDelete?.type === "relationship" && pendingDelete.id === relationship.id;

                  return (
                    <div
                      key={relationship.id}
                      className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0 break-words">{label}</span>
                      <ConfirmingDeleteButton
                        isPending={isPending}
                        label={`Delete relationship ${label}`}
                        pendingLabel="Confirm delete edge"
                        consequence="Removes this edge from future permission paths."
                        onCancel={cancelDelete}
                        onDelete={() => deleteRelationship(relationship)}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="inspector-panel min-h-0 ring-border/60" aria-label="Task and authorization inspector">
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

        <Card className="audit-panel min-h-0 ring-border/60" aria-label="Audit log">
          <PanelHeading eyebrow="Audit" title="Append-only history" />
          <CardContent className="pt-0">
            {validationIssues.length > 0 ? (
              <Alert className="mb-4 border-destructive/35 bg-destructive/5">
                <AlertTitle>Validation issues</AlertTitle>
                <AlertDescription className="flex flex-col gap-1">
                  {validationIssues.map((issue) => (
                    <p key={issue.message}>{issue.message}</p>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}
            <ScrollArea className="h-[min(520px,55vh)] pr-3">
              <div className="flex flex-col pb-2">
                {scenario.auditEvents.slice(0, 12).map((event) => (
                  <article key={event.id} className="flex flex-col gap-1 border-b border-border/60 py-2.5 last:border-b-0">
                    <div className="flex min-w-0 items-baseline justify-between gap-3">
                      <strong className="text-sm font-semibold">{event.action}</strong>
                      <time
                        className="shrink-0 text-right text-sm text-muted-foreground"
                        dateTime={event.occurredAt}
                      >
                        {new Date(event.occurredAt).toLocaleString()}
                      </time>
                    </div>
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
          <h2 className="font-heading text-base font-medium tracking-tight">{props.title}</h2>
          {props.detail ? <p className="text-sm text-muted-foreground">{props.detail}</p> : null}
        </div>
      </div>
    </CardHeader>
  );
}

function FormError(props: { id: string; message?: string; className?: string }) {
  if (!props.message) {
    return null;
  }

  return (
    <p id={props.id} role="alert" className={cn("rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive", props.className)}>
      {props.message}
    </p>
  );
}

function ConfirmingDeleteButton(props: {
  isPending: boolean;
  label: string;
  pendingLabel: string;
  consequence: string;
  disabled?: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  if (props.isPending) {
    return (
      <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:items-end">
        <p className="max-w-[18rem] text-xs text-muted-foreground">{props.consequence}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="destructive" size="sm" aria-label={props.pendingLabel} onClick={props.onDelete}>
            Confirm delete
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" size="sm" className="shrink-0" aria-label={props.label} disabled={props.disabled} onClick={props.onDelete}>
      Delete
    </Button>
  );
}

type IdentityTreeNode =
  | {
      id: string;
      type: "org";
      label: string;
      depth: number;
      org: Org;
      childItems: IdentityTreeNode[];
    }
  | {
      id: string;
      type: "user";
      label: string;
      depth: number;
      user: User;
      childItems: IdentityTreeNode[];
    };

type ParsedIdentityKey = { type: "org" | "user"; id: string };

type ChartNodeDatum = {
  id: string;
  type: "root" | "org" | "user";
  label: string;
  children?: ChartNodeDatum[];
};

function identityKey(type: ParsedIdentityKey["type"], id: string): string {
  return `${type}:${id}`;
}

function buildIdentityTree(scenario: Scenario): IdentityTreeNode[] {
  const orgs = uniqueById(scenario.orgs);
  const users = uniqueById(scenario.users);
  const visitedOrgIds = new Set<string>();
  const orgIds = new Set(orgs.map((org) => org.id));
  const rootOrgs = orgs.filter((org) => !org.parentOrgId || !orgIds.has(org.parentOrgId) || org.parentOrgId === org.id);
  const startingOrgs = rootOrgs.length > 0 ? rootOrgs : orgs;
  const tree: IdentityTreeNode[] = [];
  for (const org of startingOrgs) {
    if (!visitedOrgIds.has(org.id)) {
      tree.push(buildOrgTreeNode(scenario, orgs, users, org, visitedOrgIds, new Set(), 0));
    }
  }
  const disconnectedOrgs = orgs
    .filter((org) => !visitedOrgIds.has(org.id))
    .map((org) => buildOrgTreeNode(scenario, orgs, users, org, visitedOrgIds, new Set(), 0));
  const nestedUserIds = new Set(flattenIdentityTree([...tree, ...disconnectedOrgs]).filter((item) => item.type === "user").map((item) => item.user.id));
  const orphanUsers = users
    .filter((user) => !nestedUserIds.has(user.id))
    .map((user) => buildUserTreeNode(user));

  return [...tree, ...disconnectedOrgs, ...orphanUsers];
}

function buildOrgTreeNode(
  scenario: Scenario,
  orgs: Org[],
  users: User[],
  org: Org,
  visitedOrgIds: Set<string>,
  ancestors: Set<string>,
  depth: number
): IdentityTreeNode {
  visitedOrgIds.add(org.id);
  const childAncestors = new Set(ancestors).add(org.id);
  const childOrgs = orgs.filter(
    (candidate) => candidate.parentOrgId === org.id && !visitedOrgIds.has(candidate.id) && !childAncestors.has(candidate.id)
  );
  const childUsers = users.filter((user) => getUserOrgId(scenario, user) === org.id);

  return {
    id: identityKey("org", org.id),
    type: "org",
    label: identityOrgLabel(org),
    depth,
    org,
    childItems: [
      ...childUsers.map((user) => buildUserTreeNode(user, depth + 1)),
      ...childOrgs.map((child) => buildOrgTreeNode(scenario, orgs, users, child, visitedOrgIds, childAncestors, depth + 1))
    ]
  };
}

function buildUserTreeNode(user: User, depth = 0): IdentityTreeNode {
  return {
    id: identityKey("user", user.id),
    type: "user",
    label: user.displayName,
    depth,
    user,
    childItems: []
  };
}

function flattenIdentityTree(items: IdentityTreeNode[]): IdentityTreeNode[] {
  return items.flatMap((item) => [item, ...flattenIdentityTree(item.childItems)]);
}

function flattenExpandedIdentityTree(items: IdentityTreeNode[], expandedKeys: Set<string>): IdentityTreeNode[] {
  return items.flatMap((item) => [item, ...(expandedKeys.has(item.id) ? flattenExpandedIdentityTree(item.childItems, expandedKeys) : [])]);
}

function getExpandableIdentityKeys(items: IdentityTreeNode[]): Set<string> {
  return new Set(
    flattenIdentityTree(items)
      .filter((item) => item.childItems.length > 0)
      .map((item) => item.id)
  );
}

function identityNodeToChartDatum(item: IdentityTreeNode): ChartNodeDatum {
  return {
    id: item.id,
    type: item.type,
    label: item.label,
    children: item.childItems.map(identityNodeToChartDatum)
  };
}

function chartLinkPath(link: HierarchyPointLink<ChartNodeDatum>): string {
  const midY = (link.source.y + link.target.y) / 2;
  return `M${link.source.y},${link.source.x}C${midY},${link.source.x} ${midY},${link.target.x} ${link.target.y},${link.target.x}`;
}

function isHighlightedChartLink(
  link: HierarchyPointLink<ChartNodeDatum>,
  currentUserId: string,
  highlightedOrgId?: string
): boolean {
  const targetId = link.target.data.id;
  return targetId === identityKey("user", currentUserId) || targetId === identityKey("org", highlightedOrgId ?? "");
}

function OrgTree(props: {
  scenario: Scenario;
  identityFingerprint: string;
  treeItems: IdentityTreeNode[];
  currentUserId: string;
  selectedOrgId: string | undefined;
  pendingDelete: PendingDelete;
  pendingRename: PendingRename;
  onSelectOrg: (orgId: string | undefined) => void;
  onCancelDelete: () => void;
  onCancelRename: () => void;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onSelectUser: (user: User) => void;
  onAddOrg: (sourceKey: string) => void;
  onAddUser: (sourceKey: string) => void;
  onStartRename: (sourceKey: string) => void;
  onDeleteUser: (userId: string) => void;
  onDeleteOrg: (orgId: string) => void;
  onMoveIdentity: (sourceKey: string, targetOrgId: string | undefined) => void;
}) {
  const treeItems = props.treeItems;
  const flatTreeItems = useMemo(() => flattenIdentityTree(treeItems), [treeItems]);
  const itemMap = useMemo(() => new Map(flatTreeItems.map((item) => [item.id, item])), [flatTreeItems]);
  const expandableKeys = useMemo(() => getExpandableIdentityKeys(treeItems), [treeItems]);
  const previousExpandableKeysRef = useRef<Set<string>>(new Set(expandableKeys));
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(expandableKeys));
  const visibleTreeItems = useMemo(() => flattenExpandedIdentityTree(treeItems, expandedKeys), [expandedKeys, treeItems]);
  const selectedIdentityKey = props.selectedOrgId
    ? identityKey("org", props.selectedOrgId)
    : props.currentUserId
      ? identityKey("user", props.currentUserId)
      : undefined;

  useEffect(() => {
    const previousExpandableKeys = previousExpandableKeysRef.current;

    setExpandedKeys((currentKeys) => {
      const nextKeys = new Set(Array.from(currentKeys).filter((key) => itemMap.has(key)));

      for (const key of expandableKeys) {
        if (!previousExpandableKeys.has(key)) {
          nextKeys.add(key);
        }
      }

      if (nextKeys.size === currentKeys.size && Array.from(nextKeys).every((key) => currentKeys.has(key))) {
        return currentKeys;
      }

      return nextKeys;
    });
    previousExpandableKeysRef.current = new Set(expandableKeys);
  }, [expandableKeys, itemMap]);

  function toggleExpanded(key: string) {
    setExpandedKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(key)) {
        nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }

      return nextKeys;
    });
  }

  function handleSelectionChange(selection: Selection) {
    if (props.pendingRename) {
      return;
    }

    if (selection === "all") {
      return;
    }

    const key = selection.values().next().value;
    if (!key) {
      return;
    }

    const item = itemMap.get(String(key));
    if (item?.type === "org") {
      props.onSelectOrg(item.org.id);
      return;
    }
    if (item?.type === "user") {
      props.onSelectOrg(undefined);
      props.onSelectUser(item.user);
    }
  }

  const { dragAndDropHooks } = useDragAndDrop({
    getItems(keys) {
      if (props.pendingRename) {
        return [];
      }

      return Array.from(keys)
        .map((key) => itemMap.get(String(key)))
        .filter((item): item is IdentityTreeNode => Boolean(item))
        .map((item) => ({
          "application/x-snowball-identity": item.id,
          "text/plain": item.label
        }));
    },
    onMove(event) {
      if (props.pendingRename) {
        return;
      }

      if (event.target.dropPosition !== "on") {
        return;
      }
      const target = parseIdentityKey(String(event.target.key));
      if (target?.type !== "org") {
        return;
      }

      for (const key of event.keys) {
        props.onMoveIdentity(String(key), target.id);
      }
    },
    getDropOperation(target) {
      if (props.pendingRename) {
        return "cancel";
      }

      if (target.type === "root") {
        return "cancel";
      }

      const targetKey = parseIdentityKey(String(target.key));
      return target.dropPosition === "on" && targetKey?.type === "org" ? "move" : "cancel";
    }
  });

  return (
    <div className="identity-stack">
      <Tree
        aria-label="Organizations and users"
        className="identity-tree"
        dependencies={[props.currentUserId, props.pendingDelete, props.pendingRename, expandedKeys]}
        dragAndDropHooks={dragAndDropHooks}
        items={visibleTreeItems}
        onSelectionChange={handleSelectionChange}
        renderEmptyState={() => <p className="px-2 py-3 text-sm text-muted-foreground">Add an org to begin the identity graph.</p>}
        selectedKeys={selectedIdentityKey ? new Set([selectedIdentityKey]) : new Set()}
        selectionBehavior="replace"
        selectionMode="single"
      >
        {(item) => <IdentityTreeItem expandedKeys={expandedKeys} item={item} onToggleExpanded={toggleExpanded} {...props} />}
      </Tree>
    </div>
  );
}

function IdentityOrgChart(props: { items: IdentityTreeNode[]; currentUserId: string; highlightedOrgId?: string }) {
  const descriptionId = useId();
  const { nodes, links, viewBox, width, height } = useMemo(() => {
    const rootData: ChartNodeDatum = {
      id: "root:identity",
      type: "root",
      label: "Identity",
      children: props.items.map(identityNodeToChartDatum)
    };
    const root = hierarchy(rootData);
    const layout = d3Tree<ChartNodeDatum>().nodeSize([30, 82]);
    const laidOutRoot = layout(root);
    const allNodes = laidOutRoot.descendants();
    const minX = Math.min(...allNodes.map((node) => node.x));
    const maxX = Math.max(...allNodes.map((node) => node.x));
    const maxY = Math.max(...allNodes.map((node) => node.y));
    const chartWidth = Math.max(260, maxY + 132);
    const chartHeight = Math.max(116, maxX - minX + 40);

    return {
      nodes: allNodes,
      links: laidOutRoot.links(),
      width: chartWidth,
      height: chartHeight,
      viewBox: `-14 ${minX - 20} ${chartWidth} ${chartHeight}`
    };
  }, [props.items]);

  return (
    <figure className="identity-chart" aria-labelledby="identity-chart-title" aria-describedby={descriptionId}>
      <div className="identity-chart-header">
        <figcaption id="identity-chart-title">Org structure</figcaption>
        <span>Drag in the tree to update this map.</span>
      </div>
      <svg className="identity-chart-svg" viewBox={viewBox} width={width} height={height} role="img" aria-hidden="true">
        <g>
          {links.map((link, index) => (
            <path
              key={`${link.source.data.id}-${link.target.data.id}-${index}`}
              className={cn("identity-chart-link", isHighlightedChartLink(link, props.currentUserId, props.highlightedOrgId) && "is-highlighted")}
              d={chartLinkPath(link)}
            />
          ))}
        </g>
        <g>
          {nodes.map((node, index) => {
            const isCurrentUser = node.data.id === identityKey("user", props.currentUserId);
            const isHighlightedOrg = node.data.id === identityKey("org", props.highlightedOrgId ?? "");

            return (
              <g
                key={`${node.data.id}-${index}`}
                className={cn(
                  "identity-chart-node",
                  `identity-chart-node-${node.data.type}`,
                  isCurrentUser && "is-current-user",
                  isHighlightedOrg && "is-highlighted-org"
                )}
                transform={`translate(${node.y},${node.x})`}
              >
                <circle r={node.data.type === "root" ? 4 : 5} />
                <text x={9} dy="0.32em">
                  {node.data.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <p id={descriptionId} className="sr-only">
        Organization chart showing parent and child orgs plus user membership. The selected current user and related org are highlighted. Use the
        organizations and users tree below for keyboard selection, deletion, and drag and drop.
      </p>
    </figure>
  );
}

function userDisplayInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function identityTreeItemAriaLabel(item: IdentityTreeNode, isCurrentUser: boolean, user: User | undefined): string {
  const meta =
    item.type === "org"
      ? `${item.childItems.length} ${item.childItems.length === 1 ? "entry" : "entries"}`
      : isCurrentUser
        ? "Current actor"
        : (user?.title ?? (user ? "User" : undefined));

  return meta ? `${item.label}, ${meta}` : item.label;
}

function IdentityTreeItem(props: {
  scenario: Scenario;
  identityFingerprint: string;
  currentUserId: string;
  pendingDelete: PendingDelete;
  pendingRename: PendingRename;
  onCancelDelete: () => void;
  onCancelRename: () => void;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  item: IdentityTreeNode;
  onSelectUser: (user: User) => void;
  onAddOrg: (sourceKey: string) => void;
  onAddUser: (sourceKey: string) => void;
  onStartRename: (sourceKey: string) => void;
  onDeleteUser: (userId: string) => void;
  onDeleteOrg: (orgId: string) => void;
  onMoveIdentity: (sourceKey: string, targetOrgId: string | undefined) => void;
  expandedKeys: Set<string>;
  onToggleExpanded: (sourceKey: string) => void;
}) {
  const item = props.item;
  const org = item.type === "org" ? item.org : undefined;
  const user = item.type === "user" ? item.user : undefined;
  const isCurrentUser = user?.id === props.currentUserId;
  const hasChildItems = item.childItems.length > 0;
  const isExpanded = props.expandedKeys.has(item.id);
  const hasTaskDependency = Boolean(org && props.scenario.tasks.some((task) => task.owningOrgId === org.id));
  const isPending =
    org
      ? props.pendingDelete?.type === "org" && props.pendingDelete.id === org.id
      : Boolean(user && props.pendingDelete?.type === "user" && props.pendingDelete.id === user.id);
  const rename = props.pendingRename?.type === item.type && props.pendingRename.id === (org?.id ?? user?.id) ? props.pendingRename : undefined;

  function handleTreeItemKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!hasChildItems || props.pendingRename || event.defaultPrevented) {
      return;
    }

    if (event.key === "ArrowRight" && !isExpanded) {
      event.preventDefault();
      props.onToggleExpanded(item.id);
      return;
    }

    if (event.key === "ArrowLeft" && isExpanded) {
      event.preventDefault();
      props.onToggleExpanded(item.id);
    }
  }

  function handleTreeItemClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!hasChildItems) {
      return;
    }

    const target = event.target instanceof Element ? event.target.closest(".identity-tree-disclosure") : null;
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    props.onToggleExpanded(item.id);
  }

  return (
    <TreeItem
      id={item.id}
      textValue={rename ? item.label : props.pendingRename ? `\u200b${item.id}` : item.label}
      className="identity-tree-item"
      aria-expanded={hasChildItems ? isExpanded : undefined}
      aria-label={rename ? item.label : identityTreeItemAriaLabel(item, isCurrentUser, user)}
    >
      <TreeItemContent>
        {({ allowsDragging }) => (
          <div
            className={cn("identity-tree-item-content", org && "identity-tree-item-content-org", isCurrentUser && "is-current-user")}
            style={{ "--identity-tree-depth": item.depth } as React.CSSProperties}
            onClickCapture={handleTreeItemClickCapture}
            onKeyDown={handleTreeItemKeyDown}
          >
            {allowsDragging ? (
              <AriaButton slot="drag" className="identity-tree-hidden-action" aria-label={`Move ${item.label}`} isDisabled={Boolean(rename)}>
                Move {item.label}
              </AriaButton>
            ) : null}
            <div className="identity-tree-row-main">
              {hasChildItems ? (
                <span className="identity-tree-disclosure-control">
                  <button
                    type="button"
                    draggable={false}
                    className="identity-tree-disclosure"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.label}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      props.onToggleExpanded(item.id);
                    }}
                    onDragStart={(event) => event.preventDefault()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden />
                  </button>
                </span>
              ) : (
                <span className="identity-tree-disclosure-spacer" aria-hidden="true" />
              )}
              {user && !rename ? (
                <Avatar size="sm" className="identity-tree-user-avatar" aria-hidden="true">
                  <AvatarFallback>{userDisplayInitials(item.label)}</AvatarFallback>
                </Avatar>
              ) : null}
              {rename ? (
                <IdentityRenameEditor
                  label={item.label}
                  value={rename.value}
                  onValueChange={props.onRenameValueChange}
                  onCancel={props.onCancelRename}
                  onCommit={props.onCommitRename}
                />
              ) : (
                <div className="identity-tree-label">
                  <span className={cn("identity-tree-title", org ? "font-semibold" : "font-medium")}>{item.label}</span>
                </div>
              )}
            </div>
            <div className="identity-tree-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              {isPending ? (
                <ConfirmingDeleteButton
                  isPending
                  label={org ? `Delete org ${org.name}` : `Delete user ${user?.displayName ?? item.label}`}
                  pendingLabel={org ? "Confirm delete org" : "Confirm delete user"}
                  consequence={
                    org
                      ? hasTaskDependency
                        ? "This org owns tasks, so remove or reassign those tasks before deleting."
                        : "Deletes this org and removes relationships that point to it."
                      : "Deletes this user and removes relationships connected to them."
                  }
                  disabled={hasTaskDependency}
                  onCancel={props.onCancelDelete}
                  onDelete={() => {
                    if (org) {
                      props.onDeleteOrg(org.id);
                      return;
                    }
                    if (user) {
                      props.onDeleteUser(user.id);
                    }
                  }}
                />
              ) : (
                <IdentityRowActions
                  item={item}
                  scenario={props.scenario}
                  identityFingerprint={props.identityFingerprint}
                  canMoveToTopLevel={Boolean(org?.parentOrgId)}
                  onAddOrg={() => props.onAddOrg(item.id)}
                  onAddUser={() => props.onAddUser(item.id)}
                  onStartRename={() => props.onStartRename(item.id)}
                  onMove={(targetOrgId) => props.onMoveIdentity(item.id, targetOrgId)}
                  onStartDelete={() => {
                    if (org) {
                      props.onDeleteOrg(org.id);
                      return;
                    }
                    if (user) {
                      props.onDeleteUser(user.id);
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
      </TreeItemContent>
    </TreeItem>
  );
}

function IdentityRenameEditor(props: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handledSpaceKeyRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const inputElement: HTMLInputElement = input;

    let isCancelled = false;
    let focusTimeout = 0;
    let attempts = 0;

    function focusInput() {
      if (isCancelled) {
        return;
      }

      inputElement.focus({ preventScroll: true });
      inputElement.select();
      attempts += 1;

      if (document.activeElement !== inputElement && attempts < 5) {
        focusTimeout = window.setTimeout(focusInput, 20);
      }
    }

    focusTimeout = window.setTimeout(focusInput, 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(focusTimeout);
    };
  }, [props.label]);

  function stopTreeInteraction(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  function insertTextAtSelection(input: HTMLInputElement, text: string) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const nextValue = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
    const nextCursor = start + text.length;

    props.onValueChange(nextValue);
    requestAnimationFrame(() => input.setSelectionRange(nextCursor, nextCursor));
  }

  return (
    <form
      className="identity-rename-form"
      onClickCapture={stopTreeInteraction}
      onDragStartCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDownCapture={stopTreeInteraction}
      onPointerDownCapture={stopTreeInteraction}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onCommit();
      }}
    >
      <Input
        ref={inputRef}
        aria-label={`Rename ${props.label}`}
        autoFocus
        className="h-7"
        value={props.value}
        onChange={(event) => props.onValueChange(event.target.value)}
        onKeyDownCapture={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            props.onCancel();
            return;
          }
          if (event.key === " ") {
            event.preventDefault();
            handledSpaceKeyRef.current = true;
            insertTextAtSelection(event.currentTarget, " ");
          }
        }}
        onKeyUpCapture={(event) => {
          event.stopPropagation();
          if (event.key !== " ") {
            return;
          }

          if (!handledSpaceKeyRef.current) {
            insertTextAtSelection(event.currentTarget, " ");
          }
          handledSpaceKeyRef.current = false;
        }}
      />
      <div className="flex shrink-0 gap-1">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function IdentityRowActions(props: {
  item: IdentityTreeNode;
  scenario: Scenario;
  identityFingerprint: string;
  canMoveToTopLevel?: boolean;
  onAddOrg: () => void;
  onAddUser: () => void;
  onStartRename: () => void;
  onMove: (targetOrgId: string | undefined) => void;
  onStartDelete: () => void;
}) {
  const [moveTargets, setMoveTargets] = useState<Org[] | null>(null);

  useEffect(() => {
    setMoveTargets(null);
  }, [props.identityFingerprint, props.item.id]);

  function ensureMoveTargets() {
    if (moveTargets === null) {
      setMoveTargets(getIdentityMoveTargets(props.scenario, props.item));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Open actions for ${props.item.label}`}>
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{props.item.label}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={props.onAddOrg}>
            <HugeiconsIcon icon={Building02Icon} strokeWidth={2} aria-hidden />
            Add org
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onAddUser}>
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} aria-hidden />
            Add user
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onStartRename}>
            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSub
            onOpenChange={(open) => {
              if (open) {
                ensureMoveTargets();
              }
            }}
          >
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} aria-hidden />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="max-h-64 min-w-44 overflow-y-auto">
                {props.canMoveToTopLevel ? (
                  <DropdownMenuItem onSelect={() => props.onMove(undefined)}>Top level</DropdownMenuItem>
                ) : null}
                {moveTargets === null ? null : moveTargets.length > 0 ? (
                  moveTargets.map((org) => (
                    <DropdownMenuItem key={org.id} onSelect={() => props.onMove(org.id)}>
                      {org.abbreviation ?? org.name}
                    </DropdownMenuItem>
                  ))
                ) : props.canMoveToTopLevel ? null : (
                  <DropdownMenuItem disabled>No available orgs</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={props.onStartDelete}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[120px_1fr] lg:gap-3">
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
          ? "border-primary/35 bg-primary/5"
          : "border-destructive/35 bg-destructive/5"
      )}
    >
      <AlertTitle>{props.decision.allowed ? "Allowed by relationship path" : "Denied, no valid path"}</AlertTitle>
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

function relationshipLabel(scenario: Scenario, relationship: Relationship): string {
  return `${getEntityLabel(scenario, { type: relationship.subjectType, id: relationship.subjectId })} ${relationship.relation} ${getEntityLabel(scenario, {
    type: relationship.objectType,
    id: relationship.objectId
  })}`;
}

function identityOrgLabel(org: Org): string {
  return org.abbreviation === "ROOT" ? org.abbreviation : org.name;
}

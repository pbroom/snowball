import { cloneScenario, seedScenario } from "@snowball/scenario-store";
import { describe, expect, it } from "vitest";
import { LocalAuthorizationService } from "./index";

describe("LocalAuthorizationService", () => {
  const service = new LocalAuthorizationService();

  it("lets task view access flow through explicit inherited parent access", () => {
    const scenario = cloneScenario(seedScenario);

    const decision = service.explain({
      scenario,
      userId: "user-morgan",
      permission: "task.view",
      resourceType: "task",
      resourceId: "task-rebac-policy"
    });

    expect(decision.allowed).toBe(true);
    expect(decision.ruleId).toBe("task.parent-inheritance");
    expect(decision.path.map((step) => step.relation)).toContain("inherits_access_from");
  });

  it("enforces restricted resource grants independently from task visibility", () => {
    const scenario = cloneScenario(seedScenario);

    expect(
      service.check({
        scenario,
        userId: "user-casey",
        permission: "resource.view",
        resourceType: "resource",
        resourceId: "resource-ato-evidence"
      }).allowed
    ).toBe(true);

    expect(
      service.check({
        scenario,
        userId: "user-avery",
        permission: "resource.view",
        resourceType: "resource",
        resourceId: "resource-ato-evidence"
      }).allowed
    ).toBe(false);
  });

  it("evaluates every group grant for the same relation, not only the first", () => {
    const scenario = cloneScenario(seedScenario);
    const stamp = "2026-01-01T12:00:00.000Z";
    scenario.groups.push(
      { id: "group-no-blake", name: "Empty for Blake", description: "Regression guard" },
      { id: "group-blake-viewers", name: "Blake viewers", description: "Regression guard" }
    );
    scenario.tasks.push({
      id: "task-multi-group-viewer",
      type: "workspace",
      title: "Multi group viewer grant",
      owningOrgId: "org-records",
      createdByUserId: "user-casey",
      status: "open",
      createdAt: stamp,
      updatedAt: stamp
    });
    scenario.relationships.push(
      {
        id: "rel-blake-in-viewer-group",
        subjectType: "user",
        subjectId: "user-blake",
        relation: "member_of",
        objectType: "group",
        objectId: "group-blake-viewers"
      },
      {
        id: "rel-task-viewer-wrong-group-first",
        subjectType: "task",
        subjectId: "task-multi-group-viewer",
        relation: "viewer",
        objectType: "group",
        objectId: "group-no-blake"
      },
      {
        id: "rel-task-viewer-right-group-second",
        subjectType: "task",
        subjectId: "task-multi-group-viewer",
        relation: "viewer",
        objectType: "group",
        objectId: "group-blake-viewers"
      }
    );

    expect(
      service.check({
        scenario,
        userId: "user-blake",
        permission: "task.view",
        resourceType: "task",
        resourceId: "task-multi-group-viewer"
      }).allowed
    ).toBe(true);
  });

  it("evaluates every org grant for the same relation, not only the first", () => {
    const scenario = cloneScenario(seedScenario);
    const stamp = "2026-01-01T12:00:00.000Z";
    scenario.tasks.push({
      id: "task-multi-org-viewer",
      type: "workspace",
      title: "Multi org viewer grant",
      owningOrgId: "org-records",
      createdByUserId: "user-casey",
      status: "open",
      createdAt: stamp,
      updatedAt: stamp
    });
    scenario.relationships.push(
      {
        id: "rel-task-viewer-org-without-morgan",
        subjectType: "task",
        subjectId: "task-multi-org-viewer",
        relation: "viewer",
        objectType: "org",
        objectId: "org-platform"
      },
      {
        id: "rel-task-viewer-org-with-morgan",
        subjectType: "task",
        subjectId: "task-multi-org-viewer",
        relation: "viewer",
        objectType: "org",
        objectId: "org-executive"
      }
    );

    expect(
      service.check({
        scenario,
        userId: "user-morgan",
        permission: "task.view",
        resourceType: "task",
        resourceId: "task-multi-org-viewer"
      }).allowed
    ).toBe(true);
  });

  it("rebuilds cached indexes after in-place relationship changes", () => {
    const scenario = cloneScenario(seedScenario);

    expect(
      service.check({
        scenario,
        userId: "user-blake",
        permission: "task.view",
        resourceType: "task",
        resourceId: "task-rebac-policy"
      }).allowed
    ).toBe(false);

    scenario.relationships.push({
      id: "rel-task-rebac-policy-viewer-blake",
      subjectType: "task",
      subjectId: "task-rebac-policy",
      relation: "viewer",
      objectType: "user",
      objectId: "user-blake"
    });

    expect(
      service.check({
        scenario,
        userId: "user-blake",
        permission: "task.view",
        resourceType: "task",
        resourceId: "task-rebac-policy"
      }).allowed
    ).toBe(true);
  });

  it("rebuilds cached indexes after replacing relationships with the same length", () => {
    const scenario = cloneScenario(seedScenario);

    expect(
      service.check({
        scenario,
        userId: "user-blake",
        permission: "task.view",
        resourceType: "task",
        resourceId: "task-rebac-policy"
      }).allowed
    ).toBe(false);

    scenario.relationships = [
      ...scenario.relationships,
      {
        id: "rel-task-rebac-policy-viewer-blake",
        subjectType: "task",
        subjectId: "task-rebac-policy",
        relation: "viewer",
        objectType: "user",
        objectId: "user-blake"
      }
    ];

    expect(
      service.check({
        scenario,
        userId: "user-blake",
        permission: "task.view",
        resourceType: "task",
        resourceId: "task-rebac-policy"
      }).allowed
    ).toBe(true);
  });
});

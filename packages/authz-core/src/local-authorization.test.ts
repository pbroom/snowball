import { seedScenario } from "@snowball/scenario-store";
import { describe, expect, it } from "vitest";
import { LocalAuthorizationService, formatPath } from "./index";

const authz = new LocalAuthorizationService();

describe("LocalAuthorizationService", () => {
  it("allows owning org members to view and edit package tasks", () => {
    const view = authz.check({
      scenario: seedScenario,
      userId: "user-peter",
      permission: "task.view",
      resourceType: "task",
      resourceId: "task-package"
    });
    const edit = authz.check({
      scenario: seedScenario,
      userId: "user-peter",
      permission: "task.edit",
      resourceType: "task",
      resourceId: "task-package"
    });

    expect(view.allowed).toBe(true);
    expect(edit.allowed).toBe(true);
    expect(edit.ruleId).toBe("task.creator");
  });

  it("allows assigned org members to view and clear but not edit", () => {
    const view = authz.check({
      scenario: seedScenario,
      userId: "user-jane",
      permission: "task.view",
      resourceType: "task",
      resourceId: "task-package"
    });
    const clear = authz.check({
      scenario: seedScenario,
      userId: "user-jane",
      permission: "task.clear",
      resourceType: "task",
      resourceId: "task-clearance-eur"
    });
    const edit = authz.check({
      scenario: seedScenario,
      userId: "user-jane",
      permission: "task.edit",
      resourceType: "task",
      resourceId: "task-package"
    });

    expect(view.allowed).toBe(true);
    expect(clear.allowed).toBe(true);
    expect(edit.allowed).toBe(false);
    expect(formatPath(seedScenario, view.path)).toContain("EUR");
  });

  it("uses group grants for records review visibility", () => {
    const result = authz.check({
      scenario: seedScenario,
      userId: "user-asha",
      permission: "task.view",
      resourceType: "task",
      resourceId: "task-records"
    });

    expect(result.allowed).toBe(true);
    expect(result.ruleId).toBe("task.viewer.group");
    expect(formatPath(seedScenario, result.path)).toContain("Records Reviewers");
  });

  it("uses explicit approver grants for approval actions", () => {
    const result = authz.check({
      scenario: seedScenario,
      userId: "user-bob",
      permission: "task.approve",
      resourceType: "task",
      resourceId: "task-approval-ses"
    });

    expect(result.allowed).toBe(true);
    expect(result.ruleId).toBe("task.approver");
  });

  it("denies unrelated access with an actionable reason", () => {
    const result = authz.check({
      scenario: seedScenario,
      userId: "user-jane",
      permission: "task.approve",
      resourceType: "task",
      resourceId: "task-approval-ses"
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Approve requires");
  });
});

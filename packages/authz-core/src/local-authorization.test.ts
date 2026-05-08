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
});

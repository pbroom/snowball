import { describe, expect, it } from "vitest";
import { cloneScenario, importScenario, seedScenario, validateScenario } from "./index";

describe("scenario-store", () => {
  it("ships a valid starter scenario", () => {
    expect(validateScenario(seedScenario)).toEqual([]);
  });

  it("rejects imported scenarios with broken relationship references", () => {
    const scenario = cloneScenario(seedScenario);
    scenario.relationships.push({
      id: "rel-missing-user",
      subjectType: "user",
      subjectId: "user-missing",
      relation: "viewer",
      objectType: "task",
      objectId: "task-platform-shell"
    });

    expect(() => importScenario(JSON.stringify(scenario))).toThrow("user-missing");
  });
});

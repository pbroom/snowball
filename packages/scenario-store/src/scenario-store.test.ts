import { describe, expect, it } from "vitest";
import { exportScenario, importScenario, seedScenario, validateScenario } from "./index";

describe("scenario-store", () => {
  it("ships a valid seed scenario", () => {
    expect(validateScenario(seedScenario).filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("round-trips scenarios through JSON export and import", () => {
    const imported = importScenario(exportScenario(seedScenario));

    expect(imported.id).toBe(seedScenario.id);
    expect(imported.relationships.length).toBeGreaterThan(0);
  });

  it("reports dangling relationship references", () => {
    const scenario = {
      ...seedScenario,
      relationships: [
        ...seedScenario.relationships,
        {
          id: "rel-missing",
          subjectType: "user" as const,
          subjectId: "user-missing",
          relation: "member_of" as const,
          objectType: "org" as const,
          objectId: "org-af"
        }
      ]
    };

    expect(validateScenario(scenario).some((issue) => issue.message.includes("missing user subject"))).toBe(true);
  });
});

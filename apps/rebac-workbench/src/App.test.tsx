import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("switches the authenticated user and rerenders their visible tasks", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Avery Stone" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Blake Chen" }));

    expect(screen.getByRole("heading", { name: "Blake Chen" })).toBeInTheDocument();
    expect(screen.getAllByText("Operations review of the task shell").length).toBeGreaterThan(0);
  });
});

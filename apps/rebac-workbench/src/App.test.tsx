import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("switches simulated users and updates the task view", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Viewing as Peter Grant" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Jane Rivera/ }));

    expect(screen.getByRole("heading", { name: "Viewing as Jane Rivera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trip Memo Package/ })).toBeInTheDocument();
  });

  it("shows allow and deny explanations for the selected task", () => {
    render(<App />);

    const simulatedApp = screen.getByLabelText("Simulated application");
    expect(within(simulatedApp).getByText("Available Actions")).toBeInTheDocument();
    expect(within(simulatedApp).getByText("Denied Actions")).toBeInTheDocument();
    expect(within(simulatedApp).getByText(/The user belongs to AF/)).toBeInTheDocument();
  });
});

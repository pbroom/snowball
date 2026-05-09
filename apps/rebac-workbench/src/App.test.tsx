import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { ThemeProvider } from "./theme-provider";
import { useWorkbenchStore } from "./workbench-store";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it("switches the authenticated user and rerenders their visible tasks", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.getByRole("heading", { name: "Avery Stone" })).toBeInTheDocument();

    await user.click(screen.getByRole("row", { name: "Blake Chen" }));

    expect(screen.getByRole("heading", { name: "Blake Chen" })).toBeInTheDocument();
    expect(screen.getAllByText("Operations review of the task shell").length).toBeGreaterThan(0);
  });

  it("keeps inline org add editing focused and saves the full name", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    await user.click(screen.getByRole("button", { name: "Open actions for ROOT" }));
    await user.click(screen.getByRole("menuitem", { name: "Add org" }));

    const input = screen.getByRole("textbox", { name: "Rename New org" }) as HTMLInputElement;
    await waitFor(() => expect(input).toHaveFocus());
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("New org".length);
    expect(fireEvent.dragStart(input)).toBe(false);

    await user.keyboard("Platform Space Team");

    expect(input).toHaveFocus();
    expect(input).toHaveValue("Platform Space Team");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getAllByText("Platform Space Team").length).toBeGreaterThan(0);
  });

  it("collapses and expands identity tree branches without leaf toggles", async () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    const rootToggle = screen.getByRole("button", { name: "Collapse ROOT" });

    expect(screen.getByRole("row", { name: /Platform Team/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse Avery Stone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand Avery Stone" })).not.toBeInTheDocument();

    fireEvent.click(rootToggle);

    expect(screen.getByRole("button", { name: "Expand ROOT" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("row", { name: /Platform Team/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand ROOT" }));

    expect(screen.getByRole("button", { name: "Collapse ROOT" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("row", { name: /Platform Team/ })).toBeInTheDocument();
  });
});

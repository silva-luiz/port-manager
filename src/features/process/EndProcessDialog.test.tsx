// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import { installDialogPolyfill, renderWithProviders } from "../../test/render";
import type { ProcessDetails, TerminationOutcome } from "../../types/process";
import { EndProcessDialog } from "./EndProcessDialog";

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    api: { getSettings: vi.fn(), processDetails: vi.fn(), terminateProcess: vi.fn() },
  };
});

const target = { pid: 4321, name: "node.exe" };

function details(descendants: ProcessDetails["descendants"]): ProcessDetails {
  return {
    pid: target.pid,
    name: target.name,
    executablePath: null,
    pathError: null,
    commandLine: null,
    parent: null,
    descendants,
  };
}

const outcome: TerminationOutcome = { ...target, exited: true, children: [] };

beforeAll(installDialogPolyfill);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EndProcessDialog", () => {
  it("does nothing until confirmed, then ends only the process by default", async () => {
    vi.mocked(api.processDetails).mockResolvedValue(details([{ pid: 99, name: "esbuild.exe" }]));
    vi.mocked(api.terminateProcess).mockResolvedValue(outcome);
    const onEnded = vi.fn();
    await renderWithProviders(<EndProcessDialog target={target} onCancel={vi.fn()} onEnded={onEnded} />);

    // The dialog opens (showModal) in an effect, so wait for it to become accessible.
    expect(await screen.findByRole("heading", { name: "End node.exe?" })).toBeTruthy();
    expect(api.terminateProcess).not.toHaveBeenCalled();

    // The children option appears once details load, unchecked.
    const option = await screen.findByRole("checkbox", { name: /also end its child process/i });
    expect((option as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "End process" }));
    await waitFor(() => expect(onEnded).toHaveBeenCalledWith(outcome));
    expect(api.terminateProcess).toHaveBeenCalledWith(4321, "node.exe", false);
  });

  it("includes child processes only when the option is checked, listing them first", async () => {
    vi.mocked(api.processDetails).mockResolvedValue(
      details([
        { pid: 99, name: "esbuild.exe" },
        { pid: 100, name: "conhost.exe" },
      ]),
    );
    vi.mocked(api.terminateProcess).mockResolvedValue(outcome);
    await renderWithProviders(<EndProcessDialog target={target} onCancel={vi.fn()} onEnded={vi.fn()} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: /also end its 2 child processes/i }));
    expect(screen.getByText("esbuild.exe")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "End process" }));
    await waitFor(() => expect(api.terminateProcess).toHaveBeenCalledWith(4321, "node.exe", true));
  });

  it("shows the backend's refusal in the current language and stays open", async () => {
    vi.mocked(api.processDetails).mockResolvedValue(details([]));
    vi.mocked(api.terminateProcess).mockRejectedValue({ kind: "permissionDenied", pid: 4321, name: "node.exe" });
    const onEnded = vi.fn();
    await renderWithProviders(<EndProcessDialog target={target} onCancel={vi.fn()} onEnded={onEnded} />, "pt-BR");

    expect(await screen.findByRole("heading", { name: "Encerrar node.exe?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar processo" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("O Windows não permitiu acesso a node.exe (PID 4321)");
    expect(onEnded).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Encerrar processo" })).toBeTruthy();
  });

  it("cancels without calling the backend", async () => {
    vi.mocked(api.processDetails).mockResolvedValue(details([]));
    const onCancel = vi.fn();
    await renderWithProviders(<EndProcessDialog target={target} onCancel={onCancel} onEnded={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(api.terminateProcess).not.toHaveBeenCalled();
  });
});

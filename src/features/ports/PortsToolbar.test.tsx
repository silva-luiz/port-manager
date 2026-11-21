// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { DEFAULT_FILTERS, type PortFilters } from "./portQuery";
import { PortsToolbar } from "./PortsToolbar";

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return { ...actual, api: { getSettings: vi.fn() } };
});

afterEach(cleanup);

/** Real state, so the toolbar behaves as it does inside the Ports page. */
function Harness({ onChange }: { onChange: (filters: PortFilters) => void }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  return (
    <PortsToolbar
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        onChange(next);
      }}
      processNames={["hugo.exe", "node.exe"]}
      states={["listen", "timeWait"]}
      onRefresh={vi.fn()}
      refreshing={false}
    />
  );
}

describe("PortsToolbar", () => {
  it("flags an invalid port without blocking typing", async () => {
    await renderWithProviders(<Harness onChange={vi.fn()} />);
    const port = screen.getByRole("textbox", { name: "Local port" });

    fireEvent.change(port, { target: { value: "70000" } });
    expect(port.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(port, { target: { value: "3000" } });
    expect(port.getAttribute("aria-invalid")).toBe("false");
  });

  it("offers Clear filters only when something differs from the defaults", async () => {
    const onChange = vi.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Process" }), { target: { value: "hugo.exe" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_FILTERS);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("hides finished connections by default and can show them", async () => {
    const onChange = vi.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    const option = screen.getByRole("checkbox", { name: "Hide finished connections" }) as HTMLInputElement;
    expect(option.checked).toBe(true);

    fireEvent.click(option);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, hideInactive: false });
  });
});

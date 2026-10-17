import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LumeMemorySettings } from "./LumeMemorySettings";
import { supabase, useAuth } from "../supabase";

jest.mock("../supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
  useAuth: jest.fn(),
}));

// The real component with the shared pieces (SubTabs choice, Button link), not a mock of them.
function profileRow(row) {
  supabase.from.mockReturnValue({ select: () => ({ maybeSingle: () => Promise.resolve({ data: row }) }) });
}

describe("LumeMemorySettings", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: "u1" } });
    supabase.rpc.mockResolvedValue({});
  });

  it("renders nothing when signed out", () => {
    useAuth.mockReturnValue({ user: null });
    profileRow(null);
    const { container } = render(<LumeMemorySettings />);
    expect(container).toBeEmptyDOMElement();
  });

  it("memory is a two-way choice; picking Off turns it off", async () => {
    profileRow({ enabled: true, profile: { summary: "likes steel sports watches" } });
    render(<LumeMemorySettings />);
    expect(await screen.findByText(/likes steel sports watches/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Remember my taste" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Off" }));
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("set_ai_memory_enabled", { p_enabled: false }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true"));
  });

  it("picking the choice that is already on does nothing", async () => {
    profileRow({ enabled: true, profile: null });
    render(<LumeMemorySettings />);
    await screen.findByText(/Nothing yet/);
    fireEvent.click(screen.getByRole("radio", { name: "Remember my taste" }));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("Forget everything is off until there is something to forget, then resets", async () => {
    profileRow({ enabled: true, profile: null });
    const { unmount } = render(<LumeMemorySettings />);
    await screen.findByText(/Nothing yet/);
    expect(screen.getByRole("button", { name: "Forget everything" })).toBeDisabled();
    unmount();

    profileRow({ enabled: true, profile: { summary: "collects Heuer" } });
    render(<LumeMemorySettings />);
    await screen.findByText(/collects Heuer/);
    fireEvent.click(screen.getByRole("button", { name: "Forget everything" }));
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("reset_ai_profile"));
    expect(await screen.findByText(/Cleared/)).toBeInTheDocument();
  });
});

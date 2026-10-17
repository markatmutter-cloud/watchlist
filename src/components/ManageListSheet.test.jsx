import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManageListSheet } from "./ManageListSheet";

// The share dialog for a list. Rendered for real: a refactor of its shell must not silently drop
// the close, the invite form or the roster (there was no test before the Modal move).

const base = (over = {}) => ({
  open: true, onClose: jest.fn(), user: { id: "u1", email: "me@example.com" },
  collection: { id: "c1", name: "JLC shortlist" },
  inviteCollaborator: jest.fn(async () => ({ id: "inv1" })),
  revokeCollaborator: jest.fn(async () => ({})),
  listCollaborators: jest.fn(async () => ({ rows: [] })),
  ...over,
});

describe("ManageListSheet", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ManageListSheet {...base({ open: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is a dialog titled for the list, and closes from the x", async () => {
    const p = base();
    render(<ManageListSheet {...p} />);
    expect(screen.getByRole("dialog", { name: /JLC shortlist/ })).toBeInTheDocument();
    await waitFor(() => expect(p.listCollaborators).toHaveBeenCalledWith("c1"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it("shows the invite form and the roster with nobody on it yet", async () => {
    render(<ManageListSheet {...base()} />);
    expect(screen.getByPlaceholderText("name@example.com")).toHaveClass("ui-input");
    expect(await screen.findByText(/No collaborators yet/)).toBeInTheDocument();
  });

  it("sends an invite for the typed address", async () => {
    const p = base();
    render(<ManageListSheet {...p} />);
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() => expect(p.inviteCollaborator).toHaveBeenCalled());
    expect(p.inviteCollaborator.mock.calls[0][1]).toBe("sam@example.com");
  });
});

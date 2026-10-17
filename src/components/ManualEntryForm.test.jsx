import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualEntryForm } from "./ManualEntryForm";

// "Add a watch you own / sold". Rendered for real (it had no test before the Modal move).

const base = (over = {}) => ({
  open: true, onClose: jest.fn(), kind: "owned", collectionId: "own1",
  uploadWatchPhoto: jest.fn(async () => ({ url: "https://x/p.jpg" })),
  addManualItem: jest.fn(async () => ({ id: "m1" })),
  ...over,
});

describe("ManualEntryForm", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ManualEntryForm {...base({ open: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is titled for the kind of watch, with the shared fields", () => {
    const { rerender } = render(<ManualEntryForm {...base()} />);
    expect(screen.getByRole("dialog", { name: "Add a watch you own" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Submariner")).toHaveClass("ui-input");
    rerender(<ManualEntryForm {...base({ kind: "sold" })} />);
    expect(screen.getByRole("dialog", { name: "Add a sold watch" })).toBeInTheDocument();
  });

  it("cannot be saved without a brand, and then saves through addManualItem", async () => {
    const p = base();
    render(<ManualEntryForm {...p} />);
    const save = screen.getByRole("button", { name: "Save watch" });
    expect(save).toBeDisabled();
    const brand = screen.getAllByRole("textbox")[0];
    fireEvent.change(brand, { target: { value: "Rolex" } });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(p.addManualItem).toHaveBeenCalled());
    expect(p.addManualItem.mock.calls[0][0]).toBe("own1");
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
  });

  it("closes from Cancel", () => {
    const p = base();
    render(<ManualEntryForm {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onClose).toHaveBeenCalled();
  });
});

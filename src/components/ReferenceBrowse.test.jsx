import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReferenceBrowse } from "./ReferenceBrowse";

// Render-without-crash smoke tests for the reference browse surface.
// Self-contained nav reads window.location; jsdom's clean URL lands on the
// guides landing. 2026-06-03 chrome pass: the spelled-out brand row became a
// Brand pill + chip panel (StandardFilterBar), so brands are asserted via the
// pill + the card kickers ("Rolex · Submariner") instead of standalone tiles.
describe("ReferenceBrowse", () => {
  test("renders the guides landing with the standard filter bar + cards", () => {
    render(<ReferenceBrowse items={[]} />);
    expect(screen.getByText("Reference guides")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Brand/ })).toBeInTheDocument();
    // 2026-10-16 (Mark): Saved is an icon-only heart pill in the filter row, no
    // word, no sub-tab row. This reverses 2026-07-30 (sub-tab, never a pill);
    // the accessible name is what keeps it findable.
    expect(screen.getByRole("button", { name: "Show only saved guides" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Saved/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^All$/ })).not.toBeInTheDocument();
    // Guide cards carry "BRAND · MODEL LINE" kickers from the node registry.
    expect(screen.getAllByText(/Rolex/).length).toBeGreaterThanOrEqual(1);
  });

  test("the heart toggles, raises Clear all, and saved-only with nothing saved is an invite", () => {
    render(<ReferenceBrowse items={[]} />);
    expect(screen.queryByText(/Clear all/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show only saved guides" }));
    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.getByText(/Clear all/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Clear all/));
    expect(screen.getByRole("button", { name: "Show only saved guides" })).toHaveAttribute("aria-pressed", "false");
  });
});

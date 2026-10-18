import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CardShell from "./CardShell";

// Smoke tests for the shared card frame. Added 2026-06-06 after a prod
// ReferenceError ("Can't find variable: aspect") shipped inside the
// CardImage sub-component: the shells' render tests use MOCK grids
// (mockShellProps), so nothing in CI actually rendered a real CardShell
// with an image — the one component every card surface depends on had
// zero direct render coverage. These do the minimum: render with an
// image and without one (placeholder path), both aspects.

describe("CardShell", () => {
  test("renders with an image (square)", () => {
    render(
      <CardShell
        image={{ src: "https://example.com/x.jpg", alt: "x" }}
        href="https://example.com"
        level1={<div>Title</div>}
      />
    );
    expect(screen.getByAltText("x")).toBeInTheDocument();
  });

  test("renders with an image (editorial aspect)", () => {
    render(
      <CardShell
        image={{ src: "https://example.com/y.jpg", alt: "y" }}
        aspect="editorial"
        href="https://example.com"
        level1={<div>Title</div>}
      />
    );
    expect(screen.getByAltText("y")).toBeInTheDocument();
  });

  test("renders the placeholder when there is no image", () => {
    render(<CardShell image={null} href="https://example.com" level1={<div>Title</div>} />);
    expect(screen.getByText(/image not available/i)).toBeInTheDocument();
  });

  // The action stack is the shared Overlay pieces. This renders the real CardShell with them,
  // because the shell tests only ever render mock grids.
  test("the heart toggles without following the card link", () => {
    const onToggle = jest.fn();
    const onClickLink = jest.fn();
    render(
      <CardShell image={null} href="https://example.com" onClickLink={onClickLink}
        level1={<div>Title</div>} heart={{ wished: true, onToggle }} />
    );
    const heart = screen.getByRole("button", { name: "Save" });
    expect(heart).toHaveClass("ui-ovl", "is-on");
    fireEvent.click(heart);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onClickLink).not.toHaveBeenCalled();
  });

  test("the ⋯ menu lists the actions, runs one and closes", () => {
    const onAddToCollection = jest.fn();
    const onHide = jest.fn();
    const onExtra = jest.fn();
    render(
      <CardShell image={null} href="https://example.com" level1={<div>Title</div>}
        menu={{ onAddToCollection, onHide, isHidden: false, extraMenuItems: [{ label: "Compare", onClick: onExtra }] }} />
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Hide" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Compare" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Add to…" }));
    expect(onAddToCollection).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("share says Copied! and keeps the menu up for a moment", async () => {
    const onShare = jest.fn().mockResolvedValue({ copied: true });
    render(<CardShell image={null} href="https://example.com" level1={<div>Title</div>} menu={{ onShare }} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "Copied!" })).toBeInTheDocument();
  });

  test("the quick action is the same round button, olive when active", () => {
    const onClick = jest.fn();
    render(
      <CardShell image={null} href="https://example.com" level1={<div>Title</div>}
        quickAction={{ label: "Promote", icon: "↑", active: true, onClick }} />
    );
    const qa = screen.getByRole("button", { name: "Promote" });
    expect(qa).toHaveClass("ui-ovl", "is-on");
    fireEvent.click(qa);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("with no href it opens in-app: a button that takes click and Enter, and its menu still works", () => {
    const onOpen = jest.fn();
    const onClickLink = jest.fn();
    render(<CardShell image={null} onOpen={onOpen} onClickLink={onClickLink} level1={<div>Title</div>}
      menu={{ extraMenuItems: [{ label: "Remove", danger: true, onClick: () => {} }] }} />);
    const card = screen.getByRole("button", { name: /Title/ });
    expect(card.tagName).toBe("DIV");
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onClickLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveClass("ui-menu-item--danger");
  });
});


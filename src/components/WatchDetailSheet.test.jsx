import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WatchDetailSheet } from "./WatchDetailSheet";
import { confirm } from "./ConfirmModal";

jest.mock("./ConfirmModal", () => ({ confirm: jest.fn(), ConfirmHost: () => null }));

// CRA resets mock implementations between tests, so the confirm answer is set per test.
beforeEach(() => { confirm.mockResolvedValue(true); });

// The details sheet for an owned / sold watch: a pinned head and a scrolling body, full screen on a
// phone. Rendered for real (no test before the Modal move).

const item = { rowId: "r1", brand: "Rolex", model: "Submariner", ref: "5513", title: "Rolex Submariner 5513", flaggedForSale: false };
const base = (over = {}) => ({
  open: true, onClose: jest.fn(), item, isMobile: false,
  updateWatchDetails: jest.fn(async () => ({})), toggleFlagForSale: jest.fn(async () => ({})),
  removeItemFromCollection: jest.fn(async () => ({})), markItemAsSold: jest.fn(),
  collectionId: "c1", uploadWatchPhoto: jest.fn(),
  fetchComments: jest.fn(async () => ({ rows: [] })), postComment: jest.fn(async () => ({ row: { id: "n1", body: "x" } })),
  deleteComment: jest.fn(), user: { id: "u1" },
  ...over,
});

describe("WatchDetailSheet", () => {
  it("renders nothing when closed", () => {
    const { baseElement } = render(<WatchDetailSheet {...base({ open: false })} />);
    expect(baseElement.querySelector(".ui-modal")).toBeNull();
  });

  it("is a sheet dialog with its head pinned, and closes from the x", async () => {
    const p = base();
    render(<WatchDetailSheet {...p} />);
    const dlg = await screen.findByRole("dialog");
    expect(dlg).toHaveClass("ui-modal--sheet");
    expect(dlg).not.toHaveClass("ui-modal--full");
    await waitFor(() => expect(p.fetchComments).toHaveBeenCalledWith("r1"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it("fills a phone screen", async () => {
    render(<WatchDetailSheet {...base({ isMobile: true })} />);
    expect(await screen.findByRole("dialog")).toHaveClass("ui-modal--full");
  });

  it("flags for sale and marks as sold through the shared pills", async () => {
    const p = base();
    render(<WatchDetailSheet {...p} />);
    fireEvent.click(await screen.findByRole("button", { name: "Flag for sale" }));
    expect(p.toggleFlagForSale).toHaveBeenCalledWith("r1", true);
    fireEvent.click(screen.getByRole("button", { name: "Mark as sold" }));
    expect(p.markItemAsSold).toHaveBeenCalledWith("r1", item);
  });

  it("posts a dated note", async () => {
    const p = base();
    render(<WatchDetailSheet {...p} />);
    fireEvent.change(await screen.findByPlaceholderText(/Add a dated note/), { target: { value: "bracelet is original" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(p.postComment).toHaveBeenCalledWith("r1", "bracelet is original"));
  });

  it("removes from the collection after a confirm", async () => {
    const p = base();
    render(<WatchDetailSheet {...p} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove from collection" }));
    await waitFor(() => expect(p.removeItemFromCollection).toHaveBeenCalledWith("c1", undefined));
  });
});

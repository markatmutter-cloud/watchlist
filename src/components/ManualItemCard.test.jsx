import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualItemCard } from "./CollectionsTab";
import { confirm } from "./ConfirmModal";

jest.mock("./ConfirmModal", () => ({ confirm: jest.fn() }));

// A hand-entered watch (Owned / Sold lists) is the same CardShell as every other card in its
// grid: shared image frame, shared overlay ⋯ and menu, opening the detail sheet instead of a link.

const item = { id: "m1", brand: "Rolex", model: "Submariner", ref: "5513", material: "Steel",
               price: 9000, currency: "USD", comments: "Bought in 2019", img: "https://img/m1.jpg" };

describe("ManualItemCard", () => {
  beforeEach(() => { confirm.mockResolvedValue(true); });

  it("shows the title, reference line, price paid and notes in the shared card", () => {
    render(<ManualItemCard item={item} onRemove={() => {}} />);
    expect(screen.getByText("Rolex Submariner")).toBeInTheDocument();
    expect(screen.getByText("Ref 5513 · Steel")).toBeInTheDocument();
    expect(screen.getByText("Paid USD 9,000")).toBeInTheDocument();
    expect(screen.getByText("Bought in 2019")).toBeInTheDocument();
    expect(screen.getByAltText("Rolex Submariner")).toBeInTheDocument();
  });

  it("a sold watch carries its sold line", () => {
    render(<ManualItemCard item={{ ...item, soldPrice: 11000, soldDate: "2026-09-01" }} onRemove={() => {}} />);
    expect(screen.getByText("Sold USD 11,000 · 2026-09-01")).toBeInTheDocument();
  });

  it("tapping the card opens the detail sheet (keyboard too); with no handler it is not a button", () => {
    const onClickDetail = jest.fn();
    const { rerender } = render(<ManualItemCard item={item} onRemove={() => {}} onClickDetail={onClickDetail} />);
    const open = screen.getByRole("button", { name: /Rolex Submariner/ });
    fireEvent.click(open);
    fireEvent.keyDown(open, { key: "Enter" });
    expect(onClickDetail).toHaveBeenCalledTimes(2);
    rerender(<ManualItemCard item={item} onRemove={() => {}} />);
    expect(screen.queryByRole("button", { name: /Rolex Submariner/ })).toBeNull();
  });

  it("the ⋯ lists details, mark sold and a danger Remove that confirms first", async () => {
    const onRemove = jest.fn(async () => {});
    const onMarkSold = jest.fn();
    const onClickDetail = jest.fn();
    render(<ManualItemCard item={item} onRemove={onRemove} onMarkSold={onMarkSold} onClickDetail={onClickDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveClass("ui-menu-item--danger");
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark sold" }));
    expect(onMarkSold).toHaveBeenCalledTimes(1);
    expect(onClickDetail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ tone: "danger" }));
  });

  it("declining the confirm keeps the watch", async () => {
    confirm.mockResolvedValue(false);
    const onRemove = jest.fn();
    render(<ManualItemCard item={item} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(onRemove).not.toHaveBeenCalled();
  });
});

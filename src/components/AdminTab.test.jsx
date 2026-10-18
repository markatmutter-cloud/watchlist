import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AdminTab } from "./AdminTab";

// Direct render of the admin page (blind-edit rule: App.test never reaches it, since it needs an
// admin). Its section titles are the shared SectionHead and the cap form uses the shared fields.

jest.mock("../supabase", () => ({ supabase: null }));

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => null }));
});

describe("AdminTab", () => {
  it("renders its sections with the shared heading and the cap form with the shared fields", async () => {
    const { container } = render(<AdminTab watchItems={[]} hiddenItems={[]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Curation rules" })).toBeInTheDocument());
    for (const name of ["Brand velocity", "Fastest sales", "Auction house quality", "User limits", "Collection cleanup"]) {
      expect(screen.getByRole("heading", { name })).toHaveClass("ui-sechead-title");
    }
    // The admin jump anchors survive the heading swap.
    expect(container.querySelector("#sec-curation")).not.toBeNull();
    expect(container.querySelector("#sec-limits")).not.toBeNull();
    expect(container.querySelectorAll("h1").length).toBe(0);
  });

  it("the cap form takes the shared fields", async () => {
    const { container } = render(<AdminTab watchItems={[]} hiddenItems={[]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "User limits" })).toBeInTheDocument());
    const email = container.querySelector('input[type="email"]');
    expect(email).toHaveClass("ui-input");
    fireEvent.change(email, { target: { value: "a@b.co" } });
    expect(email).toHaveValue("a@b.co");
    expect(screen.getByRole("button", { name: "Set cap" })).toBeInTheDocument();
  });
});

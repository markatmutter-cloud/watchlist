import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreateStage } from "./ChallengeFlow";
import { SizeCompare } from "./SizeCompare";

// Direct renders (blind-edit rule): neither is reached by a shell or App test. Both are built
// from the shared Input / FieldLabel / Button / Pill, so these click and type for real.

describe("CreateStage (new challenge)", () => {
  it("title, count and budget are the shared fields; Start picking submits them", () => {
    const onSubmit = jest.fn();
    const { container } = render(<CreateStage challenge={null} onSubmit={onSubmit} onCancel={() => {}} />);
    const fields = container.querySelectorAll("input.ui-input");
    expect(fields.length).toBe(3);
    fireEvent.change(fields[0], { target: { value: "Three for 30k" } });
    fireEvent.change(fields[1], { target: { value: "4" } });
    fireEvent.change(fields[2], { target: { value: "30000" } });
    expect(fields[2]).toHaveValue("$30,000");
    fireEvent.click(screen.getByRole("button", { name: /Start picking/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Three for 30k", targetCount: 4, budget: 30000 });
  });

  it("Start picking is off with no budget", () => {
    render(<CreateStage challenge={null} onSubmit={() => {}} onCancel={() => {}} />);
    const budget = screen.getByPlaceholderText("$50,000");
    fireEvent.change(budget, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /Start picking/ })).toBeDisabled();
  });
});

describe("SizeCompare", () => {
  it("renders the shared fields and the photo slot as a pill, and Learn goes back", () => {
    const onBack = jest.fn();
    const { container } = render(<SizeCompare onBack={onBack} />);
    expect(container.querySelectorAll("input.ui-input").length).toBe(6);
    expect(screen.getAllByText("+ Add photo")[0]).toHaveClass("ui-pill");
    fireEvent.click(screen.getByRole("button", { name: /Learn/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("editing a dimension updates the field", () => {
    const { container } = render(<SizeCompare onBack={() => {}} />);
    const fields = container.querySelectorAll("input.ui-input");
    fireEvent.change(fields[1], { target: { value: "30" } });
    expect(fields[1]).toHaveValue(30);
  });
});

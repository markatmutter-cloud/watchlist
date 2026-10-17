import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ChatBubbleHost, renderInline } from "./ChatBubbleHost";
import { resolveItemByUrl } from "./ActionBus";
import { askLumeAbout } from "./LumeBus";

// Render-without-crash smoke tests for the concierge bubble (Epic 9).
// The launcher shows for everyone now (B-43) — signed-out taps prompt sign-in.
// We mock ../supabase the same way App.test.jsx mocks ./supabase.

let mockUser = null;

jest.mock("../supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
  useAuth: () => ({ user: mockUser, ready: true, signInWithGoogle: () => {} }),
}));

jest.mock("./ActionBus", () => ({
  dispatchAction: jest.fn(async () => ({ ok: true })),
  resolveItemByUrl: jest.fn(() => null),
}));

describe("ChatBubbleHost", () => {
  test("renders the launcher when signed out (sign-in entry point)", () => {
    mockUser = null;
    render(<ChatBubbleHost />);
    expect(screen.getByLabelText("Open Lumé")).toBeInTheDocument();
  });

  test("renders the launcher when signed in", () => {
    mockUser = { id: "user-123" };
    render(<ChatBubbleHost />);
    expect(screen.getByLabelText("Open Lumé")).toBeInTheDocument();
  });

  test("signed-in desktop: opening the chat exposes an Expand control that toggles to Collapse", () => {
    mockUser = { id: "user-123" }; // jsdom has no matchMedia → isMobile=false (desktop)
    render(<ChatBubbleHost />);
    fireEvent.click(screen.getByLabelText("Open Lumé"));
    const expand = screen.getByLabelText("Expand");
    fireEvent.click(expand);
    expect(screen.getByLabelText("Collapse")).toBeInTheDocument();
  });

  test("the first visit shows the 'Ask me' label beside the dot; opening once retires it", () => {
    mockUser = { id: "user-123" };
    try { localStorage.removeItem("lume_opened_v1"); } catch {}
    const first = render(<ChatBubbleHost />);
    expect(screen.getByRole("button", { name: "Ask me" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Open Lumé"));
    first.unmount();
    render(<ChatBubbleHost />);
    expect(screen.queryByRole("button", { name: "Ask me" })).toBeNull();
    expect(screen.getByLabelText("Open Lumé")).toBeInTheDocument();
  });

  test("the panel header names Lumé and says it is an AI that is still learning", () => {
    mockUser = { id: "user-123" };
    render(<ChatBubbleHost />);
    fireEvent.click(screen.getByLabelText("Open Lumé"));
    const panel = screen.getByRole("dialog", { name: "Lumé" });
    expect(panel).toHaveClass("ui-lume-panel");
    expect(panel.textContent).toMatch(/AI, still learning/);
  });

  test("signed out: the open panel is one sentence and one sign-in button", () => {
    mockUser = null;
    render(<ChatBubbleHost />);
    fireEvent.click(screen.getByLabelText("Open Lumé"));
    expect(screen.getByRole("button", { name: "Sign in to chat" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ask about a watch…")).toBeNull();
  });

  // The bubble renders through a portal to document.body, so assert on that.
  test("a plain open still shows the standard intro", () => {
    mockUser = { id: "user-123" };
    render(<ChatBubbleHost />);
    fireEvent.click(screen.getByLabelText("Open Lumé"));
    expect(document.body.textContent).toMatch(/what's your watch problem/i);
  });

  test("Share with Lumé opens seeded on the watch, without the standard intro", async () => {
    mockUser = { id: "user-123" };
    render(<ChatBubbleHost />);
    await act(async () => {
      askLumeAbout({ brand: "Rolex", model: "Submariner", reference_id: "5513", url: "https://dealer.com/5513" });
    });
    expect(document.body.textContent).not.toMatch(/what's your watch problem/i);
    expect(document.body.textContent).toMatch(/Submariner/); // seeded on the shared watch
  });
});

describe("renderInline — reply-body links", () => {
  test("a resolvable watch link opens IN-APP (onClick handler, no external target)", () => {
    resolveItemByUrl.mockReturnValueOnce({ id: "abc" }); // pretend it's a live watch
    const openInApp = jest.fn();
    const { container } = render(<div>{renderInline("see [the 5513](https://dealer.com/5513)", "k", openInApp)}</div>);
    const a = container.querySelector("a");
    expect(a).toHaveTextContent("the 5513");
    expect(a).not.toHaveAttribute("target", "_blank");
    a.click();
    expect(openInApp).toHaveBeenCalledWith("https://dealer.com/5513");
  });

  test("parses an angle-bracket-wrapped url and still routes in-app", () => {
    resolveItemByUrl.mockReturnValueOnce({ id: "x" });
    const openInApp = jest.fn();
    const { container } = render(<div>{renderInline("see [the 5513](<https://dealer.com/5513>)", "k", openInApp)}</div>);
    const a = container.querySelector("a");
    expect(a).toHaveTextContent("the 5513");
    expect(a).toHaveAttribute("href", "https://dealer.com/5513"); // brackets stripped
    a.click();
    expect(openInApp).toHaveBeenCalledWith("https://dealer.com/5513");
  });

  test("a non-resolvable link stays a normal external link", () => {
    resolveItemByUrl.mockReturnValueOnce(null); // article / citation / gone
    const openInApp = jest.fn();
    const { container } = render(<div>{renderInline("read [this](https://magazine.com/x)", "k", openInApp)}</div>);
    const a = container.querySelector("a");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("href", "https://magazine.com/x");
    expect(openInApp).not.toHaveBeenCalled(); // render alone must not open anything
  });
});

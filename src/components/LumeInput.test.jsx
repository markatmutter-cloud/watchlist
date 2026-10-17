import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LumeInput from "./LumeInput";

// The one Lumé composer, shared by the conversation and the mobile-home canvas. The real
// component against a plain `chat` object (the same shape useLumeChat returns).

function chatWith(over = {}) {
  return { draft: "", setDraft: jest.fn(), loading: false, listening: false, toggleMic: jest.fn(), ...over };
}

describe("LumeInput", () => {
  it("is one field with Send inside it, and Send is disabled until there is text", () => {
    const { container } = render(<LumeInput chat={chatWith()} onSend={jest.fn()} />);
    expect(container.querySelector(".ui-lume-field textarea")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("types into the chat's draft", () => {
    const chat = chatWith();
    render(<LumeInput chat={chat} onSend={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Ask about a watch…"), { target: { value: "5513" } });
    expect(chat.setDraft).toHaveBeenCalledWith("5513");
  });

  it("Enter sends, Shift+Enter does not", () => {
    const onSend = jest.fn();
    render(<LumeInput chat={chatWith({ draft: "  a 5513  " })} onSend={onSend} />);
    const box = screen.getByPlaceholderText("Ask about a watch…");
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("a 5513");
  });

  it("the Send button submits the trimmed draft", () => {
    const onSend = jest.fn();
    render(<LumeInput chat={chatWith({ draft: "hello " })} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("does not send while Lumé is answering", () => {
    const onSend = jest.fn();
    render(<LumeInput chat={chatWith({ draft: "hello", loading: true })} onSend={onSend} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Ask about a watch…")).toBeDisabled();
  });

  it("takes its placeholder from the surface, and the phone's bottom inset from isMobile", () => {
    const { container } = render(<LumeInput chat={chatWith()} onSend={jest.fn()} isMobile placeholder="Ask Lumé, or search the catalog…" />);
    expect(screen.getByPlaceholderText("Ask Lumé, or search the catalog…")).toBeInTheDocument();
    expect(container.querySelector(".ui-lume-compose--sheet")).not.toBeNull();
  });
});

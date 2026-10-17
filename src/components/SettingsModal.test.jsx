import React from "react";
import { render, screen } from "@testing-library/react";

// SettingsModal pulls in LumeMemorySettings → supabase.useAuth. Mock
// the supabase module so the modal renders without a network call.
// Same pattern as App.test.jsx's jest.mock("./supabase"). A signed-out
// useAuth makes LumeMemorySettings early-return null — fine for this
// road test, which is about the modal's own form rendering.
jest.mock("../supabase", () => ({
  supabase: null,
  useAuth: () => ({ user: null, ready: true }),
}));

// eslint-disable-next-line import/first
import { SettingsModal } from "./SettingsModal";

describe("SettingsModal", () => {
  const baseProps = {
    onClose: () => {},
    user: null,
    primaryCurrency: "USD", setPrimaryCurrency: () => {},
    isMobile: false,
    dark: false, setDarkOverride: () => {},
    mobileCols: 2, setMobileCols: () => {},
    desktopCols: "auto", setDesktopCols: () => {}, desktopAutoCols: 5,
    setAboutModalOpen: () => {},
  };

  test("returns null when closed", () => {
    const { container } = render(<SettingsModal open={false} {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders the section headings when open", () => {
    render(<SettingsModal open={true} {...baseProps} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Primary currency")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Columns")).toBeInTheDocument();
  });

  test("renders all three currency choices", () => {
    render(<SettingsModal open={true} {...baseProps} />);
    expect(screen.getByRole("radio", { name: /USD/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /GBP/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /EUR/ })).toBeInTheDocument();
  });

  test("the default-landing 'Make Lumé my home' preference is gone (removed with the Lumé tab 2026-06-18)", () => {
    render(<SettingsModal open={true} {...baseProps} user={{ id: "u1" }} />);
    expect(screen.queryByText("Make Lumé my home")).not.toBeInTheDocument();
    expect(screen.queryByText("Where the app opens")).not.toBeInTheDocument();
  });

  test("renders the mobile column picker (1/2/3) when isMobile", () => {
    render(<SettingsModal open={true} {...baseProps} isMobile />);
    expect(screen.getByRole("radio", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "3" })).toBeInTheDocument();
  });

  test("renders the desktop column picker (Auto/3/4/5/6/7) when not mobile", () => {
    render(<SettingsModal open={true} {...baseProps} isMobile={false} />);
    expect(screen.getByRole("radio", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "7" })).toBeInTheDocument();
  });
});

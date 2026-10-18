import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Pill, SavedPill, SearchField, SubTabs, FilterBar, PageFrame, Count,
  AccountDisc, SuggestionRows, Chip, ChipPanel, DismissChip, JumpNav, SectionHead, Button,
  Modal, ModalNote, ModalError, ModalFoot, FieldLabel, Input, PickRow,
  OverlayButton, OverlayHeart, OverlayMenu, MenuItem,
  AccountMenu, AccountMenuHead, AccountMenuSection,
} from "./index";

// The shared page frame. Pages are built from these and nothing else, so a break
// here breaks every tab; shell tests render MOCK content and would never see it.

describe("Pill", () => {
  it("renders a button with the pill class, and marks the selected look (solid olive)", () => {
    const { rerender } = render(<Pill>Source</Pill>);
    const btn = screen.getByRole("button", { name: "Source" });
    expect(btn).toHaveClass("ui-pill");
    expect(btn).not.toHaveClass("is-on");
    rerender(<Pill on>Source</Pill>);
    expect(screen.getByRole("button", { name: "Source" })).toHaveClass("is-on");
  });

  it("only sets aria-pressed for on/off toggles", () => {
    const { rerender } = render(<Pill on>Brand</Pill>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
    rerender(<Pill on toggle>Brand</Pill>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a count suffix", () => {
    render(<Pill on n={2}>Source</Pill>);
    expect(screen.getByRole("button")).toHaveTextContent("Source· 2");
  });

  it("an icon with no label is an icon-only circle", () => {
    render(<Pill icon={<svg data-testid="i" />} aria-label="Filters" />);
    expect(screen.getByRole("button", { name: "Filters" })).toHaveClass("ui-pill--icon");
  });

  it("clicks through", () => {
    const onClick = jest.fn();
    render(<Pill onClick={onClick}>Go</Pill>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SavedPill", () => {
  it("is a bare heart: no word, an accessible name that says what it does", () => {
    const { rerender } = render(<SavedPill on={false} onClick={() => {}} what="saved articles" />);
    const off = screen.getByRole("button", { name: "Show only saved articles" });
    expect(off).toHaveTextContent("");
    expect(off).toHaveAttribute("aria-pressed", "false");
    rerender(<SavedPill on onClick={() => {}} what="saved articles" />);
    const on = screen.getByRole("button", { name: "Show all" });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on).toHaveClass("is-on");
  });
});

describe("SearchField", () => {
  it("is one search role with a labelled input, and reports typing", () => {
    const onChange = jest.fn();
    render(<SearchField value="" onChange={onChange} placeholder="Search articles…" />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search articles…" }), { target: { value: "omega" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("offers a clear × only when there is a value and a handler", () => {
    const { rerender } = render(<SearchField value="" onChange={() => {}} onClear={() => {}} placeholder="s" />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    const onClear = jest.fn();
    rerender(<SearchField value="rolex" onChange={() => {}} onClear={onClear} placeholder="s" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("seats a trailing control and a suggestions child inside the field", () => {
    const { container } = render(
      <SearchField value="" onChange={() => {}} placeholder="s" trailing={<button>save</button>}>
        <div className="ui-search-drop">rows</div>
      </SearchField>);
    expect(container.querySelector(".ui-search .ui-search-trailing button")).not.toBeNull();
    expect(container.querySelector(".ui-search .ui-search-drop")).not.toBeNull();
  });

  it("takes its size from the prop, same component for header, row and phone", () => {
    const { container } = render(<SearchField size="bar" value="" onChange={() => {}} placeholder="s" />);
    expect(container.firstChild).toHaveClass("ui-search", "ui-search--bar");
  });
});

describe("SubTabs", () => {
  const tabs = [{ key: "a", label: "For sale" }, { key: "b", label: "Sold" }];

  it("is one segmented tablist with one selected tab, and selecting reports the key", () => {
    const onSelect = jest.fn();
    const { container } = render(<SubTabs tabs={tabs} activeKey="a" onSelect={onSelect} ariaLabel="Views" />);
    expect(container.firstChild).toHaveClass("ui-tabs");
    expect(screen.getByRole("tablist", { name: "Views" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "For sale" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sold" })).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByRole("tab", { name: "Sold" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("an icon-only tab keeps an accessible name (the Watches Saved heart)", () => {
    render(<SubTabs tabs={[{ key: "s", label: "♡", ariaLabel: "Saved" }]} activeKey="s" />);
    expect(screen.getByRole("tab", { name: "Saved" })).toHaveTextContent("♡");
  });

  it("has no underline variant (retired by Mark, 2026-10-17)", () => {
    const { container } = render(<SubTabs tabs={tabs} activeKey="a" variant="underline" />);
    expect(container.firstChild.className).toBe("ui-tabs");
  });
});

describe("FilterBar and PageFrame", () => {
  it("lays out pills, search and count in their own slots", () => {
    const { container } = render(
      <FilterBar pills={<Pill>Source</Pill>} search={<input aria-label="s" />} count="12 articles" end={<Pill>Date</Pill>} />);
    expect(container.querySelector(".ui-filterbar-pills")).toHaveTextContent("Source");
    expect(container.querySelector(".ui-filterbar-search input")).not.toBeNull();
    expect(container.querySelector(".ui-filterbar-end")).toHaveTextContent("Date");
    expect(screen.getByText("12 articles")).toHaveClass("ui-count");
  });

  it("a bar with no search says so, so it never reserves the search column", () => {
    const { container } = render(<FilterBar pills={<Pill>Source</Pill>} />);
    expect(container.querySelector(".ui-filterbar")).toHaveClass("ui-filterbar--nosearch");
    expect(container.querySelector(".ui-filterbar-search")).toBeNull();
  });

  it("PageFrame always orders sub-tabs, filter bar, content (and has no title band)", () => {
    const { container } = render(
      <PageFrame subTabs={<span>tabs</span>} filterBar={<div className="fb">bar</div>}>
        <p>content</p>
      </PageFrame>);
    const order = [...container.querySelectorAll(".ui-tabs-row, .fb, .ui-content")]
      .map((el) => el.className.split(" ")[0]);
    expect(order).toEqual(["ui-tabs-row", "fb", "ui-content"]);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("every band is optional", () => {
    const { container } = render(<PageFrame><p>only content</p></PageFrame>);
    expect(container.querySelector(".ui-tabs-row")).toBeNull();
    expect(screen.getByText("only content")).toBeInTheDocument();
  });
});

describe("FilterBar zone", () => {
  it("keeps the open options panel INSIDE the sticky zone, so it pins with the bar", () => {
    const { container } = render(
      <FilterBar sticky pills={<Pill>Source</Pill>} panel={<ChipPanel><Chip>Rolex</Chip></ChipPanel>} />);
    const zone = container.querySelector(".ui-filterzone");
    expect(zone).toHaveClass("is-sticky");
    expect(zone.querySelector(".ui-panel .ui-chip")).not.toBeNull();
  });

  it("is not sticky unless asked", () => {
    const { container } = render(<FilterBar pills={<Pill>Source</Pill>} />);
    expect(container.querySelector(".ui-filterzone")).not.toHaveClass("is-sticky");
  });

  it("can stack its search onto its own row, for a bar that carries too much for one line", () => {
    const { container } = render(<FilterBar stacked pills={<Pill>Source</Pill>} search={<input aria-label="s" />} />);
    expect(container.querySelector(".ui-filterbar")).toHaveClass("ui-filterbar--stacked");
    const plain = render(<FilterBar pills={<Pill>Source</Pill>} search={<input aria-label="s" />} />);
    expect(plain.container.querySelector(".ui-filterbar")).not.toHaveClass("ui-filterbar--stacked");
  });
});

describe("Pill as a link", () => {
  it("a pill with an href is an anchor that opens elsewhere, in the same look", () => {
    render(<Pill href="https://auction.example/sale">Auction house ↗</Pill>);
    const a = screen.getByRole("link", { name: "Auction house ↗" });
    expect(a).toHaveClass("ui-pill");
    expect(a).toHaveAttribute("href", "https://auction.example/sale");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toMatch(/noopener/);
  });
});

describe("FilterBar publishes where the pinned chrome ends", () => {
  // Date dividers read --sticky-top to stick just below the chrome. A window-scrolled
  // page has to publish it itself, or they hide behind the header and the filter bar.
  const heightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return 57; } });
  });
  afterAll(() => {
    if (heightDesc) Object.defineProperty(HTMLElement.prototype, "offsetHeight", heightDesc);
    else delete HTMLElement.prototype.offsetHeight;
  });

  it("sets --sticky-top on the page to the bar's pinned offset plus its own height", () => {
    const spy = jest.spyOn(window, "getComputedStyle").mockImplementation(() => ({ top: "56px" }));
    const { container, unmount } = render(
      <div className="ui-page"><FilterBar sticky pills={<span>p</span>} /></div>
    );
    expect(container.querySelector(".ui-page").style.getPropertyValue("--sticky-top")).toBe("113px");
    unmount();
    spy.mockRestore();
  });

  it("leaves the page alone when the bar is not pinned", () => {
    const { container } = render(
      <div className="ui-page"><FilterBar pills={<span>p</span>} /></div>
    );
    expect(container.querySelector(".ui-page").style.getPropertyValue("--sticky-top")).toBe("");
  });

  it("gives the page's own stylesheet a sensible default under the header alone", () => {
    const css = require("fs").readFileSync(require("path").join(__dirname, "ui.css"), "utf8");
    expect(css).toMatch(/\.ui-page\s*\{[^}]*--sticky-top:\s*var\(--ui-header-h\)/);
  });
});

describe("Chip", () => {
  it("is a selectable option with an optional count, solid when on", () => {
    const onClick = jest.fn();
    const { rerender } = render(<Chip n={12} onClick={onClick}>Rolex</Chip>);
    expect(screen.getByRole("button")).toHaveTextContent("Rolex12");
    expect(screen.getByRole("button")).not.toHaveClass("is-on");
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
    rerender(<Chip on quiet>Rolex</Chip>);
    expect(screen.getByRole("button")).toHaveClass("is-on", "ui-chip--quiet");
  });
});

describe("the small ones", () => {
  it("Count renders nothing without a value", () => {
    const { container } = render(<Count>{null}</Count>);
    expect(container).toBeEmptyDOMElement();
  });

  it("AccountDisc is one olive disc with the initial", () => {
    render(<AccountDisc initial="M" />);
    const disc = screen.getByRole("button", { name: "Account menu" });
    expect(disc).toHaveClass("ui-disc");
    expect(disc).toHaveTextContent("M");
  });

  it("SuggestionRows runs and removes rows, and renders nothing when empty", () => {
    const onRun = jest.fn();
    const onRemove = jest.fn();
    const rows = [{ id: "1", label: "Speedmaster pro", meta: "12 for sale" }];
    const { container, rerender } = render(<SuggestionRows heading="Saved searches" rows={rows} onRun={onRun} onRemove={onRemove} />);
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Speedmaster pro"));
    expect(onRun).toHaveBeenCalledWith(rows[0]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Speedmaster pro" }));
    expect(onRemove).toHaveBeenCalledWith(rows[0]);
    rerender(<SuggestionRows heading="Saved searches" rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Pill primary and as=span", () => {
  it("primary is the solid olive look for the one main action, without claiming to be selected", () => {
    render(<Pill primary>+ From feed</Pill>);
    const p = screen.getByRole("button", { name: "+ From feed" });
    expect(p).toHaveClass("ui-pill", "is-on");
    expect(p).not.toHaveAttribute("aria-pressed");
  });

  it("as=span is the look without a second control, for use inside something already clickable", () => {
    const { container } = render(<a href="/x"><Pill as="span">View listing →</Pill></a>);
    expect(container.querySelector("a > span.ui-pill")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("Button inline", () => {
  it("sizes to its label instead of growing to fill a row", () => {
    render(<Button primary inline>Sign in</Button>);
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass("ui-btn--primary", "ui-btn--inline");
  });
});

describe("DismissChip", () => {
  it("is a selected filter with a x that takes it off, named for what it removes", () => {
    const onRemove = jest.fn();
    render(<DismissChip label="Rolex" onRemove={onRemove}>Rolex</DismissChip>);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Rolex" }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("JumpNav", () => {
  it("is a labelled nav of pills; the active one is on, and tapping one goes to its section", () => {
    const onGo = jest.fn();
    const { container } = render(
      <JumpNav ariaLabel="Sections" activeKey="b" onGo={onGo}
               items={[{ key: "a", label: "Notes" }, { key: "b", label: "Watches" }]} />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watches" })).toHaveClass("is-on");
    expect(screen.getByRole("button", { name: "Notes" })).not.toHaveClass("is-on");
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(onGo).toHaveBeenCalledWith("a");
    expect(container.querySelector(".ui-jumpnav")).not.toBeNull();
  });
});

describe("SectionHead", () => {
  it("names a thing on the page, with its actions as pills and a way back", () => {
    const onExit = jest.fn();
    const share = jest.fn();
    render(<SectionHead title="JLC shortlist" meta="Shared by Sam" onExit={onExit} exitLabel="All lists"
                        actions={[{ label: "Share", onClick: share }, { label: "Auction house", href: "https://x.example" }]}
                        count="12 items" />);
    expect(screen.getByRole("heading", { level: 2, name: "JLC shortlist" })).toBeInTheDocument();
    expect(screen.getByText("Shared by Sam")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← All lists" }));
    expect(onExit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Auction house" })).toHaveAttribute("href", "https://x.example");
    expect(screen.getByText("12 items")).toBeInTheDocument();
  });

  it("with no title it is only the row of actions and the count (the sub-tab already says where you are)", () => {
    const { container } = render(<SectionHead count="3 lists" actions={[{ label: "Watchbox", onClick: () => {} }]} />);
    expect(container.querySelector(".ui-sechead-title")).toBeNull();
    expect(screen.getByRole("button", { name: "Watchbox" })).toBeInTheDocument();
    expect(screen.getByText("3 lists")).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("is a labelled dialog with a title, a close x, and its content", () => {
    const onClose = jest.fn();
    render(<Modal title="New list" onClose={onClose}><p>body</p></Modal>);
    const dlg = screen.getByRole("dialog", { name: "New list" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { level: 2, name: "New list" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the scrim and from Escape, but not from a click inside it", () => {
    const onClose = jest.fn();
    const { container } = render(<Modal title="T" onClose={onClose}><p>inside</p></Modal>);
    fireEvent.click(screen.getByText("inside"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".ui-modal-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("locked ignores the scrim and Escape (while saving)", () => {
    const onClose = jest.fn();
    const { container } = render(<Modal title="T" onClose={onClose} locked><p>x</p></Modal>);
    fireEvent.click(container.querySelector(".ui-modal-scrim"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("takes a width, and a head action in place of the x", () => {
    const { container } = render(
      <Modal title="Add to list" onClose={() => {}} width={420} headAction={<Button small primary>Done</Button>}>x</Modal>);
    expect(container.querySelector(".ui-modal").style.getPropertyValue("--ui-modal-w")).toBe("420px");
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("sheet pins its head and scrolls the body; full fills a phone; bare has no head of its own", () => {
    const a = render(<Modal title="Settings" onClose={() => {}} sheet full><p>b</p></Modal>);
    expect(a.container.querySelector(".ui-modal--sheet.ui-modal--full .ui-modal-head")).not.toBeNull();
    expect(a.container.querySelector(".ui-modal-body")).not.toBeNull();
    a.unmount();
    const b = render(<Modal bare onClose={() => {}} ariaLabel="About"><p>hero</p></Modal>);
    expect(b.container.querySelector(".ui-modal-head")).toBeNull();
    expect(screen.getByRole("dialog", { name: "About" })).toBeInTheDocument();
  });

  it("has the note, the error, the foot, the field label and the input", () => {
    render(<Modal title="T" onClose={() => {}}>
      <ModalNote>A note</ModalNote><FieldLabel>Name</FieldLabel><Input placeholder="List name" />
      <ModalError>Could not save</ModalError>
      <ModalFoot><Button small>Cancel</Button><Button small primary>Save</Button></ModalFoot>
    </Modal>);
    expect(screen.getByText("A note")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("List name")).toHaveClass("ui-input");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("ui-btn--primary", "ui-btn--sm");
  });
});

describe("PickRow and the choice SubTabs", () => {
  it("a plain pick row shows its name and meta; a toggle row shows a box and says whether it is on", () => {
    const { rerender } = render(<PickRow meta="3 items">Vintage divers</PickRow>);
    expect(screen.getByRole("button", { name: /Vintage divers/ })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByText("3 items")).toBeInTheDocument();
    rerender(<PickRow checked meta="3 items">Vintage divers</PickRow>);
    expect(screen.getByRole("button", { name: /Vintage divers/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("choice announces a radio group, block fills the width", () => {
    const onSelect = jest.fn();
    const { container } = render(
      <SubTabs choice block ariaLabel="Theme" activeKey="dark" onSelect={onSelect}
               tabs={[{ key: "light", label: "Light" }, { key: "dark", label: "Dark" }]} />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onSelect).toHaveBeenCalledWith("light");
    expect(container.querySelector(".ui-tabs--block")).not.toBeNull();
  });
});

describe("Button link, muted, danger and href", () => {
  it("link is a text action with no box; muted is the quiet footer size; link+danger is red text", () => {
    render(<><Button link>View all</Button><Button link muted>About</Button><Button link danger>Remove</Button></>);
    expect(screen.getByRole("button", { name: "View all" })).toHaveClass("ui-btn--link");
    expect(screen.getByRole("button", { name: "About" })).toHaveClass("ui-btn--link", "ui-btn--muted");
    expect(screen.getByRole("button", { name: "Remove" })).toHaveClass("ui-btn--link", "ui-btn--link-danger");
  });

  it("danger is the solid destructive confirm", () => {
    render(<Button danger>Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("ui-btn--danger");
  });

  it("an href makes the same look an anchor (a footer's Privacy / Terms)", () => {
    render(<Button link muted href="/privacy.html">Privacy</Button>);
    const a = screen.getByRole("link", { name: "Privacy" });
    expect(a).toHaveAttribute("href", "/privacy.html");
    expect(a).toHaveClass("ui-btn", "ui-btn--link");
  });

  it("icon is the bare 28px row button (a list row's pencil / share)", () => {
    render(<Button link icon aria-label="Rename">✎</Button>);
    expect(screen.getByRole("button", { name: "Rename" })).toHaveClass("ui-btn--link", "ui-btn--icon");
  });

  it("a submit button keeps its type", () => {
    render(<form><Button primary type="submit">Set cap</Button></form>);
    expect(screen.getByRole("button", { name: "Set cap" })).toHaveAttribute("type", "submit");
  });
});

describe("Overlay controls (the heart and ⋯ on an image)", () => {
  it("the heart is a pressed/unpressed toggle; saved is olive, never red", () => {
    const onClick = jest.fn();
    const { rerender } = render(<OverlayHeart aria-label="Save" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveClass("ui-ovl");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<OverlayHeart on aria-label="Save" onClick={onClick} />);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("is-on");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "true");
  });

  it("small is the tight-grid size", () => {
    render(<OverlayButton small aria-label="x">x</OverlayButton>);
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("ui-ovl--sm");
  });

  it("the menu opens under the button, portals to body and closes on an item, Escape and an outside press", async () => {
    const onPick = jest.fn();
    render(
      <a href="https://example.com" onClick={onPick}>
        <OverlayMenu>{({ close }) => <MenuItem onClick={() => { close(); onPick("item"); }}>Share</MenuItem>}</OverlayMenu>
      </a>
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const item = screen.getByRole("menuitem", { name: "Share" });
    expect(item.closest(".ui-menu").parentElement).toBe(document.body);
    // A press inside the menu never reaches the card's link behind it.
    fireEvent.click(screen.getByRole("menu"));
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledWith("item");
    expect(screen.queryByRole("menu")).toBeNull();
    // Escape closes it.
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 5));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    // So does a press anywhere else.
    fireEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 5));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("danger is the one destructive row", () => {
    render(<MenuItem danger>Remove</MenuItem>);
    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveClass("ui-menu-item", "ui-menu-item--danger");
  });
});

describe("AccountMenu", () => {
  it("signed in: the olive initial disc opens a panel of plain buttons, with Sign out beside the name", () => {
    const onSignOut = jest.fn();
    const onLists = jest.fn();
    render(
      <AccountMenu signedIn initial="M">
        {({ close }) => (
          <>
            <AccountMenuHead name="Mark Mutter" onSignOut={() => { close(); onSignOut(); }} />
            <MenuItem badge="Admin" onClick={() => { close(); onLists(); }}>Site stats</MenuItem>
            <AccountMenuSection>settings</AccountMenuSection>
          </>
        )}
      </AccountMenu>
    );
    const disc = screen.getByRole("button", { name: "Account menu" });
    expect(disc).toHaveClass("ui-disc");
    expect(disc).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Mark Mutter")).toBeNull();
    fireEvent.click(disc);
    expect(disc).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Mark Mutter")).toBeInTheDocument();
    // The panel also holds settings controls, so its rows are buttons, not ARIA menu items.
    expect(screen.getByRole("button", { name: /Site stats/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getByText("Admin")).toHaveClass("ui-menu-badge");
    fireEvent.click(screen.getByRole("button", { name: /Site stats/ }));
    expect(onLists).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Mark Mutter")).toBeNull();
    fireEvent.click(disc);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Mark Mutter")).toBeNull();
  });

  it("signed out: a Sign in pill opens the same panel", () => {
    render(<AccountMenu><MenuItem>About Watchlist</MenuItem></AccountMenu>);
    const pill = screen.getByRole("button", { name: "Menu" });
    expect(pill).toHaveClass("ui-pill");
    expect(pill).toHaveTextContent("Sign in");
    fireEvent.click(pill);
    expect(screen.getByRole("button", { name: "About Watchlist" })).toBeInTheDocument();
  });

  it("an outside press or Escape closes it; a press inside does not", () => {
    render(<div><AccountMenu signedIn initial="M"><MenuItem>Lists</MenuItem></AccountMenu><p>elsewhere</p></div>);
    const disc = screen.getByRole("button", { name: "Account menu" });
    fireEvent.click(disc);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Lists" }));
    expect(screen.getByRole("button", { name: "Lists" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("button", { name: "Lists" })).toBeNull();
    fireEvent.click(disc);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Lists" })).toBeNull();
  });
});


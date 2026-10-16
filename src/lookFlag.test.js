import { readLook, readChromeFaces } from "./lookFlag";

function at(search) { window.history.replaceState({}, "", `/${search}`); }

beforeEach(() => { window.localStorage.clear(); at(""); });
afterAll(() => { window.localStorage.clear(); at(""); });

describe("readLook", () => {
  it("defaults to the old look, so the live site is unchanged until opted in", () => {
    expect(readLook()).toBe("old");
  });

  it("?look=new turns it on and remembers it past the query string", () => {
    at("?look=new");
    expect(readLook()).toBe("new");
    at(""); // an iOS PWA launch drops the query
    expect(readLook()).toBe("new");
  });

  it("?look=old turns it back off and remembers that too", () => {
    at("?look=new"); readLook();
    at("?look=old");
    expect(readLook()).toBe("old");
    at("");
    expect(readLook()).toBe("old");
  });

  it("ignores values it doesn't know", () => {
    at("?look=banana");
    expect(readLook()).toBe("old");
    expect(window.localStorage.getItem("dial_look")).toBeNull();
  });

  it("falls back cleanly when storage throws", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readLook()).toBe("old");
    spy.mockRestore();
  });
});

describe("readChromeFaces", () => {
  it("defaults to system type (what the Watches page wears)", () => {
    expect(readChromeFaces()).toBe("system");
  });

  it("?chrome=display opts into the front page's faces and sticks", () => {
    at("?chrome=display");
    expect(readChromeFaces()).toBe("display");
    at("");
    expect(readChromeFaces()).toBe("display");
    at("?chrome=system");
    expect(readChromeFaces()).toBe("system");
  });
});

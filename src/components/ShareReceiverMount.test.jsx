import React from "react";
import { render } from "@testing-library/react";
import { ShareReceiver } from "./ShareReceiver";

// Regression (Mark 2026-10-23): a cold-loaded share link landed on Home. The
// receiver's first mirror report must be "active", never a false that makes
// App unmount it before its intent lands.
test("a share link reports the surface active on the first render", () => {
  window.history.pushState({}, "", "/?listing=abc123&shared=1&from=Mark");
  const setShareActive = jest.fn();
  const { getByText } = render(
    <ShareReceiver
      items={[{ id: "abc123", url: "https://x", source: "Phillips", ref: "Rolex 1675" }]}
      setShareActive={setShareActive}
    />
  );
  expect(setShareActive.mock.calls[0][0]).toBe(true);
  expect(setShareActive).not.toHaveBeenCalledWith(false);
  expect(getByText("Rolex 1675")).toBeTruthy();
  window.history.pushState({}, "", "/");
});

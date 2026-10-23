import { receiveIntentFromUrl } from "./receiveIntent";

test("a listing share link turns the share surface on", () => {
  expect(receiveIntentFromUrl("?listing=abc123&shared=1&from=Mark")).toEqual(
    { share: true, list: false, challenge: false, catalog: false });
});

test("each receiver type is recognised", () => {
  expect(receiveIntentFromUrl("?list=uuid&shared=1").list).toBe(true);
  expect(receiveIntentFromUrl("?challenge=c1&shared=1").challenge).toBe(true);
  expect(receiveIntentFromUrl("?newchallenge=1&t=x&n=3&b=5").challenge).toBe(true);
  expect(receiveIntentFromUrl("?catalog=https%3A%2F%2Fx&shared=1").catalog).toBe(true);
});

test("ordinary URLs open no share surface", () => {
  for (const s of ["", "?tab=listings", "?listing=abc123", "?shared=1"]) {
    const r = receiveIntentFromUrl(s);
    expect(r.share || r.list || r.challenge || r.catalog).toBe(false);
  }
});

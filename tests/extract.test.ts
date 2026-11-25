import { describe, expect, it } from "vitest";
import { extractEntities, uniqueDomains } from "../lib/extract";

const ex = (t: string) => extractEntities(t);
const vals = (spans: { value: string }[]) => spans.map((s) => s.value);

describe("extractEntities", () => {
  it("finds an https URL and its registrable domain", () => {
    const e = ex("Apply at https://careers.infosys.com/jobs?id=1.");
    expect(vals(e.urls)).toEqual(["https://careers.infosys.com/jobs?id=1"]);
    expect(e.domains[0].domain).toBe("infosys.com");
  });
  it("finds a bare www URL", () => {
    expect(vals(ex("visit www.hr-infosys-careers.online now").urls)).toEqual(["www.hr-infosys-careers.online"]);
  });
  it("finds a bare domain on a listed TLD", () => {
    const e = ex("Register at hotelrate-daily-earn.xyz today");
    expect(e.domains.map((d) => d.domain)).toEqual(["hotelrate-daily-earn.xyz"]);
  });
  it("does not treat Node.js or file.py as domains", () => {
    expect(ex("We use Node.js and run main.py").domains).toEqual([]);
  });
  it("finds emails and their domains", () => {
    const e = ex("Write to hr.infosys.recruit@gmail.com or jobs@tcs.com");
    expect(vals(e.emails)).toEqual(["hr.infosys.recruit@gmail.com", "jobs@tcs.com"]);
    expect(uniqueDomains(e).map((d) => d.domain)).toEqual(["gmail.com", "tcs.com"]);
  });
  it("treats dotless @ybl as UPI, not email", () => {
    const e = ex("pay to hrdesk.infosys@ybl now");
    expect(vals(e.upi)).toEqual(["hrdesk.infosys@ybl"]);
    expect(e.emails).toEqual([]);
  });
  it("finds @paytm and @oksbi UPI handles", () => {
    expect(vals(ex("UPI: 9876543210@paytm or rahul.k@oksbi").upi)).toEqual(["9876543210@paytm", "rahul.k@oksbi"]);
  });
  it("ignores unknown dotless hosts", () => {
    const e = ex("ping me @ home or user@localhost");
    expect(e.upi).toEqual([]);
    expect(e.emails).toEqual([]);
  });
  it("finds +91 phone numbers with spaces", () => {
    expect(vals(ex("Call +91 90000 00000 now").phones)).toEqual(["+91 90000 00000"]);
  });
  it("finds plain 10-digit mobile numbers", () => {
    expect(vals(ex("WhatsApp 9123456780 for details").phones)).toEqual(["9123456780"]);
  });
  it("does not treat short numbers as phones", () => {
    expect(ex("Room 4021, batch of 2027").phones).toEqual([]);
  });
  it("does not treat money amounts as phones", () => {
    expect(ex("Salary ₹6,00,000 per annum").phones).toEqual([]);
  });
  it("parses rupee amounts with Indian grouping", () => {
    const m = ex("Pay ₹1,999 today").money[0];
    expect(m.value).toBe("₹1,999");
    expect(m.amount).toBe(1999);
    expect(m.currency).toBe("INR");
  });
  it("parses Rs. and INR prefixes", () => {
    expect(ex("fee Rs. 500 and INR 2000").money.map((m) => m.amount)).toEqual([500, 2000]);
  });
  it("parses suffix forms like 1500/- and 300 rupees", () => {
    expect(ex("fees 1500/- or 300 rupees").money.map((m) => m.amount)).toEqual([1500, 300]);
  });
  it("parses dollars", () => {
    const m = ex("Earn $150 per day").money[0];
    expect(m.currency).toBe("USD");
    expect(m.amount).toBe(150);
  });
  it("parses k suffix", () => {
    expect(ex("stipend ₹25k").money[0].amount).toBe(25000);
  });
  it("handles Hinglish WhatsApp formatting", () => {
    const e = ex("*Registration ke liye* ₹499 bhejo 👉 9123456780@ybl\nJoin: t.me/earn_daily");
    expect(e.money[0].amount).toBe(499);
    expect(vals(e.upi)).toEqual(["9123456780@ybl"]);
    expect(vals(e.urls)).toEqual(["t.me/earn_daily"]);
  });
  it("extracts t.me links as bare domains", () => {
    const e = ex("Join https://t.me/earn_daily");
    expect(e.domains[0].domain).toBe("t.me");
  });
  it("strips trailing punctuation from URLs", () => {
    expect(vals(ex("See (https://bit.ly/abc).").urls)).toEqual(["https://bit.ly/abc"]);
  });
  it("returns exact offsets for every entity", () => {
    const t = "Mail a@gmail.com, pay ₹99 to x@ybl, visit www.foo.xyz, call +91 90000 00000";
    const e = ex(t);
    for (const s of [...e.urls, ...e.emails, ...e.upi, ...e.phones, ...e.money, ...e.domains]) {
      expect(t.slice(s.start, s.end)).toBe(s.value);
    }
  });
  it("returns nothing for plain prose", () => {
    const e = ex("Thanks for applying. We will get back to you soon.");
    expect([e.urls, e.emails, e.upi, e.phones, e.money, e.domains].every((a) => a.length === 0)).toBe(true);
  });
});

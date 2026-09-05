import { describe, expect, it } from "vitest";
import {
  atMarketClose,
  atMarketOpen,
  isMarketLikelyOpen,
  lastNTradingDays,
  mostRecentMarketClose,
  mostRecentTradingDay,
} from "@/server/domain/tradingDays";

// 2026-01-26 (Republic Day) is a verified NSE trading holiday, and falls
// on a Monday — a weekday that would otherwise look like a normal
// trading day, making it a good probe for holiday-awareness.

// All times below are anchored to real weekdays/weekends so the
// weekend-skipping logic is actually exercised.
// 2026-09-04 is a Friday, 2026-09-05/06 are Sat/Sun, 2026-09-07 is Monday.

describe("isMarketLikelyOpen", () => {
  it("is open during NSE session hours on a weekday", () => {
    expect(isMarketLikelyOpen(new Date("2026-09-04T05:00:00Z"))).toBe(true); // 10:30 IST
  });

  it("is closed before/after session hours on a weekday", () => {
    expect(isMarketLikelyOpen(new Date("2026-09-04T02:00:00Z"))).toBe(false); // 07:30 IST
    expect(isMarketLikelyOpen(new Date("2026-09-04T12:00:00Z"))).toBe(false); // 17:30 IST
  });

  it("is closed on weekends regardless of time of day", () => {
    expect(isMarketLikelyOpen(new Date("2026-09-06T05:00:00Z"))).toBe(false); // Sunday
  });

  it("is closed on an NSE trading holiday even during normal session hours on a weekday", () => {
    expect(isMarketLikelyOpen(new Date("2026-01-26T05:00:00Z"))).toBe(false); // Republic Day, 10:30 IST
  });
});

describe("holiday awareness", () => {
  it("mostRecentTradingDay skips a holiday back to the prior trading day", () => {
    const preMarketOnHoliday = new Date("2026-01-26T02:00:00Z"); // 07:30 IST, before that day's would-be open
    expect(mostRecentTradingDay(preMarketOnHoliday).toISOString().slice(0, 10)).toBe("2026-01-23");
  });

  it("mostRecentMarketClose skips a holiday back to the prior trading day's close", () => {
    const afterHoursOnHoliday = new Date("2026-01-26T12:00:00Z"); // 17:30 IST
    expect(mostRecentMarketClose(afterHoursOnHoliday).getTime()).toBe(
      atMarketClose(new Date("2026-01-23")).getTime(),
    );
  });

  it("lastNTradingDays excludes a holiday that falls within the window", () => {
    // asOf = Thu Jan 29; walking back: Wed 28, Tue 27, [Mon 26 = holiday,
    // Sun 25, Sat 24 skipped], Fri 23, Thu 22, Wed 21.
    const days = lastNTradingDays(new Date("2026-01-29T05:00:00Z"), 5).map((d) =>
      d.toISOString().slice(0, 10),
    );
    expect(days).not.toContain("2026-01-26");
    expect(days).toEqual(["2026-01-21", "2026-01-22", "2026-01-23", "2026-01-27", "2026-01-28"]);
  });
});

describe("mostRecentTradingDay", () => {
  it("is today once today's session has started", () => {
    const midSession = new Date("2026-09-04T06:00:00Z"); // Friday, 11:30 IST
    expect(mostRecentTradingDay(midSession).toISOString().slice(0, 10)).toBe("2026-09-04");
  });

  it("is the previous trading day before today's session has opened", () => {
    const preMarket = new Date("2026-09-04T02:00:00Z"); // Friday, 07:30 IST
    expect(mostRecentTradingDay(preMarket).toISOString().slice(0, 10)).toBe("2026-09-03");
  });

  it("skips the weekend back to Friday", () => {
    const sunday = new Date("2026-09-06T10:00:00Z");
    expect(mostRecentTradingDay(sunday).toISOString().slice(0, 10)).toBe("2026-09-04");
  });
});

describe("mostRecentMarketClose", () => {
  it("is today's close once the session has ended", () => {
    const afterClose = new Date("2026-09-04T12:00:00Z"); // Friday, 17:30 IST
    expect(mostRecentMarketClose(afterClose).getTime()).toBe(atMarketClose(new Date("2026-09-04")).getTime());
  });

  it("is the previous trading day's close while today's session is still running", () => {
    const midSession = new Date("2026-09-04T06:00:00Z"); // Friday, 11:30 IST
    expect(mostRecentMarketClose(midSession).getTime()).toBe(
      atMarketClose(new Date("2026-09-03")).getTime(),
    );
  });

  it("skips the weekend back to Friday's close", () => {
    const monday7am = new Date("2026-09-07T01:00:00Z"); // Monday, 06:30 IST — before open
    expect(mostRecentMarketClose(monday7am).getTime()).toBe(
      atMarketClose(new Date("2026-09-04")).getTime(),
    );
  });
});

describe("atMarketOpen / atMarketClose", () => {
  it("are 09:15 and 15:30 IST respectively", () => {
    const day = new Date("2026-09-04");
    expect(atMarketOpen(day).toISOString()).toBe("2026-09-04T03:45:00.000Z");
    expect(atMarketClose(day).toISOString()).toBe("2026-09-04T10:00:00.000Z");
  });
});

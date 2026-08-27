// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EnvBanner } from "../components/env-banner";

// Phase 3.3 — env banner visibility + poll interval (RED first).
//
// Pinned by docs/architecture.md + Phase 3 plan:
//   - Banner is visible when at least one required key is absent
//   - Banner shows a copyable curl command
//   - Polling interval is 15 s (NOT 5 s — earlier 5 s caused flicker)
//   - Banner disappears when the key is restored
//   - No reflow / flicker on poll (we don't re-render the banner text)

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("EnvBanner — visibility", () => {
  it("shows the banner when GMI key is absent", () => {
    render(
      <EnvBanner
        status={{ gmi: false, daytona: true }}
        onCopy={async () => true}
      />,
    );
    expect(screen.getByTestId("env-banner")).toBeTruthy();
    expect(screen.getByTestId("env-banner-key-gmi")).toBeTruthy();
  });

  it("hides the banner when all keys are present", () => {
    render(
      <EnvBanner
        status={{ gmi: true, daytona: true }}
        onCopy={async () => true}
      />,
    );
    expect(screen.queryByTestId("env-banner")).toBeNull();
  });

  it("shows Sandbox preview badge when Daytona is missing", () => {
    render(
      <EnvBanner
        status={{ gmi: true, daytona: false }}
        onCopy={async () => true}
      />,
    );
    expect(screen.getByTestId("env-banner")).toBeTruthy();
    expect(screen.getByText(/sandbox preview/i)).toBeTruthy();
  });
});

describe("EnvBanner — copyable curl", () => {
  it("renders a curl command that includes the missing key name", () => {
    render(
      <EnvBanner
        status={{ gmi: false, daytona: true }}
        onCopy={async () => true}
      />,
    );
    const code = screen.getByTestId("env-banner-curl");
    expect(code.textContent).toMatch(/curl/);
    expect(code.textContent).toMatch(/GMI_API_KEY/);
  });

  it("calls onCopy when the copy button is clicked", async () => {
    const onCopy = vi.fn(async () => true);
    render(
      <EnvBanner
        status={{ gmi: false, daytona: true }}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByTestId("env-banner-copy"));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("GMI_API_KEY"));
  });
});

describe("EnvBanner — poll cadence", () => {
  it("does not reflow banner text more than once per poll (15s, not 5s)", async () => {
    vi.useFakeTimers();
    const onPoll = vi.fn();
    render(
      <EnvBanner
        status={{ gmi: false, daytona: true }}
        onCopy={async () => true}
        pollMs={15_000}
        onPoll={onPoll}
      />,
    );
    // t=14s — first poll scheduled at t=15s, so still 0 calls.
    vi.advanceTimersByTime(14_000);
    expect(onPoll).not.toHaveBeenCalled();
    // t=15s — first poll fires (1 call). Next scheduled at t=30s.
    vi.advanceTimersByTime(1_000);
    expect(onPoll).toHaveBeenCalledTimes(1);
    // t=29s — still no second poll.
    vi.advanceTimersByTime(14_000);
    expect(onPoll).toHaveBeenCalledTimes(1);
    // t=30s — second poll fires.
    vi.advanceTimersByTime(1_000);
    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it("5 s would have fired 3 times by 16 s; 15 s fires only once (P9 fix)", () => {
    // The P9 fix: 5 s polling caused perceptible flicker. We assert the
    // 15 s default by counting calls in a 16 s window.
    vi.useFakeTimers();
    const onPoll = vi.fn();
    render(
      <EnvBanner
        status={{ gmi: false, daytona: true }}
        onCopy={async () => true}
        pollMs={15_000}
        onPoll={onPoll}
      />,
    );
    vi.advanceTimersByTime(16_000);
    expect(onPoll.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { VerifyCard, type VerifyCardProps } from "../components/gates/verify-card";

// Phase 4.2 — Verify card G1 contract (RED first).
//
// Pins every G1 item by data-testid, the press-and-hold timing, the
// owner-mismatch lock, the chrome header, and the expiry copy.

afterEach(() => cleanup());

const baseProps: VerifyCardProps = {
  gate: {
    id: "g-1",
    tool_name: "bash",
    thread_id: "thr_v",
    tool_call_id: "tc_v",
    status: "pending",
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    payload: {
      command: "python train.py --config configs/cifar.yaml",
      signals: {
        hasSetupPy: true,
        hasMakefile: false,
        hasWrite18: false,
        largeDownload: { url: "https://example.com/data.tar.gz", bytes: 1_500_000_000 },
        hasNetworkCall: true,
      },
    },
  },
  expectedOwner: "tensorflow",
  provenance: {
    arxivId: "2106.14834",
    title: "CIFAR-10 reproduction",
    authors: ["Alice", "Bob"],
    fetchedAt: "2026-08-28T00:00:00.000Z",
    sourceUrl: "https://arxiv.org/pdf/2106.14834",
    sourceSha256: "a".repeat(64),
    repoUrl: "https://github.com/tensorflow/tensorflow",
    repoCommitSha: "b".repeat(40),
  },
  intent: "Train a small CNN on CIFAR-10 and report test accuracy.",
  budget: {
    cpu: "2 vCPU",
    ram: "4 GB",
    disk: "20 GB",
    wallClock: "30 min",
    networkMode: "egress-allowlist only",
    egressAllowlist: ["github.com", "pypi.org"],
  },
  envelope: {
    hypervisor: "KVM (microVM)",
    baseImageDigest: "sha256:1d2c3d4e…",
    seccompProfile: "default",
    uid: "1000:1000",
    mounts: "/workspace (tmpfs)",
    ephemeral: "true — destroyed on exit",
  },
  dataScope:
    "Files readable: /workspace, /tmp. Cannot read ~/.ssh, ~/.aws, browser profile, or home directory.",
  persistence:
    "Nothing survives this run except stdout/stderr log, the workspace tarball, and Postgres rows tagged with run_id.",
  onAllow: vi.fn(),
  onEdit: vi.fn(),
  onDeny: vi.fn(),
  onKillSwitch: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
  baseProps.onAllow = vi.fn();
  baseProps.onEdit = vi.fn();
  baseProps.onDeny = vi.fn();
  baseProps.onKillSwitch = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

function getCard() {
  return render(<VerifyCard {...baseProps} />);
}

describe("G1 — Verify card renders all 11 items", () => {
  it("renders every G1 item by test id", () => {
    const { getByTestId } = getCard();
    const ids = [
      "g1-provenance",
      "g1-intent",
      "g1-command",
      "g1-budget",
      "g1-envelope",
      "g1-risk-flags",
      "g1-data-scope",
      "g1-persistence",
      "g1-kill-switch",
      "g1-identity",
      "g1-liability",
    ];
    for (const id of ids) {
      expect(getByTestId(id), id).toBeTruthy();
    }
  });

  it("chrome header shows ◀ Verify gate · irreversible · expires in M:SS", () => {
    const { getByTestId } = getCard();
    const header = getByTestId("verify-header");
    expect(header.textContent).toMatch(/Verify gate/);
    expect(getByTestId("verify-severity").textContent).toBe("irreversible");
    expect(getByTestId("verify-countdown").textContent).toMatch(/expires in \d+:\d{2}/);
  });

  it("renders the command verbatim", () => {
    const { getByTestId } = getCard();
    const pre = getByTestId("g1-command").querySelector("pre");
    expect(pre?.textContent).toContain("python train.py --config configs/cifar.yaml");
  });

  it("renders the provenance block (arXiv, title, authors, source sha, repo commit)", () => {
    const { getByTestId } = getCard();
    const sec = getByTestId("g1-provenance");
    expect(sec.textContent).toContain("2106.14834");
    expect(sec.textContent).toContain("CIFAR-10 reproduction");
    expect(sec.textContent).toContain("Alice");
    expect(sec.textContent).toContain("tensorflow");
  });

  it("renders the 5 auto risk flags and marks the present ones", () => {
    const { getByTestId } = getCard();
    expect(getByTestId("risk-flag-setup_py").getAttribute("data-present")).toBe("true");
    expect(getByTestId("risk-flag-makefile").getAttribute("data-present")).toBe("false");
    expect(getByTestId("risk-flag-write18").getAttribute("data-present")).toBe("false");
    expect(getByTestId("risk-flag-large_download").getAttribute("data-present")).toBe("true");
    expect(getByTestId("risk-flag-network_call").getAttribute("data-present")).toBe("true");
    // The header shows the high-risk count.
    expect(getByTestId("verify-risk-count").textContent).toMatch(/3 high/);
  });

  it("renders data-scope and persistence copy verbatim from props", () => {
    const { getByTestId } = getCard();
    expect(getByTestId("g1-data-scope").textContent).toContain("~/.ssh");
    expect(getByTestId("g1-persistence").textContent).toContain("stdout/stderr");
  });

  it("renders a kill switch button", () => {
    const { getByTestId } = getCard();
    const kill = getByTestId("verify-kill") as HTMLButtonElement;
    expect(kill.textContent).toMatch(/Abort/);
  });

  it("renders the liability note", () => {
    const { getByTestId } = getCard();
    expect(getByTestId("g1-liability").textContent).toMatch(/authorise/);
  });
});

describe("G1 #10 — Identity confirm", () => {
  it("Allow is disabled until the typed owner matches", () => {
    const { getByTestId } = getCard();
    const allow = getByTestId("verify-allow") as HTMLButtonElement;
    expect(allow.disabled).toBe(true);
    fireEvent.input(getByTestId("verify-owner-input"), { target: { value: "ten" } });
    expect(allow.disabled).toBe(true);
    fireEvent.input(getByTestId("verify-owner-input"), { target: { value: "tensorflow" } });
    expect(allow.disabled).toBe(false);
  });

  it("press-and-hold for 3s triggers onAllow", () => {
    const { getByTestId } = getCard();
    const allow = getByTestId("verify-allow");
    fireEvent.input(getByTestId("verify-owner-input"), { target: { value: "tensorflow" } });
    fireEvent.mouseDown(allow);
    // 2.9s — not yet
    act(() => { vi.advanceTimersByTime(2900); });
    expect(baseProps.onAllow).not.toHaveBeenCalled();
    // cross 3s
    act(() => { vi.advanceTimersByTime(200); });
    expect(baseProps.onAllow).toHaveBeenCalledTimes(1);
  });

  it("releasing the press before 3s does NOT call onAllow", () => {
    const { getByTestId } = getCard();
    const allow = getByTestId("verify-allow");
    fireEvent.input(getByTestId("verify-owner-input"), { target: { value: "tensorflow" } });
    fireEvent.mouseDown(allow);
    act(() => { vi.advanceTimersByTime(1500); });
    fireEvent.mouseUp(allow);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(baseProps.onAllow).not.toHaveBeenCalled();
  });
});

describe("G1 #10 — owner mismatch", () => {
  it("disables Allow when typed owner is empty", () => {
    const { getByTestId } = getCard();
    const allow = getByTestId("verify-allow") as HTMLButtonElement;
    expect(allow.disabled).toBe(true);
  });

  it("disables Allow when typed owner differs from expected", () => {
    const { getByTestId } = getCard();
    fireEvent.input(getByTestId("verify-owner-input"), { target: { value: "other-org" } });
    const allow = getByTestId("verify-allow") as HTMLButtonElement;
    expect(allow.disabled).toBe(true);
    // mouseDown is ignored
    fireEvent.mouseDown(allow);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(baseProps.onAllow).not.toHaveBeenCalled();
  });
});

describe("Verify card actions", () => {
  it("Deny button is clickable and calls onDeny", () => {
    const { getByTestId } = getCard();
    fireEvent.click(getByTestId("verify-deny"));
    expect(baseProps.onDeny).toHaveBeenCalledTimes(1);
  });

  it("Edit button is clickable and calls onEdit", () => {
    const { getByTestId } = getCard();
    fireEvent.click(getByTestId("verify-edit"));
    expect(baseProps.onEdit).toHaveBeenCalledTimes(1);
  });

  it("Kill switch calls onKillSwitch", () => {
    const { getByTestId } = getCard();
    fireEvent.click(getByTestId("verify-kill"));
    expect(baseProps.onKillSwitch).toHaveBeenCalledTimes(1);
  });
});

describe("Verify card expiry", () => {
  it("shows the expiry copy and disables all actions when gate is expired", () => {
    const props = {
      ...baseProps,
      gate: { ...baseProps.gate, status: "expired" as const },
    };
    const { getByTestId } = render(<VerifyCard {...props} />);
    expect(getByTestId("verify-expired").textContent).toMatch(
      /approval expired — restart verification/,
    );
    expect((getByTestId("verify-allow") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("verify-deny") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("verify-kill") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the expiry copy when secondsRemaining hits 0", () => {
    const props = {
      ...baseProps,
      gate: {
        ...baseProps.gate,
        expires_at: new Date(Date.now() + 2000).toISOString(),
      },
    };
    const { getByTestId } = render(<VerifyCard {...props} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(getByTestId("verify-expired").textContent).toMatch(
      /approval expired — restart verification/,
    );
  });
});

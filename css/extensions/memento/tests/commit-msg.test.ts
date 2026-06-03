import { describe, it, expect } from "vitest";
import { formatCommitMessage } from "../src/commit-msg";

describe("formatCommitMessage", () => {
  it("uses op + identifier as the subject", () => {
    const msg = formatCommitMessage({
      op: "create",
      identifier: "http://pod/note.md",
    });
    expect(msg.split("\n")[0]).toContain("create");
    expect(msg.split("\n")[0]).toContain("http://pod/note.md");
  });

  // (audit L1) The `WebID:` trailer was removed: the MonitoringStore `changed`
  // event carries only the AS activity term, so a WebID was never available at
  // runtime. The message is the bare `op identifier` subject with no trailer.
  it("emits no trailer — just the op + identifier subject", () => {
    const msg = formatCommitMessage({
      op: "delete",
      identifier: "http://pod/note.md",
    });
    expect(msg).not.toMatch(/webid/i);
    expect(msg).toContain("delete");
    expect(msg.includes("\n")).toBe(false);
  });

  it("supports each ChangeOp value", () => {
    for (const op of ["create", "update", "delete"] as const) {
      const msg = formatCommitMessage({ op, identifier: "http://pod/x" });
      expect(msg.toLowerCase()).toContain(op);
    }
  });
});

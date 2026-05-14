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

  it("includes WebID in trailer when present", () => {
    const msg = formatCommitMessage({
      op: "update",
      identifier: "http://pod/note.md",
      webid: "http://pod/profile/card#me",
    });
    expect(msg).toContain("http://pod/profile/card#me");
  });

  it("omits WebID trailer when absent — message still valid", () => {
    const msg = formatCommitMessage({
      op: "delete",
      identifier: "http://pod/note.md",
    });
    expect(msg).not.toMatch(/webid/i);
    expect(msg).toContain("delete");
  });

  it("supports each ChangeOp value", () => {
    for (const op of ["create", "update", "delete"] as const) {
      const msg = formatCommitMessage({ op, identifier: "http://pod/x" });
      expect(msg.toLowerCase()).toContain(op);
    }
  });
});

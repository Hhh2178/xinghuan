import { describe, expect, it } from "vitest";
import { executeCodeNode } from "./code-node-runtime.js";

describe("code node runtime", () => {
  it("executes deterministic Python against JSON input", async () => {
    const output = await executeCodeNode({
      code: "result = [item * 2 for item in input_data['values']]",
      input: { values: [1, 2, 3] },
    });
    expect(output.result).toEqual([2, 4, 6]);
  });

  it("rejects imports", async () => {
    await expect(executeCodeNode({ code: "import os\nresult = 1", input: {} }))
      .rejects.toThrow(/CODE_NODE_IMPORT_NOT_ALLOWED/);
  });

  it("rejects private object graph access", async () => {
    await expect(executeCodeNode({ code: "result = (1).__class__", input: {} }))
      .rejects.toThrow(/CODE_NODE_PRIVATE_ATTRIBUTE_NOT_ALLOWED/);
  });

  it("times out infinite loops", async () => {
    await expect(executeCodeNode({ code: "while True:\n    pass", input: {} }, { timeoutMs: 150 }))
      .rejects.toThrow("CODE_NODE_TIMEOUT");
  });

  it("limits concurrent Python processes", async () => {
    const first = executeCodeNode({ code: "while True:\n    pass", input: {} }, { timeoutMs: 150 });
    const second = executeCodeNode({ code: "while True:\n    pass", input: {} }, { timeoutMs: 150 });
    await expect(executeCodeNode({ code: "result = 1", input: {} })).rejects.toThrow("CODE_NODE_BUSY");
    await Promise.allSettled([first, second]);
  });
});

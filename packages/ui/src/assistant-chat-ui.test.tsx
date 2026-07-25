import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AssistantAttachmentStrip,
  AssistantComposer,
  AssistantConversationList,
  assistantPhaseLabel,
} from "./assistant-chat-ui.js";

describe("shared assistant chat UI", () => {
  it("maps API phases to the same user-facing status on every surface", () => {
    expect(assistantPhaseLabel("starting")).toBe("正在读取上下文");
    expect(assistantPhaseLabel("building-context")).toBe("正在分析");
    expect(assistantPhaseLabel("generating")).toBe("正在生成答复");
    expect(assistantPhaseLabel("idle")).toBe("就绪");
  });

  it("renders shared message identity, process state and Markdown blocks", () => {
    const html = renderToStaticMarkup(
      <AssistantConversationList
        assistantLabel="后台 AI 助手"
        status="正在分析"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            text: "## 结论\n\n1. 修复输入",
            process: [{ label: "上下文", content: "已读取" }],
          },
          { id: "assistant-2", role: "assistant", text: "", streaming: true },
        ]}
      />,
    );

    expect(html).toContain("后台 AI 助手");
    expect(html).toContain("正在分析");
    expect(html).toContain("已完成 1 个分析步骤");
    expect(html).toContain("<h3>结论</h3>");
    expect(html).toContain('data-kind="steps"');
  });

  it("renders shared attachment and composer controls", () => {
    const html = renderToStaticMarkup(
      <>
        <AssistantAttachmentStrip items={[{ key: "node-1", kind: "node", title: "候选选择 #ydhc", kindLabel: "节点" }]} onRemove={() => undefined} />
        <AssistantComposer value="" placeholder="描述问题" busy={false} hasAttachments onCommit={() => undefined} onUpload={async () => undefined} onSend={() => undefined} />
      </>,
    );
    expect(html).toContain("候选选择 #ydhc");
    expect(html).toContain("添加图片");
    expect(html).toContain("发送");
  });
});

type Message = { role: "user" | "assistant" | "system"; content: string };

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "AI 连接请求失败";
}

function parseMcpText(value: unknown): string {
  const result = value as {
    result?: { content?: Array<{ type?: string; text?: string }> };
    error?: { message?: string };
  };
  if (result.error?.message) throw new Error(result.error.message);
  return (
    result.result?.content
      ?.filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n") || "MCP 工具没有返回文本"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: "api" | "mcp";
      connection?: Record<string, string>;
      conversationId?: string;
      messages?: Message[];
      attachments?: Array<{ name?: string; url?: string; type?: string }>;
    };
    const connection = body.connection || {};
    const messages = Array.isArray(body.messages) ? body.messages.slice(-80) : [];
    if (!messages.length) return json({ error: "消息不能为空" }, 400);

    if (body.mode === "api") {
      const baseUrl = connection.baseUrl?.replace(/\/$/, "");
      if (!baseUrl || !connection.apiKey || !connection.model)
        return json({ error: "请先填写 API Base URL、模型和 API Key" }, 400);
      const isAnthropic = /anthropic/i.test(connection.provider || "") ||
        /api\.anthropic\.com/i.test(baseUrl);
      const endpoint = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: isAnthropic
          ? {
              "content-type": "application/json",
              "x-api-key": connection.apiKey,
              "anthropic-version": "2023-06-01",
            }
          : {
              "content-type": "application/json",
              authorization: `Bearer ${connection.apiKey}`,
            },
        body: JSON.stringify(
          isAnthropic
            ? {
                model: connection.model,
                max_tokens: 4096,
                messages: messages
                  .filter((item) => item.role !== "system")
                  .map((item) => ({ role: item.role, content: item.content })),
              }
            : { model: connection.model, messages },
        ),
      });
      const result = (await response.json()) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
        content?: Array<{ text?: string }>;
      };
      if (!response.ok)
        return json({ error: result.error?.message || `API 返回 ${response.status}` }, 502);
      const content = isAnthropic
        ? result.content?.map((item) => item.text || "").join("\n")
        : result.choices?.[0]?.message?.content;
      return json({ content: content || "AI 没有返回文本" });
    }

    if (body.mode === "mcp") {
      if (!connection.url) return json({ error: "请先填写 MCP 服务地址" }, 400);
      const latest = messages[messages.length - 1]?.content || "";
      const response = await fetch(connection.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(connection.token
            ? { authorization: `Bearer ${connection.token}` }
            : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method: "tools/call",
          params: {
            name: connection.toolName || "chat",
            arguments: {
              message: latest,
              conversationId: body.conversationId || "main",
              history: messages,
              attachments: body.attachments || [],
            },
          },
        }),
      });
      const raw = await response.text();
      if (!response.ok) return json({ error: `MCP 返回 ${response.status}` }, 502);
      const payload = raw.includes("data:")
        ? raw
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .filter((line) => line && line !== "[DONE]")
            .map((line) => JSON.parse(line))
            .pop()
        : JSON.parse(raw);
      return json({ content: parseMcpText(payload) });
    }

    return json({ error: "不支持的 AI 连接方式" }, 400);
  } catch (reason) {
    return json({ error: errorMessage(reason) }, 502);
  }
}

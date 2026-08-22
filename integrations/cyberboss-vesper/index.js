const DEFAULT_POLL_INTERVAL_MS = 1_500;

function createVesperChannelAdapter(config) {
  const baseUrl = String(config.vesperBaseUrl || "https://api.vesper.r-vera.com").replace(/\/$/, "");
  const token = String(config.vesperBridgeToken || "").trim();
  const userId = String(config.vesperUserId || "vesper-user").trim();
  const accountId = "vesper";
  let minChunkChars = 20;

  if (!token) {
    throw new Error("Missing CYBERBOSS_VESPER_TOKEN.");
  }

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Vesper bridge ${response.status}: ${detail.slice(0, 300)}`);
    }
    return response.json();
  }

  return {
    describe() {
      return { id: "vesper", kind: "channel", baseUrl, accountId };
    },
    async login() {
      console.log("Vesper uses a bridge token; no QR login is required.");
    },
    printAccounts() {
      console.log(`- ${accountId}\n  userId: ${userId}\n  baseUrl: ${baseUrl}`);
    },
    resolveAccount() {
      return { accountId, userId, baseUrl, token: "(worker secret)" };
    },
    getKnownContextTokens() {
      return { [userId]: "main" };
    },
    loadSyncBuffer() {
      return "";
    },
    saveSyncBuffer() {},
    rememberContextToken() {
      return "main";
    },
    async getUpdates() {
      const payload = await request("/api/cyberboss?limit=10");
      if (!payload.messages?.length) {
        await sleep(Number(config.vesperPollIntervalMs) || DEFAULT_POLL_INTERVAL_MS);
      }
      return {
        ret: 0,
        errcode: 0,
        msgs: (payload.messages || []).map((message) => ({
          id: message.id,
          conversationId: message.conversationId || "main",
          content: message.content || "",
          createdAt: message.createdAt || new Date().toISOString(),
        })),
      };
    },
    normalizeIncomingMessage(message) {
      const content = String(message?.content || "").trim();
      if (!content) return null;
      const conversationId = String(message?.conversationId || "main").trim() || "main";
      return {
        provider: "vesper",
        accountId,
        workspaceId: config.workspaceId,
        senderId: userId,
        chatId: conversationId,
        messageId: String(message?.id || ""),
        threadKey: conversationId,
        text: content,
        attachments: [],
        contextToken: conversationId,
        receivedAt: message?.createdAt || new Date().toISOString(),
      };
    },
    async sendText({ text, contextToken = "main" }) {
      const content = String(text || "").trim();
      if (!content) return;
      await request("/api/cyberboss", {
        method: "POST",
        body: JSON.stringify({
          type: "message",
          conversationId: contextToken || "main",
          content,
          metadata: { source: "cyberboss" },
        }),
      });
    },
    async sendTyping({ status = 1 } = {}) {
      await request("/api/cyberboss", {
        method: "POST",
        body: JSON.stringify({ type: "heartbeat", metadata: { state: status ? "thinking" : "idle" } }),
      }).catch(() => {});
    },
    async sendFile() {
      throw new Error("Vesper file delivery is not enabled yet.");
    },
    setMinChunkChars(value) {
      const parsed = Number.parseInt(String(value), 10);
      if (Number.isFinite(parsed) && parsed > 0) minChunkChars = parsed;
      return minChunkChars;
    },
    getMinChunkChars() {
      return minChunkChars;
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createVesperChannelAdapter };

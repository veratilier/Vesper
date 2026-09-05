"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
  type CSSProperties,
} from "react";
import { subscribe, serializeSubscription } from "@mmmike/web-push/client";
import { mergeCodexMessages } from "./codex-message-merge";
import {
  approvalResultFor,
  approvalWasResolved,
  clearCodexApprovals,
  createCodexApprovalRequest,
  queueCodexApproval,
  removeCodexApproval,
  type PendingCodexApproval,
} from "@/lib/codex-approval";
import { requestNeteaseLibrary, type MusicLibraryResult } from "@/lib/music-service";
import { CodexModelPicker } from "./codex-model-picker";
import { startCodexTurnWithModel, effortLabel, listCodexModels, selectionFromThread, type CodexModel, type CodexModelSelection } from "@/lib/codex-models";
function Notes() {
  const [notes, setNotes] = usePersistentDocument<NoteItem[]>("notes", []);
  const add = () =>
    setNotes((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        text: "",
        kind: "user",
        tone: "warm",
        createdAt: new Date().toISOString(),
      },
    ]);
  return (
    <div className="page-body">
      <PageIntro
        eyebrow="QUICK NOTES"
        title="便笺"
        text="用户与 Agent 都可以在这里留下内容。"
      />
      <div className="note-toolbar">
        <span>{notes.length} 张便笺</span>
        <button onClick={add}>
          <Icon name="plus" />
          新便笺
        </button>
      </div>
      {!notes.length ? (
        <EmptyState text="还没有便笺，点击“新便笺”开始。" />
      ) : (
        <div className="sticky-wall">
          {notes.map((note) => (
            <article className={`sticky ${note.tone}`} key={note.id}>
              <div className="tape" />
              <div className="sticky-meta">
                <span>{note.kind === "agent" ? "VESPER" : "我"}</span>
                <button
                  aria-label="删除便笺"
                  onClick={() =>
                    setNotes((items) =>
                      items.filter((item) => item.id !== note.id),
                    )
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
              {note.kind === "user" ? (
                <textarea
                  className="sticky-editor"
                  aria-label="编辑便笺"
                  placeholder="写下便笺…"
                  value={note.text}
                  onChange={(event) =>
                    setNotes((items) =>
                      items.map((item) =>
                        item.id === note.id
                          ? { ...item, text: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              ) : (
                <p>{note.text}</p>
              )}
              <footer>
                {note.kind === "agent" ? (
                  <>
                    <Icon name="sparkles" />
                    Agent 留言
                  </>
                ) : (
                  <>
                    <Icon name="edit" />
                    可编辑 · 自动保存
                  </>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
      <div className="agent-callout">
        <Icon name="link" />
        <div>
          <b>Vesper note channel</b>
          <p>Connected agents can create and update notes here.</p>
        </div>
      </div>
    </div>
  );
}
const VESPER_API_ORIGIN = "https://api.vesper.r-vera.com";
const DEFAULT_APP_BACKGROUND = "#f5f5f3";
const NEUTRAL_ACCENTS = new Set(["#4a4a48", "#6b6b68", "#878783", "#a3a39f"]);

function normalizeNeutralAccent(value?: string) {
  return value && NEUTRAL_ACCENTS.has(value.toLowerCase()) ? value.toLowerCase() : "#6b6b68";
}

function normalizeAppBackground(value?: string) {
  const candidate = value?.trim() || "";
  if (/^#[\da-f]{6}$/i.test(candidate)) return candidate;
  // Uploaded photographs remain user content. Former colour/gradient presets and
  // the old blue marble default become the new warm-white canvas.
  return candidate.includes("url(") && !candidate.includes("vesper-default-bg.webp")
    ? candidate
    : DEFAULT_APP_BACKGROUND;
}
function apiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? path
    : `${VESPER_API_ORIGIN}${path}`;
}
function appHeaders(json = false) {
  return {
    ...(json ? { "content-type": "application/json" } : {}),
    "x-vesper-device-token": deviceToken(),
  };
}
function anniversaryTarget(item: AnniversaryItem) {
  const base = new Date(`${item.date}T12:00:00`);
  if (!item.repeats) return base;
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    base.getMonth(),
    base.getDate(),
    12,
  );
  if (target.getTime() < now.getTime())
    target.setFullYear(target.getFullYear() + 1);
  return target;
}
function daysUntil(item: AnniversaryItem) {
  return Math.max(
    0,
    Math.ceil((anniversaryTarget(item).getTime() - Date.now()) / 86400000),
  );
}
function anniversaryDayLabel(item: AnniversaryItem) {
  const target = anniversaryTarget(item);
  if (!item.repeats && target.getTime() < Date.now()) {
    return `过了 ${Math.max(1, Math.ceil((Date.now() - target.getTime()) / 86400000))} 天`;
  }
  return `距离 ${daysUntil(item)} 天`;
}
function nextAnniversary(items: AnniversaryItem[]) {
  return [...items].sort(
    (a, b) => anniversaryTarget(a).getTime() - anniversaryTarget(b).getTime(),
  )[0];
}
function AnniversaryCard({ item }: { item: AnniversaryItem }) {
  const target = anniversaryTarget(item);
  const nowMs = new Date().getTime();
  const pastDays = Math.max(1, Math.ceil((nowMs - target.getTime()) / 86400000));
  return (
    <article className="surface anniversary">
      <div className="days">
        <small>{item.repeats || target.getTime() >= nowMs ? "距离" : "过了"}</small>
        <b>{item.repeats || target.getTime() >= nowMs ? daysUntil(item) : pastDays}</b>
        <small>天</small>
      </div>
      <div className="anniversary-copy">
        <span>
          NEXT · {String(target.getMonth() + 1).padStart(2, "0")} /{" "}
          {String(target.getDate()).padStart(2, "0")}
        </span>
        <h2>{item.title}</h2>
        <p>{target.toLocaleDateString("zh-CN")}</p>
      </div>
    </article>
  );
}
function Anniversaries() {
  const [items, setItems] = usePersistentDocument<AnniversaryItem[]>(
    "anniversaries",
    [],
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    date: new Date().toLocaleDateString("en-CA"),
    repeats: true,
  });
  const add = () => {
    if (!draft.title.trim() || !draft.date) return;
    setItems((current) => [...current, {
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      date: draft.date,
      repeats: draft.repeats,
    }]);
    setDraft({ title: "", date: new Date().toLocaleDateString("en-CA"), repeats: true });
    setAdding(false);
  };
  const next = nextAnniversary(items);
  const nowMs = new Date().getTime();
  return (
    <div className="page-body">
      <PageIntro
        eyebrow="DAYS MATTER"
        title="纪念日"
        text="记录重要日期并自动计算天数。"
      />
      {next ? (
        <div className="days-hero">
          <span>NEXT ANNIVERSARY</span>
          <h2>{next.title}</h2>
          <div>
            <small>{next.repeats || anniversaryTarget(next).getTime() >= nowMs ? "还有" : "已过"}</small>
            <b>{next.repeats || anniversaryTarget(next).getTime() >= nowMs ? daysUntil(next) : Math.max(1, Math.ceil((nowMs - anniversaryTarget(next).getTime()) / 86400000))}</b>
            <small>天</small>
          </div>
          <footer>
            {anniversaryTarget(next).toLocaleDateString("zh-CN")} ·{" "}
            {next.repeats ? "每年重复" : "仅一次"}
          </footer>
        </div>
      ) : (
        <EmptyState text="还没有纪念日。" />
      )}
      <div className="anniv-list">
        {items.map((item) => (
          <article className="surface anniv-row" key={item.id}>
            <time>{item.date.slice(5).replace("-", ".")}</time>
            <div>
              <b>{item.title}</b>
              <small>{item.repeats ? "每年重复" : "仅一次"}</small>
            </div>
              <span>{anniversaryDayLabel(item)}</span>
            <button
              aria-label="删除纪念日"
              onClick={() =>
                setItems((current) =>
                  current.filter((entry) => entry.id !== item.id),
                )
              }
            >
              <Icon name="close" />
            </button>
          </article>
        ))}
      </div>
      <button className="primary-action" onClick={() => setAdding(true)}>
        <Icon name="plus" />
        添加纪念日
      </button>
      {adding && (
        <div className="modal-layer">
          <button className="modal-scrim" aria-label="关闭" onClick={() => setAdding(false)} />
          <section className="connection-modal anniversary-editor">
            <div className="modal-head">
              <div><small>NEW ANNIVERSARY</small><h2>添加纪念日</h2></div>
              <button aria-label="关闭" onClick={() => setAdding(false)}><Icon name="close" /></button>
            </div>
            <label className="profile-field"><span>名称</span><input value={draft.title} autoFocus placeholder="值得记住的日子" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="profile-field"><span>日期</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <button className={draft.repeats ? "repeat-choice selected" : "repeat-choice"} onClick={() => setDraft({ ...draft, repeats: !draft.repeats })}><span>每年重复</span><b>{draft.repeats ? "✓" : ""}</b></button>
            <button className="save-profile" disabled={!draft.title.trim() || !draft.date} onClick={add}>保存纪念日</button>
          </section>
        </div>
      )}
    </div>
  );
}
const iconPaths: Record<string, string[]> = {
  archive: ["M3 5h18v5H3z", "M5 10v10h14V10", "M10 14h4"],
  box: ["M3 8l9-5 9 5v8l-9 5-9-5z", "m3 8 9 5 9-5", "M12 13v8"],
  calendar: [
    "M8 2v3",
    "M16 2v3",
    "M3 9h18",
    "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z",
  ],
  check: ["M20 6 9 17l-5-5"],
  chevron: ["m9 18 6-6-6-6"],
  cloud: [
    "M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6z",
    "M18.4 14.5a6 6 0 0 0 3.4-4.1c.2-.7-.6-1-1.2-.7a4 4 0 0 1-5.3-5.3c.3-.6-.1-1.4-.7-1.2A6 6 0 0 0 10 8.5",
  ],
  feather: ["M14 18H5v-7l7-7a6 6 0 0 1 8 8z", "M16 8 2 22", "M17 15H9"],
  heart: [
    "M2 9.5a5.5 5.5 0 0 1 9.6-3.7A5.5 5.5 0 0 1 22 9.5c0 2.3-1.5 4-3 5.5l-7 6-7-6c-1.5-1.5-3-3.2-3-5.5",
  ],
  home: ["M15 21v-8H9v8", "M3 10 12 2l9 8v9H3z"],
  library: ["m16 6 4 14", "M12 6v14", "M8 8v12", "M4 4v16"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  music: ["M12 18V3l7 3", "M12 18a4 4 0 1 1-4-4 4 4 0 0 1 4 4"],
  diary: [
    "M13 3H6a2 2 0 0 0-2 2v15h14v-7",
    "M2 7h4M2 11h4M2 15h4",
    "m13 10 7-7 2 2-7 7-3 1z",
  ],
  pause: ["M6 4h4v16H6z", "M14 4h4v16h-4z"],
  plus: ["M5 12h14", "M12 5v14"],
  settings: [
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    "M9 4a4 4 0 0 1 6 0l3 2a4 4 0 0 1 3 5v3a4 4 0 0 1-3 4l-3 2a4 4 0 0 1-6 0l-3-2a4 4 0 0 1-3-4v-3a4 4 0 0 1 3-5z",
  ],
  sparkles: ["M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"],
  note: [
    "M5 3h10l6 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M15 3v6h6",
  ],
  close: ["M18 6 6 18", "M6 6l12 12"],
  chat: ["M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4A8 8 0 1 1 21 15z"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  volume: [
    "M11 5 6 9H3v6h3l5 4z",
    "M15 9a4 4 0 0 1 0 6",
    "M18 6a8 8 0 0 1 0 12",
  ],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1z",
  ],
  link: [
    "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2",
    "M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  ],
  send: ["m22 2-7 20-4-9-9-4z", "M22 2 11 13"],
  queue: ["M4 6h11", "M4 12h11", "M4 18h7", "M18 15v6", "m15 18 3 3 3-3"],
  one: ["M9 7h2v10", "M8 17h6"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  edit: ["M12 20h9", "m16 4 4 4L8 20H4v-4z"],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  search: ["M11 19a8 8 0 1 1 5.65-2.35L22 22", "m16.65 16.65 4.2 4.2"],
  wifi: ["M5 12a10 10 0 0 1 14 0", "M8 15a6 6 0 0 1 8 0", "M12 19h.01"],
};
Object.assign(iconPaths, {
  play: ["M8 5v14l11-7z"],
  back: ["M19 20 9 12l10-8z", "M5 19V5"],
  forward: ["m5 4 10 8-10 8z", "M19 5v14"],
  repeat: [
    "m17 1 4 4-4 4",
    "M3 11V9a4 4 0 0 1 4-4h14",
    "m7 23-4-4 4-4",
    "M21 13v2a4 4 0 0 1-4 4H3",
  ],
  shuffle: ["M16 3h5v5", "M4 20 21 3", "M21 16v5h-5", "M15 15l6 6", "M4 4l5 5"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  upload: ["M12 21V9", "m17 14-5-5-5 5", "M5 3h14"],
  database: [
    "M4 6c0-2 4-3 8-3s8 1 8 3-4 3-8 3-8-1-8-3z",
    "M4 6v6c0 2 4 3 8 3s8-1 8-3V6",
    "M4 12v6c0 2 4 3 8 3s8-1 8-3v-6",
  ],
});
Object.assign(iconPaths, {
  location: [
    "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z",
    "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
});
Object.assign(iconPaths, {
  clock: ["M12 22a10 10 0 1 0-10-10", "M12 6v6l4 2"],
  copy: ["M9 9h11v11H9z", "M4 15H3V4h11v1"],
  bookmark: ["M6 3h12v18l-6-4-6 4z"],
  like: [
    "M7 10v11H3V10z",
    "M7 18c4 3 10 2 11-1l2-6c.3-2-1-3-3-3h-4l1-4c.3-2-2-3-3-1L7 10",
  ],
  dislike: [
    "M7 14V3H3v11z",
    "M7 6c4-3 10-2 11 1l2 6c.3 2-1 3-3 3h-4l1 4c.3 2-2 3-3 1l-4-7",
  ],
  refresh: ["M20 11a8 8 0 1 0-2 5", "M20 4v7h-7"],
  trash: ["M4 7h16", "M9 3h6l1 4H8z", "M7 7l1 14h8l1-14", "M10 11v6", "M14 11v6"],
  sticker: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8 9h.01", "M16 9h.01", "M8 14c1.1 1.3 2.4 2 4 2s2.9-.7 4-2", "M16 3v4h4"],
  mic: [
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z",
    "M5 10v2a7 7 0 0 0 14 0v-2",
    "M12 19v3",
  ],
});
function Icon({ name }: { name: string }) {
  const paths = iconPaths[name] || iconPaths.sparkles;
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="icon-depth">
        {paths.map((d, i) => (
          <path d={d} key={`d${i}`} />
        ))}
      </g>
      <g>
        {paths.map((d, i) => (
          <path d={d} key={i} />
        ))}
      </g>
    </svg>
  );
}

const vesperNavMarks: Record<string, string[]> = {
  home: ["M2.75 9.1 10 2.8l7.25 6.3v7.4h-4.7v-4.75h-5.1v4.75h-4.7z"],
  chat: [
    "M3 3.5h14v10.25H9.2L5.25 17v-3.25H3z",
    "M6.2 8.5h.01M10 8.5h.01M13.8 8.5h.01",
  ],
  diary: [
    "M4 2.5h8.8L16 5.7v11.8H4z",
    "M12.8 2.5v3.2H16",
    "M6.5 8.5h6.8",
    "M6.5 11.5h6.8",
    "M6.5 14.5h4.2",
  ],
  note: [
    "M2.75 4.2c2.9-.75 5.25-.3 7.25 1.25 2-1.55 4.35-2 7.25-1.25v12.3c-2.75-.7-5.2-.25-7.25 1.25-2.05-1.5-4.5-1.95-7.25-1.25z",
    "M10 5.45v12.3",
  ],
  check: ["m11.2 2.5-7.1 8.35h5.15L7.9 17.5l8-9.25h-5.4z"],
  calendar: [
    "M10 17.25 3.9 11.7C.35 8.45 2.25 3.25 6.25 3.25c1.65 0 2.95.8 3.75 2.1.8-1.3 2.1-2.1 3.75-2.1 4 0 5.9 5.2 2.35 8.45z",
  ],
  box: [
    "m10 2.4 7 3.9v7.4l-7 3.9-7-3.9V6.3z",
    "m3 6.3 7 4 7-4",
    "M10 10.3v7.3",
    "m6.5 4.35 7 4",
  ],
  music: [
    "M8.2 14.2V4.4l7-1.5v9.4",
    "M8.2 6.8l7-1.5",
    "M8.2 14.2a3 3 0 1 1-3-3h3z",
    "M15.2 12.3a3 3 0 1 1-3-3h3z",
  ],
  library: [
    "M10 4c-1.2-2.25-4.65-1.55-4.65 1.05-2.55-.1-3.7 3.05-1.55 4.35-2.15 1.3-.95 4.45 1.55 4.35-.05 2.6 3.35 3.35 4.65 1.05 1.25 2.25 4.65 1.55 4.65-1.05 2.55.1 3.7-3.05 1.55-4.35 2.15-1.3.95-4.45-1.55-4.35.05-2.6-3.35-3.35-4.65-1.05z",
    "M10 4v12",
    "M6.65 6.35c1.25.1 2.05.9 2.1 2.2",
    "M6.4 12.95c1.45-.05 2.25-.75 2.35-2.05",
    "M13.35 6.35c-1.25.1-2.05.9-2.1 2.2",
    "M13.6 12.95c-1.45-.05-2.25-.75-2.35-2.05",
  ],
  settings: [
    "M3 5.2h14",
    "M3 10h14",
    "M3 14.8h14",
    "M7 3.5v3.4",
    "M13.5 8.3v3.4",
    "M8.8 13.1v3.4",
  ],
};
function VesperNavIcon({ name }: { name: string }) {
  return (
    <svg
      className="vesper-nav-icon"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <g className="nav-etch-primary">
        {vesperNavMarks[name].map((d, i) => (
          <path d={d} key={i} />
        ))}
      </g>
    </svg>
  );
}
const navIconPaths: Record<string, string[]> = {
  home: ["M3 10.5 10 4l7 6.5", "M5.5 9.5V17h9V9.5", "M8.5 17v-4h3v4"],
  chat: ["M17 11.5a6.5 6.5 0 0 1-9.7 5.6L3 18.5l1.5-3.7A6.5 6.5 0 1 1 17 11.5z"],
  diary: ["M5 3.5h7l3 3v10H5z", "M12 3.5v3h3", "M7.5 10h5", "M7.5 13h5"],
  note: ["M4 3.5h9l3 3v10H4z", "M13 3.5v3h3", "M7 10h6", "M7 13h4"],
  check: ["M15.5 8.5a5.5 5.5 0 1 1-2-3.9", "M10 8.5l2 2 4.5-5"],
  calendar: ["M10 17.2 4.5 12a4.4 4.4 0 0 1 6.2-6.2L10 7l-.7-1.2A4.4 4.4 0 0 1 15.5 12z"],
  box: ["m10 3 7 4v8l-7 4-7-4V7z", "m3 7 7 4 7-4", "M10 11v8"],
  music: ["M8 14V4l7-1.5v9.5", "M8 14a3 3 0 1 1-3-3h3z", "M15 12a3 3 0 1 1-3-3h3z"],
  library: ["M10 17a7 7 0 1 1 0-14", "M10 3v14", "M6 6.5h2M6 10h2M6 13.5h2"],
  settings: ["M3 5h14M3 10h14M3 15h14", "M7 3v4M13 8v4M9 13v4"],
};
function NavIcon({ name }: { name: string }) {
  return <svg className="nav-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">{(navIconPaths[name] || navIconPaths.sparkles || []).map((d, i) => <path d={d} key={i} />)}</svg>;
}

const nav = [
  { label: "今日", english: "Today", icon: "home" },
  { label: "聊天", english: "Letters", icon: "chat" },
  { label: "日记", english: "Journal", icon: "diary" },
  { label: "便笺", english: "Notes", icon: "note" },
  { label: "提醒", english: "Reminders", icon: "check" },
  { label: "纪念日", english: "Dates", icon: "calendar" },
  { label: "音乐", english: "Music", icon: "music" },
  { label: "记忆库", english: "Memory", icon: "library" },
  { label: "设置", english: "Settings", icon: "settings" },
];
type NoteItem = {
  id: string;
  text: string;
  kind: "user" | "agent";
  tone: string;
  createdAt: string;
};
type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  tag: string;
  due: string;
  createdAt: string;
};
type AnniversaryItem = {
  id: string;
  title: string;
  date: string;
  repeats: boolean;
};
type DiaryEntry = { user: string; agent: string; updatedAt: string };
type DiaryDocument = Record<string, DiaryEntry>;
type Track = {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  url: string;
  cover?: string;
  neteaseId?: string;
  album?: string;
  playable?: boolean;
  lyrics?: Array<{ time: number; text: string }>;
};
type MusicPlayMode = "order" | "repeat" | "single" | "random";
type MusicTogetherState = {
  status?: "idle" | "invited" | "connected" | "offline";
  distanceKm?: number;
  totalListeningSeconds?: number;
  sessionStartedAt?: string;
  updatedAt?: string;
  inviteRequestedAt?: string;
};
type PlayerSnapshot = {
  playing: boolean;
  currentTime: number;
  duration: number;
  trackId?: string;
  canSeek: boolean;
};
type PlayerAdapter = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  previous: () => void;
  next: () => void;
  select: (index: number) => void;
  getState: () => PlayerSnapshot;
};
type MusicCardData = {
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: string;
  url?: string;
  playable?: boolean;
  message?: string;
  source?: string;
};
type MusicPlaylistIntent = Pick<MusicCardData, "trackId" | "title" | "artist" | "album" | "cover" | "duration" | "url" | "playable" | "source">;
type FavoriteItem = {
  id: string;
  folderId: string;
  messageId: string;
  itemId?: string;
  threadId?: string;
  conversationId: string;
  conversationTitle: string;
  role: "user" | "agent" | "system";
  content: string;
  createdAt: string;
};
type MusicControl = { id: string; action: "play" | "pause" | "next" | "previous" | "play_track"; trackId?: string; replaceQueue?: boolean; processedAt?: string };
type MusicPlaybackState = { trackId?: string; playing?: boolean; positionSeconds?: number; durationSeconds?: number; queueLength?: number; updatedAt?: string };
type MusicResumeState = Pick<MusicPlaybackState, "trackId" | "positionSeconds" | "updatedAt">;
type MusicQueueUpdate = { autoplay?: boolean; trackId?: string };
type ConnectionSettings = Record<string, Record<string, string>>;
type ChatAttachment = {
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
};
type StickerMessageData = {
  assetId: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  alt: string;
  description?: string;
  category?: string;
};
type StickerCatalogItem = StickerMessageData & { name?: string; categoryId?: string | null; favorite?: boolean; createdAt?: string; lastUsedAt?: string | null; useCount?: number; status?: string };
type StickerCategoryItem = { id: string; name: string; description: string; sortOrder: number };
type EnvironmentSnapshot = {
  permission: "unknown" | "granted" | "denied";
  latitude?: number;
  longitude?: number;
  temperature?: number;
  weatherCode?: number;
  timezone?: string;
  updatedAt?: string;
  error?: string;
};
type VesperPreferences = {
  reminders: boolean;
  anniversaries: boolean;
  agentNotes: boolean;
  careFrequency: "off" | "daily" | "twice-weekly";
  memoryDiary: boolean;
  memoryNotes: boolean;
  memoryChat: boolean;
  lastExportAt?: string;
};
const defaultPreferences: VesperPreferences = {
  reminders: true,
  anniversaries: true,
  agentNotes: true,
  careFrequency: "daily",
  memoryDiary: true,
  memoryNotes: true,
  memoryChat: true,
};

function readLocalValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
}

function mergeMusicTracks(current: Track[], incoming: Track[]) {
  const next = [...current];
  for (const track of incoming) {
    const index = next.findIndex((item) => item.id === track.id || (item.neteaseId && item.neteaseId === track.neteaseId));
    if (index >= 0) next[index] = { ...next[index], ...track };
    else next.push(track);
  }
  return next;
}

export default function Home() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState("今日");
  const [profileOpen, setProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [conversationId, setConversationId] = useState(() => latestLocalConversationId());
  const [focusMessageId, setFocusMessageId] = useState("");
  const initialProfile = readLocalValue("vesper-local-profile", { userName: "我", agentName: "Vesper", userAvatar: "", agentAvatar: "" });
  const storedAppearance = readLocalValue("vesper-local-appearance", { accent: "#6b6b68", background: DEFAULT_APP_BACKGROUND });
  const initialAppearance = {
    accent: normalizeNeutralAccent(storedAppearance.accent),
    background: normalizeAppBackground(storedAppearance.background),
  };
  const [userName, setUserName] = useState(initialProfile.userName);
  const [agentName, setAgentName] = useState(initialProfile.agentName);
  const [userAvatar, setUserAvatar] = useState(initialProfile.userAvatar);
  const [agentAvatar, setAgentAvatar] = useState(initialProfile.agentAvatar);
  const [accent, setAccent] = useState(initialAppearance.accent);
  const [customBackground, setCustomBackground] = useState(initialAppearance.background || DEFAULT_APP_BACKGROUND);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [tracks, setTracks] = usePersistentDocument<Track[]>("music", []);
  const [queue, setQueue] = usePersistentDocument<Track[]>("musicQueue", []);
  const [favorites, setFavorites] = usePersistentDocument<FavoriteItem[]>("favorites", []);
  const [musicControl, setMusicControl] = usePersistentDocument<MusicControl | null>("musicControl", null);
  const [, setMusicPlayback] = usePersistentDocument<MusicPlaybackState>("musicPlayback", {});
  const [musicResume, setMusicResume] = useLocalDocument<MusicResumeState>("music-resume", {});
  const [savedMusicCookie] = useLocalDocument("netease-music-u", "");
  const [musicTogether, setMusicTogether] = usePersistentDocument<MusicTogetherState>("musicTogether", {});
  const [playMode, setPlayMode] = useState<MusicPlayMode>(() => readLocalValue<MusicPlayMode>("vesper-music-play-mode", "order"));
  const [musicToast, setMusicToast] = useState("");
  const [musicPlaylistIntent, setMusicPlaylistIntent] = useState<MusicPlaylistIntent | null>(null);
  const globalPlayer = useRef<HTMLAudioElement>(null);
  const playbackTimeRef = useRef(0);
  const playbackResumeReady = useRef(false);
  const [storageReady, setStorageReady] = useState(false);
  const [environment, setEnvironment] =
    usePersistentDocument<EnvironmentSnapshot>("environment", {
      permission: "unknown",
    });
  const queueSeeded = readLocalValue<boolean>("vesper-music-queue-seeded", false);
  // `music` is the full library. `musicQueue` is the selected playlist that is
  // currently being listened to. A fresh PWA install has no local queue marker,
  // but it can still receive a non-empty queue from D1; never fall back to the
  // full library in that case.
  const activeTracks = queue.length > 0 || queueSeeded ? queue : tracks;
  const currentTrack = activeTracks[trackIndex];
  const showMusicToast = (message: string) => {
    setMusicToast(message);
    window.setTimeout(() => setMusicToast((current) => current === message ? "" : current), 1800);
  };
  const replaceMusicQueue = useCallback((nextQueue: Track[], options: MusicQueueUpdate = {}) => {
    const now = new Date().toISOString();
    const preferredTrackId = options.trackId;
    const retainedIndex = preferredTrackId
      ? nextQueue.findIndex((track) => track.id === preferredTrackId || track.neteaseId === preferredTrackId)
      : currentTrack
        ? nextQueue.findIndex((track) => track.id === currentTrack.id || track.neteaseId === currentTrack.neteaseId)
        : -1;
    const nextIndex = retainedIndex >= 0 ? retainedIndex : 0;

    // Stamp the local revision before React's deferred persistence effect runs.
    // The queue poller uses this timestamp to reject an older server snapshot
    // while the selected playlist is being written to D1.
    window.localStorage.setItem("vesper-music-queue-seeded", "true");
    window.localStorage.setItem("vesper-document-meta-musicQueue", JSON.stringify({ updatedAt: now, source: "local" }));
    setQueue(nextQueue);
    setTrackIndex(nextIndex);
    if (options.autoplay) {
      const target = nextQueue[nextIndex];
      if (target?.url && target.playable !== false) setPlaying(true);
      else {
        setPlaying(false);
        const message = "这首歌暂时没有可播放音源";
        setMusicToast(message);
        window.setTimeout(() => setMusicToast((current) => current === message ? "" : current), 1800);
      }
    } else if (currentTrack && retainedIndex < 0) {
      setPlaying(false);
    }

    // Do not leave a window for the three-second device poll to read the old
    // playlist back from D1. The generic document hook still provides its
    // retry path if this immediate write is unavailable.
    void fetch(apiUrl("/api/state"), {
      method: "PUT",
      headers: appHeaders(true),
      body: JSON.stringify({ key: "musicQueue", value: nextQueue }),
    }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { updatedAt?: string };
      window.localStorage.setItem("vesper-document-meta-musicQueue", JSON.stringify({ updatedAt: result.updatedAt || now, source: "local" }));
    }).catch(() => {});
  }, [currentTrack, setQueue]);
  useEffect(() => {
    const resolveCard = (event: Event) => {
      const card = (event as CustomEvent<{ card?: MusicCardData }>).detail?.card;
      const neteaseId = card?.trackId?.replace(/^netease-/, "");
      if (!card || card.source !== "netease" || !neteaseId) return;
      const existing = tracks.find((track) => track.id === card.trackId || track.neteaseId === neteaseId);
      if (existing?.url && savedMusicCookie) return;
      void requestNeteaseLibrary(apiUrl("/api/music/library"), appHeaders(true), {
        action: "resolve",
        songIds: [neteaseId],
        cookie: savedMusicCookie,
        tracks: [{
          id: card.trackId,
          neteaseId,
          title: card.title,
          artist: card.artist,
          album: card.album,
          cover: card.cover,
          duration: card.duration,
          url: card.url || "",
          playable: card.playable,
        }],
      }).then((result) => {
        if (!result.tracks?.length) return;
        setTracks((current) => mergeMusicTracks(current, result.tracks as Track[]));
      }).catch(() => {});
    };
    window.addEventListener("vesper-music-card", resolveCard);
    return () => window.removeEventListener("vesper-music-card", resolveCard);
  }, [savedMusicCookie, setTracks, tracks]);
  useEffect(() => {
    const refreshLibrary = () => {
      void fetch(apiUrl("/api/state?key=music"), { cache: "no-store", headers: appHeaders() })
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then((result: { value?: Track[] | null }) => {
          if (!Array.isArray(result.value)) return;
          window.dispatchEvent(new CustomEvent("vesper-document-change", { detail: { key: "music", value: result.value } }));
        })
        .catch(() => {});
    };
    window.addEventListener("vesper-music-library-refresh", refreshLibrary);
    return () => window.removeEventListener("vesper-music-library-refresh", refreshLibrary);
  }, []);
  const playerAdapter: PlayerAdapter = {
    play: () => {
      if (!currentTrack?.url || currentTrack.playable === false) return showMusicToast("当前歌曲没有可播放音频");
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    toggle: () => {
      if (playing) setPlaying(false);
      else {
        if (!currentTrack?.url || currentTrack.playable === false) return showMusicToast("当前歌曲没有可播放音频");
        setPlaying(true);
      }
    },
    seek: (time) => {
      if (!Number.isFinite(playbackDuration) || playbackDuration <= 0) return showMusicToast("音频时长尚未就绪");
      const nextTime = Math.max(0, Math.min(playbackDuration, time));
      if (globalPlayer.current) globalPlayer.current.currentTime = nextTime;
      setPlaybackTime(nextTime);
    },
    previous: () => {
      if (!activeTracks.length) return;
      setTrackIndex((index) => (index - 1 + activeTracks.length) % activeTracks.length);
    },
    next: () => {
      if (!activeTracks.length) return;
      setTrackIndex((index) => (index + 1) % activeTracks.length);
    },
    select: (index) => {
      const track = activeTracks[index];
      if (!track) return;
      if (!track.url || track.playable === false) return showMusicToast("这首歌没有可播放音频");
      setTrackIndex(index);
      setPlaying(true);
    },
    getState: () => ({
      playing,
      currentTime: playbackTime,
      duration: playbackDuration,
      trackId: currentTrack?.id,
      canSeek: Boolean(currentTrack?.url && playbackDuration > 0),
    }),
  };
  useEffect(() => {
    if (musicTogether.status !== "connected" || musicTogether.sessionStartedAt) return;
    const startedAt = new Date().toISOString();
    setMusicTogether((current) => current.status === "connected" && !current.sessionStartedAt ? { ...current, sessionStartedAt: startedAt, updatedAt: startedAt } : current);
  }, [musicTogether.status, musicTogether.sessionStartedAt, setMusicTogether]);
  useEffect(() => {
    playbackTimeRef.current = playbackTime;
  }, [playbackTime]);
  useEffect(() => {
    // Resume is a one-time bootstrap action. Re-running it whenever the current
    // track changes makes a manual next/previous action bounce back to the old
    // song and can leave the audio element between two sources.
    if (playbackResumeReady.current || !activeTracks.length) return;
    const savedIndex = musicResume.trackId
      ? activeTracks.findIndex((track) => track.id === musicResume.trackId || track.neteaseId === musicResume.trackId)
      : -1;
    if (savedIndex >= 0) setTrackIndex(savedIndex);
    playbackResumeReady.current = true;
  }, [activeTracks, musicResume.trackId]);
  useEffect(() => {
    if (!playbackResumeReady.current || !currentTrack?.id) return;
    setMusicResume((current) => current.trackId === currentTrack.id ? current : {
      trackId: currentTrack.id,
      positionSeconds: Math.floor(playbackTimeRef.current),
      updatedAt: new Date().toISOString(),
    });
  }, [currentTrack?.id, setMusicResume]);
  useEffect(() => {
    if (!playbackResumeReady.current || !currentTrack?.id) return;
    const publish = () => {
      setMusicPlayback({
        trackId: currentTrack?.id,
        playing,
        positionSeconds: Math.floor(playbackTimeRef.current),
        durationSeconds: Math.floor(playbackDuration),
        queueLength: activeTracks.length,
        updatedAt: new Date().toISOString(),
      });
    };
    publish();
    if (!playing) return;
    const timer = window.setInterval(publish, 10_000);
    return () => window.clearInterval(timer);
  }, [activeTracks.length, currentTrack?.id, playbackDuration, playing, setMusicPlayback]);
  useAutonomousWake(agentName);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("vesper-pwa")) {
      url.searchParams.delete("vesper-pwa");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      const match = nav.find((item) => item.label === section || item.english.toLowerCase() === String(section || "").toLowerCase());
      if (match) setActive(match.label);
    };
    window.addEventListener("vesper-navigate", handleNavigate);
    return () => window.removeEventListener("vesper-navigate", handleNavigate);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js?v=25", { scope: "/", updateViaCache: "none" }).then((registration) => registration.update());
    }
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code");
    const state = query.get("state");
    const oauthError = query.get("error");
    const oauthErrorDescription = query.get("error_description");
    const raw = window.sessionStorage.getItem("vesper-mcp-oauth-pending");
    if (!raw || (!code && !oauthError)) return;
    try {
      const pending = JSON.parse(raw) as {
        serverId: string;
        state: string;
        verifier: string;
        tokenUrl: string;
        clientId: string;
        clientSecret?: string;
        redirectUri: string;
        resource?: string;
      };
      if (pending.state !== state) throw new Error("OAuth state 不匹配");
      if (oauthError) {
        const detail = oauthErrorDescription?.trim() || oauthError;
        const key = "vesper-local-external-mcp-servers";
        const servers = readLocalValue<ExternalMcpEntry[]>(key, []);
        window.localStorage.setItem(
          key,
          JSON.stringify(servers.map((server) => server.id === pending.serverId ? { ...server, oauthStatus: undefined } : server)),
        );
        window.sessionStorage.setItem("vesper-mcp-oauth-result", `OAuth 授权未完成：${detail.slice(0, 180)}`);
        window.sessionStorage.removeItem("vesper-mcp-oauth-pending");
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
        return;
      }
      if (!code) throw new Error("OAuth 回调中缺少授权码");
      void fetch("/api/mcp/oauth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...pending, code }),
      })
        .then(async (response) => {
          const result = (await response.json()) as { accessToken?: string; error?: string };
          if (!response.ok || !result.accessToken)
            throw new Error(result.error || "OAuth 授权失败");
          const key = "vesper-local-external-mcp-servers";
          const servers = readLocalValue<ExternalMcpEntry[]>(key, []);
          window.localStorage.setItem(
            key,
            JSON.stringify(
              servers.map((server) =>
                server.id === pending.serverId
                  ? { ...server, token: result.accessToken, oauthStatus: "authorized" }
                  : server,
              ),
            ),
          );
          window.sessionStorage.setItem("vesper-mcp-oauth-result", "授权成功");
        })
        .catch((reason) =>
          window.sessionStorage.setItem(
            "vesper-mcp-oauth-result",
            reason instanceof Error ? reason.message : "OAuth 授权失败",
          ),
        )
        .finally(() => {
          window.sessionStorage.removeItem("vesper-mcp-oauth-pending");
          window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
        });
    } catch (reason) {
      window.sessionStorage.setItem(
        "vesper-mcp-oauth-result",
        reason instanceof Error ? reason.message : "OAuth 授权失败",
      );
    }
  }, []);
  useEffect(() => {
    const audio = globalPlayer.current;
    if (!audio) return;
    if (playing && currentTrack)
      void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing, currentTrack]);
  useEffect(() => {
    if (queueSeeded || !tracks.length) return;
    setQueue(tracks);
    window.localStorage.setItem("vesper-music-queue-seeded", "true");
  }, [queueSeeded, tracks, setQueue]);
  useEffect(() => {
    if (trackIndex < activeTracks.length) return;
    const timer = window.setTimeout(() => {
      setTrackIndex(Math.max(0, activeTracks.length - 1));
      if (!activeTracks.length) setPlaying(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTracks.length, trackIndex]);
  useEffect(() => {
    const audio = globalPlayer.current;
    if (!audio) return;
    audio.currentTime = 0;
    setPlaybackTime(0);
  }, [currentTrack?.id]);
  useEffect(() => {
    if (!musicControl || musicControl.processedAt) return;
    const timer = window.setTimeout(() => {
      if (musicControl.action === "play") setPlaying(true);
      if (musicControl.action === "pause") setPlaying(false);
      if (musicControl.action === "next" && activeTracks.length) setTrackIndex((index) => (index + 1) % activeTracks.length);
      if (musicControl.action === "previous" && activeTracks.length) setTrackIndex((index) => (index - 1 + activeTracks.length) % activeTracks.length);
      if (musicControl.action === "play_track" && musicControl.trackId) {
        const index = activeTracks.findIndex((track) => track.id === musicControl.trackId || track.neteaseId === musicControl.trackId);
        // The queue is polled separately. Keep the command pending until the
        // newly-written queue has arrived, otherwise a fast poll could mark a
        // valid server command as processed before its track is visible.
        if (index < 0) return;
        if (activeTracks[index].url) { setTrackIndex(index); setPlaying(true); }
      }
      setMusicControl({ ...musicControl, processedAt: new Date().toISOString() });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [musicControl, setMusicControl, activeTracks]);
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(apiUrl("/api/state?key=musicControl"), { cache: "no-store", headers: appHeaders() });
        if (!response.ok) return;
        const result = await response.json() as { value?: MusicControl | null };
        if (result.value?.id && result.value.id !== musicControl?.id) setMusicControl(result.value);
        const queueResponse = await fetch(apiUrl("/api/state?key=musicQueue"), { cache: "no-store", headers: appHeaders() });
        if (queueResponse.ok) {
          const queueResult = await queueResponse.json() as { value?: Track[] | null; updatedAt?: string };
          if (Array.isArray(queueResult.value)) {
            const localMeta = readLocalValue<{ updatedAt?: string }>("vesper-document-meta-musicQueue", {});
            const localUpdatedAt = localMeta.updatedAt ? Date.parse(localMeta.updatedAt) : 0;
            const remoteUpdatedAt = queueResult.updatedAt ? Date.parse(queueResult.updatedAt) : 0;
            // A playlist selection is written optimistically. Never let a stale
            // poll put the previous playlist (and its cover) back on screen.
            if (localUpdatedAt && remoteUpdatedAt && remoteUpdatedAt < localUpdatedAt) return;
            window.localStorage.setItem("vesper-music-queue-seeded", "true");
            if (queueResult.updatedAt) window.localStorage.setItem("vesper-document-meta-musicQueue", JSON.stringify({ updatedAt: queueResult.updatedAt, source: "remote" }));
            setQueue(queueResult.value);
          }
        }
      } catch {}
    };
    const timer = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(timer);
  }, [musicControl?.id, setMusicControl, setQueue]);
  useEffect(() => {
    const nextTrack = () => {
      if (!activeTracks.length) return;
      setTrackIndex((index) => {
        if (playMode === "single") return index;
        if (playMode === "order" && index >= activeTracks.length - 1) {
          window.setTimeout(() => setPlaying(false), 0);
          return index;
        }
        if (playMode === "random") {
          if (activeTracks.length < 2) return index;
          let next = index;
          while (next === index) next = Math.floor(Math.random() * activeTracks.length);
          return next;
        }
        return (index + 1) % activeTracks.length;
      });
      setPlaying(true);
    };
    const audio = globalPlayer.current;
    if (audio) audio.onended = nextTrack;
    return () => { if (audio) audio.onended = null; };
  }, [activeTracks, playMode]);
  useEffect(() => {
    const showToast = (message: string) => {
      setMusicToast(message);
      window.setTimeout(() => setMusicToast((current) => current === message ? "" : current), 1600);
    };
    const play = (event: Event) => {
      const trackId = (event as CustomEvent<{ trackId?: string }>).detail?.trackId;
      const index = activeTracks.findIndex((track) => track.id === trackId || track.neteaseId === trackId);
      if (index < 0) return showToast("这首歌不在当前队列");
      if (!activeTracks[index].url) return showToast("这首歌暂时没有可播放音源");
      setTrackIndex(index); setPlaying(true);
    };
    const add = (event: Event) => {
      const trackId = (event as CustomEvent<{ trackId?: string }>).detail?.trackId;
      const track = tracks.find((item) => item.id === trackId || item.neteaseId === trackId);
      if (!track) return showToast("找不到这首歌");
      if (activeTracks.some((item) => item.id === track.id || item.neteaseId === track.neteaseId)) return showToast("已经在播放队列");
      replaceMusicQueue([...activeTracks, track]);
      showToast("已加入播放队列");
    };
    const open = () => setActive("音乐");
    window.addEventListener("vesper-music-play", play);
    window.addEventListener("vesper-music-queue-add", add);
    window.addEventListener("vesper-music-open", open);
    return () => {
      window.removeEventListener("vesper-music-play", play);
      window.removeEventListener("vesper-music-queue-add", add);
      window.removeEventListener("vesper-music-open", open);
    };
  }, [activeTracks, playMode, queueSeeded, replaceMusicQueue, tracks]);
  const cyclePlayMode = () => {
    const modes: MusicPlayMode[] = ["order", "repeat", "single", "random"];
    const next = modes[(modes.indexOf(playMode) + 1) % modes.length];
    setPlayMode(next);
    window.localStorage.setItem("vesper-music-play-mode", next);
    const labels: Record<MusicPlayMode, string> = { order: "顺序播放", repeat: "列表循环", single: "单曲循环", random: "随机播放" };
    setMusicToast(labels[next]);
    window.setTimeout(() => setMusicToast(""), 1600);
  };
  const isPhotoBackground = customBackground.includes("url(");
  const shellStyle = {
    "--theme-accent": accent,
    backgroundColor: isPhotoBackground ? DEFAULT_APP_BACKGROUND : customBackground || DEFAULT_APP_BACKGROUND,
    backgroundImage: isPhotoBackground ? customBackground : "none",
  } as CSSProperties;
  const navigateTo = (label: string) => {
    setDrawerOpen(false);
    if (label === "聊天") setConversationId(latestLocalConversationId());
    if (label !== active) window.setTimeout(() => setActive(label), 290);
  };
  useEffect(() => {
    if (active !== "聊天") return;
    let cancelled = false;
    void resolveLatestConversationId().then((id) => {
      if (!cancelled) setConversationId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);
  useEffect(() => {
    let live = true;
    let hasLocalProfile = false;
    let hasLocalAppearance = false;
    try {
      const localProfile = window.localStorage.getItem("vesper-local-profile");
      const localAppearance = window.localStorage.getItem("vesper-local-appearance");
      if (localProfile) hasLocalProfile = true;
      if (localAppearance) hasLocalAppearance = true;
    } catch {}
    fetch(apiUrl("/api/state"), { headers: appHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((raw) => {
        if (!live) return;
        const data = raw as { documents: Record<string, { value: unknown }> };
        const docs = data.documents;
        const profile = docs.profile?.value as
          | {
              userName?: string;
              agentName?: string;
              userAvatar?: string;
              agentAvatar?: string;
            }
          | undefined;
        const appearance = docs.appearance?.value as
          { accent?: string; background?: string } | undefined;
        if (profile && !hasLocalProfile) {
          setUserName(profile.userName || "我");
          setAgentName(profile.agentName || "Vesper");
          setUserAvatar(profile.userAvatar || "");
          setAgentAvatar(profile.agentAvatar || "");
        }
        if (appearance && !hasLocalAppearance) {
          setAccent(normalizeNeutralAccent(appearance.accent));
          setCustomBackground(normalizeAppBackground(appearance.background));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (live) setStorageReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(
      "vesper-local-profile",
      JSON.stringify({ userName, agentName, userAvatar, agentAvatar }),
    );
    const timer = window.setTimeout(
      () =>
        fetch(apiUrl("/api/state"), {
          method: "PUT",
          headers: appHeaders(true),
          body: JSON.stringify({
            key: "profile",
            value: { userName, agentName, userAvatar, agentAvatar },
          }),
        }).catch(() => {}),
      260,
    );
    return () => window.clearTimeout(timer);
  }, [storageReady, userName, agentName, userAvatar, agentAvatar]);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(
      "vesper-local-appearance",
      JSON.stringify({ accent, background: customBackground }),
    );
    const timer = window.setTimeout(
      () =>
        fetch(apiUrl("/api/state"), {
          method: "PUT",
          headers: appHeaders(true),
          body: JSON.stringify({
            key: "appearance",
            value: { accent, background: customBackground },
          }),
        }).catch(() => {}),
      260,
    );
    return () => window.clearTimeout(timer);
  }, [storageReady, accent, customBackground]);
  if (!mounted)
    return (
      <main className="stage">
        <section className="app-shell" />
      </main>
    );
  return (
    <main className="stage" style={shellStyle}>
      <audio
        ref={globalPlayer}
        src={currentTrack?.url}
        onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setPlaybackDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onError={() => {
          setPlaying(false);
          setPlaybackDuration(0);
          showMusicToast("此音频当前无法在网页播放");
        }}
      />
      <section className="app-shell" style={shellStyle}>
        <header
          className={`${active === "聊天" ? "app-header chat-mode" : active === "音乐" ? "app-header music-mode" : "app-header"}${historyOpen ? " history-host-shift" : ""}`}
        >
          <button
            className="icon-button"
            aria-label="打开目录"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" />
          </button>
          {active === "今日" ? (
            <div className="wordmark">
              <span className="home-app-mark">
                <img src="/icon-192-20260901-v1.png" alt="" />
              </span>
              <b>Vesper</b>
            </div>
          ) : active === "聊天" ? (
            <div
              className="chat-identity"
              aria-label={`${userName} 与 ${agentName}`}
            >
              <AvatarMark src={userAvatar} label={userName} kind="user" />
              <AvatarMark src={agentAvatar} label={agentName} kind="agent" />
            </div>
          ) : (
            <h1 className="page-name">{nav.find((item) => item.label === active)?.english || active}</h1>
          )}
          {active === "聊天" ? (
            <div className="chat-header-actions">
              <button
                aria-label="新建对话"
                onClick={() => {
                  const id = `chat-${Date.now()}-${crypto.randomUUID()}`;
                  rememberConversation(id, "新对话");
                  setConversationId(id);
                }}
              >
                <Icon name="plus" />
              </button>
              <button
                aria-label="语音通话"
                onClick={() => setVoiceCallOpen(true)}
              >
                <Icon name="phone" />
              </button>
              <button
                aria-label="历史聊天记录"
                onClick={() => setHistoryOpen(true)}
              >
                <Icon name="archive" />
              </button>
            </div>
          ) : active === "音乐" ? (
            <span className="music-header-spacer" aria-hidden="true" />
          ) : (
            <button
              className="avatar-button"
              onClick={() => setProfileOpen(true)}
            >
              {userAvatar ? (
                <AvatarMark src={userAvatar} label={userName} kind="user" />
              ) : (
                userName.slice(0, 1)
              )}
            </button>
          )}
        </header>
        <div className={`scroll-view${active === "音乐" ? " music-scroll-view" : ""}${historyOpen ? " history-host-shift" : ""}`} key={active}>
          {active === "今日" ? (
            <Today
              track={currentTrack}
              playing={playing}
              onToggle={() => setPlaying(!playing)}
              environment={environment}
              userName={userName}
              onOpenSection={(section) => setActive(section)}
            />
          ) : active === "聊天" ? (
              <ConnectedChat
                key={conversationId}
                conversationId={conversationId}
                onSelectConversation={setConversationId}
              agentName={agentName}
              userName={userName}
                favorites={favorites}
                setFavorites={setFavorites}
                focusMessageId={focusMessageId}
                currentTrack={currentTrack}
                playing={playing}
                onToggleMusic={() => setPlaying((value) => !value)}
                onNextMusic={() => {
                  if (activeTracks.length) setTrackIndex((index) => (index + 1) % activeTracks.length);
                }}
                onOpenMusic={() => setActive("音乐")}
                onAddMusicToPlaylist={(card) => {
                  setMusicPlaylistIntent(card);
                  setActive("音乐");
                }}
              />
          ) : active === "日记" ? (
            <Diary />
          ) : active === "便笺" ? (
            <Notes />
          ) : active === "提醒" ? (
            <Todos />
          ) : active === "纪念日" ? (
            <Anniversaries />
          ) : active === "音乐" ? (
            <MusicPlayerUI
              queue={activeTracks}
              onQueue={replaceMusicQueue}
              selected={trackIndex}
              onTracks={(incoming) => setTracks((current) => {
                return mergeMusicTracks(current, incoming);
              })}
              playlistIntent={musicPlaylistIntent}
              onPlaylistIntentConsumed={() => setMusicPlaylistIntent(null)}
              playMode={playMode}
              onCycleMode={cyclePlayMode}
              toast={musicToast}
              adapter={playerAdapter}
              userName={userName}
              agentName={agentName}
              userAvatar={userAvatar}
              agentAvatar={agentAvatar}
              together={musicTogether}
              onInvite={() => setMusicTogether((current) => current.status === "connected" ? current : { ...current, status: "invited", inviteRequestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}
              onRemoveQueueItem={(index) => {
                const nextQueue = activeTracks.filter((_, itemIndex) => itemIndex !== index);
                replaceMusicQueue(nextQueue);
                if (!nextQueue.length) setPlaying(false);
              }}
            />
          ) : active === "记忆库" ? (
            <MemoryLibrary />
          ) : active === "设置" ? (
            <SettingsPage
              accent={accent}
              background={customBackground}
              onAccent={(value) => setAccent(normalizeNeutralAccent(value))}
              onBackground={(value) => setCustomBackground(normalizeAppBackground(value))}
              environment={environment}
              onEnvironment={setEnvironment}
            />
          ) : (
            <Placeholder title={active} />
          )}
        </div>
        <div
          className={drawerOpen ? "drawer-layer visible" : "drawer-layer"}
          aria-hidden={!drawerOpen}
        >
          <button
            className="scrim"
            aria-label="关闭目录"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="drawer">
            <div className="drawer-head">
              <div className="drawer-brand">
                <span className="drawer-app-mark">
                  <img src="/icon-192-20260901-v1.png" alt="" />
                </span>
                <div>
                  <b>Vesper</b>
                  <small>YOUR QUIET CORNER</small>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setDrawerOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <nav>
              {nav.map(({ label, english, icon }) => (
                <button
                  key={label}
                  className={active === label ? "nav-row active" : "nav-row"}
                  onClick={() => navigateTo(label)}
                >
                  <NavIcon name={icon} />
                  <span>{english}</span>
                  {active === label && <i />}
                </button>
              ))}
            </nav>
            <button
              className="drawer-footer"
              onClick={() => {
                setDrawerOpen(false);
                window.setTimeout(() => setProfileOpen(true), 290);
              }}
            >
              <span className="footer-avatar">{userName.slice(0, 1)}</span>
              <span>
                <b>Vesper</b>
                <small>编辑用户与 Agent 名称</small>
              </span>
              <Icon name="chevron" />
            </button>
          </aside>
        </div>
        {profileOpen && (
          <ProfileModal
            userName={userName}
            agentName={agentName}
            userAvatar={userAvatar}
            agentAvatar={agentAvatar}
            onSave={(user, agent, userPhoto, agentPhoto) => {
              setUserName(user || "我");
              setAgentName(agent || "Vesper");
              setUserAvatar(userPhoto);
              setAgentAvatar(agentPhoto);
              setProfileOpen(false);
            }}
            onClose={() => setProfileOpen(false)}
          />
        )}{" "}
        {historyOpen && (
          <HistoryModal
            activeId={conversationId}
            favorites={favorites}
            onSelect={(id) => {
              setConversationId(id);
              setFocusMessageId("");
              setHistoryOpen(false);
            }}
            onDelete={(id) => {
              if (id === conversationId) setConversationId("main");
            }}
            onSelectFavorite={(item) => {
              setConversationId(item.conversationId);
              setFocusMessageId(item.messageId);
              setHistoryOpen(false);
            }}
            onRemoveFavorite={(id) => setFavorites((items) => items.filter((item) => item.id !== id))}
            onClose={() => setHistoryOpen(false)}
          />
        )}
        {voiceCallOpen && (
          <VoiceCallModal
            agentName={agentName}
            agentAvatar={agentAvatar}
            conversationId={conversationId}
            onClose={() => setVoiceCallOpen(false)}
          />
        )}
      </section>
    </main>
  );
}

function AvatarMark({
  src,
  label,
  kind,
}: {
  src: string;
  label: string;
  kind: "user" | "agent";
}) {
  return (
    <span
      className={`avatar-mark ${kind}`}
      style={src ? { backgroundImage: `url("${src}")` } : undefined}
    >
      <span>{src ? "" : label.slice(0, 1)}</span>
    </span>
  );
}

async function uploadImage(file: File) {
  const data = new FormData();
  data.append("file", file);
  const response = await fetch(apiUrl("/api/media"), {
    method: "POST",
    headers: appHeaders(),
    body: data,
  });
  if (!response.ok) throw new Error("图片上传失败");
  return (await response.json()) as { key: string; url: string };
}
async function localImage(file: File, maxSize = 1200, quality = 0.86) {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    image.src = url;
  });
  const scale = Math.min(1, maxSize / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
async function uploadMedia(file: File) {
  const data = new FormData();
  data.append("file", file);
  const response = await fetch(apiUrl("/api/media"), {
    method: "POST",
    headers: appHeaders(),
    body: data,
  });
  if (!response.ok) throw new Error("附件上传失败");
  return (await response.json()) as ChatAttachment;
}
async function fileSha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function usePersistentDocument<T>(key: string, initial: T) {
  const storageKey = `vesper-document-${key}`;
  const metaKey = `vesper-document-meta-${key}`;
  const [value, setValue] = useState<T>(() => readLocalValue<T>(storageKey, initial));
  const [ready, setReady] = useState(false);
  const lastSerialized = useRef(
    typeof window === "undefined" ? "" : window.localStorage.getItem(storageKey) || "",
  );
  useEffect(() => {
    let live = true;
    const reconcile = async (initialLoad = false) => {
      const localRaw = window.localStorage.getItem(storageKey);
      const localMeta = readLocalValue<{ updatedAt?: string }>(metaKey, {});
      try {
        const response = await fetch(apiUrl(`/api/state?key=${encodeURIComponent(key)}`), {
          cache: "no-store",
          headers: appHeaders(),
        });
        if (!response.ok) throw new Error("sync unavailable");
        const remote = (await response.json()) as { value: T | null; updatedAt?: string };
        const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
        const localTime = localMeta.updatedAt ? Date.parse(localMeta.updatedAt) : 0;
        if (remote.value !== null && (localRaw === null || (localTime > 0 && remoteTime > localTime))) {
          const serialized = JSON.stringify(remote.value);
          lastSerialized.current = serialized;
          window.localStorage.setItem(storageKey, serialized);
          window.localStorage.setItem(metaKey, JSON.stringify({ updatedAt: remote.updatedAt, source: "remote" }));
          if (live) setValue(remote.value);
        } else if (localRaw !== null && (!remote.updatedAt || localTime === 0)) {
          const upload = await fetch(apiUrl("/api/state"), {
            method: "PUT",
            headers: appHeaders(true),
            body: JSON.stringify({ key, value: JSON.parse(localRaw) }),
          });
          if (upload.ok) {
            const result = (await upload.json()) as { updatedAt?: string };
            window.localStorage.setItem(metaKey, JSON.stringify({ updatedAt: result.updatedAt || new Date().toISOString(), source: "local" }));
          }
        }
      } catch {
        // Local data remains authoritative while offline or when cloud sync is unavailable.
      } finally {
        if (live && initialLoad) setReady(true);
      }
    };
    void reconcile(true);
    const refresh = () => {
      if (document.visibilityState === "visible") void reconcile(false);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key, metaKey, storageKey]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: T }>).detail;
      if (detail?.key === key) {
        lastSerialized.current = JSON.stringify(detail.value);
        setValue(detail.value);
      }
    };
    window.addEventListener("vesper-document-change", receive);
    return () => window.removeEventListener("vesper-document-change", receive);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(value);
    if (lastSerialized.current === serialized) return;
    lastSerialized.current = serialized;
    window.localStorage.setItem(storageKey, serialized);
    window.localStorage.setItem(metaKey, JSON.stringify({ updatedAt: new Date().toISOString(), source: "local" }));
    window.dispatchEvent(
      new CustomEvent("vesper-document-change", { detail: { key, value } }),
    );
    const timer = window.setTimeout(() => {
      fetch(apiUrl("/api/state"), {
        method: "PUT",
        headers: appHeaders(true),
        body: JSON.stringify({ key, value }),
      })
        .then(async (response) => {
          if (!response.ok) return;
          const result = (await response.json()) as { updatedAt?: string };
          window.localStorage.setItem(metaKey, JSON.stringify({ updatedAt: result.updatedAt || new Date().toISOString(), source: "local" }));
        })
        .catch(() => {});
    }, 260);
    return () => window.clearTimeout(timer);
  }, [key, metaKey, ready, storageKey, value]);
  return [value, setValue] as const;
}
function useLocalDocument<T>(key: string, initial: T) {
  const storageKey = `vesper-local-${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "") as T;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);
  return [value, setValue] as const;
}

function wakeThreshold() {
  const sample = new Uint32Array(1);
  crypto.getRandomValues(sample);
  const unit = Math.max(1 / 2 ** 32, sample[0] / 2 ** 32);
  return -Math.log(unit);
}

type AutonomousPushKind = "message" | "call" | "note";

async function sendAutonomousPush(
  kind: AutonomousPushKind,
  title: string,
  body: string,
  url = "/",
) {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const current = await registration.pushManager.getSubscription();
  if (!current) return false;
  const response = await fetch(apiUrl("/api/push"), {
    method: "POST",
    headers: appHeaders(true),
    body: JSON.stringify({
      action: "notify",
      subscription: serializeSubscription(current),
      notification: {
        title,
        body,
        url,
        tag: `vesper-agent-${kind}-${Date.now()}`,
        kind,
      },
    }),
  });
  return response.ok;
}

function useAutonomousWake(agentName: string) {
  const [preferences] = usePersistentDocument<VesperPreferences>("settings", defaultPreferences);
  const [, setNotes] = usePersistentDocument<NoteItem[]>("notes", []);
  useEffect(() => {
    if (preferences.careFrequency === "off") return;
    let running = false;
    const key = "vesper-wake-runtime-v1";
    const check = async () => {
      if (running || document.visibilityState !== "visible") return;
      const now = Date.now();
      const hour = new Date(now).getHours();
      if (hour >= 23 || hour < 8) return;
      const state = readLocalValue(key, {
        checkedAt: now,
        cumulative: 0,
        threshold: wakeThreshold(),
        lastWakeAt: 0,
        generation: 0,
      });
      const elapsedHours = Math.min(6, Math.max(0, now - state.checkedAt) / 3_600_000);
      const rate = preferences.careFrequency === "daily" ? 1 / 14 : 1 / 72;
      const cumulative = state.cumulative + elapsedHours * rate;
      const minimumGap = preferences.careFrequency === "daily" ? 8 : 36;
      const gapHours = (now - state.lastWakeAt) / 3_600_000;
      if (cumulative < state.threshold || gapHours < minimumGap) {
        window.localStorage.setItem(key, JSON.stringify({ ...state, checkedAt: now, cumulative }));
        return;
      }
      const generation = state.generation + 1;
      window.localStorage.setItem(key, JSON.stringify({
        checkedAt: now,
        cumulative: 0,
        threshold: wakeThreshold(),
        lastWakeAt: now,
        generation,
      }));
      running = true;
      try {
        const connections = readLocalValue<AiConnectionStore>("vesper-local-ai-connections-v1", {
          active: "api", api: {}, mcp: {}, cyberboss: {},
        });
        if (connections.active === "cyberboss") return;
        const configured = connections.active === "api"
          ? Boolean(connections.api.baseUrl && connections.api.apiKey && connections.api.model)
          : Boolean(connections.mcp.url);
        if (!configured) return;
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: deviceHeaders(),
          body: JSON.stringify({
            mode: connections.active,
            connection: connections[connections.active],
            conversationId: "autonomous-wake",
            messages: [{
              role: "user",
              content: "你是 Vesper。现在是一次自主关心机会。请结合当前时段，用一句自然、克制、不重复的中文留下关心，不要提系统、算法或提醒。",
            }],
          }),
        });
        const result = (await response.json()) as { content?: string };
        const latest = readLocalValue<typeof state>(key, state);
        if (!response.ok || !result.content || latest.generation !== generation) return;
        const text = result.content.trim().slice(0, 240);
        setNotes((items) => [{
          id: crypto.randomUUID(),
          text,
          kind: "agent",
          tone: "mist",
          createdAt: new Date().toISOString(),
        }, ...items]);
        const delivered = await sendAutonomousPush(
          "note",
          agentName || "Vesper",
          `给你留了一张便笺：${text}`,
          "/?view=notes",
        );
        if (!delivered && Notification.permission === "granted") {
          const registration = await navigator.serviceWorker?.ready;
          await registration?.showNotification(agentName || "Vesper", {
            body: `给你留了一张便笺：${text}`,
            tag: `vesper-wake-${generation}`,
            icon: "/icon-192-20260901-v1.png",
          });
        }
      } finally {
        running = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    const visible = () => void check();
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [agentName, preferences.careFrequency, setNotes]);
}

function Today({
  track,
  playing,
  onToggle,
  environment,
  userName,
  onOpenSection,
}: {
  track?: Track;
  playing: boolean;
  onToggle: () => void;
  environment: EnvironmentSnapshot;
  userName: string;
  onOpenSection: (section: "便笺" | "提醒" | "纪念日" | "音乐") => void;
}) {
  const [notes] = usePersistentDocument<NoteItem[]>("notes", []);
  const [todos, setTodos] = usePersistentDocument<TodoItem[]>("todos", []);
  const [anniversaries] = usePersistentDocument<AnniversaryItem[]>(
    "anniversaries",
    [],
  );
  const now = new Date();
  const dateText = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const hour = now.getHours();
  const greeting =
    hour < 6
      ? "Late night"
      : hour < 11
        ? "Good morning"
        : hour < 14
          ? "Good afternoon"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";
  const weather =
    environment.permission === "granted" &&
    environment.temperature !== undefined
      ? `${Math.round(environment.temperature)}°`
      : "--°";
  const homeSignal =
    hour < 6
      ? "夜里慢一点。"
      : hour < 11
        ? "灯还亮着。"
        : hour < 18
          ? "今天也住在这里。"
          : "你回来了。";
  const realNotes = [...notes]
    .filter((note) => note.text.trim().length > 0)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return (Number.isFinite(rightTime) ? rightTime : 0) -
        (Number.isFinite(leftTime) ? leftTime : 0);
    });
  const latestNote = realNotes[0];
  const latestNoteLines = latestNote
    ? latestNote.text
        .trim()
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const latestNoteTitle = latestNoteLines[0] || "";
  const latestNoteSummary = latestNoteLines.slice(1).join(" ").trim();
  const latestNoteTimestamp = latestNote
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(latestNote.createdAt))
    : "";
  const todayReminder = todos.find((item) => {
    if (item.done || !item.due?.trim()) return false;
    if (item.due.includes("今天")) return true;
    const dueAt = new Date(item.due);
    return Number.isFinite(dueAt.getTime()) && dueAt.toDateString() === now.toDateString();
  });
  const todayAnniversary = anniversaries.find((item) => {
    const date = new Date(`${item.date}T12:00:00`);
    return Number.isFinite(date.getTime()) &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  });
  const todayMoment = todayReminder
    ? {
        icon: "check",
        title: todayReminder.title,
        detail: todayReminder.due || todayReminder.tag,
        section: "提醒" as const,
      }
    : latestNote
      ? {
          icon: latestNote.kind === "agent" ? "sparkles" : "note",
          title: latestNoteTitle,
          detail: "最近便笺",
          section: "便笺" as const,
        }
      : todayAnniversary
        ? {
            icon: "calendar",
            title: todayAnniversary.title,
            detail: "今天的纪念日",
            section: "纪念日" as const,
          }
        : track && playing
          ? {
              icon: "music",
              title: track.title,
              detail: track.artist,
              section: "音乐" as const,
            }
          : null;
  return (
    <div className="today-home">
      <section className="welcome">
        <div className="date-row">
          <span>{dateText}</span>
          <span className="weather-pill">
            <Icon name="cloud" />
            {weather}
          </span>
        </div>
        <h1>{greeting}, {userName}.</h1>
        <p className="home-return-signal">{homeSignal}</p>
      </section>
      <section className="section-block home-notes">
        <SectionTitle icon="note" title="Notes" count={latestNote ? String(realNotes.length) : undefined} />
        {latestNote ? (
          <button className="home-note-summary" onClick={() => onOpenSection("便笺")}>
            <span className="home-card-icon">
              <Icon name={latestNote.kind === "agent" ? "sparkles" : "note"} />
            </span>
            <span className="home-note-copy">
              <b>{latestNoteTitle}</b>
              <small>{latestNoteSummary || `记录于 ${latestNoteTimestamp}`}</small>
            </span>
            <Icon name="chevron" />
          </button>
        ) : (
          <button className="home-note-empty" onClick={() => onOpenSection("便笺")}>
            <span>留一句给今天的你。</span>
            <Icon name="chevron" />
          </button>
        )}
      </section>
      {todayMoment && (
        <section className="section-block home-moment-section">
          <button
            className="home-moment-card"
            onClick={() => onOpenSection(todayMoment.section)}
          >
            <span className="home-card-icon">
              <Icon name={todayMoment.icon} />
            </span>
            <span className="home-moment-copy">
              <small>今日</small>
              <b>{todayMoment.title}</b>
              <span>{todayMoment.detail}</span>
            </span>
            <Icon name="chevron" />
          </button>
        </section>
      )}
      <section className="section-block">
        <SectionTitle
          icon="check"
          title="Today's reminders"
          count={`${todos.filter((x) => x.done).length} / ${todos.length}`}
        />
        <div className="surface reminders">
          {todos.slice(0, 4).map((item) => (
            <button
              className="reminder-row"
              key={item.id}
              onClick={() =>
                setTodos((items) =>
                  items.map((x) =>
                    x.id === item.id ? { ...x, done: !x.done } : x,
                  ),
                )
              }
            >
              <span
                className={item.done ? "round-check checked" : "round-check"}
              >
                {item.done && <Icon name="check" />}
              </span>
              <span
                className={
                  item.done ? "reminder-copy crossed" : "reminder-copy"
                }
              >
                {item.title}
                <small>{item.done ? "已完成" : item.due || item.tag}</small>
              </span>
            </button>
          ))}
          {!todos.length && <EmptyState text="No reminders yet" />}
        </div>
      </section>
      <section className="section-block">
        <SectionTitle icon="calendar" title="Dates" />
        {nextAnniversary(anniversaries) ? (
          <AnniversaryCard item={nextAnniversary(anniversaries)!} />
        ) : (
          <div className="surface">
            <EmptyState text="No dates yet" />
          </div>
        )}
      </section>
      <MusicCard track={track} playing={playing} onToggle={onToggle} />
    </div>
  );
}

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt?: string;
  messageCount: number;
};

function conversationUpdatedTimestamp(item: ConversationSummary) {
  const timestamp = Date.parse(item.updatedAt || item.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeConversationSummaries(remote: ConversationSummary[], local: ConversationSummary[]) {
  const byId = new Map<string, ConversationSummary>();
  for (const item of [...remote, ...local]) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    if (!existing || conversationUpdatedTimestamp(item) > conversationUpdatedTimestamp(existing)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((left, right) => conversationUpdatedTimestamp(right) - conversationUpdatedTimestamp(left));
}

function latestLocalConversationId() {
  const conversations = readLocalValue<ConversationSummary[]>("vesper-local-conversation-index", []);
  return mergeConversationSummaries([], conversations)[0]?.id || "main";
}

async function resolveLatestConversationId() {
  const local = readLocalValue<ConversationSummary[]>("vesper-local-conversation-index", []);
  try {
    const response = await fetch(codexHistoryUrl("/conversations"), {
      headers: codexHistoryHeaders(),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("History is unavailable");
    const payload = await response.json() as { conversations?: ConversationSummary[] };
    const conversations = mergeConversationSummaries(payload.conversations || [], local);
    window.localStorage.setItem("vesper-local-conversation-index", JSON.stringify(conversations.slice(0, 100)));
    return conversations[0]?.id || "main";
  } catch {
    return mergeConversationSummaries([], local)[0]?.id || "main";
  }
}

function rememberConversation(id: string, title = "新对话", messageCount?: number) {
  if (typeof window === "undefined") return;
  const key = "vesper-local-conversation-index";
  const current = readLocalValue<ConversationSummary[]>(key, []);
  const existing = current.find((item) => item.id === id);
  const next = [
    {
      id,
      title: title || existing?.title || "新对话",
      updatedAt: new Date().toISOString(),
      messageCount: messageCount ?? Math.max(1, (existing?.messageCount || 0) + 1),
    },
    ...current.filter((item) => item.id !== id),
  ];
  window.localStorage.setItem(key, JSON.stringify(next.slice(0, 100)));
}

function HistoryModal({
  activeId,
  favorites,
  onSelect,
  onSelectFavorite,
  onRemoveFavorite,
  onDelete,
  onClose,
}: {
  activeId: string;
  favorites: FavoriteItem[];
  onSelect: (id: string) => void;
  onSelectFavorite: (item: FavoriteItem) => void;
  onRemoveFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(() =>
    readLocalValue<ConversationSummary[]>("vesper-local-conversation-index", []),
  );
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"conversations" | "favorites">("conversations");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const token = deviceToken();
    if (!token) return;
    void migrateLegacyHistory().then(async () => {
      const response = await fetch(codexHistoryUrl("/conversations"), { headers: codexHistoryHeaders(), cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { conversations?: ConversationSummary[] };
      setConversations(data.conversations || []);
    }).catch((reason) => setHistoryError(reason instanceof Error ? reason.message : "旧历史迁移失败"));
    fetch(codexHistoryUrl("/conversations"), {
      headers: codexHistoryHeaders(),
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) =>
        setConversations((current) => {
          const remote = (data as { conversations?: ConversationSummary[] }).conversations || [];
          return [...remote, ...current.filter((local) => !remote.some((item) => item.id === local.id))];
        }),
      )
      .catch(() => {});
  }, []);
  const visible = conversations.filter((item) =>
    String(item.title || "未命名对话").toLowerCase().includes(query.trim().toLowerCase()),
  );
  const remove = async (item: ConversationSummary) => {
    if (!window.confirm(`删除“${item.title || "未命名对话"}”？此操作无法撤销。`)) return;
    const token = deviceToken();
    if (token) {
      const response = await fetch(
        codexHistoryUrl(`/conversations/${encodeURIComponent(item.id)}`),
        { method: "DELETE", headers: codexHistoryHeaders() },
      );
      if (!response.ok && response.status !== 404) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setHistoryError(payload.error || `删除失败（HTTP ${response.status}）`);
        return;
      }
    }
    for (const key of Object.keys(window.localStorage)) {
      if ((key.startsWith("vesper-local-chat-") || key.startsWith("vesper-codex-chat-")) && key.endsWith(`-${item.id}`))
        window.localStorage.removeItem(key);
    }
    const next = conversations.filter((conversation) => conversation.id !== item.id);
    setConversations(next);
    window.localStorage.setItem("vesper-local-conversation-index", JSON.stringify(next));
    onDelete(item.id);
    setMenuId("");
  };
  const rename = async (item: ConversationSummary) => {
    const title = window.prompt("重命名对话", item.title || "对话")?.trim();
    if (!title || title === item.title) return;
    try {
      await persistCodexConversation(item.id, { title });
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : "云端标题同步失败");
      return;
    }
    const next = conversations.map((entry) => entry.id === item.id ? { ...entry, title, updatedAt: new Date().toISOString() } : entry);
    setConversations(next);
    window.localStorage.setItem("vesper-local-conversation-index", JSON.stringify(next));
    setMenuId("");
  };
  const nowMs = new Date().getTime();
  const groups = [
    ["今天", visible.filter((item) => new Date(item.updatedAt).toDateString() === new Date().toDateString())],
    
    ["过去 7 天", visible.filter((item) => {
      const age = nowMs - new Date(item.updatedAt).getTime();
      return age >= 86_400_000 && age <= 7 * 86_400_000;
    })],
    ["更早", visible.filter((item) => nowMs - new Date(item.updatedAt).getTime() > 7 * 86_400_000)],
  ] as const;
  const visibleFavorites = favorites.filter((item) => `${item.content} ${item.conversationTitle}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="modal-layer history-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="history-modal history-drawer" aria-label="对话导航">
        <header className="history-drawer-head">
          <div className="history-drawer-title"><button className={tab === "conversations" ? "active" : ""} onClick={() => setTab("conversations")}>对话</button><button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>收藏</button></div>
          <div className="history-drawer-actions"><button aria-label="搜索" onClick={() => setSearchOpen((value) => !value)}><Icon name="search" /></button><button aria-label="关闭" onClick={onClose}><Icon name="close" /></button></div>
        </header>
        {searchOpen && <label className="history-search compact"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "favorites" ? "搜索收藏" : "搜索对话"} /></label>}
        {historyError && <div className="history-error" role="alert">{historyError}</div>}
        {tab === "conversations" ? (
          <div className="history-list drawer-list">
            {groups.map(([label, items]) => items.length ? <section className="history-group" key={label}><h3>{label}</h3>{items.map((item) => <article className={item.id === activeId ? "history-item-row selected" : "history-item-row"} key={item.id}><button className="history-open" onClick={() => onSelect(item.id)}><b>{item.title || "未命名对话"}</b><span>{item.messageCount} 条 · {new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span></button><button className="history-delete" aria-label={`${item.title || "对话"}的更多操作`} aria-expanded={menuId === item.id} onClick={() => setMenuId((current) => current === item.id ? "" : item.id)}><Icon name="more" /></button>{menuId === item.id && <div className="history-item-menu" role="menu"><button role="menuitem" onClick={() => void rename(item)}><Icon name="edit" />重命名</button><button role="menuitem" className="danger" onClick={() => void remove(item)}><Icon name="trash" />删除会话</button></div>}</article>)}</section> : null)}
            {!visible.length && <EmptyState text="还没有聊天记录。" />}
          </div>
        ) : (
          <div className="history-list drawer-list favorites-list">
            {visibleFavorites.map((item) => <article className="favorite-row" key={item.id}><button onClick={() => onSelectFavorite(item)}><b>{item.content.split("\n").slice(0, 2).join(" ").slice(0, 100)}</b><span>{item.conversationTitle} · {new Date(item.createdAt).toLocaleDateString("zh-CN")}</span></button><button aria-label="删除收藏" onClick={() => onRemoveFavorite(item.id)}><Icon name="trash" /></button></article>)}
            {!visibleFavorites.length && <EmptyState text="还没有收藏。" />}
          </div>
        )}
        {tab === "conversations" && <button className="history-new" onClick={() => { const id = `chat-${Date.now()}-${crypto.randomUUID()}`; rememberConversation(id, "新对话"); onSelect(id); }}><Icon name="plus" />新建对话</button>}
      </section>
    </div>
  );
}

function VoiceCallModal({
  agentName,
  agentAvatar,
  conversationId,
  onClose,
}: {
  agentName: string;
  agentAvatar: string;
  conversationId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<
    "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"
  >("idle");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [caption, setCaption] = useState("");
  const [connections] = useLocalDocument<AiConnectionStore>(
    "ai-connections-v1",
    { active: "api", api: {}, mcp: {}, cyberboss: {} },
  );
  const [connectionSettings] = useLocalDocument<ConnectionSettings>("connections", {});
  const ttsSettings = connectionSettings["Agent 声音"] || {};
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const stateRef = useRef(state);
  const mutedRef = useRef(muted);
  const speakerRef = useRef(speaker);
  const playback = useRef<HTMLAudioElement | null>(null);
  const playbackUrl = useRef("");
  const recognition = useRef<{ start: () => void; stop: () => void } | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);
  const restartRecognition = () => {
    if (mutedRef.current || stateRef.current !== "listening") return;
    window.setTimeout(() => {
      try {
        recognition.current?.start();
      } catch {}
    }, 180);
  };
  const stopPlayback = () => {
    playback.current?.pause();
    playback.current = null;
    if (playbackUrl.current) URL.revokeObjectURL(playbackUrl.current);
    playbackUrl.current = "";
  };
  const speak = async (text: string, id: number) => {
    if (generation.current !== id) return;
    if (!speakerRef.current) {
      stateRef.current = "listening";
      setState("listening");
      restartRecognition();
      return;
    }
    try {
      if (!ttsSettings.baseUrl || !ttsSettings.apiKey)
        throw new Error("请先在设置 → Agent 声音中配置 TTS");
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, connection: ttsSettings }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "TTS 请求失败");
      }
      if (generation.current !== id) return;
      stopPlayback();
      const url = URL.createObjectURL(await response.blob());
      playbackUrl.current = url;
      const audio = new Audio(url);
      playback.current = audio;
      audio.onplay = () => {
        if (generation.current === id) {
          stateRef.current = "speaking";
          setState("speaking");
        }
      };
      audio.onended = () => {
        stopPlayback();
        if (generation.current !== id) return;
        stateRef.current = "listening";
        setState("listening");
        restartRecognition();
      };
      audio.onerror = () => {
        stopPlayback();
        setCaption("TTS 音频播放失败");
        stateRef.current = "listening";
        setState("listening");
        restartRecognition();
      };
      await audio.play();
    } catch (reason) {
      setCaption(reason instanceof Error ? reason.message : "TTS 播放失败");
      stateRef.current = "listening";
      setState("listening");
      restartRecognition();
    }
  };
  const runTurn = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const id = ++generation.current;
    stopPlayback();
    setCaption(clean);
    stateRef.current = "thinking";
    setState("thinking");
    try { recognition.current?.stop(); } catch {}
    try {
      if (connections.active === "cyberboss") {
        const response = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: deviceHeaders(),
          body: JSON.stringify({ conversationId, content: clean }),
        });
        if (!response.ok) throw new Error("AI 运行端暂时没有响应");
        if (generation.current === id) {
          setCaption("消息已交给 AI 运行端，等待回复");
          stateRef.current = "listening";
          setState("listening");
          restartRecognition();
        }
        return;
      }
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: deviceHeaders(),
        body: JSON.stringify({
          mode: connections.active,
          connection: connections[connections.active],
          conversationId,
          messages: [{ role: "user", content: clean }],
        }),
      });
      const result = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "语音通话请求失败");
      if (generation.current !== id) return;
      const answer = result.content || "我在。";
      setCaption(answer);
      void speak(answer, id);
    } catch (reason) {
      if (generation.current !== id) return;
      setCaption(reason instanceof Error ? reason.message : "语音通话连接失败");
      stateRef.current = "error";
      setState("error");
    }
  };
  const start = async () => {
    setState("connecting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Speech = (
        window as Window & {
          SpeechRecognition?: new () => {
            lang: string;
            continuous: boolean;
            interimResults: boolean;
            onresult: (event: {
              results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
              resultIndex: number;
            }) => void;
            onend: () => void;
            onerror: () => void;
            start: () => void;
            stop: () => void;
          };
          webkitSpeechRecognition?: new () => {
            lang: string;
            continuous: boolean;
            interimResults: boolean;
            onresult: (event: {
              results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
              resultIndex: number;
            }) => void;
            onend: () => void;
            onerror: () => void;
            start: () => void;
            stop: () => void;
          };
        }
      ).SpeechRecognition ||
        (window as Window & { webkitSpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: (event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>; resultIndex: number }) => void;
          onend: () => void;
          onerror: () => void;
          start: () => void;
          stop: () => void;
        } }).webkitSpeechRecognition;
      if (!Speech) throw new Error("当前浏览器不支持实时语音识别");
      const session = new Speech();
      session.lang = "zh-CN";
      session.continuous = false;
      session.interimResults = true;
      session.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const part = event.results[index];
          if (part.isFinal) final += part[0].transcript;
          else interim += part[0].transcript;
        }
        if (interim) {
          if (stateRef.current === "speaking") {
            generation.current += 1;
            stopPlayback();
          }
          setCaption(interim);
        }
        if (final) void runTurn(final);
      };
      session.onend = () => {
        if (stream.current && !mutedRef.current && stateRef.current === "listening") restartRecognition();
      };
      session.onerror = () => {
        if (stream.current) restartRecognition();
      };
      recognition.current = session;
      stateRef.current = "listening";
      setState("listening");
      setCaption("我在听");
      session.start();
    } catch (reason) {
      setState("error");
      setCaption(reason instanceof Error ? reason.message : "无法开始通话，请检查麦克风与语音识别权限");
    }
  };
  const finish = () => {
    generation.current += 1;
    stopPlayback();
    recognition.current?.stop();
    recognition.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    onClose();
  };
  useEffect(() => {
    if (!["listening", "thinking", "speaking"].includes(state)) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  useEffect(() => () => {
    stopPlayback();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  const toggleMute = () => {
    const next = !muted;
    stream.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
    if (next) recognition.current?.stop();
    else restartRecognition();
    setMuted(next);
  };
  return (
    <div className="modal-layer call-layer">
      <button className="modal-scrim" onClick={finish} />
      <section className="voice-call-modal">
        <div className={`call-avatar-rings ${state}`}>
          <i /><i /><i />
          <AvatarMark src={agentAvatar} label={agentName} kind="agent" />
        </div>
        <small>· {state === "idle" ? "VOICE CALL" : "LIVE DUPLEX"} ·</small>
        <h2>{agentName}</h2>
        <p>
          {["listening", "thinking", "speaking"].includes(state)
            ? `${state === "listening" ? "我在听" : state === "thinking" ? "正在思考" : "正在回应"} · ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
            : state === "connecting"
              ? "正在请求麦克风…"
              : state === "error"
                ? caption
                : "通过当前 AI 连接开始语音通话"}
        </p>
        {caption && !["idle", "error"].includes(state) && <blockquote>{caption}</blockquote>}
        {state === "idle" || state === "error" ? (
          <button className="call-start" onClick={() => void start()}>
            <Icon name="phone" />
            开始通话
          </button>
        ) : (
          <div className="call-actions">
            <button onClick={toggleMute} aria-label={muted ? "打开麦克风" : "静音"}>
              <Icon name="mic" />
              <small>{muted ? "取消静音" : "静音"}</small>
            </button>
            <button onClick={() => {
              const next = !speakerRef.current;
              speakerRef.current = next;
              setSpeaker(next);
              if (!next) stopPlayback();
            }} aria-label="扬声器">
              <Icon name="volume" />
              <small>{speaker ? "扬声器" : "听筒"}</small>
            </button>
            <button className="call-end" onClick={finish} aria-label="结束通话">
              <Icon name="phone" />
              <small>挂断</small>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileModal({
  userName,
  agentName,
  userAvatar,
  agentAvatar,
  onSave,
  onClose,
}: {
  userName: string;
  agentName: string;
  userAvatar: string;
  agentAvatar: string;
  onSave: (
    user: string,
    agent: string,
    userPhoto: string,
    agentPhoto: string,
  ) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(userName === "我" ? "" : userName);
  const [agent, setAgent] = useState(agentName);
  const [userPhoto, setUserPhoto] = useState(userAvatar);
  const [agentPhoto, setAgentPhoto] = useState(agentAvatar);
  const [birthday, setBirthday] = useState("");
  const loadPhoto = async (
    file: File | undefined,
    setter: (value: string) => void,
  ) => {
    if (!file) return;
    const preview = await localImage(file, 640, 0.88);
    setter(preview);
    try {
      const { url } = await uploadImage(file);
      setter(url);
    } catch {}
  };
  return (
    <div className="modal-layer profile-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="profile-modal">
        <div className="modal-head">
          <div>
            <small>USER & AGENT</small>
            <h2>我的 Vesper</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="avatar-editor-pair">
          <label>
            <AvatarMark src={userPhoto} label={name || "我"} kind="user" />
            <i>
              <Icon name="edit" />
            </i>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => loadPhoto(e.target.files?.[0], setUserPhoto)}
            />
            <small>User 头像</small>
          </label>
          <label>
            <AvatarMark src={agentPhoto} label={agent || "V"} kind="agent" />
            <i>
              <Icon name="edit" />
            </i>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => loadPhoto(e.target.files?.[0], setAgentPhoto)}
            />
            <small>Agent 头像</small>
          </label>
        </div>
        <label className="profile-field">
          <span>用户名称</span>
          <input
            placeholder="未填写时显示“我”"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="profile-field">
          <span>Agent 昵称</span>
          <input value={agent} onChange={(e) => setAgent(e.target.value)} />
        </label>
        <label className="profile-field">
          <span>生日</span>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </label>
        <p className="profile-note">
          头像和名称会同步显示在聊天顶部与消息中；生日只用于纪念日和个性化陪伴。
        </p>
        <button
          className="save-profile"
          onClick={() => onSave(name, agent, userPhoto, agentPhoto)}
        >
          保存资料
        </button>
      </section>
    </div>
  );
}

type BridgeChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "agent" | "system";
  content: string;
  status: string;
  metadata?: {
    thoughtSummary?: string;
    durationMs?: number;
    tools?: string[];
    attachments?: ChatAttachment[];
    turnId?: string;
    threadId?: string;
    itemId?: string;
    turnStatus?: "thinking" | "tool" | "completed" | "error";
    showTurnStatus?: boolean;
    blockType?: string;
    musicCard?: MusicCardData;
    sticker?: StickerMessageData;
    timeSource?: "message" | "turn" | "thread" | "unknown";
  };
  createdAt: string;
  source?: "legacy-vesper" | "codex";
  type?: "text" | "sticker";
  timeSource?: "message" | "turn" | "thread" | "unknown";
};
type BridgeSnapshot = {
  messages: BridgeChatMessage[];
  bridge: { runtime: string; online: boolean; lastSeenAt?: string };
};
const deviceToken = () =>
  typeof window === "undefined"
    ? ""
    : window.localStorage.getItem("vesper-device-token") || "";
const deviceHeaders = () => ({
  "content-type": "application/json",
  "x-vesper-device-token": deviceToken(),
});

function LegacyConnectedChat({
  conversationId,
  agentName,
  userName,
  agentAvatar,
  userAvatar,
}: {
  conversationId: string;
  agentName: string;
  userName: string;
  agentAvatar: string;
  userAvatar: string;
}) {
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<BridgeSnapshot>({
    messages: [],
    bridge: { runtime: "cyberboss", online: false },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thought, setThought] = useState<BridgeChatMessage | null>(null);
  const [pending, setPending] = useState<{ file: File; preview: string }[]>([]);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [connections, setConnections] = useLocalDocument<AiConnectionStore>(
    "ai-connections-v1",
    { active: "api", api: {}, mcp: {}, cyberboss: {} },
  );
  const streamEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const recordingChunks = useRef<Blob[]>([]);
  const localMessageKey = () =>
    `vesper-local-chat-${connections.active}-${conversationId}`;
  const saveLocalMessages = (messages: BridgeChatMessage[]) => {
    window.localStorage.setItem(localMessageKey(), JSON.stringify(messages));
    setData({
      messages,
      bridge: { runtime: connections.active, online: true },
    });
  };
  const editMessage = async (item: BridgeChatMessage) => {
    const content = window.prompt("编辑消息", item.content)?.trim();
    if (!content || content === item.content) return;
    if (connections.active === "cyberboss") {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "PATCH",
        headers: deviceHeaders(),
        body: JSON.stringify({ id: item.id, content }),
      });
      if (!response.ok) {
        setError("消息编辑失败");
        return;
      }
      await refresh();
      return;
    }
    const current = readLocalValue<BridgeChatMessage[]>(localMessageKey(), []);
    saveLocalMessages(current.map((message) => message.id === item.id ? { ...message, content } : message));
  };
  const refresh = async () => {
    if (connections.active !== "cyberboss") {
      const configured =
        connections.active === "api"
          ? Boolean(
              connections.api.baseUrl &&
                connections.api.apiKey &&
                connections.api.model,
            )
          : Boolean(connections.mcp.url);
      const messages = readLocalValue<BridgeChatMessage[]>(localMessageKey(), []);
      setData({
        messages,
        bridge: { runtime: connections.active, online: configured },
      });
      setError(
        configured
          ? ""
          : `请先在设置 → AI 连接中配置${
              connections.active === "api" ? " API Key" : " MCP"
            }`,
      );
      return;
    }
    const token = deviceToken();
    if (!token) {
      setError("请先在设置 → AI 连接中配置连接方式");
      return;
    }
    try {
      const response = await fetch(
        apiUrl(`/api/chat?conversationId=${encodeURIComponent(conversationId)}`),
        {
        headers: { "x-vesper-device-token": token },
        cache: "no-store",
        },
      );
      if (response.status === 401) throw new Error("当前 AI 连接尚未授权");
      if (!response.ok) throw new Error("暂时无法读取对话");
      setData((await response.json()) as BridgeSnapshot);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接失败");
    }
  };
  const send = async () => {
    const content = draft.trim();
    if ((!content && !pending.length) || busy) return;
    setBusy(true);
    setDraft("");
    try {
      const attachments = await Promise.all(
        pending.map(async ({ file }) => uploadMedia(file)),
      );
      if (connections.active !== "cyberboss") {
        const createdAt = new Date().toISOString();
        const userMessage: BridgeChatMessage = {
          id: crypto.randomUUID(),
          conversationId,
          role: "user",
          content: content || "附件",
          status: "delivered",
          metadata: { attachments },
          createdAt,
        };
        const current = readLocalValue<BridgeChatMessage[]>(localMessageKey(), []);
        saveLocalMessages([...current, userMessage]);
        // eslint-disable-next-line react-hooks/purity
        const startedAt = performance.now();
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: deviceHeaders(),
          body: JSON.stringify({
            mode: connections.active,
            connection: connections[connections.active],
            conversationId,
            messages: [...current, userMessage].map((item) => ({
              role: item.role === "agent" ? "assistant" : item.role,
              content: item.content,
            })),
            attachments,
            documents: Object.fromEntries(
              ["notes", "todos", "anniversaries", "diary", "music", "musicControl"].map((key) => [
                key,
                readLocalValue(`vesper-document-${key}`, key === "diary" || key === "musicControl" ? {} : []),
              ]),
            ),
          }),
        });
        const result = (await response.json()) as {
          content?: string;
          reasoningSummary?: string;
          changedDocuments?: Record<string, unknown>;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "AI 连接请求失败");
        for (const [key, value] of Object.entries(result.changedDocuments || {})) {
          window.localStorage.setItem(`vesper-document-${key}`, JSON.stringify(value));
          window.dispatchEvent(new CustomEvent("vesper-document-change", { detail: { key, value } }));
        }
        const agentMessage: BridgeChatMessage = {
          id: crypto.randomUUID(),
          conversationId,
          role: "agent",
          content: result.content || "AI 没有返回内容",
          status: "delivered",
          metadata: {
            // eslint-disable-next-line react-hooks/purity
            durationMs: Math.round(performance.now() - startedAt),
            thoughtSummary: result.reasoningSummary || undefined,
          },
          createdAt: new Date().toISOString(),
        };
        saveLocalMessages([...current, userMessage, agentMessage]);
        rememberConversation(conversationId, content.slice(0, 28) || "附件");
        pending.forEach((item) => URL.revokeObjectURL(item.preview));
        setPending([]);
        setError("");
        return;
      }
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: deviceHeaders(),
        body: JSON.stringify({
          conversationId,
          content: content || (attachments.length ? "附件" : ""),
          attachments,
        }),
      });
      if (response.status === 401)
        throw new Error("请先在设置 → AI 连接中完成授权");
      if (!response.ok) throw new Error("消息发送失败");
      rememberConversation(conversationId, content.slice(0, 28) || "附件");
      pending.forEach((item) => URL.revokeObjectURL(item.preview));
      setPending([]);
      await refresh();
    } catch (reason) {
      setDraft(content);
      setError(reason instanceof Error ? reason.message : "消息发送失败");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const initial = window.setTimeout(() => {
      setData({ messages: [], bridge: { runtime: "connection", online: false } });
      setError("");
      void refresh();
    }, 0);
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [conversationId, connections.active]);
  useLayoutEffect(() => {
    const scroller = streamEnd.current?.closest(
      ".scroll-view",
    ) as HTMLElement | null;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [data.messages.length]);
  const stamp = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  const selectFiles = (files: FileList | null) => {
    if (!files) return;
    setPending((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };
  const startStt = () => {
    const Speech = (
      window as Window & {
        SpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
          onend: () => void;
          onerror: () => void;
          start: () => void;
        };
        webkitSpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
          onend: () => void;
          onerror: () => void;
          start: () => void;
        };
      }
    ).SpeechRecognition ||
      (
        window as Window & {
          webkitSpeechRecognition?: new () => {
            lang: string;
            interimResults: boolean;
            onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
            onend: () => void;
            onerror: () => void;
            start: () => void;
          };
        }
      ).webkitSpeechRecognition;
    if (!Speech) {
      setError("当前浏览器不支持语音转文字");
      return;
    }
    const recognition = new Speech();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onresult = (event) =>
      setDraft((value) => `${value}${value ? " " : ""}${event.results[0][0].transcript}`);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("语音识别失败，请检查麦克风权限");
    };
    setListening(true);
    recognition.start();
  };
  const toggleVoiceMessage = async () => {
    if (recording && recorder.current) {
      recorder.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStream.current = stream;
      recordingChunks.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunks.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunks.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: blob.type,
        });
        const preview = URL.createObjectURL(file);
        setPending((current) => [...current, { file, preview }]);
        recordingStream.current?.getTracks().forEach((track) => track.stop());
        recordingStream.current = null;
        setBusy(true);
        void uploadMedia(file)
          .then(async (attachment) => {
            const response = await fetch(apiUrl("/api/chat"), {
              method: "POST",
              headers: deviceHeaders(),
              body: JSON.stringify({
                conversationId,
                content: "语音消息",
                attachments: [attachment],
              }),
            });
            if (!response.ok) throw new Error("语音消息发送失败");
            URL.revokeObjectURL(preview);
            setPending((current) =>
              current.filter((item) => item.preview !== preview),
            );
            await refresh();
          })
          .catch((reason) =>
            setError(reason instanceof Error ? reason.message : "语音消息发送失败"),
          )
          .finally(() => setBusy(false));
      };
      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError("无法录音，请检查麦克风权限");
    }
  };
  return (
    <div className="page-body chat-page">
      <div className="bridge-presence">
        <i className={data.bridge.online ? "online" : ""} />
        <span>
          {data.bridge.online ? "AI 运行端已连接" : "AI 运行端离线"}
        </span>
      </div>
      <div className="chat-stream">
        {!data.messages.length && (
          <div className="chat-empty">
            <Icon name="chat" />
            <b>{error || "还没有对话"}</b>
            <span>
              {error
                ? "前往设置 → AI 连接"
                : "从这里开始与 Vesper 对话"}
            </span>
          </div>
        )}
        {data.messages.map((item) =>
          item.role === "agent" ? (
            <div className="agent-turn" key={item.id}>
              <time>{stamp(item.createdAt)}</time>
              <div className="message assistant">
                <AvatarMark src={agentAvatar} label={agentName} kind="agent" />
                <div>
                  {item.metadata?.thoughtSummary && (
                    <button
                      className="thought-toggle"
                      onClick={() => setThought(item)}
                    >
                      <Icon name="clock" />
                      <span>
                        {item.metadata.durationMs
                          ? `思考了 ${Math.max(1, Math.round(item.metadata.durationMs / 1000))} 秒`
                          : "查看过程摘要"}
                      </span>
                      <Icon name="chevron" />
                    </button>
                  )}
                  <p>{item.content}</p>
                  <MessageAttachments items={item.metadata?.attachments || []} />
                  <small>{agentName} · AI</small>
                </div>
              </div>
            </div>
          ) : (
            <div className="sent-turn" key={item.id}>
              <time>{stamp(item.createdAt)}</time>
              <div className="message mine sent-message">
                <div>
                  <p>{item.content}</p>
                  <MessageAttachments items={item.metadata?.attachments || []} />
                  <button className="message-edit" aria-label="编辑这条消息" title="编辑" onClick={() => void editMessage(item)}><Icon name="edit" /></button>
                </div>
                <AvatarMark src={userAvatar} label={userName} kind="user" />
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="agent-typing" aria-label={`${agentName} 正在输入`}>
            <AvatarMark src={agentAvatar} label={agentName} kind="agent" />
            <div><i /><i /><i /><span>{agentName} 正在输入</span></div>
          </div>
        )}
        <div ref={streamEnd} />
      </div>
      <div className="chat-compose">
        {pending.length > 0 && (
          <div className="compose-previews">
            {pending.map((item, index) => (
              <div className="compose-preview" key={`${item.file.name}-${index}`}>
                {item.file.type.startsWith("image/") ? (
                  <img src={item.preview} alt={item.file.name} />
                ) : item.file.type.startsWith("video/") ? (
                  <video src={item.preview} muted />
                ) : item.file.type.startsWith("audio/") ? (
                  <audio src={item.preview} controls />
                ) : (
                  <span><Icon name="archive" />{item.file.name}</span>
                )}
                <button
                  aria-label="移除附件"
                  onClick={() =>
                    setPending((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          placeholder={`回复 ${agentName}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="compose-actions">
          <button aria-label="添加附件" onClick={() => fileInput.current?.click()}>
            <Icon name="plus" />
          </button>
          <input
            ref={fileInput}
            hidden
            multiple
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.zip"
            onChange={(event) => {
              selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <label className="compose-connection" aria-label="选择 AI 连接方式">
            <i className={`connection-dot ${connections.active}`} />
            <select
              value={connections.active}
              onChange={(event) => {
                const active = event.target.value as AiConnectionStore["active"];
                setConnections({ ...connections, active });
                const token = connections.cyberboss.deviceToken?.trim();
                if (active === "cyberboss" && token)
                  window.localStorage.setItem("vesper-device-token", token);
              }}
            >
              <option value="api">API Key</option>
              <option value="mcp">MCP</option>
              <option value="cyberboss">CyberBoss</option>
            </select>
            <Icon name="chevron" />
          </label>
          <span>{busy ? "发送中…" : recording ? "录音中，再点一次结束" : ""}</span>
          <button
            className={listening ? "active" : ""}
            aria-label="语音转文字"
            onClick={startStt}
          >
            <Icon name="mic" />
          </button>
          {draft.trim() || pending.length ? (
            <button
              className="send-message-button"
              aria-label="发送消息"
              onClick={() => void send()}
            >
              <Icon name="send" />
            </button>
          ) : (
            <button
              className={recording ? "voice recording" : "voice"}
              aria-label={recording ? "结束并发送语音" : "发送语音"}
              onClick={() => void toggleVoiceMessage()}
            >
              <i />
              <i />
              <i />
              <i />
            </button>
          )}
        </div>
      </div>
      {thought && (
        <div className="thought-sheet-layer">
          <button
            className="thought-scrim"
            aria-label="关闭过程摘要"
            onClick={() => setThought(null)}
          />
          <section className="thought-sheet">
            <div className="thought-sheet-head">
              <button aria-label="关闭" onClick={() => setThought(null)}>
                <Icon name="close" />
              </button>
              <h2>Thought process</h2>
            </div>
            <div className="thought-raw">{thought.metadata?.thoughtSummary?.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
          </section>
        </div>
      )}
    </div>
  );
}

type CodexSocketMessage = {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};
type CodexItem = {
  id?: string;
  type?: string;
  role?: string;
  text?: unknown;
  summary?: unknown;
  content?: unknown;
};
type CodexInput =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "audio"; url: string };
type CodexPendingFile = { file: File; preview: string };
type CodexMessageTombstone = { threadId?: string | null; stableId?: string; itemId?: string | null; messageId: string; deletedAt?: string };

const CODEX_DYNAMIC_TOOLS = [
  {
    name: "read_vesper_state",
    description: "Read one Vesper document or section. Read-only; never changes data.",
    inputSchema: { type: "object", additionalProperties: false, properties: { section: { type: "string", enum: ["today", "notes", "reminders", "dates", "journal", "music", "memory", "settings"] } }, required: ["section"] },
  },
  {
    name: "search_vesper_state",
    description: "Search Vesper notes, reminders, anniversaries, journal, and music by text. Read-only.",
    inputSchema: { type: "object", additionalProperties: false, properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "write_vesper_state",
    description: "Create a Vesper note, reminder, anniversary, or agent journal entry.",
    inputSchema: { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["note", "reminder", "anniversary", "journal"] }, text: { type: "string" }, title: { type: "string" }, date: { type: "string" }, repeats: { type: "boolean" }, due: { type: "string" }, tag: { type: "string" } }, required: ["kind"] },
  },
  { name: "music_get_status", description: "Read the current device playback state, including song, playing/paused state, position, duration and queue length. Use before answering what is currently playing.", inputSchema: { type: "object", additionalProperties: false, properties: {} } },
  { name: "music_search", description: "Search the Vesper music library and current queue by title, artist, album, or keyword. Read-only.", inputSchema: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } }, required: ["query"] } },
  { name: "music_netease_search", description: "Search the public NetEase Music catalog, save returned songs to Vesper music, then use music_send_card, music_queue_add, or music_play with an exact trackId. This does not edit a NetEase playlist.", inputSchema: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 10 } }, required: ["query"] } },
  { name: "music_play", description: "Play one uniquely identified Vesper song on the user's current device. Never claims success without a playable source.", inputSchema: { type: "object", additionalProperties: false, properties: { trackId: { type: "string" }, replaceQueue: { type: "boolean", default: false } }, required: ["trackId"] } },
  { name: "music_control", description: "Control the current player: play/resume, pause, next track, or previous track.", inputSchema: { type: "object", additionalProperties: false, properties: { action: { type: "string", enum: ["play", "pause", "next", "previous"] } }, required: ["action"] } },
  { name: "music_queue_add", description: "Add one Vesper song to the shared playback queue, either next or at the end.", inputSchema: { type: "object", additionalProperties: false, properties: { trackId: { type: "string" }, position: { type: "string", enum: ["next", "end"] } }, required: ["trackId", "position"] } },
  { name: "music_send_card", description: "Return a structured Vesper song card for the chat timeline without starting playback.", inputSchema: { type: "object", additionalProperties: false, properties: { trackId: { type: "string" }, message: { type: "string" } }, required: ["trackId"] } },
  { name: "music_playlist_add", description: "Add a song to the persistent Vesper music playlist, separate from the temporary queue.", inputSchema: { type: "object", additionalProperties: false, properties: { trackId: { type: "string" } }, required: ["trackId"] } },
  { name: "recall_vesper_memory", description: "Read Rowan's relevant server-side memories. Returned entries are old background, not the user's current message.", inputSchema: { type: "object", additionalProperties: false, properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "remember_vesper_memory", description: "Only after a meaningful exchange, preserve one concise and durable memory. Never save a joke, guess, duplicate, or transient detail. Core items are candidates and require the user's confirmation; feelings must be Rowan's first-person feeling.", inputSchema: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["core", "long_term", "feeling", "dream"] }, body: { type: "string" }, mood: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["type", "body"] } },
  { name: "manage_vesper_memory", description: "List, add, edit, or remove Vesper memories only after the user explicitly requests that exact change. Core edits require explicit confirmation and a reason.", inputSchema: { type: "object", additionalProperties: false, properties: { action: { type: "string", enum: ["list", "add", "edit", "delete", "pin", "unpin", "restore"] }, id: { type: "string" }, type: { type: "string", enum: ["core", "long_term", "feeling", "dream"] }, body: { type: "string" }, mood: { type: "string" }, tags: { type: "array", items: { type: "string" } }, reason: { type: "string" }, includeDemoted: { type: "boolean" } }, required: ["action"] } },
  { name: "sticker_search", description: "Search Vera's private sticker catalog by emotion, situation, category, or description. Read-only. Use only when a sticker would naturally add to a reply, never for every reply.", inputSchema: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 12 } }, required: ["query"] } },
  { name: "sticker_send", description: "Send exactly one sticker returned by sticker_search. Pass only its assetId. Vesper validates it and appends a structured sticker message; use sparingly.", inputSchema: { type: "object", additionalProperties: false, properties: { assetId: { type: "string" } }, required: ["assetId"] } },
  { name: "list_configured_mcp_tools", description: "List the user's enabled Vesper Settings MCP connections and their allowed tools before calling one. Credentials are never returned.", inputSchema: { type: "object", additionalProperties: false, properties: {} } },
  { name: "call_configured_mcp_tool", description: "Call exactly one tool returned by list_configured_mcp_tools. Vesper holds the connection credentials securely on the server.", inputSchema: { type: "object", additionalProperties: false, properties: { connectionId: { type: "string" }, toolName: { type: "string" }, arguments: { type: "object", additionalProperties: true } }, required: ["connectionId", "toolName"] } },
].map((definition) => ({ type: "function" as const, ...definition }));

// Vesper is a companion chat, not a report console. This always travels through
// the app-server's developer-instruction channel, never through a user turn.
// Putting it in `turn/start.input` made the app-server correctly persist it as
// a thread item, which in turn made it possible for private context to surface
// in Vesper's visible history.
const VESPER_CONVERSATIONAL_STYLE = [
  "You are Rowan in Vesper. Default to the cadence of a natural one-to-one chat.",
  "For an ordinary conversational message, reply with one short, complete sentence; at most two short sentences when needed.",
  "When you send two or three short chat sentences, put each sentence on its own line.",
  "Say one thing at a time. Do not volunteer a plan, recap, headings, bullets, or a long explanation unless the user explicitly asks for detail, analysis, writing, or a multi-step task.",
  "When a task needs time, give one brief human update rather than a long report. Keep warmth without filler.",
].join(" ");

const VESPER_INTERNAL_CONTEXT_PREFIXES = [
  "[vesper response preference — not user content:",
  "旧记忆背景（只作为长期背景",
];

function isVesperInternalContextText(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
  return VESPER_INTERNAL_CONTEXT_PREFIXES.some((prefix) => text.startsWith(prefix));
}

function vesperDeveloperInstructions(memoryBackground = "") {
  return [VESPER_CONVERSATIONAL_STYLE, memoryBackground.trim()].filter(Boolean).join("\n\n");
}

const CODEX_ASSISTANT_ITEM_TYPES = new Set(["agentMessage", "assistantMessage", "outputMessage"]);
const CODEX_ASSISTANT_CONTENT_TYPES = new Set(["text", "outputText"]);
const CODEX_TOOL_ITEM_TYPES = new Set(["toolCall", "functionCall", "mcpCall", "shellCall", "computerCall", "webSearchCall"]);
const CODEX_REASONING_ITEM_TYPES = new Set(["reasoning", "reasoningSummary"]);
const CODEX_DYNAMIC_TOOL_METHODS = new Set(["item/tool/call", "tool/call", "tools/call"]);

function cleanReasoningSummary(value: unknown) {
  if (typeof value !== "string") return [] as string[];
  return value
    .replace(/\*\*/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 2 && !/^\$?\s*\/bin\//.test(line));
}

function visibleAssistantText(item: CodexItem) {
  if (!CODEX_ASSISTANT_ITEM_TYPES.has(String(item.type || ""))) return "";
  if (item.role && item.role !== "assistant") return "";
  if (Array.isArray(item.content)) {
    const chunks = item.content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const content = part as { type?: unknown; text?: unknown };
      return CODEX_ASSISTANT_CONTENT_TYPES.has(String(content.type || "")) && typeof content.text === "string" ? [content.text] : [];
    });
    if (chunks.length) return chunks.join("");
  }
  return typeof item.text === "string" ? item.text : "";
}

function splitAssistantChatBubbles(content: string) {
  const value = content.trim();
  // Structured content must remain intact: splitting a code block, a Markdown
  // link, or a list makes it harder to read and breaks copy/paste semantics.
  if (!value || /```|`[^`]+`|https?:\/\/|\[[^\]]+\]\([^\n)]+\)|^\s*(?:[-*+] |\d+[.)] )/m.test(value)) return [value];
  const sentences = value.match(/[^。！？!?\n]+[。！？!?]+(?:[”’」』）】]*)|[^。！？!?\n]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [value];
  // A normal reply has one to three bubbles. Keep any unexpected long tail
  // together rather than turning a detailed answer into a wall of bubbles.
  return sentences.length > 3 ? [...sentences.slice(0, 2), sentences.slice(2).join(" ")] : sentences;
}

function visibleUserText(item: CodexItem) {
  if (typeof item.text === "string") return item.text;
  if (!Array.isArray(item.content)) return "";
  return item.content.flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    const value = part as { text?: unknown };
    return typeof value.text === "string" ? [value.text] : [];
  }).join("");
}

function codexTimestamp(value: unknown, fallback = "") {
  if (typeof value === "number" && Number.isFinite(value))
    return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return fallback;
}

function visibleMessageTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).getUTCFullYear() > 1971 ? timestamp : Number.NaN;
}

function normalizeCodexMessages(value: unknown, conversationId: string): BridgeChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as BridgeChatMessage;
    // These markers identify only Vesper's former internal presentation and
    // memory input. They are never user-authored messages and must not survive
    // a restore from local cache, the VPS history service, or a legacy import.
    if (isVesperInternalContextText(item.content)) return [];
    const isMusicCard = item.metadata?.blockType === "musicCard";
    // Older VPS history servers do not yet persist `message_type`, but they do
    // preserve metadata. Treat that durable metadata as authoritative so an
    // already-sent sticker never falls back to its compatibility text after a
    // refresh or a device switch.
    const isSticker = Boolean(item.metadata?.sticker?.assetId) && (item.type === "sticker" || !item.type);
    if (item.role === "agent" && item.metadata?.blockType && !isMusicCard && !isSticker && !CODEX_ASSISTANT_ITEM_TYPES.has(item.metadata.blockType)) return [];
    if (item.role === "agent" && item.metadata?.blockType && !isMusicCard && !isSticker && !item.content.trim()) return [];
    return [{ ...item, type: isSticker ? "sticker" : "text", conversationId: item.conversationId || conversationId }];
  });
}

function messageWasDeleted(item: BridgeChatMessage, tombstones: CodexMessageTombstone[]) {
  return tombstones.some((deleted) =>
    deleted.messageId === item.id || deleted.stableId === item.id ||
    Boolean(item.metadata?.itemId && (deleted.itemId === item.metadata.itemId || deleted.stableId === item.metadata.itemId)));
}

function codexSocketUrl() {
  const configured = readLocalValue<string>("vesper-codex-endpoint", "").trim();
  // The fixed personal deployment uses the authenticated VPS tunnel directly.
  // The token is appended as a query parameter and validated by the VPS proxy.
  const base = configured || "wss://codex.r-vera.com";
  const url = new URL(base || "http://localhost/api/codex");
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  const token = deviceToken();
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

const CODEX_HISTORY_ORIGIN = "https://codex.r-vera.com/history";

function codexHistoryUrl(path: string) {
  return `${CODEX_HISTORY_ORIGIN}${path}`;
}

function codexHistoryHeaders(json = false) {
  return {
    ...(json ? { "content-type": "application/json" } : {}),
    authorization: `Bearer ${deviceToken()}`,
  };
}

async function persistMemoryMessage(item: BridgeChatMessage) {
  if (item.role !== "user" && item.role !== "agent") return;
  const response = await fetch(apiUrl("/api/memory/messages"), {
    method: "POST",
    headers: appHeaders(true),
    cache: "no-store",
    body: JSON.stringify({
      conversationId: item.conversationId,
      messageId: item.id,
      role: item.role,
      content: item.content,
      createdAt: item.createdAt,
      turnId: item.metadata?.turnId,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("memory-message-sync-failed");
}

async function recallMemoryBackground(query: string) {
  try {
    const response = await fetch(apiUrl("/api/memory/context"), {
      method: "POST",
      headers: appHeaders(true),
      cache: "no-store",
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return "";
    const payload = await response.json() as { context?: string };
    return typeof payload.context === "string" ? payload.context : "";
  } catch {
    // Memory retrieval is intentionally degradable: it can never stop a chat turn.
    return "";
  }
}

function scheduleMemoryDistillation(conversationId: string) {
  return fetch(apiUrl("/api/memory/distill"), {
    method: "POST",
    headers: appHeaders(true),
    cache: "no-store",
    body: JSON.stringify({ conversationId }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

async function persistCodexConversation(conversationId: string, value: { title?: string; codexThreadId?: string | null; createdAt?: string; updatedAt?: string; source?: "legacy-vesper" | "codex" }) {
  const response = await fetch(codexHistoryUrl(`/conversations/${encodeURIComponent(conversationId)}`), {
    method: "POST",
    headers: codexHistoryHeaders(true),
    cache: "no-store",
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error("Conversation history could not be saved");
  return response.json() as Promise<{ conversation?: { codexThreadId?: string | null; title?: string } }>;
}

async function persistCodexMessage(item: BridgeChatMessage, title?: string) {
  // This is a hard guard in addition to the rendering filter. Context is never
  // a chat message and must not reach durable history through a delayed retry
  // or a legacy migration.
  if (isVesperInternalContextText(item.content)) return;
  const response = await fetch(codexHistoryUrl(`/conversations/${encodeURIComponent(item.conversationId)}/messages`), {
    method: "POST",
    headers: codexHistoryHeaders(true),
    cache: "no-store",
    body: JSON.stringify({ ...item, title, source: item.source || "codex", timeSource: item.timeSource || item.metadata?.timeSource || (item.createdAt ? "message" : "unknown") }),
  });
  if (!response.ok) throw new Error("Message history could not be saved");
}

async function removeLeakedInternalHistoryMessages(conversationId: string, messages: BridgeChatMessage[]) {
  const leaked = messages.filter((item) => isVesperInternalContextText(item.content));
  if (!leaked.length) return;
  await Promise.all(leaked.map(async (item) => {
    const response = await fetch(codexHistoryUrl(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(item.id)}`), {
      method: "DELETE",
      headers: codexHistoryHeaders(true),
      cache: "no-store",
      body: JSON.stringify({
        messageId: item.id,
        itemId: item.metadata?.itemId || null,
        threadId: item.metadata?.threadId || null,
      }),
    });
    if (!response.ok) throw new Error("无法清理内部上下文记录");
  }));
}

let legacyHistoryMigration: Promise<void> | null = null;

function migrateLegacyHistory() {
  if (legacyHistoryMigration) return legacyHistoryMigration;
  legacyHistoryMigration = (async () => {
    if (!deviceToken() || window.localStorage.getItem("vesper-history-migration-v1") === "complete") return;
    const summaries = readLocalValue<ConversationSummary[]>("vesper-local-conversation-index", []);
    const conversations = new Map<string, { id: string; title: string; createdAt: string; updatedAt: string; messages: BridgeChatMessage[] }>();
    const ensureConversation = (id: string, title = "未命名对话", updatedAt = "") => {
      const existing = conversations.get(id);
      if (existing) {
        if (title && existing.title === "未命名对话") existing.title = title;
        if (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt)) existing.updatedAt = updatedAt;
        return existing;
      }
      const value = { id, title: title || "未命名对话", createdAt: "", updatedAt, messages: [] as BridgeChatMessage[] };
      conversations.set(id, value);
      return value;
    };
    for (const summary of summaries) ensureConversation(summary.id, summary.title, summary.updatedAt);

    const listResponse = await fetch(apiUrl("/api/chat?list=1"), { headers: deviceHeaders(), cache: "no-store" });
    if (listResponse.ok) {
      const list = await listResponse.json() as { conversations?: ConversationSummary[] };
      for (const summary of list.conversations || []) {
        const detail = await fetch(apiUrl(`/api/chat?conversationId=${encodeURIComponent(summary.id)}`), { headers: deviceHeaders(), cache: "no-store" });
        if (!detail.ok) throw new Error(`旧 D1 会话 ${summary.id} 读取失败`);
        const payload = await detail.json() as { messages?: BridgeChatMessage[] };
        ensureConversation(summary.id, summary.title, summary.updatedAt).messages.push(...(payload.messages || []).map((message) => ({ ...message, source: "legacy-vesper" as const })));
      }
    } else if (listResponse.status !== 404) {
      throw new Error("旧 D1 历史读取失败");
    }

    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith("vesper-local-chat-") && !key.startsWith("vesper-codex-chat-")) continue;
      const summary = summaries.find((item) => key.endsWith(`-${item.id}`));
      const id = summary?.id || (key.startsWith("vesper-codex-chat-")
        ? key.slice("vesper-codex-chat-".length)
        : key.slice("vesper-local-chat-".length).replace(/^(api|mcp|cyberboss)-/, ""));
      if (!id) continue;
      const source = key.startsWith("vesper-codex-chat-") ? "codex" as const : "legacy-vesper" as const;
      const items = normalizeCodexMessages(readLocalValue<BridgeChatMessage[]>(key, []), id).map((message) => ({ ...message, source: message.source || source }));
      ensureConversation(id, summary?.title || items[0]?.content.slice(0, 42) || "未命名对话", summary?.updatedAt || "").messages.push(...items);
    }

    for (const entry of conversations.values()) {
      const unique = new Map<string, BridgeChatMessage>();
      entry.messages.forEach((message, index) => {
        const id = message.id || `legacy-${entry.id}-${index}`;
        const normalized = { ...message, id, conversationId: entry.id, source: message.source || "legacy-vesper" as const, timeSource: message.createdAt ? "message" as const : "unknown" as const };
        unique.set(id, unique.has(id) ? { ...unique.get(id)!, ...normalized } : normalized);
      });
      const messages = [...unique.values()];
      const dated = messages.map((item) => item.createdAt).filter((value) => Number.isFinite(Date.parse(value))).sort();
      entry.createdAt ||= dated[0] || entry.updatedAt || new Date().toISOString();
      entry.updatedAt ||= dated.at(-1) || entry.createdAt;
      const source = messages.some((message) => message.source === "codex") ? "codex" : "legacy-vesper";
      await persistCodexConversation(entry.id, { title: entry.title, createdAt: entry.createdAt, updatedAt: entry.updatedAt, source });
      for (const message of messages) await persistCodexMessage(message, entry.title);
    }
    window.localStorage.setItem("vesper-history-migration-v1", "complete");
  })().catch((reason) => {
    legacyHistoryMigration = null;
    throw reason;
  });
  return legacyHistoryMigration;
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function videoPoster(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Video preview failed"));
    });
    video.currentTime = Math.min(1, Number.isFinite(video.duration) ? video.duration / 2 : 1);
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
    canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function StickerImage({ sticker, className = "" }: { sticker: StickerMessageData; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`sticker-image-placeholder ${className}`} role="img" aria-label="表情包已不可用"><Icon name="sticker" /><span>表情包已不可用</span></div>;
  return <img className={`sticker-image ${className}`} src={sticker.url} alt={sticker.alt || "表情包"} loading="lazy" onError={() => setFailed(true)} />;
}

function StickerPickerSheet({ open, onClose, onSelect, onManage }: { open: boolean; onClose: () => void; onSelect: (sticker: StickerCatalogItem) => void; onManage: () => void }) {
  const [view, setView] = useState<"recent" | "favorites" | "all">("recent");
  const [query, setQuery] = useState("");
  const [stickers, setStickers] = useState<StickerCatalogItem[]>([]);
  const [categories, setCategories] = useState<StickerCategoryItem[]>([]);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    if (!open) return;
    try {
      setError("");
      const search = new URLSearchParams();
      if (view !== "all") search.set("view", view);
      if (query.trim()) search.set("q", query.trim());
      if (category) search.set("category", category);
      const response = await fetch(apiUrl(`/api/stickers?${search}`), { headers: appHeaders(), cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { stickers?: StickerCatalogItem[]; categories?: StickerCategoryItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "无法读取表情包");
      setStickers(payload.stickers || []); setCategories(payload.categories || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法读取表情包"); }
  };
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [open, view, category]);
  useEffect(() => { if (!open) return; const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer); }, [query]);
  if (!open) return null;
  return <div className="sticker-sheet-layer" role="presentation"><button className="sticker-sheet-scrim" aria-label="关闭表情包" onClick={onClose} /><section className="sticker-sheet" role="dialog" aria-modal="true" aria-label="表情包">
    <div className="sticker-sheet-handle" />
    <header><div><h2>表情包</h2><p>只发送给这段对话</p></div><button className="sticker-manage-trigger" onClick={onManage}>管理</button><button className="sticker-close" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></header>
    <div className="sticker-picker-controls"><label><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索表情或场景" /></label><div className="sticker-picker-tabs"><button className={view === "recent" ? "active" : ""} onClick={() => setView("recent")}>最近</button><button className={view === "favorites" ? "active" : ""} onClick={() => setView("favorites")}>收藏</button><button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>全部</button></div></div>
    {categories.length > 0 && <div className="sticker-category-strip"><button className={!category ? "active" : ""} onClick={() => setCategory("")}>全部</button>{categories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.name}</button>)}</div>}
    {error ? <p className="sticker-sheet-error">{error}</p> : stickers.length ? <div className="sticker-grid">{stickers.map((sticker) => <button key={sticker.assetId} className="sticker-grid-item" title={sticker.description || sticker.name || "表情包"} onClick={() => onSelect(sticker)}><StickerImage sticker={sticker} /><span>{sticker.description || sticker.category || "表情包"}</span></button>)}</div> : <div className="sticker-empty"><Icon name="sticker" /><p>这里还没有表情包。</p><button onClick={onManage}>去添加</button></div>}
  </section></div>;
}

function StickerManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stickers, setStickers] = useState<StickerCatalogItem[]>([]); const [categories, setCategories] = useState<StickerCategoryItem[]>([]);
  const [selected, setSelected] = useState<StickerCatalogItem | null>(null); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [categoryId, setCategoryId] = useState("");
  const [autoCollect, setAutoCollect] = useState(false); const [visionAvailable, setVisionAvailable] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const uploadRef = useRef<HTMLInputElement>(null);
  const load = async () => {
    if (!open) return;
    try { const [catalog, settings] = await Promise.all([fetch(apiUrl("/api/stickers?view=all"), { headers: appHeaders(), cache: "no-store" }), fetch(apiUrl("/api/stickers/settings"), { headers: appHeaders(), cache: "no-store" })]);
      const catalogData = await catalog.json() as { stickers?: StickerCatalogItem[]; categories?: StickerCategoryItem[]; error?: string }; const settingsData = await settings.json().catch(() => ({})) as { settings?: { enabled?: boolean; visionAvailable?: boolean } };
      if (!catalog.ok) throw new Error(catalogData.error || "无法读取表情包"); setStickers(catalogData.stickers || []); setCategories(catalogData.categories || []); setAutoCollect(Boolean(settingsData.settings?.enabled)); setVisionAvailable(Boolean(settingsData.settings?.visionAvailable));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法读取表情包"); }
  };
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [open]);
  const selectSticker = (sticker: StickerCatalogItem | null) => { setSelected(sticker); setName(sticker?.name || ""); setDescription(sticker?.description || ""); setCategoryId(sticker?.categoryId || ""); };
  const upload = async (files: FileList | File[]) => { const list = Array.from(files); if (!list.length) return; setBusy(true); setError(""); try { for (const file of list) { const form = new FormData(); form.append("file", file); if (categoryId) form.append("categoryId", categoryId); const response = await fetch(apiUrl("/api/stickers"), { method: "POST", headers: appHeaders(), body: form }); const payload = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) throw new Error(payload.error || `${file.name} 上传失败`); } await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "上传失败"); } finally { setBusy(false); } };
  const save = async () => { if (!selected) return; setBusy(true); try { const response = await fetch(apiUrl(`/api/stickers/${encodeURIComponent(selected.assetId)}`), { method: "PATCH", headers: appHeaders(true), body: JSON.stringify({ name, description, categoryId: categoryId || null }) }); const payload = await response.json().catch(() => ({})) as { sticker?: StickerCatalogItem; error?: string }; if (!response.ok) throw new Error(payload.error || "保存失败"); selectSticker(payload.sticker || null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } finally { setBusy(false); } };
  const remove = async () => { if (!selected || !window.confirm("删除这张表情包？聊天历史中的旧消息会显示为不可用占位。")) return; setBusy(true); try { const response = await fetch(apiUrl(`/api/stickers/${encodeURIComponent(selected.assetId)}`), { method: "DELETE", headers: appHeaders(true) }); const payload = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) throw new Error(payload.error || "删除失败"); selectSticker(null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); } finally { setBusy(false); } };
  const favorite = async () => { if (!selected) return; const response = await fetch(apiUrl(`/api/stickers/${encodeURIComponent(selected.assetId)}`), { method: "PATCH", headers: appHeaders(true), body: JSON.stringify({ favorite: !selected.favorite }) }); const payload = await response.json().catch(() => ({})) as { sticker?: StickerCatalogItem; error?: string }; if (!response.ok) return setError(payload.error || "收藏失败"); selectSticker(payload.sticker || null); await load(); };
  const createCategory = async () => { const name = window.prompt("新分类名称")?.trim(); if (!name) return; const response = await fetch(apiUrl("/api/stickers/categories"), { method: "POST", headers: appHeaders(true), body: JSON.stringify({ name }) }); const payload = await response.json().catch(() => ({})) as { category?: StickerCategoryItem; error?: string }; if (!response.ok) return setError(payload.error || "无法创建分类"); await load(); if (payload.category) setCategoryId(payload.category.id); };
  const editCategory = async () => { const current = categories.find((item) => item.id === categoryId); if (!current) return setError("先选择一个分类"); const nextName = window.prompt("分类名称", current.name)?.trim(); if (!nextName) return; const description = window.prompt("分类说明（可留空）", current.description); if (description === null) return; const response = await fetch(apiUrl(`/api/stickers/categories/${encodeURIComponent(current.id)}`), { method: "PATCH", headers: appHeaders(true), body: JSON.stringify({ name: nextName, description }) }); const payload = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) return setError(payload.error || "无法编辑分类"); await load(); };
  const setCollection = async (enabled: boolean) => { const response = await fetch(apiUrl("/api/stickers/settings"), { method: "PATCH", headers: appHeaders(true), body: JSON.stringify({ enabled }) }); const payload = await response.json().catch(() => ({})) as { settings?: { enabled?: boolean }; error?: string }; if (!response.ok) return setError(payload.error || "设置失败"); setAutoCollect(Boolean(payload.settings?.enabled)); };
  if (!open) return null;
  return <div className="sticker-manager-layer" role="presentation"><button className="sticker-sheet-scrim" aria-label="关闭表情包管理" onClick={onClose} /><section className="sticker-manager" role="dialog" aria-modal="true" aria-label="管理表情包" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
    <header><div><p>VERA&apos;S STICKERS</p><h2>管理表情包</h2></div><button className="sticker-close" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></header>
    <div className="sticker-manager-upload"><input ref={uploadRef} hidden type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { if (event.target.files) void upload(event.target.files); event.target.value = ""; }} /><button onClick={() => uploadRef.current?.click()} disabled={busy}><Icon name="upload" />{busy ? "正在保存…" : "添加图片"}</button><span>可拖进 PNG、JPG、GIF 或 WebP，单张不超过 12MB。</span></div>
    <div className="sticker-manager-category"><span>分类</span><div>{categories.map((item) => <button key={item.id} className={categoryId === item.id ? "active" : ""} onClick={() => setCategoryId(item.id)}>{item.name}</button>)}<button onClick={createCategory}>＋ 新建</button><button onClick={editCategory}>编辑当前</button></div></div>
    <label className="sticker-collect-toggle"><span><b>自动收集聊天图片</b><small>{visionAvailable ? "仅在识别为表情包后保存，可随时关闭。" : "需要在服务端配置视觉识别后才能开启；不会默认保存普通照片。"}</small></span><input type="checkbox" checked={autoCollect} disabled={!visionAvailable} onChange={(event) => void setCollection(event.target.checked)} /></label>
    {error && <p className="sticker-sheet-error">{error}</p>}
    <div className="sticker-manager-content"><div className="sticker-manager-grid">{stickers.map((sticker) => <button key={sticker.assetId} className={selected?.assetId === sticker.assetId ? "selected" : ""} onClick={() => selectSticker(sticker)}><StickerImage sticker={sticker} /><i>{sticker.favorite ? "★" : ""}</i></button>)}</div>{selected && <aside className="sticker-detail"><StickerImage sticker={selected} /><label>名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><label>使用场景<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} placeholder="例如：害羞地答应、晚安、撒娇" /></label><label>分类<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">未分类</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div><button onClick={() => void favorite()}>{selected.favorite ? "取消收藏" : "收藏"}</button><button onClick={() => void save()} disabled={busy}>保存</button><button className="danger" onClick={() => void remove()} disabled={busy}>删除</button></div></aside>}</div>
  </section></div>;
}

function CodexChatMessage({
  item,
  agentName,
  userName,
  onEdit,
  onThought,
  onCopy,
  favorite,
  onFavorite,
  onDelete,
  onPlayMusic,
  onQueueMusic,
  onOpenMusic,
  onAddMusicToPlaylist,
  onSaveAttachmentAsSticker,
}: {
  item: BridgeChatMessage;
  agentName: string;
  userName: string;
  onEdit: (item: BridgeChatMessage) => void;
  onThought: (item: BridgeChatMessage) => void;
  onCopy: (item: BridgeChatMessage) => void;
  favorite: boolean;
  onFavorite: (item: BridgeChatMessage) => void;
  onDelete: (item: BridgeChatMessage) => Promise<void>;
  onPlayMusic: (trackId: string) => void;
  onQueueMusic: (trackId: string) => void;
  onOpenMusic: () => void;
  onAddMusicToPlaylist: (card: MusicPlaylistIntent) => void;
  onSaveAttachmentAsSticker?: (attachment: ChatAttachment, item: BridgeChatMessage) => void;
}) {
  const assistant = item.role === "agent";
  const timestamp = visibleMessageTimestamp(item.createdAt);
  const stamp = Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp))
    : "时间未知";
  const status = item.metadata?.turnStatus;
  const statusText = status === "thinking" ? "Thinking…" : status === "tool" ? "Using a tool…" : status === "error" ? "Failed" : "Done";
  const statusLabel = `${stamp}  ${statusText}`;
  const sticker = item.type === "sticker" ? item.metadata?.sticker : undefined;
  return (
    <div data-message-id={item.id} className={`${assistant ? "agent-turn" : "sent-turn"}${favorite ? " is-favorite" : ""}`}>
      {assistant && item.metadata?.showTurnStatus !== false && (
        item.metadata?.thoughtSummary ? (
          <button className="turn-status" onClick={() => onThought(item)} aria-label="View thought process">
            <i /> <span>{statusLabel}</span>
          </button>
        ) : (
          <div className="turn-status" aria-live="polite"><i /> <span>{statusLabel}</span></div>
        )
      )}
      <div className={assistant ? "message assistant" : "message mine sent-message"}>
        {sticker ? <div className="sticker-bubble"><StickerImage sticker={sticker} /></div> : <div>
          {item.content && <p>{item.content}</p>}
          {item.metadata?.musicCard && <MusicMessageCard card={item.metadata.musicCard} onPlay={onPlayMusic} onQueue={onQueueMusic} onOpen={onOpenMusic} onAddToPlaylist={onAddMusicToPlaylist} />}
        </div>}
      </div>
      <div className="message-actions">
        {!assistant && <time dateTime={Number.isFinite(timestamp) ? item.createdAt : undefined}>{stamp}</time>}
        <button className="message-action" aria-label="复制" title="复制" onClick={() => onCopy(item)}><Icon name="copy" /></button>
        <button className={`message-action${favorite ? " active" : ""}`} aria-label={favorite ? "取消收藏" : "收藏"} title={favorite ? "取消收藏" : "收藏"} onClick={() => onFavorite(item)}><Icon name="bookmark" /></button>
        {!assistant && <button className="message-action" aria-label="编辑" title="编辑" onClick={() => onEdit(item)}><Icon name="edit" /></button>}
        <button className="message-action danger" aria-label="删除" title="删除" onClick={() => void onDelete(item).catch(() => {})}><Icon name="trash" /></button>
      </div>
      <MessageAttachments items={item.metadata?.attachments || []} onSaveAsSticker={onSaveAttachmentAsSticker ? (attachment) => onSaveAttachmentAsSticker(attachment, item) : undefined} />
    </div>
  );
}

function CodexApprovalDialog({
  approval,
  queuedCount,
  onDecision,
}: {
  approval: PendingCodexApproval;
  queuedCount: number;
  onDecision: (action: "allow" | "deny") => void;
}) {
  const type = approval.kind === "command" ? "命令" : approval.kind === "file" ? "文件变更" : "额外权限";
  return (
    <div className="codex-approval-layer" role="presentation">
      <section className="codex-approval-dialog" role="alertdialog" aria-modal="true" aria-labelledby="codex-approval-title" aria-describedby="codex-approval-description">
        <p className="codex-approval-kicker">CODEX 审批 · {type}</p>
        <h2 id="codex-approval-title">{approval.title}</h2>
        <p id="codex-approval-description" className="codex-approval-summary">{approval.summary}</p>
        <dl className="codex-approval-details">
          <div><dt>{approval.targetLabel}</dt><dd>{approval.target}</dd></div>
          <div><dt>{approval.detailLabel}</dt><dd><pre>{approval.detail}</pre></dd></div>
        </dl>
        {queuedCount > 1 && <p className="codex-approval-queue">还有 {queuedCount - 1} 个请求等待你的决定。</p>}
        <p className="codex-approval-note">允许只适用于这一次，不会保存为自动批准。</p>
        <div className="codex-approval-actions">
          <button className="codex-approval-deny" onClick={() => onDecision("deny")}>拒绝</button>
          <button className="codex-approval-allow" autoFocus onClick={() => onDecision("allow")}>仅本次允许</button>
        </div>
      </section>
    </div>
  );
}

function MusicMessageCard({
  card,
  onPlay,
  onQueue,
  onOpen,
  onAddToPlaylist,
}: {
  card: MusicCardData;
  onPlay: (trackId: string) => void;
  onQueue: (trackId: string) => void;
  onOpen: () => void;
  onAddToPlaylist: (card: MusicPlaylistIntent) => void;
}) {
  return (
    <article className="music-message-card">
      {card.cover ? <img src={card.cover} alt="" /> : <div className="music-card-placeholder">V</div>}
      <div className="music-card-copy">
        <b>{card.title}</b>
        <span>{card.artist || "未知歌手"}{card.album ? ` · ${card.album}` : ""}</span>
        {card.message && <p>{card.message}</p>}
        <div className="music-card-actions">
          <button disabled={!card.playable} onClick={() => onPlay(card.trackId)}><Icon name="play" /> 播放</button>
          <button onClick={() => onQueue(card.trackId)}><Icon name="plus" /> 队列</button>
          {card.source === "netease" && <button onClick={() => onAddToPlaylist(card)}><Icon name="library" /> 歌单</button>}
          <button onClick={onOpen}><Icon name="music" /> 播放器</button>
        </div>
      </div>
    </article>
  );
}

function ConnectedChat({
  conversationId,
  onSelectConversation,
  agentName,
  userName,
  favorites,
  setFavorites,
  focusMessageId,
  currentTrack,
  playing,
  onToggleMusic,
  onNextMusic,
  onOpenMusic,
  onAddMusicToPlaylist,
}: {
  conversationId: string;
  onSelectConversation: (id: string) => void;
  agentName: string;
  userName: string;
  favorites: FavoriteItem[];
  setFavorites: Dispatch<SetStateAction<FavoriteItem[]>>;
  focusMessageId?: string;
  currentTrack?: Track;
  playing: boolean;
  onToggleMusic: () => void;
  onNextMusic: () => void;
  onOpenMusic: () => void;
  onAddMusicToPlaylist: (card: MusicPlaylistIntent) => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<BridgeChatMessage[]>(() => normalizeCodexMessages(readLocalValue(`vesper-codex-chat-${conversationId}`, []), conversationId));
  const [pending, setPending] = useState<CodexPendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [historyWarning, setHistoryWarning] = useState("");
  const [resumeError, setResumeError] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [streamingItems, setStreamingItems] = useState<Record<string, string>>({});
  const [thought, setThought] = useState<BridgeChatMessage | null>(null);
  const [listening, setListening] = useState(false);
  const [approvalQueue, setApprovalQueue] = useState<PendingCodexApproval[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [models, setModels] = useState<CodexModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState("");
  const [currentModel, setCurrentModel] = useState<CodexModelSelection | null>(null);
  const [nextModel, setNextModel] = useState<CodexModelSelection | null>(null);
  const modelCatalog = useRef<CodexModel[]>([]);
  const nextModelRef = useRef<CodexModelSelection | null>(null);
  const modelLoadId = useRef(0);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerManagerOpen, setStickerManagerOpen] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const messagesRef = useRef(messages);
  const rpcId = useRef(1);
  const rpc = useRef(new Map<number, { resolve: (value: CodexSocketMessage) => void; reject: (reason: Error) => void }>());
  const threadId = useRef("");
  const streamBuffers = useRef(new Map<string, string>());
  const reasoningBuffers = useRef(new Map<string, string>());
  const reasoningSummaries = useRef<string[]>([]);
  const appliedDeveloperInstructions = useRef("");
  const turnDone = useRef<((value?: unknown) => void) | null>(null);
  const activeTurnId = useRef("");
  const activeTurnUserId = useRef("");
  const streamEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const tombstonesRef = useRef<CodexMessageTombstone[]>(readLocalValue(`vesper-codex-tombstones-${conversationId}`, []));
  const approvalQueueRef = useRef<PendingCodexApproval[]>([]);
  const approvalResponses = useRef(new Map<string, { result: Record<string, unknown>; expiresAt: number }>());
  const pendingAgentStickers = useRef<StickerMessageData[]>([]);

  const updateApprovalQueue = (update: (current: PendingCodexApproval[]) => PendingCodexApproval[]) => {
    setApprovalQueue((current) => {
      const next = update(current);
      approvalQueueRef.current = next;
      return next;
    });
  };
  const clearApprovalQueue = (filter?: { threadId?: string; turnId?: string; itemId?: string }) => {
    updateApprovalQueue((current) => clearCodexApprovals(current, filter));
  };

  const save = (next: BridgeChatMessage[]) => {
    const sanitized = normalizeCodexMessages(next, conversationId).filter((item) => !messageWasDeleted(item, tombstonesRef.current));
    // A thread snapshot is only one source of a Vesper conversation.  Keep a
    // separate, union-only local recovery copy so a short/empty snapshot (or a
    // temporarily incomplete history response) can never replace old messages.
    // Tombstones still win, so an intentionally deleted message is not revived.
    const backupKey = `vesper-codex-chat-backup-${conversationId}`;
    const previousBackup = normalizeCodexMessages(readLocalValue<BridgeChatMessage[]>(backupKey, []), conversationId);
    const recoveryCopy = mergeCodexMessages(previousBackup, sanitized)
      .filter((item) => !messageWasDeleted(item, tombstonesRef.current));
    messagesRef.current = sanitized;
    setMessages(sanitized);
    window.localStorage.setItem(`vesper-codex-chat-${conversationId}`, JSON.stringify(sanitized));
    window.localStorage.setItem(backupKey, JSON.stringify(recoveryCopy));
  };
  const updateMessage = (id: string, update: (item: BridgeChatMessage) => BridgeChatMessage) => {
    const updated = messagesRef.current.map((item) => item.id === id ? update(item) : item);
    save(updated);
    const item = updated.find((candidate) => candidate.id === id);
    if (item) void persistCodexMessage(item).catch(() => setHistoryWarning("历史暂未同步"));
  };
  const logCodexDiagnostic = (message: CodexSocketMessage) => {
    const method = typeof message.method === "string" ? message.method : "rpc-response";
    const itemType = message.params && typeof message.params.item === "object" && message.params.item !== null
      ? String((message.params.item as { type?: unknown }).type || "")
      : "";
    const entry = { method, itemType, at: new Date().toISOString() };
    const current = readLocalValue<typeof entry[]>("vesper-codex-diagnostics", []);
    window.localStorage.setItem("vesper-codex-diagnostics", JSON.stringify([...current.slice(-49), entry]));
    console.debug("[Vesper Codex diagnostic]", entry);
  };

  const setTurnStatus = (status: "thinking" | "tool" | "completed" | "error") => {
    if (!activeTurnUserId.current) return;
    updateMessage(activeTurnUserId.current, (item) => ({ ...item, metadata: { ...item.metadata, turnStatus: status } }));
  };

  const callServerTool = async (name: string, args: Record<string, unknown>, itemId: string) => {
    const response = await fetch(apiUrl("/api/codex/tools"), {
      method: "POST",
      headers: appHeaders(true),
      cache: "no-store",
      body: JSON.stringify({ name, arguments: args, threadId: threadId.current, itemId, conversationId, turnId: activeTurnId.current }),
    });
    const payload = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
    if (!response.ok) throw new Error(payload.error || `Tool ${name} failed`);
    return payload.result;
  };

  const dynamicToolCall = (params: Record<string, unknown>) => {
    const nested = params.toolCall && typeof params.toolCall === "object" ? params.toolCall as Record<string, unknown> : {};
    const rawArguments = params.arguments ?? params.input ?? nested.arguments ?? nested.input ?? {};
    let argumentsValue: Record<string, unknown> = {};
    if (rawArguments && typeof rawArguments === "object" && !Array.isArray(rawArguments)) argumentsValue = rawArguments as Record<string, unknown>;
    if (typeof rawArguments === "string") {
      try {
        const parsed = JSON.parse(rawArguments) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) argumentsValue = parsed as Record<string, unknown>;
      } catch {}
    }
    return {
      name: String(params.tool ?? params.name ?? nested.tool ?? nested.name ?? ""),
      itemId: String(params.itemId ?? params.callId ?? nested.itemId ?? nested.callId ?? nested.id ?? ""),
      argumentsValue,
    };
  };

  const sendToolResult = async (message: CodexSocketMessage) => {
    if (typeof message.id !== "number" && typeof message.id !== "string") return;
    const { name, itemId, argumentsValue } = dynamicToolCall(message.params || {});
    if (!name) {
      socket.current?.send(JSON.stringify({ id: message.id, result: { success: false, error: "Dynamic tool name is missing" } }));
      return;
    }
    setTurnStatus("tool");
    try {
      const result = await callServerTool(name, argumentsValue, itemId);
      if (result && typeof result === "object" && "musicCard" in result) {
        window.dispatchEvent(new CustomEvent("vesper-music-card", { detail: { conversationId, card: (result as { musicCard: MusicCardData }).musicCard } }));
      }
      if (result && typeof result === "object" && (result as { musicLibraryRefresh?: unknown }).musicLibraryRefresh === true) {
        window.dispatchEvent(new CustomEvent("vesper-music-library-refresh"));
      }
      if (result && typeof result === "object" && "stickerMessage" in result) {
        const sticker = (result as { stickerMessage?: unknown }).stickerMessage;
        if (sticker && typeof sticker === "object" && typeof (sticker as StickerMessageData).assetId === "string") pendingAgentStickers.current.push(sticker as StickerMessageData);
      }
      socket.current?.send(JSON.stringify({ id: message.id, result: { contentItems: [{ type: "inputText", text: JSON.stringify(result) }], success: true } }));
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Tool failed";
      socket.current?.send(JSON.stringify({ id: message.id, result: { contentItems: [{ type: "inputText", text }], success: false, error: text } }));
      setError(text);
    }
  };
  const sendRpc = (method: string, params: Record<string, unknown>, timeoutMs = 0) => new Promise<CodexSocketMessage>((resolve, reject) => {
    const current = socket.current;
    if (!current || current.readyState !== WebSocket.OPEN) return reject(new Error("Codex socket is not open"));
    const id = rpcId.current++;
    const timer = timeoutMs ? window.setTimeout(() => {
      rpc.current.delete(id);
      reject(new Error("Codex 请求超时，请重试"));
    }, timeoutMs) : undefined;
    rpc.current.set(id, {
      resolve: (value) => { window.clearTimeout(timer); resolve(value); },
      reject: (reason) => { window.clearTimeout(timer); reject(reason); },
    });
    current.send(JSON.stringify({ id, method, params }));
  });
  const refreshModels = async () => {
    const loadId = ++modelLoadId.current;
    setModelsLoading(true);
    setModelError("");
    try {
      const catalog = await listCodexModels((method, params) => sendRpc(method, params, 15000));
      if (loadId !== modelLoadId.current) return;
      modelCatalog.current = catalog;
      setModels(catalog);
    } catch {
      if (loadId === modelLoadId.current) setModelError("暂时无法同步模型，请重试。");
    } finally {
      if (loadId === modelLoadId.current) setModelsLoading(false);
    }
  };
  const syncThreadModel = (message: CodexSocketMessage) => {
    setCurrentModel(selectionFromThread(message.result));
  };
  const answerApproval = (approval: PendingCodexApproval, action: "allow" | "deny") => {
    const current = socket.current;
    if (!current || current.readyState !== WebSocket.OPEN) {
      clearApprovalQueue();
      setError("Codex 连接已断开，未发送审批决定。请重连后重试操作。");
      return;
    }
    // Guard against a double tap while React is scheduling the dialog removal.
    if (approvalResponses.current.has(approval.requestKey)) return;
    const result = approvalResultFor(approval, action);
    const expiresAt = Date.now() + 30_000;
    approvalResponses.current.set(approval.requestKey, { result, expiresAt });
    for (const id of approval.rpcIds) current.send(JSON.stringify({ id, result }));
    window.setTimeout(() => {
      const saved = approvalResponses.current.get(approval.requestKey);
      if (saved && saved.expiresAt <= Date.now()) approvalResponses.current.delete(approval.requestKey);
    }, 30_100);
    updateApprovalQueue((queue) => removeCodexApproval(queue, approval.requestKey));
  };
  const handleSocketMessage = (message: CodexSocketMessage) => {
    if (typeof message.id === "number" && rpc.current.has(message.id) && !message.method) {
      const pendingRpc = rpc.current.get(message.id)!;
      rpc.current.delete(message.id);
      if (message.error) pendingRpc.reject(new Error(message.error.message || "Codex request failed"));
      else pendingRpc.resolve(message);
      return;
    }
    // App-server versions have used each of these request names for dynamic tools.
    if (message.method && CODEX_DYNAMIC_TOOL_METHODS.has(message.method)) {
      void sendToolResult(message);
      return;
    }
    if (message.method === "currentTime/read" && typeof message.id === "number") {
      socket.current?.send(JSON.stringify({ id: message.id, result: { currentTimeAt: Math.floor(Date.now() / 1000) } }));
      return;
    }
    const params = message.params || {};
    if (message.method === "serverRequest/resolved") {
      updateApprovalQueue((queue) => queue.filter((approval) => !approvalWasResolved(approval, params)));
      for (const [key, response] of approvalResponses.current) {
        if (response.expiresAt <= Date.now()) approvalResponses.current.delete(key);
      }
      return;
    }
    const approval = createCodexApprovalRequest(message);
    if (approval) {
      const cachedResponse = approvalResponses.current.get(approval.requestKey);
      if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
        socket.current?.send(JSON.stringify({ id: message.id, result: cachedResponse.result }));
      } else {
        if (cachedResponse) approvalResponses.current.delete(approval.requestKey);
        updateApprovalQueue((queue) => queueCodexApproval(queue, approval));
      }
      return;
    }
    if (message.method?.endsWith("/requestApproval")) {
      // This is intentionally not a decision: the client only supports the
      // explicit command, file-change, and permissions request schemas above.
      // Returning a JSON-RPC error keeps an unknown server request from leaving
      // an uncloseable modal behind without guessing an approval payload.
      logCodexDiagnostic(message);
      setError("收到当前版本无法安全展示的 Codex 审批请求；未替你作出允许或拒绝决定。");
      if (typeof message.id === "number" || typeof message.id === "string") {
        socket.current?.send(JSON.stringify({ id: message.id, error: { code: -32601, message: "Unsupported approval request type" } }));
      }
      return;
    }
    if (message.method === "item/agentMessage/delta") {
      const id = String(params.itemId || "agent");
      const next = `${streamBuffers.current.get(id) || ""}${String(params.delta || "")}`;
      streamBuffers.current.set(id, next);
      setStreamingItems((current) => ({ ...current, [id]: next }));
    }
    if (message.method === "item/reasoning/summaryTextDelta") {
      const id = String(params.itemId || "reasoning");
      reasoningBuffers.current.set(id, `${reasoningBuffers.current.get(id) || ""}${String(params.delta || "")}`);
    }
    if (message.method === "item/completed") {
      const item = (params.item || {}) as CodexItem;
      const itemId = String(item.id || params.itemId || "");
      const itemType = String(item.type || "");
      if (itemId) clearApprovalQueue({ threadId: String(params.threadId || threadId.current || ""), itemId });
      if (CODEX_REASONING_ITEM_TYPES.has(itemType)) {
        const summaries = cleanReasoningSummary(item.summary ?? item.text ?? reasoningBuffers.current.get(itemId) ?? "");
        reasoningSummaries.current.push(...summaries.filter((line) => !reasoningSummaries.current.includes(line)));
      }
      if (CODEX_TOOL_ITEM_TYPES.has(itemType)) {
        setTurnStatus("tool");
      }
      const content = (streamBuffers.current.get(itemId) || visibleAssistantText(item)).trim();
      if (content && activeTurnId.current && CODEX_ASSISTANT_ITEM_TYPES.has(itemType) && (!item.role || item.role === "assistant")) {
        const current = messagesRef.current;
        const bubbles = splitAssistantChatBubbles(content);
        const agentMessages = bubbles.map((bubble, index) => {
          const bubbleItemId = index === 0 ? itemId : `${itemId}:bubble:${index}`;
          const existing = current.find((candidate) => candidate.metadata?.itemId === bubbleItemId);
          return {
            id: existing?.id || (itemId ? `${itemId}:bubble:${index}` : crypto.randomUUID()),
            conversationId,
            role: "agent" as const,
            content: bubble,
            status: "delivered",
            metadata: {
              ...existing?.metadata,
              turnId: activeTurnId.current,
              threadId: threadId.current,
              itemId: bubbleItemId,
              blockType: itemType,
              turnStatus: index === 0 ? "completed" as const : undefined,
              showTurnStatus: index === 0,
            },
            createdAt: existing?.createdAt || new Date().toISOString(),
          } satisfies BridgeChatMessage;
        });
        save(mergeCodexMessages(current, agentMessages));
        void Promise.all(agentMessages.map((agentMessage) => persistCodexMessage(agentMessage)))
          .catch(() => setHistoryWarning("历史暂未同步"));
        agentMessages.forEach((agentMessage) => void persistMemoryMessage(agentMessage).catch(() => {}));
      }
      if (CODEX_ASSISTANT_ITEM_TYPES.has(itemType)) {
        setStreamingItems((current) => {
          const next = { ...current };
          delete next[itemId];
          return next;
        });
        streamBuffers.current.delete(itemId);
      }
    }
    if (message.method === "turn/completed") {
      const completedTurn = params.turn && typeof params.turn === "object" ? params.turn as { id?: unknown } : {};
      const completedTurnId = String(completedTurn.id || activeTurnId.current || "");
      if (completedTurnId) clearApprovalQueue({ threadId: threadId.current, turnId: completedTurnId });
      setBusy(false);
      if (activeTurnUserId.current) {
        updateMessage(activeTurnUserId.current, (item) => ({
          ...item,
          status: "completed",
          metadata: {
            ...item.metadata,
            turnId: activeTurnId.current || item.metadata?.turnId,
            turnStatus: "completed",
            thoughtSummary: reasoningSummaries.current.length ? reasoningSummaries.current.join("\n") : undefined,
          },
        }));
      }
      const stickers = pendingAgentStickers.current.splice(0, pendingAgentStickers.current.length);
      if (stickers.length) {
        const stickerMessages = stickers.map((sticker, index) => ({
          id: `${completedTurnId || crypto.randomUUID()}:sticker:${index}`,
          conversationId,
          role: "agent" as const,
          type: "sticker" as const,
          // The deployed VPS history service previously required non-empty
          // content. The renderer ignores this compatibility value whenever a
          // structured sticker is present.
          content: "[Sticker]",
          status: "delivered",
          metadata: { sticker, turnId: completedTurnId, threadId: threadId.current, itemId: `${completedTurnId}:sticker:${index}`, blockType: "sticker", showTurnStatus: false },
          createdAt: new Date().toISOString(),
        } satisfies BridgeChatMessage));
        save(mergeCodexMessages(messagesRef.current, stickerMessages));
        void Promise.all(stickerMessages.map((item) => persistCodexMessage(item))).catch(() => setHistoryWarning("历史暂未同步"));
      }
      setStreamingItems({});
      streamBuffers.current.clear();
      reasoningBuffers.current.clear();
      reasoningSummaries.current = [];
      turnDone.current?.(params.turn);
      turnDone.current = null;
      activeTurnId.current = "";
      activeTurnUserId.current = "";
      void scheduleMemoryDistillation(conversationId);
    }
    if (message.method === "turn/started" || message.method === "turn/inProgress") setTurnStatus("thinking");
    const knownMethods = new Set(["item/agentMessage/delta", "item/reasoning/summaryTextDelta", "item/completed", "turn/completed", "turn/started", "turn/inProgress", "item/started", "currentTime/read", "serverRequest/resolved", ...CODEX_DYNAMIC_TOOL_METHODS]);
    if (message.method && !knownMethods.has(message.method)) {
      logCodexDiagnostic(message);
      if (typeof message.id === "number" || typeof message.id === "string") socket.current?.send(JSON.stringify({ id: message.id, error: { code: -32601, message: "Unsupported app-server request" } }));
    }
  };
  const hydrateThreadSnapshot = (response: CodexSocketMessage) => {
    const root = response.result || {};
    const thread = (root.thread || root) as { createdAt?: unknown; turns?: unknown[]; items?: unknown[]; messages?: unknown[] };
    const turns = Array.isArray(thread.turns) ? thread.turns : [];
    const rawItems = [
      ...(Array.isArray(thread.items) ? thread.items.map((item) => ({ item, turnId: "", createdAt: thread.createdAt })) : []),
      ...(Array.isArray(thread.messages) ? thread.messages.map((item) => ({ item, turnId: "", createdAt: thread.createdAt })) : []),
      ...turns.flatMap((turn) => {
        if (!turn || typeof turn !== "object") return [];
        const value = turn as { id?: string; startedAt?: unknown; items?: unknown[] };
        return Array.isArray(value.items) ? value.items.map((item) => ({ item, turnId: value.id || "", createdAt: value.startedAt })) : [];
      }),
    ];
    const restored = rawItems.flatMap((entry) => {
      if (!entry.item || typeof entry.item !== "object") return [];
      const item = entry.item as CodexItem & { createdAt?: unknown; startedAt?: unknown };
      const type = String(item.type || "");
      const role = item.role === "user" || type === "userMessage" || type === "userInput" ? "user" : "agent";
      const content = role === "agent" ? visibleAssistantText(item) : visibleUserText(item);
      if (!content.trim()) return [];
      if (isVesperInternalContextText(content)) return [];
      if (role === "agent" && (!CODEX_ASSISTANT_ITEM_TYPES.has(type) || (item.role && item.role !== "assistant"))) return [];
      // A completed app-server item remains one item in its own snapshot, but
      // Vesper may have saved it as two or three chat bubbles. The persisted
      // bubbles are authoritative here; do not merge the original full text
      // back into their first bubble on a later resume.
      if (role === "agent" && item.id && messagesRef.current.some((candidate) =>
        candidate.metadata?.itemId?.startsWith(`${item.id}:bubble:`))) return [];
      const existing = messagesRef.current.find((candidate) =>
        (item.id && candidate.metadata?.itemId === item.id) ||
        (entry.turnId && candidate.metadata?.turnId === entry.turnId && candidate.role === role && candidate.content === content.trim()));
      const messageTime = codexTimestamp(item.createdAt ?? item.startedAt);
      const turnTime = codexTimestamp(entry.createdAt);
      const threadTime = codexTimestamp(thread.createdAt);
      const createdAt = existing?.createdAt || messageTime || turnTime || threadTime;
      const timeSource = existing?.timeSource || existing?.metadata?.timeSource || (messageTime ? "message" : turnTime ? "turn" : threadTime ? "thread" : "unknown");
      return [{ id: existing?.id || String(item.id || crypto.randomUUID()), conversationId, role: role as "user" | "agent", content: content.trim(), status: "delivered", metadata: { ...existing?.metadata, itemId: item.id, turnId: entry.turnId || existing?.metadata?.turnId, blockType: type, threadId: threadId.current, timeSource }, createdAt, source: "codex", timeSource } satisfies BridgeChatMessage];
    });
    if (restored.length) save(mergeCodexMessages(messagesRef.current, restored.filter((item) => !messageWasDeleted(item, tombstonesRef.current))));
  };
  const loadDynamicTools = async () => {
    let dynamicTools = CODEX_DYNAMIC_TOOLS;
    try {
      const catalog = await fetch(apiUrl("/api/codex/tools"), { headers: appHeaders(), cache: "no-store" });
      if (catalog.ok) {
        const payload = await catalog.json() as { tools?: typeof CODEX_DYNAMIC_TOOLS };
        if (Array.isArray(payload.tools) && payload.tools.length) {
          // Older Vesper builds omitted the required app-server discriminator.
          // Normalize the API catalogue as well as the local fallback so the
          // browser always sends protocol-valid dynamic function definitions.
          dynamicTools = payload.tools.map((tool) => ({ ...tool, type: "function" as const }));
        }
      }
    } catch {
      // The fallback keeps the app-server handshake useful while the bridge is offline.
    }
    return dynamicTools;
  };
  const startThreadWithTools = async (dynamicTools: typeof CODEX_DYNAMIC_TOOLS, developerInstructions: string) => {
    const result = await sendRpc("thread/start", {
      dynamicTools,
      approvalPolicy: "on-request",
      summary: "concise",
      developerInstructions,
    });
    const thread = (result.result?.thread || {}) as { id?: string };
    if (!thread.id) throw new Error("Codex did not return a thread id");
    threadId.current = thread.id;
    syncThreadModel(result);
    appliedDeveloperInstructions.current = developerInstructions;
    void persistCodexConversation(conversationId, { codexThreadId: thread.id })
      .catch(() => setHistoryWarning("历史暂未同步"));
    return thread.id;
  };
  const resumeThread = async (developerInstructions: string) => {
    try {
      const resumed = await sendRpc("thread/resume", { threadId: threadId.current, developerInstructions });
      syncThreadModel(resumed);
      hydrateThreadSnapshot(resumed);
      appliedDeveloperInstructions.current = developerInstructions;
      setResumeError("");
    } catch (reason) {
      // A dated app-server can reject the newer `developerInstructions` field.
      // Continue the conversation without recalled context rather than making
      // chat availability depend on that optional enhancement.
      if (developerInstructions) {
        try {
          const resumed = await sendRpc("thread/resume", { threadId: threadId.current });
          syncThreadModel(resumed);
          hydrateThreadSnapshot(resumed);
          appliedDeveloperInstructions.current = "";
          setResumeError("");
          logCodexDiagnostic({ method: "thread/resume/developer-instructions-unsupported", params: {} });
          return;
        } catch {
          // Keep the original resume failure below for the user-facing path.
        }
      }
      logCodexDiagnostic({ method: "thread/resume/failed", params: { kind: reason instanceof Error ? reason.name : "unknown" } });
      setResumeError("这段旧对话无法连接原 Codex 会话，但已保存的聊天记录仍可查看。");
      throw new Error("原会话暂时无法继续，可新建替代会话。 ");
    }
  };
  const connect = async (memoryBackground = "") => {
    const developerInstructions = vesperDeveloperInstructions(memoryBackground);
    if (socket.current?.readyState === WebSocket.OPEN) {
      // `thread/resume` is the protocol-supported way to update developer
      // instructions for an existing thread. This keeps recalled memory out of
      // the durable user-item timeline.
      if (threadId.current && appliedDeveloperInstructions.current !== developerInstructions) {
        await resumeThread(developerInstructions);
      }
      return;
    }
    const ws = new WebSocket(codexSocketUrl());
    socket.current = ws;
    ws.onmessage = (event) => {
      try { handleSocketMessage(JSON.parse(String(event.data)) as CodexSocketMessage); } catch { setError("Invalid message from Codex app-server"); }
    };
    ws.onclose = () => {
      if (socket.current !== ws) return;
      const hadPendingApproval = approvalQueueRef.current.length > 0;
      setOnline(false);
      socket.current = null;
      for (const request of rpc.current.values()) request.reject(new Error("Codex 连接已断开"));
      rpc.current.clear();
      clearApprovalQueue();
      approvalResponses.current.clear();
      if (hadPendingApproval) setError("Codex 连接已断开，待处理的审批没有被发送。");
    };
    ws.onerror = () => setError("Codex app-server is offline");
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Codex app-server is offline"));
    });
    setOnline(true);
    await sendRpc("initialize", { clientInfo: { name: "vesper_web", title: "Vesper", version: "0.6.0" }, capabilities: { experimentalApi: true, requestAttestation: false } });
    ws.send(JSON.stringify({ method: "initialized" }));
    void refreshModels();
    const dynamicTools = await loadDynamicTools();
    if (threadId.current) {
      await resumeThread(developerInstructions);
      // The app-server does not accept a dynamic-tool update on thread/resume.
      // Never auto-replace a persisted Codex thread here: a continuation thread
      // has a shorter snapshot and must not be allowed to make an existing
      // Vesper conversation appear empty.
    } else {
      await startThreadWithTools(dynamicTools, developerInstructions);
    }
  };
  const createReplacementConversation = async () => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      setError("Codex app-server is offline");
      return;
    }
    const replacementId = `chat-${Date.now()}-${crypto.randomUUID()}`;
    try {
      const result = await sendRpc("thread/start", { dynamicTools: await loadDynamicTools(), approvalPolicy: "on-request", summary: "concise", developerInstructions: VESPER_CONVERSATIONAL_STYLE });
      const thread = (result.result?.thread || {}) as { id?: string };
      if (!thread.id) throw new Error("Codex did not return a thread id");
      void persistCodexConversation(replacementId, { title: "替代会话", codexThreadId: thread.id })
        .catch(() => setHistoryWarning("历史暂未同步"));
      rememberConversation(replacementId, "替代会话", 0);
      onSelectConversation(replacementId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create replacement conversation");
    }
  };
  const cancelActiveTurn = async () => {
    if (!activeTurnId.current || !threadId.current) return;
    clearApprovalQueue({ threadId: threadId.current, turnId: activeTurnId.current });
    try {
      await sendRpc("turn/interrupt", { threadId: threadId.current, turnId: activeTurnId.current });
      setError("已请求取消当前回复。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not cancel the active turn");
    }
  };
  const editMessage = (item: BridgeChatMessage) => {
    const content = window.prompt("Edit message", item.content)?.trim();
    if (!content || content === item.content) return;
    const updated = { ...item, content };
    save(messagesRef.current.map((message) => message.id === item.id ? updated : message));
    void persistCodexMessage(updated).catch(() => setHistoryWarning("历史暂未同步"));
  };
  const copyMessage = async (item: BridgeChatMessage) => {
    try {
      await navigator.clipboard.writeText(item.content || item.metadata?.sticker?.description || item.metadata?.sticker?.alt || "表情包");
      setError("Copied");
      window.setTimeout(() => setError((current) => current === "Copied" ? "" : current), 1200);
    } catch {
      setError("Copy failed");
    }
  };
  const toggleFavorite = (item: BridgeChatMessage) => {
    if (favorites.some((favorite) => favorite.messageId === item.id)) {
      setFavorites((current) => current.filter((favorite) => favorite.messageId !== item.id));
      return;
    }
    const title = readLocalValue<ConversationSummary[]>("vesper-local-conversation-index", []).find((entry) => entry.id === conversationId)?.title || "对话";
    setFavorites((current) => [...current, {
      id: crypto.randomUUID(), folderId: "default", messageId: item.id,
      itemId: item.metadata?.itemId || item.metadata?.blockType, threadId: item.metadata?.threadId || item.metadata?.turnId,
      conversationId, conversationTitle: title, role: item.role, content: item.content, createdAt: item.createdAt,
    }]);
  };
  const deleteMessage = async (item: BridgeChatMessage) => {
    if (!window.confirm("删除此消息？此操作无法撤销。")) return;
    const response = await fetch(codexHistoryUrl(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(item.id)}`), {
      method: "DELETE",
      headers: codexHistoryHeaders(true),
      cache: "no-store",
      body: JSON.stringify({ messageId: item.id, itemId: item.metadata?.itemId || null, threadId: item.metadata?.threadId || threadId.current || null }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      const detail = payload.error || `删除失败（HTTP ${response.status}）`;
      setError(detail);
      throw new Error(detail);
    }
    const tombstone = { messageId: item.id, itemId: item.metadata?.itemId || null, threadId: item.metadata?.threadId || threadId.current || null, deletedAt: new Date().toISOString() };
    tombstonesRef.current = [...tombstonesRef.current.filter((entry) => entry.messageId !== tombstone.messageId && (!tombstone.itemId || entry.itemId !== tombstone.itemId)), tombstone];
    window.localStorage.setItem(`vesper-codex-tombstones-${conversationId}`, JSON.stringify(tombstonesRef.current));
    save(messagesRef.current.filter((message) => !messageWasDeleted(message, tombstonesRef.current)));
    setFavorites((current) => current.filter((favorite) => favorite.messageId !== item.id));
  };
  const prepareFile = async (item: CodexPendingFile): Promise<{ attachment: ChatAttachment; input?: CodexInput; text?: string }> => {
    const { file, preview } = item;
    let attachment: ChatAttachment = { key: crypto.randomUUID(), url: preview, name: file.name, type: file.type || "application/octet-stream", size: file.size };
    try { attachment = await uploadMedia(file); } catch {}
    if (file.type.startsWith("image/")) return { attachment, input: { type: "image", url: await localImage(file, 1600, 0.84) } };
    if (file.type.startsWith("audio/")) return { attachment, input: { type: "audio", url: await readDataUrl(file) } };
    if (file.type.startsWith("video/")) return { attachment, input: { type: "image", url: await videoPoster(file) }, text: `[Video attached: ${file.name}. A representative frame is included.]` };
    if (file.type.startsWith("text/") || /\.(json|html?|md|csv|tsx?|jsx?)$/i.test(file.name)) return { attachment, text: `[File: ${file.name}]\n${(await file.text()).slice(0, 120000)}` };
    return { attachment, text: `[File attached: ${file.name} (${file.type || "unknown"}, ${file.size} bytes).]` };
  };
  const stickerInputForModel = async (sticker: StickerCatalogItem): Promise<CodexInput | null> => {
    try {
      const response = await fetch(sticker.url, { cache: "no-store" });
      if (!response.ok) return null;
      const blob = await response.blob();
      return { type: "image", url: await localImage(new File([blob], sticker.name || "sticker", { type: sticker.mimeType || blob.type })) };
    } catch { return null; }
  };
  const send = async (selectedSticker?: StickerCatalogItem) => {
    const content = draft.trim();
    if ((!content && !pending.length && !selectedSticker) || busy) return;
    setBusy(true); setError(""); setDraft("");
    pendingAgentStickers.current = [];
    nearBottomRef.current = true;
    const userMessage: BridgeChatMessage = { id: crypto.randomUUID(), conversationId, role: "user", type: selectedSticker ? "sticker" : "text", content: content || (selectedSticker ? "[Sticker]" : "Attachment"), status: "thinking", metadata: { attachments: [], sticker: selectedSticker ? { assetId: selectedSticker.assetId, url: selectedSticker.url, width: selectedSticker.width, height: selectedSticker.height, mimeType: selectedSticker.mimeType, alt: selectedSticker.alt || selectedSticker.description || selectedSticker.name || "表情包", description: selectedSticker.description, category: selectedSticker.category } : undefined, turnId: `pending-${crypto.randomUUID()}`, turnStatus: "thinking" }, createdAt: new Date().toISOString() };
    activeTurnUserId.current = userMessage.id;
    save([...messagesRef.current, userMessage]);
    if (selectedSticker) void fetch(apiUrl(`/api/stickers/${encodeURIComponent(selectedSticker.assetId)}`), { method: "POST", headers: appHeaders(true), body: JSON.stringify({ action: "use" }) }).catch(() => {});
    rememberConversation(conversationId, content.slice(0, 28) || (selectedSticker ? "表情包" : "Attachment"));
    try {
      void persistCodexMessage(userMessage, content.slice(0, 42) || (selectedSticker ? "表情包" : "Attachment"))
        .catch(() => setHistoryWarning("历史暂未同步"));
      if (userMessage.content && userMessage.type !== "sticker") void persistMemoryMessage(userMessage).catch(() => {});
      const prepared = await Promise.all(pending.map(prepareFile));
      userMessage.metadata = { ...userMessage.metadata, attachments: prepared.map((item) => item.attachment) };
      updateMessage(userMessage.id, () => userMessage);
      // Opt-in automatic collection is server-owned and classification-gated.
      // This notification deliberately remains non-blocking so an ordinary
      // photo never delays a chat turn or silently turns into a sticker.
      for (const [index, item] of prepared.entries()) {
        const source = pending[index]?.file;
        if (!source?.type.startsWith("image/")) continue;
        void fileSha256(source).then((sha256) => fetch(apiUrl("/api/stickers/collect"), {
          method: "POST", headers: appHeaders(true), body: JSON.stringify({ key: item.attachment.key, messageId: userMessage.id, conversationId, sha256 }),
        })).catch(() => {});
      }
      const stickerText = selectedSticker ? `[Vesper sticker sent by Vera. This is a private catalog asset, not a user text message. category: ${selectedSticker.category || "未分类"}; description: ${selectedSticker.description || selectedSticker.alt || "无"}; assetId: ${selectedSticker.assetId}]` : "";
      const memoryBackground = await recallMemoryBackground((selectedSticker ? "" : content) || stickerText);
      const input: CodexInput[] = [
        { type: "text", text: [selectedSticker ? "" : content, stickerText, ...prepared.map((item) => item.text).filter(Boolean)].filter(Boolean).join("\n\n") || "Please inspect the attached files." },
      ];
      for (const item of prepared) if (item.input) input.push(item.input);
      if (selectedSticker) { const image = await stickerInputForModel(selectedSticker); if (image) input.push(image); }
      await connect(memoryBackground);
      if (!threadId.current) throw new Error("No Codex thread");
      const done = new Promise<void>((resolve) => { turnDone.current = () => resolve(); });
      const requestedModel = nextModelRef.current;
      const started = await startCodexTurnWithModel(sendRpc, { threadId: threadId.current, clientUserMessageId: userMessage.id, input, summary: "concise" }, requestedModel, modelCatalog.current);
      // A rejected RPC must retain the pending selection, not pretend it applied.
      if (requestedModel) {
        setCurrentModel(requestedModel);
        nextModelRef.current = null;
        setNextModel(null);
      }
      const turn = (started.result?.turn || {}) as { id?: string };
      activeTurnId.current = turn.id || `turn-${userMessage.id}`;
      updateMessage(userMessage.id, (item) => ({ ...item, metadata: { ...item.metadata, turnId: activeTurnId.current, turnStatus: "thinking" } }));
      const completion = await Promise.race([done.then(() => "completed" as const), new Promise<"listening">((resolve) => window.setTimeout(() => resolve("listening"), 120000))]);
      if (completion === "listening") {
        setError("回复仍在服务器上运行，Vesper 会继续监听；也可手动取消。");
        return;
      }
      setPending([]);
    } catch (reason) {
      updateMessage(userMessage.id, (item) => ({ ...item, status: "error", metadata: { ...item.metadata, turnStatus: "error" } }));
      setDraft(content); setError(reason instanceof Error ? reason.message : "Message failed"); setBusy(false);
    }
  };
  const saveAttachmentAsSticker = async (attachment: ChatAttachment, item: BridgeChatMessage) => {
    const description = window.prompt("这张表情适合什么时候用？（可留空）", "") ?? null;
    if (description === null) return;
    try {
      const response = await fetch(apiUrl("/api/stickers/from-message"), { method: "POST", headers: appHeaders(true), body: JSON.stringify({ key: attachment.key, name: attachment.name, type: attachment.type, conversationId: item.conversationId, messageId: item.id, description }) });
      const payload = await response.json().catch(() => ({})) as { duplicate?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败");
      setError(payload.duplicate ? "这张图片已经在表情包里了" : "已保存到表情包");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存为表情包失败"); }
  };
  const selectFiles = (files: FileList | null) => {
    if (!files) return;
    setPending((current) => [...current, ...Array.from(files).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };
  const startStt = () => {
    const Speech = (window as Window & { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void; start: () => void } }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;
    if (!Speech) return setError("Speech recognition is not supported here");
    const recognition = new Speech(); recognition.lang = "en-US"; recognition.interimResults = false;
    recognition.onresult = (event) => setDraft((value) => `${value}${value ? " " : ""}${event.results[0][0].transcript}`);
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setError("Speech recognition failed"); };
    setListening(true); recognition.start();
  };
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      setHistoryReady(false);
      try {
        await migrateLegacyHistory();
      } catch {
        if (!cancelled) setHistoryWarning("历史暂未同步");
      }
      try {
        const response = await fetch(codexHistoryUrl(`/conversations/${encodeURIComponent(conversationId)}`), {
          headers: codexHistoryHeaders(),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("无法读取 VPS 历史记录");
        const payload = await response.json() as {
          conversation?: { codexThreadId?: string | null } | null;
          messages?: BridgeChatMessage[];
          tombstones?: CodexMessageTombstone[];
        };
        if (cancelled) return;
        tombstonesRef.current = [...(payload.tombstones || []), ...readLocalValue<CodexMessageTombstone[]>(`vesper-codex-tombstones-${conversationId}`, [])]
          .filter((item, index, all) => all.findIndex((candidate) => candidate.messageId === item.messageId && candidate.itemId === item.itemId) === index);
        window.localStorage.setItem(`vesper-codex-tombstones-${conversationId}`, JSON.stringify(tombstonesRef.current));
        const rawRemote = payload.messages || [];
        // Versions that used a faux input item may already have copied that
        // item into the VPS history through a legacy migration. Remove only
        // those tagged internal records, then immediately exclude them from
        // this render even if the cleanup request is temporarily offline.
        void removeLeakedInternalHistoryMessages(conversationId, rawRemote)
          .catch(() => setHistoryWarning("历史暂未同步"));
        const remote = normalizeCodexMessages(rawRemote, conversationId);
        const cached = normalizeCodexMessages(readLocalValue(`vesper-codex-chat-${conversationId}`, []), conversationId);
        const backup = normalizeCodexMessages(readLocalValue(`vesper-codex-chat-backup-${conversationId}`, []), conversationId);
        save(mergeCodexMessages(remote, cached, backup).filter((item) => !messageWasDeleted(item, tombstonesRef.current)));
        threadId.current = payload.conversation?.codexThreadId || "";
      } catch {
        if (!cancelled) setHistoryWarning("历史暂未同步");
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
      if (cancelled) return;
      try {
        await connect();
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Codex app-server is offline");
      }
    };
    void restore();
    return () => { cancelled = true; socket.current?.close(); socket.current = null; };
  }, [conversationId]);
  useEffect(() => {
    const receiveCard = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string; card?: MusicCardData }>).detail;
      if (detail?.conversationId !== conversationId || !detail.card) return;
      const current = messagesRef.current;
      const cardMessage: BridgeChatMessage = {
        id: crypto.randomUUID(),
        conversationId,
        role: "agent",
        content: detail.card.message || "",
        status: "delivered",
        metadata: { musicCard: detail.card, blockType: "musicCard", threadId: threadId.current },
        createdAt: new Date().toISOString(),
      };
      save([...current, cardMessage]);
      void persistCodexMessage(cardMessage).catch(() => setHistoryWarning("历史暂未同步"));
    };
    window.addEventListener("vesper-music-card", receiveCard);
    return () => window.removeEventListener("vesper-music-card", receiveCard);
  }, [conversationId]);
  useLayoutEffect(() => {
    const scroller = streamEnd.current?.closest(".chat-stream") as HTMLElement | null;
    if (!scroller) return;
    const updateNearBottom = () => {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      nearBottomRef.current = distance <= 96;
    };
    updateNearBottom();
    scroller.addEventListener("scroll", updateNearBottom, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      if (nearBottomRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    resizeObserver.observe(scroller);
    nearBottomRef.current = true;
    requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", updateNearBottom);
    };
  }, [conversationId]);
  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "24px";
    const styles = getComputedStyle(node);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const maxHeight = Math.ceil(lineHeight * 4 + (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0));
    const nextHeight = Math.min(node.scrollHeight, maxHeight);
    node.style.height = `${Math.max(24, nextHeight)}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);
  useLayoutEffect(() => {
    if (!nearBottomRef.current) return;
    const scroller = streamEnd.current?.closest(".chat-stream") as HTMLElement | null;
    if (!scroller) return;
    requestAnimationFrame(() => {
      if (nearBottomRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
  }, [messages.length, streamingItems]);
  useLayoutEffect(() => {
    if (!focusMessageId) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-message-id="${CSS.escape(focusMessageId)}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.classList.add("focus-message");
      window.setTimeout(() => target?.classList.remove("focus-message"), 2200);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, messages.length]);
  const liveStatusStamp = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const displayedModel = nextModel || currentModel;
  const displayedModelName = models.find((item) => item.model === displayedModel?.model)?.displayName || displayedModel?.model || "选择模型";
  return (
    <div className="page-body chat-page codex-chat">
      <div className="chat-status-stack">
        <div className="bridge-presence"><i className={online ? "online" : ""} /><span>{online ? "Codex app-server connected" : "Codex app-server offline"}</span></div>
        {historyWarning && <div className="chat-history-warning" role="status">{historyWarning}</div>}
        {resumeError && <div className="chat-restore-error" role="alert"><span>{resumeError}</span><button onClick={() => void createReplacementConversation()}>继续为新会话</button></div>}
      </div>
      <div className="chat-stream">
        {!messages.length && !Object.keys(streamingItems).length && <div className="chat-empty"><Icon name="chat" /><b>{!historyReady ? "正在准备对话…" : error || "A quiet place to think"}</b><span>One private Codex connection · files, images, audio and tools ready</span></div>}
        {messages.map((item, index) => {
          const timestamp = visibleMessageTimestamp(item.createdAt);
          const previousTimestamp = index ? visibleMessageTimestamp(messages[index - 1].createdAt) : Number.NaN;
          const day = Number.isFinite(timestamp) ? new Date(timestamp).toDateString() : "";
          const previousDay = Number.isFinite(previousTimestamp) ? new Date(previousTimestamp).toDateString() : "";
          const divider = day && day !== previousDay ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(timestamp)) : "";
          return <div className="message-with-date" key={item.id}>{divider && <div className="chat-date-divider"><span>{divider}</span></div>}<CodexChatMessage item={item} agentName={agentName} userName={userName} onEdit={editMessage} onThought={setThought} onCopy={copyMessage} favorite={favorites.some((favorite) => favorite.messageId === item.id)} onFavorite={toggleFavorite} onDelete={deleteMessage} onPlayMusic={(trackId) => window.dispatchEvent(new CustomEvent("vesper-music-play", { detail: { trackId } }))} onQueueMusic={(trackId) => window.dispatchEvent(new CustomEvent("vesper-music-queue-add", { detail: { trackId } }))} onOpenMusic={onOpenMusic} onAddMusicToPlaylist={onAddMusicToPlaylist} onSaveAttachmentAsSticker={item.role === "user" ? saveAttachmentAsSticker : undefined} /></div>;
        })}
        {busy && !Object.keys(streamingItems).length && <div className="agent-turn pending-agent-turn"><div className="turn-status" aria-live="polite"><i /><span>{liveStatusStamp}  Thinking…</span></div></div>}
        {Object.entries(streamingItems).map(([itemId, text]) => <div className="agent-turn" key={itemId}><div className="turn-status" aria-live="polite"><i /><span>{liveStatusStamp}  Thinking…</span></div><div className="message assistant"><div><p>{text}</p></div></div></div>)}
        <div ref={streamEnd} />
      </div>
      {currentTrack && <div className="codex-mini-player"><button className="mini-track" onClick={onOpenMusic}>{currentTrack.cover ? <img src={currentTrack.cover} alt="" /> : <span>V</span>}<strong>{currentTrack.title}</strong><small>{currentTrack.artist || "未知歌手"}</small></button><button aria-label={playing ? "暂停" : "播放"} onClick={onToggleMusic}><Icon name={playing ? "pause" : "play"} /></button><button aria-label="下一首" onClick={onNextMusic}><Icon name="forward" /></button></div>}
      <div className="chat-compose">
        {pending.length > 0 && <div className="compose-previews">{pending.map((item, index) => <div className="compose-preview" key={`${item.file.name}-${index}`}>{item.file.type.startsWith("image/") ? <img src={item.preview} alt={item.file.name} /> : item.file.type.startsWith("video/") ? <video src={item.preview} muted /> : item.file.type.startsWith("audio/") ? <audio src={item.preview} controls /> : <span><Icon name="archive" />{item.file.name}</span>}<button aria-label="Remove attachment" onClick={() => setPending((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="close" /></button></div>)}</div>}
        <textarea ref={textareaRef} placeholder="Write to Codex…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
        <div className="compose-actions"><button aria-label="Attach files" onClick={() => fileInput.current?.click()}><Icon name="plus" /></button><input ref={fileInput} hidden multiple type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.json,.html,.csv,.zip" onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /><button aria-label="选择表情包" onClick={() => setStickerPickerOpen(true)}><Icon name="sticker" /></button>
          <span className="composer-status"><i className={online ? "online" : ""} /><button className="codex-model-trigger" type="button" aria-label="选择模型与使用强度" aria-haspopup="dialog" disabled={busy || !online} onClick={() => { setModelPickerOpen(true); void refreshModels(); }}><span>{busy ? "回复中…" : listening ? "Listening…" : displayedModelName}</span><small>{nextModel ? "下次 · " : ""}{effortLabel(displayedModel?.effort ?? null)}⌄</small></button></span>
          {busy && <button aria-label="Cancel active response" onClick={() => void cancelActiveTurn()}><Icon name="close" /></button>}<button className={listening ? "active" : ""} aria-label="Voice input" onClick={startStt}><Icon name="mic" /></button><button className="send-message-button" aria-label="Send message" disabled={busy || (!draft.trim() && !pending.length)} onClick={() => void send()}><Icon name="send" /></button></div>
      </div>
      {thought && <div className="thought-sheet-layer"><button className="thought-scrim" aria-label="Close reasoning" onClick={() => setThought(null)} /><section className="thought-sheet"><div className="thought-sheet-head"><button aria-label="Close" onClick={() => setThought(null)}><Icon name="close" /></button><h2>Thought process</h2></div><div className="thought-raw">{thought.metadata?.thoughtSummary?.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div></section></div>}
      {approvalQueue[0] && <CodexApprovalDialog approval={approvalQueue[0]} queuedCount={approvalQueue.length} onDecision={answerApproval} />}
      {modelPickerOpen && <CodexModelPicker models={models} current={displayedModel} loading={modelsLoading} error={modelError} online={online} onRefresh={() => void refreshModels()} onClose={() => setModelPickerOpen(false)} onSelect={(selection) => { nextModelRef.current = selection; setNextModel(selection); setModelPickerOpen(false); }} />}
      <StickerPickerSheet open={stickerPickerOpen} onClose={() => setStickerPickerOpen(false)} onSelect={(sticker) => { setStickerPickerOpen(false); void send(sticker); }} onManage={() => { setStickerPickerOpen(false); setStickerManagerOpen(true); }} />
      <StickerManagerModal open={stickerManagerOpen} onClose={() => setStickerManagerOpen(false)} />
    </div>
  );
}

function MessageAttachments({ items, onSaveAsSticker }: { items: ChatAttachment[]; onSaveAsSticker?: (item: ChatAttachment) => void }) {
  if (!items.length) return null;
  return (
    <div className="message-attachments">
      {items.map((item) =>
        item.type.startsWith("image/") ? (
          <div className="image-attachment" key={item.key}>
            <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.name} /></a>
            {onSaveAsSticker && <button className="save-as-sticker" onClick={() => onSaveAsSticker(item)}><Icon name="sticker" />保存为表情包</button>}
          </div>
        ) : item.type.startsWith("video/") ? (
          <video src={item.url} controls playsInline key={item.key} />
        ) : item.type.startsWith("audio/") ? (
          <audio src={item.url} controls key={item.key} />
        ) : (
          <a
            className="file-attachment"
            href={item.url}
            target="_blank"
            rel="noreferrer"
            key={item.key}
          >
            <Icon name="archive" />
            <span>{item.name}</span>
          </a>
        ),
      )}
    </div>
  );
}

function Diary() {
  const [entries, setEntries] = usePersistentDocument<DiaryDocument>(
    "diary",
    {},
  );
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= dayCount ? day : null;
  });
  const keyFor = (day: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selected = selectedKey
    ? entries[selectedKey] || { user: "", agent: "", updatedAt: "" }
    : null;
  const saveUser = (value: string) => {
    if (!selectedKey) return;
    setEntries((current) => ({
      ...current,
      [selectedKey]: {
        ...(current[selectedKey] || { agent: "" }),
        user: value,
        updatedAt: new Date().toISOString(),
      },
    }));
  };
  return (
    <div className="page-body">
      <PageIntro
        eyebrow={`${year} · ${String(monthIndex + 1).padStart(2, "0")}`}
        title="日记"
        text="点击日期查看或编辑当天日记。"
      />
      <div className="calendar-head">
        <button
          aria-label="上个月"
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
        >
          ‹
        </button>
        <h2>
          {year}年 {monthIndex + 1}月
        </h2>
        <button
          aria-label="下个月"
          onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="calendar surface">
        <div className="week">
          {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-blank" key={index} />;
            const key = keyFor(day);
            const entry = entries[key];
            const today = key === new Date().toLocaleDateString("en-CA");
            return (
              <button
                key={key}
                className={`${today ? "today " : ""}${entry?.user || entry?.agent ? "has-entry" : ""}`}
                onClick={() => setSelectedKey(key)}
              >
                <b>{day}</b>
                {(entry?.user || entry?.agent) && <i />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="diary-legend">
        <span>
          <i className="user-dot" />
          我的日记
        </span>
        <span>
          <i className="agent-dot" />
          Agent 日记
        </span>
      </div>
      <div className="month-memory surface">
        <span>本月记录</span>
        <b>
          {
            Object.keys(entries).filter((key) =>
              key.startsWith(
                `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
              ),
            ).length
          }{" "}
          天
        </b>
      </div>
      {selectedKey && selected && (
        <div className="modal-layer">
          <button
            className="modal-scrim"
            onClick={() => setSelectedKey(null)}
          />
          <section className="diary-modal">
            <div className="modal-head">
              <div>
                <small>
                  {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(
                    "zh-CN",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </small>
                <h2>这一天的日记</h2>
              </div>
              <button onClick={() => setSelectedKey(null)}>
                <Icon name="close" />
              </button>
            </div>
            <label className="diary-sheet user-sheet">
              <span>
                <b>USER</b>
                <em>可编辑</em>
              </span>
              <textarea
                placeholder="写下今天……"
                value={selected.user}
                onChange={(event) => saveUser(event.target.value)}
              />
              <small>
                {selected.updatedAt
                  ? `保存于 ${new Date(selected.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
                  : "输入后自动保存"}
              </small>
            </label>
            <article className="diary-sheet agent-sheet">
              <span>
                <b>AGENT</b>
                <em>
                  <Icon name="link" />
                  Agent can write
                </em>
              </span>
              <p>{selected.agent || "Agent 尚未记录这一天。"}</p>
            </article>
          </section>
        </div>
      )}
    </div>
  );
}

function Todos() {
  const [items, setItems] = usePersistentDocument<TodoItem[]>("todos", []);
  const add = () => {
    const title = window.prompt("提醒内容");
    if (!title?.trim()) return;
    const due = window.prompt("时间或日期（可留空）") || "";
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        done: false,
        tag: "未分类",
        due: due.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
  };
  const completed = items.filter((item) => item.done).length;
  return (
    <div className="page-body">
      <PageIntro
        eyebrow="TO DO"
        title="提醒"
        text="创建、完成和删除你的提醒。"
      />
      <div className="todo-summary">
        <div>
          <b>
            {completed}/{items.length}
          </b>
          <span>已完成</span>
        </div>
        <div className="summary-line">
          <i
            style={{
              width: items.length
                ? `${(completed / items.length) * 100}%`
                : "0%",
            }}
          />
        </div>
      </div>
      {!items.length ? (
        <EmptyState text="还没有提醒。" />
      ) : (
        <div className="surface todo-list">
          {items.map((item) => (
            <div className="todo-item" key={item.id}>
              <button
                aria-label="切换完成状态"
                onClick={() =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, done: !entry.done }
                        : entry,
                    ),
                  )
                }
              >
                <span
                  className={item.done ? "round-check checked" : "round-check"}
                >
                  {item.done && <Icon name="check" />}
                </span>
              </button>
              <span className={item.done ? "crossed" : ""}>
                <b>{item.title}</b>
                <small>
                  {[item.tag, item.due].filter(Boolean).join(" · ") ||
                    "未设置时间"}
                </small>
              </span>
              <button
                aria-label="删除提醒"
                onClick={() =>
                  setItems((current) =>
                    current.filter((entry) => entry.id !== item.id),
                  )
                }
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="primary-action" onClick={add}>
        <Icon name="plus" />
        添加新提醒
      </button>
    </div>
  );
}

function SettingsPage({
  accent,
  background,
  onAccent,
  onBackground,
  environment,
  onEnvironment,
}: {
  accent: string;
  background: string;
  onAccent: (value: string) => void;
  onBackground: (value: string) => void;
  environment: EnvironmentSnapshot;
  onEnvironment: (value: EnvironmentSnapshot) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [preferences, setPreferences] =
    usePersistentDocument<VesperPreferences>("settings", defaultPreferences);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default",
    );
  const careLabel =
    preferences.careFrequency === "off"
      ? "关闭"
      : preferences.careFrequency === "twice-weekly"
        ? "每周两次"
        : "每天一次";
  const locationLabel =
    environment.permission === "granted"
      ? environment.temperature === undefined
        ? "已授权"
        : `已定位 · ${Math.round(environment.temperature)}°`
      : environment.permission === "denied"
        ? "定位被拒绝"
        : "尚未授权";
  const notificationLabel =
    notificationPermission === "granted"
      ? "系统通知已授权"
      : notificationPermission === "denied"
        ? "通知被拒绝"
        : "尚未授权";
  const closeDetail = () => {
    if (detailClosing) return;
    setDetailClosing(true);
    window.setTimeout(() => {
      setSelected(null);
      setDetailClosing(false);
    }, 260);
  };
  return (
    <div className={`${selected ? "page-body settings-page detail-active" : "page-body settings-page"}${detailClosing ? " detail-closing" : ""}`}>
      <PageIntro
        eyebrow="PREFERENCES"
        title="设置"
        text="让 Vesper 以你感到舒服的方式陪伴。"
      />
      <SettingsGroup title="CODEx RUNTIME">
        <SettingRow
          icon="sparkles"
          title="Codex Server"
          sub="One private app-server on your VPS"
          onClick={() => setSelected("Codex Server")}
        />
        <SettingRow
          icon="link"
          title="MCP Servers"
          sub="Add servers with OAuth or no authorization"
          onClick={() => setSelected("MCP 工具")}
        />
        <SettingRow
          icon="volume"
          title="Agent 声音（TTS）"
          sub="尚未连接声音服务"
          onClick={() => setSelected("Agent 声音")}
        />
        <SettingRow
          icon="wifi"
          title="Web Push"
          sub={notificationLabel}
          status={notificationPermission === "granted"}
          onClick={() => setSelected("Web Push")}
        />
        <SettingRow
          icon="location"
          title="定位与环境"
          sub={locationLabel}
          status={environment.permission === "granted"}
          onClick={() => setSelected("定位与环境")}
        />
      </SettingsGroup>
      <SettingsGroup title="体验">
        <SettingRow
          icon="settings"
          title="外观 Appearance"
          sub={background ? "自定义主题与背景" : "冰灰主题 · 大理石背景"}
          onClick={() => setSelected("Appearance")}
        />
        <SettingRow
          icon="bell"
          title="通知偏好"
          sub={
            `${preferences.reminders ? "提醒 " : ""}${preferences.anniversaries ? "纪念日 " : ""}${preferences.agentNotes ? "Agent 留言" : ""}`.trim() ||
            "全部关闭"
          }
          onClick={() => setSelected("通知偏好")}
        />
        <SettingRow
          icon="heart"
          title="关心频率"
          sub={careLabel}
          onClick={() => setSelected("关心频率")}
        />
        <SettingRow
          icon="sparkles"
          title="自主唤醒"
          sub={preferences.careFrequency === "off" ? "当前已关闭" : "查看运行状态与下一次机会"}
          status={preferences.careFrequency !== "off"}
          onClick={() => setSelected("自主唤醒")}
        />
      </SettingsGroup>
      <SettingsGroup title="隐私与数据">
        <SettingRow
          icon="lock"
          title="记忆权限"
          sub="日记、便笺与聊天可分别控制"
          onClick={() => setSelected("记忆权限")}
        />
        <SettingRow
          icon="archive"
          title="导出与备份"
          sub={
            preferences.lastExportAt
              ? `上次导出：${new Date(preferences.lastExportAt).toLocaleString("zh-CN")}`
              : "本地优先保存 · 应用更新不清除数据"
          }
          onClick={() => setSelected("导出与备份")}
        />
      </SettingsGroup>
      <p className="settings-foot">VESPER 0.5 · CODEX APP-SERVER</p>
      {selected === "Appearance" ? (
        <AppearanceModal
          accent={accent}
          onAccent={onAccent}
          onBackground={onBackground}
          onClose={closeDetail}
        />
      ) : selected === "Codex Server" ? (
        <CodexConnectionModal onClose={closeDetail} />
      ) : selected === "MCP 工具" ? (
        <ExternalMcpModal onClose={closeDetail} />
      ) : selected === "Vesper MCP" ? (
        <VesperMcpModal onClose={closeDetail} />
      ) : selected === "自主唤醒" ? (
        <WakeVisualizer preferences={preferences} onClose={closeDetail} />
      ) : selected === "Agent 声音" ? (
        <VoiceSettingsModal onClose={closeDetail} />
      ) : selected &&
        ["通知偏好", "关心频率", "记忆权限", "导出与备份"].includes(
          selected,
        ) ? (
        <FunctionalSettingsModal
          type={selected}
          preferences={preferences}
          onPreferences={setPreferences}
          onClose={closeDetail}
        />
      ) : (
        selected && (
          <ConnectionModal
            type={selected}
            environment={environment}
            onEnvironment={onEnvironment}
            onNotificationPermission={setNotificationPermission}
            onClose={closeDetail}
          />
        )
      )}
    </div>
  );
}

function WakeVisualizer({ preferences, onClose }: { preferences: VesperPreferences; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  const [previewPulse, setPreviewPulse] = useState(0);
  const runtime = readLocalValue("vesper-wake-runtime-v1", {
    checkedAt: 0, cumulative: 0, threshold: 1, lastWakeAt: 0, generation: 0,
  });
  useEffect(() => {
    const update = () => setTick(new Date().getTime());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);
  const elapsed = tick && runtime.checkedAt ? Math.max(0, tick - runtime.checkedAt) / 3_600_000 : 0;
  const rate = preferences.careFrequency === "daily" ? 1 / 14 : 1 / 72;
  const progress = preferences.careFrequency === "off" ? 0 : Math.min(1, (runtime.cumulative + elapsed * rate) / Math.max(.01, runtime.threshold));
  const estimatedHours = preferences.careFrequency === "off" ? null : Math.max(0, (runtime.threshold - runtime.cumulative) / rate - elapsed);
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal wake-visualizer" data-tick={tick}>
        <div className="modal-head"><button className="settings-back" onClick={onClose}><Icon name="chevron" /></button><div><small>AUTONOMOUS WAKE</small><h2>自主唤醒</h2></div></div>
        <div key={previewPulse} className={`${preferences.careFrequency === "off" ? "wake-orbit asleep" : "wake-orbit"}${previewPulse ? " previewing" : ""}`} style={{ "--wake-progress": progress } as CSSProperties}><i /><i /><span><Icon name="sparkles" /></span></div>
        <div className="wake-status-grid">
          <div><small>当前状态</small><b>{preferences.careFrequency === "off" ? "休眠" : "静候合适时机"}</b></div>
          <div><small>机会累积</small><b>{Math.round(progress * 100)}%</b></div>
          <div><small>上次行动</small><b>{runtime.lastWakeAt ? new Date(runtime.lastWakeAt).toLocaleString("zh-CN") : "尚未发生"}</b></div>
          <div><small>预计窗口</small><b>{estimatedHours === null ? "—" : estimatedHours < 1 ? "一小时内" : `约 ${Math.ceil(estimatedHours)} 小时`}</b></div>
        </div>
        <p className="settings-hint">Vesper 只在白天、达到频率阈值且 AI 已连接时行动；留言、消息或来电会同时触发 Web Push。</p>
        <button className="reset-background" onClick={() => setPreviewPulse((value) => value + 1)}>预览一次脉冲</button>
      </section>
    </div>
  );
}

const VESPER_MCP_URL = "https://mcp.vesper.r-vera.com/mcp";

type ExternalMcpEntry = {
  id: string;
  name: string;
  url: string;
  token: string;
  enabled: boolean;
  authMode?: "none" | "oauth";
  authorizationUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string;
  oauthStatus?: "authorized" | "pending";
  resource?: string;
};

function ExternalMcpModal({ onClose }: { onClose: () => void }) {
  const [servers, setServers] = useLocalDocument<ExternalMcpEntry[]>("external-mcp-servers", []);
  const [message, setMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    const value = window.sessionStorage.getItem("vesper-mcp-oauth-result") || "";
    window.sessionStorage.removeItem("vesper-mcp-oauth-result");
    return value;
  });
  const [testingId, setTestingId] = useState("");
  const [editor, setEditor] = useState<ExternalMcpEntry | null>(null);
  const [editorMessage, setEditorMessage] = useState("");
  const syncedConnections = useRef(new Set<string>());
  const configuredServers = servers.filter(
    (server) => Boolean(server.name.trim() || server.url.trim()),
  );
  const closeEditor = () => {
    setEditor(null);
    setEditorMessage("");
  };
  const openEditor = (server: ExternalMcpEntry) => {
    setEditor({ ...server });
    setEditorMessage("");
  };
  const add = () => {
    setEditor({
      id: crypto.randomUUID(),
      name: "",
      url: "",
      token: "",
      enabled: true,
      authMode: "none",
    });
    setEditorMessage("");
  };
  const updateEditor = (patch: Partial<ExternalMcpEntry>) =>
    setEditor((current) => (current ? { ...current, ...patch } : current));
  const saveEditor = () => {
    if (!editor) return;
    const next = {
      ...editor,
      name: editor.name.trim(),
      url: editor.url.trim(),
    };
    if (!next.name && !next.url) {
      setEditorMessage("请填写名称或 MCP 服务地址");
      return;
    }
    setServers((current) =>
      current.some((server) => server.id === next.id)
        ? current.map((server) => (server.id === next.id ? next : server))
        : [...current, next],
    );
    closeEditor();
  };
  const update = (id: string, patch: Partial<ExternalMcpEntry>) =>
    setServers((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const syncToCodex = async (server: ExternalMcpEntry) => {
    const response = await fetch(apiUrl("/api/mcp/connections"), {
      method: "PUT",
      headers: appHeaders(true),
      cache: "no-store",
      body: JSON.stringify({
        id: server.id,
        name: server.name,
        url: server.url,
        authMode: server.authMode || "none",
        token: server.token,
        enabled: server.enabled,
      }),
    });
    const result = await response.json().catch(() => ({})) as { serverName?: string; toolCount?: number; error?: string };
    if (!response.ok) throw new Error(result.error || "无法同步 MCP 给 Codex");
    return result;
  };
  useEffect(() => {
    for (const server of servers) {
      const signature = `${server.id}:${server.url}:${server.token}:${server.enabled}`;
      if (!server.enabled || !server.url || !server.token || syncedConnections.current.has(signature)) continue;
      syncedConnections.current.add(signature);
      void syncToCodex(server).catch(() => {
        syncedConnections.current.delete(signature);
      });
    }
  }, [servers]);
  const authorize = async (server: ExternalMcpEntry) => {
    if (!server.url) {
      setMessage("请先填写 MCP 服务地址");
      return;
    }
    try {
      setMessage("正在打开授权页面…");
      const redirectUri = `${window.location.origin}/mcp/oauth/callback`;
      const discoveryResponse = await fetch("/api/mcp/oauth/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: server.url, redirectUri, clientId: server.clientId }),
      });
      const discovered = (await discoveryResponse.json()) as {
        authorizationUrl?: string;
        tokenUrl?: string;
        clientId?: string;
        clientSecret?: string;
        scopes?: string;
        resource?: string;
        needsClientId?: boolean;
        error?: string;
      };
      if (!discoveryResponse.ok || !discovered.authorizationUrl || !discovered.tokenUrl) {
        throw new Error(discovered.error || "无法自动发现 OAuth 授权页面");
      }
      if (discovered.needsClientId || !discovered.clientId) {
        throw new Error("该服务不支持自动注册，请填写它分配给 Vesper 的 Client ID 后重试");
      }
      update(server.id, {
        authorizationUrl: discovered.authorizationUrl,
        tokenUrl: discovered.tokenUrl,
        clientId: discovered.clientId,
        clientSecret: discovered.clientSecret || server.clientSecret,
        scopes: discovered.scopes,
        resource: discovered.resource,
      });
      const verifier = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      const state = crypto.randomUUID();
      window.sessionStorage.setItem(
        "vesper-mcp-oauth-pending",
        JSON.stringify({
          serverId: server.id,
          state,
          verifier,
          tokenUrl: discovered.tokenUrl,
          clientId: discovered.clientId,
          clientSecret: discovered.clientSecret || server.clientSecret,
          redirectUri,
          resource: discovered.resource,
        }),
      );
      update(server.id, { oauthStatus: "pending" });
      const target = new URL(discovered.authorizationUrl);
      target.searchParams.set("response_type", "code");
      target.searchParams.set("client_id", discovered.clientId);
      target.searchParams.set("redirect_uri", redirectUri);
      target.searchParams.set("state", state);
      target.searchParams.set("code_challenge", challenge);
      target.searchParams.set("code_challenge_method", "S256");
      if (discovered.scopes) target.searchParams.set("scope", discovered.scopes);
      target.searchParams.set("resource", discovered.resource || server.url);
      window.location.assign(target.toString());
    } catch (reason) {
      update(server.id, { oauthStatus: undefined });
      setMessage(reason instanceof Error ? reason.message : "无法打开 OAuth 授权页面");
    }
  };
  const test = async (server: ExternalMcpEntry) => {
    if (!server.url) {
      setMessage("请先填写 MCP 服务地址");
      return;
    }
    setTestingId(server.id);
    setMessage("");
    try {
      const result = await syncToCodex(server);
      setMessage(`连接成功${result.serverName ? ` · ${result.serverName}` : ""}${typeof result.toolCount === "number" ? ` · ${result.toolCount} 个工具` : ""}；已同步给 Codex，新建对话后即可使用。`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "MCP 连接失败");
    } finally {
      setTestingId("");
    }
  };
  return (
    <div className="modal-layer settings-subpage-layer mcp-settings-page">
      <button className="modal-scrim" onClick={onClose} />
      {editor ? (
        <section className="connection-modal external-mcp-modal mcp-editor-modal">
          <div className="modal-head">
            <button className="settings-back" onClick={closeEditor} aria-label="返回"><Icon name="chevron" /></button>
            <div><small>MCP SERVER</small><h2>{editor.name ? "编辑 MCP 服务器" : "添加 MCP 服务器"}</h2></div>
            <span className="mcp-editor-head-spacer" aria-hidden="true" />
          </div>
          <div className="mcp-editor-scroll">
            <label className="profile-field"><span>名称</span><input value={editor.name} onChange={(event) => updateEditor({ name: event.target.value })} /></label>
            <label className="profile-field"><span>Streamable HTTP 地址</span><input value={editor.url} placeholder="https://example.com/mcp" autoCapitalize="none" autoCorrect="off" onChange={(event) => updateEditor({ url: event.target.value })} /></label>
            <div className="mcp-auth-choice"><span>OAuth 授权</span><div><button className={(editor.authMode || "none") === "none" ? "selected" : ""} onClick={() => updateEditor({ authMode: "none" })}>无</button><button className={editor.authMode === "oauth" ? "selected" : ""} onClick={() => updateEditor({ authMode: "oauth" })}>有</button></div></div>
            {editor.authMode === "oauth" ? <><p className="settings-hint">Vesper 会自动发现 OAuth 页面并跳转授权；若服务要求预先登记回调地址，请填写 <code>https://vesper.r-vera.com/mcp/oauth/callback</code>。</p><label className="profile-field"><span>Client ID（服务要求时填写）</span><input value={editor.clientId || ""} onChange={(event) => updateEditor({ clientId: event.target.value })} /></label></> : <label className="profile-field"><span>Bearer Token（可选）</span><input type="password" value={editor.token} onChange={(event) => updateEditor({ token: event.target.value })} /></label>}
            <button className={editor.enabled ? "mcp-enable on" : "mcp-enable"} onClick={() => updateEditor({ enabled: !editor.enabled })}><span>{editor.enabled ? "已启用" : "已停用"}</span><i><u /></i></button>
            {editorMessage && <p className="connection-message">{editorMessage}</p>}
          </div>
          <div className="mcp-editor-actions"><button onClick={closeEditor}>取消</button><button className="save-profile" onClick={saveEditor}>保存</button></div>
        </section>
      ) : (
        <section className="connection-modal external-mcp-modal">
          <div className="modal-head">
            <button className="settings-back" onClick={onClose} aria-label="返回"><Icon name="chevron" /></button>
            <div><small>TOOL CONNECTIONS</small><h2>MCP 工具</h2></div>
            <button onClick={add} aria-label="添加 MCP"><Icon name="plus" /></button>
          </div>
          <div className="mcp-list-scroll">
            <p className="mcp-list-intro">在这里接入搜索、文件、记忆库或其他第三方 MCP。AI 连接中的 MCP 是对话运行端，这里则是提供给 AI 使用的工具目录。</p>
            <div className="mcp-server-list">
              {!configuredServers.length && <EmptyState text="还没有接入第三方 MCP。" />}
              {configuredServers.map((server) => (
                <article className="mcp-server-card" key={server.id}>
                  <div className="mcp-server-summary">
                    <span className={server.enabled ? "mcp-live-dot" : "mcp-live-dot off"} />
                    <div><b>{server.name || "未命名 MCP"}</b><small>{server.url || "尚未填写地址"} · {server.authMode === "oauth" ? `OAuth ${server.oauthStatus === "authorized" ? "已授权" : "待授权"}` : "Bearer / 无授权"}</small></div>
                  </div>
                  <div className="mcp-card-actions">
                    <button disabled={testingId === server.id} onClick={() => void test(server)}>{testingId === server.id ? "测试中" : "测试"}</button>
                    {server.authMode === "oauth" && <button onClick={() => void authorize(server)}>授权</button>}
                    <button onClick={() => openEditor(server)}>编辑</button>
                    <button onClick={() => void (async () => {
                      try {
                        const response = await fetch(`${apiUrl("/api/mcp/connections")}?id=${encodeURIComponent(server.id)}`, { method: "DELETE", headers: appHeaders(true), cache: "no-store" });
                        const result = await response.json().catch(() => ({})) as { error?: string };
                        if (!response.ok) throw new Error(result.error || "无法删除服务端 MCP 凭证");
                        setServers((current) => current.filter((item) => item.id !== server.id));
                      } catch (reason) {
                        setMessage(reason instanceof Error ? reason.message : "删除 MCP 失败");
                      }
                    })()}>删除</button>
                  </div>
                </article>
              ))}
            </div>
            {message && <p className="connection-message">{message}</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function VesperMcpModal({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useLocalDocument("mcp-access-token", "");
  const [draft, setDraft] = useState(token);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const generateToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const setup = async () => {
    const nextToken = draft.trim() || generateToken();
    if (nextToken.length < 16) return setMessage("访问令牌至少需要 16 位。");
    if (!draft.trim()) setDraft(nextToken);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(VESPER_MCP_URL.replace(/\/mcp$/, "/setup"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ token: nextToken }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || `配置失败（${response.status}）`);
      setToken(nextToken);
      const testResponse = await fetch(apiUrl("/api/mcp"), {
        method: "POST",
        headers: appHeaders(true),
        body: JSON.stringify({ url: VESPER_MCP_URL, token: nextToken }),
      });
      const tested = (await testResponse.json()) as { toolCount?: number; error?: string };
      if (!testResponse.ok) throw new Error(tested.error || "MCP tools 测试失败");
      setToolCount(tested.toolCount ?? 0);
      setMessage(`MCP 已启用并连接成功，发现 ${tested.toolCount ?? 0} 个 tools。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MCP 配置失败");
    } finally {
      setBusy(false);
    }
  };
  const testTools = async () => {
    if (!draft.trim()) return setMessage("请先生成并启用连接令牌");
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(apiUrl("/api/mcp"), {
        method: "POST",
        headers: appHeaders(true),
        body: JSON.stringify({ url: VESPER_MCP_URL, token: draft.trim() }),
      });
      const result = (await response.json()) as { toolCount?: number; serverName?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "MCP tools 测试失败");
      setToolCount(result.toolCount ?? 0);
      setMessage(`${result.serverName || "Vesper"} 已连接，发现 ${result.toolCount ?? 0} 个 tools。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MCP tools 测试失败");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify({ url: VESPER_MCP_URL, headers: { Authorization: `Bearer ${draft.trim()}` } }, null, 2),
    );
    setMessage("连接参数已复制");
  };
  return (
    <div className="modal-layer settings-subpage-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal ai-connection-modal">
        <div className="modal-head">
          <button className="settings-back" onClick={onClose} aria-label="返回"><Icon name="chevron" /></button>
          <div><small>VESPER MCP</small><h2>Vesper MCP</h2></div>
        </div>
        <div className="connection-symbol"><Icon name="link" /></div>
        <p>Vesper 会作为一台 MCP 工具服务器，向 Codex 等支持远程 MCP 的 AI 提供便笺、提醒、日记、纪念日、记忆与通知工具。</p>
        <div className="parameter-form">
          <label className="profile-field">
            <span>Streamable HTTP 地址</span>
            <input value={VESPER_MCP_URL} readOnly />
          </label>
          <label className="profile-field">
            <span>访问令牌</span>
            <input type="password" value={draft} autoCapitalize="none" autoCorrect="off" placeholder="留空时自动生成安全令牌" onChange={(event) => setDraft(event.target.value)} />
          </label>
        </div>
        <p className="settings-hint">令牌只保存在此设备和 MCP 服务的哈希值中；AI 官端连接时使用 Authorization: Bearer。</p>
        {message && <p className="connection-message">{message}</p>}
        {toolCount !== null && <p className="settings-hint">当前远程目录：{toolCount} 个 MCP tools</p>}
        <button className="save-profile" disabled={busy} onClick={() => void setup()}>{busy ? "配置中…" : token ? "更新并测试 MCP" : "生成令牌并启用 MCP"}</button>
        <button className="reset-background" disabled={busy || !draft.trim()} onClick={() => void testTools()}>测试 MCP tools</button>
        <button className="reset-background" disabled={!draft.trim()} onClick={() => void copy()}>复制 AI 官端连接参数</button>
      </section>
    </div>
  );
}

function CodexConnectionModal({ onClose }: { onClose: () => void }) {
  const [endpoint, setEndpoint] = useState(() => readLocalValue("vesper-codex-endpoint", "wss://codex.r-vera.com"));
  const [token, setToken] = useState(() => deviceToken());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const cleanEndpoint = endpoint.trim().replace(/\/$/, "");
    window.localStorage.setItem("vesper-codex-endpoint", cleanEndpoint);
    if (token.trim()) window.localStorage.setItem("vesper-device-token", token.trim());
    try {
      if (/^wss?:\/\//i.test(cleanEndpoint)) {
        await new Promise<void>((resolve, reject) => {
          const probe = new WebSocket(`${cleanEndpoint}${cleanEndpoint.includes("?") ? "&" : "?"}token=${encodeURIComponent(token.trim())}`);
          probe.onopen = () => { probe.close(); resolve(); };
          probe.onerror = () => reject(new Error("WebSocket endpoint is unreachable"));
        });
      } else {
        const url = cleanEndpoint || `${window.location.origin}/api/codex`;
        const response = await fetch(url, { headers: { "x-vesper-device-token": token.trim() }, cache: "no-store" });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
      }
      setMessage("Codex app-server is reachable. The chat uses this single connection.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not reach the app-server");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal ai-connection-modal">
        <div className="modal-head">
          <div><small>CODEX APP-SERVER</small><h2>One private connection</h2></div>
          <button onClick={onClose}><Icon name="close" /></button>
        </div>
        <p className="settings-hint">Your private Codex tunnel is preconfigured. Keep this endpoint as <code>wss://codex.r-vera.com</code> and enter your Vesper device token.</p>
        <label className="profile-field"><span>WebSocket endpoint (optional)</span><input value={endpoint} placeholder="wss://codex.example.com" onChange={(event) => setEndpoint(event.target.value)} /></label>
        <label className="profile-field"><span>Vesper device token</span><input type="password" value={token} placeholder="The VESPER_APP_TOKEN value" onChange={(event) => setToken(event.target.value)} /></label>
        {message && <p className="connection-message">{message}</p>}
        <button className="save-profile" disabled={busy} onClick={() => void save()}>{busy ? "Testing…" : "Save and test"}</button>
      </section>
    </div>
  );
}

type AiConnectionStore = {
  active: "api" | "mcp" | "cyberboss";
  api: Record<string, string>;
  mcp: Record<string, string>;
  cyberboss: Record<string, string>;
};

function AiConnectionModal({ onClose }: { onClose: () => void }) {
  const [stored, setStored] = useLocalDocument<AiConnectionStore>(
    "ai-connections-v1",
    { active: "api", api: {}, mcp: {}, cyberboss: {} },
  );
  const [active, setActive] = useState<AiConnectionStore["active"]>(stored.active);
  const [form, setForm] = useState<Record<string, string>>(() => stored[stored.active]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>(() => {
    try { return JSON.parse(stored.api.availableModels || "[]") as string[]; } catch { return []; }
  });
  const choices = [
    { id: "api" as const, label: "API Key", icon: "sparkles" },
    { id: "mcp" as const, label: "MCP", icon: "link" },
    { id: "cyberboss" as const, label: "CyberBoss", icon: "chat" },
  ];
  const fields: Record<AiConnectionStore["active"], Array<{ key: string; label: string; placeholder?: string; type?: string }>> = {
    api: [
      { key: "baseUrl", label: "API 地址", placeholder: "https://api.openai.com/v1" },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-…" },
    ],
    mcp: [
      { key: "url", label: "MCP 服务地址", placeholder: "https://…/mcp" },
      { key: "transport", label: "传输方式", placeholder: "Streamable HTTP / SSE" },
      { key: "token", label: "授权令牌", type: "password", placeholder: "Bearer token（可选）" },
      { key: "serverName", label: "服务名称", placeholder: "我的 MCP" },
      { key: "toolName", label: "对话工具名称", placeholder: "chat" },
    ],
    cyberboss: [
      { key: "endpoint", label: "运行端地址", placeholder: "https://api.vesper.r-vera.com" },
      { key: "deviceToken", label: "设备配对口令", type: "password", placeholder: "vsp_…" },
      { key: "runtime", label: "运行时名称", placeholder: "CyberBoss / Codex" },
      { key: "workspace", label: "工作区", placeholder: "/path/to/workspace（可选）" },
    ],
  };
  const switchChoice = (next: AiConnectionStore["active"]) => {
    setStored({ ...stored, [active]: form, active: next });
    setActive(next);
    setForm(stored[next] || {});
    setMessage("");
  };
  const fetchModels = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl: form.baseUrl, apiKey: form.apiKey }),
      });
      const result = await response.json() as { models?: string[]; error?: string };
      if (!response.ok) throw new Error(result.error || "获取模型失败");
      const available = result.models || [];
      setModels(available);
      setForm((current) => ({ ...current, availableModels: JSON.stringify(available), model: current.model || available[0] || "" }));
      setMessage(available.length ? `已获取 ${available.length} 个可用模型` : "接口没有返回可用模型");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "获取模型失败");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setMessage("");
    const next = { ...stored, [active]: form, active };
    setStored(next);
    if (active === "cyberboss" && form.deviceToken)
      window.localStorage.setItem("vesper-device-token", form.deviceToken.trim());
    try {
      if (active === "api") {
        if (!form.baseUrl || !form.apiKey || !form.model)
          throw new Error("请填写 Base URL、模型和 API Key");
        const response = await fetch("/api/ai/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseUrl: form.baseUrl, apiKey: form.apiKey }),
        });
        if (!response.ok) throw new Error(`API 返回 ${response.status}`);
      } else if (active === "mcp") {
        if (!form.url) throw new Error("请填写 MCP 服务地址");
        const response = await fetch("/api/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: form.url, token: form.token }),
        });
        const result = await response.json() as { toolCount?: number; error?: string };
        if (!response.ok) throw new Error(result.error || `MCP 返回 ${response.status}`);
        setMessage(`参数已保存，发现 ${result.toolCount || 0} 个 MCP tools`);
        return;
      } else {
        if (!form.deviceToken) throw new Error("请填写设备配对口令");
        const endpoint = (form.endpoint || VESPER_API_ORIGIN).replace(/\/$/, "");
        const response = await fetch(`${endpoint}/api/chat?conversationId=main`, {
          headers: { "x-vesper-device-token": form.deviceToken.trim() },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("配对口令或运行端地址无效");
      }
      setMessage("参数已保存，连接测试成功");
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? `参数已保存；${reason.message}`
          : "参数已保存，测试失败",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal ai-connection-modal">
        <div className="modal-head">
          <div><small>AI CONNECTION</small><h2>选择连接方式</h2></div>
          <button onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="ai-connection-tabs">
          {choices.map((choice) => (
            <button
              className={active === choice.id ? "active" : ""}
              key={choice.id}
              onClick={() => switchChoice(choice.id)}
            >
              <Icon name={choice.icon} />
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
        <div className="parameter-form">
          {active === "api" && (
            <label className="profile-field"><span>接口类型</span>
              <select value={form.provider || "OpenAI-compatible"} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
                <option value="OpenAI-compatible">OpenAI-compatible</option>
                <option value="Anthropic">Anthropic</option>
              </select>
            </label>
          )}
          {fields[active].map((field) => (
            <label className="profile-field" key={field.key}>
              <span>{field.label}</span>
              <input
                type={field.type || "text"}
                value={form[field.key] || ""}
                placeholder={field.placeholder || ""}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              />
            </label>
          ))}
          {active === "api" && (
            <>
              <button className="model-fetch-button" disabled={busy || !form.baseUrl || !form.apiKey} onClick={() => void fetchModels()}>
                {busy ? "正在读取…" : "读取这个 Key 的可用模型"}
              </button>
              <label className="profile-field"><span>当前模型</span>
                  <select value={form.model || ""} onChange={(event) => setForm({ ...form, model: event.target.value })}>
                    <option value="">先读取模型</option>
                    {form.model && !models.includes(form.model) && <option value={form.model}>{form.model}</option>}
                    {models.map((model) => <option value={model} key={model}>{model}</option>)}
                  </select>
                </label>
            </>
          )}
        </div>
        {message && <p className="connection-message">{message}</p>}
        <button className="save-profile" disabled={busy} onClick={() => void save()}>
          {busy ? "测试中…" : "保存并测试"}
        </button>
      </section>
    </div>
  );
}

function CyberbossConnectionModal({
  onPaired,
  onClose,
}: {
  onPaired: (value: boolean) => void;
  onClose: () => void;
}) {
  const [token, setToken] = useState(deviceToken);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    const value = token.trim();
    if (!value) {
      setMessage("请输入设备配对口令");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(apiUrl("/api/chat?conversationId=main"), {
        headers: { "x-vesper-device-token": value },
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      window.localStorage.setItem("vesper-device-token", value);
      onPaired(true);
      setMessage("设备已配对。启动 CyberBoss 后会自动上线。");
    } catch {
      setMessage("配对口令不正确");
    } finally {
      setBusy(false);
    }
  };
  const remove = () => {
    window.localStorage.removeItem("vesper-device-token");
    setToken("");
    onPaired(false);
    setMessage("已移除此设备的配对信息");
  };
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal">
        <div className="modal-head">
          <div>
            <small>CYBERBOSS BRIDGE</small>
            <h2>连接运行端</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="connection-symbol">
          <Icon name="chat" />
        </div>
        <p>
          Vesper 负责手机界面，CyberBoss 在你的电脑或服务器上运行 Codex /
          Claude、提醒、日记和主动关心。
        </p>
        <label className="bridge-token-field">
          <span>设备配对口令</span>
          <input
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="粘贴配对口令"
          />
        </label>
        {message && <p className="connection-message">{message}</p>}
        <button
          className="save-profile"
          disabled={busy}
          onClick={() => void verify()}
        >
          {busy ? "验证中…" : "验证并保存到此设备"}
        </button>
        {deviceToken() && (
          <button className="reset-background" onClick={remove}>
            移除此设备
          </button>
        )}
      </section>
    </div>
  );
}

function AppearanceModal({
  accent,
  onAccent,
  onBackground,
  onClose,
}: {
  accent: string;
  onAccent: (value: string) => void;
  onBackground: (value: string) => void;
  onClose: () => void;
}) {
  const [color, setColor] = useState("#e4e4e0");
  const accents = [
    ["石墨", "#4a4a48"],
    ["岩灰", "#6b6b68"],
    ["雾灰", "#878783"],
    ["浅灰", "#a3a39f"],
  ];
  const backgrounds = [
    ["暖白", "#f5f5f3"],
    ["纸灰", "#eeeeeb"],
    ["雾灰", "#e2e2df"],
  ];
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const preview = await localImage(file, 1600, 0.86);
    onBackground(
      `linear-gradient(rgba(245,247,247,.18),rgba(245,247,247,.18)),url("${preview}")`,
    );
    try {
      const { url } = await uploadImage(file);
      onBackground(`linear-gradient(rgba(245,247,247,.18),rgba(245,247,247,.18)),url("${url}")`);
    } catch {}
  };
  return (
    <div className="modal-layer appearance-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="appearance-modal">
        <div className="modal-head">
          <div>
            <small>APPEARANCE</small>
            <h2>外观</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="appearance-section">
          <div className="appearance-title">
            <b>主题色</b>
            <small>用于选中状态与细节高光</small>
          </div>
          <div className="accent-options">
            {accents.map(([name, value]) => (
              <button
                className={accent === value ? "selected" : ""}
                key={value}
                onClick={() => onAccent(value)}
              >
                <i style={{ background: value }} />
                <span>{name}</span>
                {accent === value && <em>✓</em>}
              </button>
            ))}
          </div>
        </div>
        <div className="appearance-section">
          <div className="appearance-title">
            <b>背景</b>
            <small>选择预设、导入图片或用颜色生成</small>
          </div>
          <div className="background-presets">
            {backgrounds.map(([name, value]) => (
              <button
                key={name}
                style={{ backgroundColor: value }}
                onClick={() => onBackground(value)}
              >
                <span>{name}</span>
              </button>
            ))}
          </div>
          <div className="appearance-tools">
            <label>
              <Icon name="upload" />
              <span>导入图片</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
            <div>
              <input
                aria-label="背景颜色"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <button
                onClick={() => onBackground(color)}
              >
                用颜色生成
              </button>
            </div>
          </div>
          <button className="reset-background" onClick={() => onBackground("")}>
            恢复暖白背景
          </button>
        </div>
        <button className="save-profile" onClick={onClose}>
          完成
        </button>
      </section>
    </div>
  );
}
function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-group">
      <h2>{title}</h2>
      <div className="surface">{children}</div>
    </section>
  );
}
function SettingRow({
  icon,
  title,
  sub,
  status,
  badge,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  status?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button className="setting-row" onClick={onClick}>
      <span className="setting-icon">
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      {status ? (
        <i className="connection-dot" />
      ) : badge ? (
        <em>{badge}</em>
      ) : (
        <Icon name="chevron" />
      )}
    </button>
  );
}

async function exportVesperData() {
  const local = Object.fromEntries(
    Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith("vesper-")))
      .map((key) => {
        const raw = window.localStorage.getItem(key) || "";
        try { return [key, JSON.parse(raw)]; } catch { return [key, raw]; }
      }),
  );
  let cloud: Record<string, unknown> | null = null;
  try {
    const response = await fetch(apiUrl("/api/state"), { cache: "no-store", headers: appHeaders() });
    if (response.ok) cloud = ((await response.json()) as { documents: Record<string, unknown> }).documents;
  } catch {}
  const blob = new Blob(
    [
      JSON.stringify(
        { exportedAt: new Date().toISOString(), version: 2, storageMode: "local-first", local, cloud },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vesper-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function FunctionalSettingsModal({
  type,
  preferences,
  onPreferences,
  onClose,
}: {
  type: string;
  preferences: VesperPreferences;
  onPreferences: (value: VesperPreferences) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const toggle = (
    key: keyof Pick<
      VesperPreferences,
      | "reminders"
      | "anniversaries"
      | "agentNotes"
      | "memoryDiary"
      | "memoryNotes"
      | "memoryChat"
    >,
  ) => onPreferences({ ...preferences, [key]: !preferences[key] });
  const doExport = async () => {
    try {
      await exportVesperData();
      onPreferences({ ...preferences, lastExportAt: new Date().toISOString() });
      setMessage("备份文件已生成");
    } catch {
      setMessage("导出失败，请稍后重试");
    }
  };
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal functional-modal">
        <div className="modal-head">
          <div>
            <small>SETTINGS</small>
            <h2>{type}</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {type === "通知偏好" && (
          <div className="preference-list">
            <PreferenceToggle
              label="提醒"
              detail="待办事项到期时通知"
              value={preferences.reminders}
              onChange={() => toggle("reminders")}
            />
            <PreferenceToggle
              label="纪念日"
              detail="重要日期临近时通知"
              value={preferences.anniversaries}
              onChange={() => toggle("anniversaries")}
            />
            <PreferenceToggle
              label="Agent 留言"
              detail="允许 Vesper 主动留下消息"
              value={preferences.agentNotes}
              onChange={() => toggle("agentNotes")}
            />
          </div>
        )}
        {type === "关心频率" && (
          <div className="choice-list">
            {(
              [
                ["daily", "每天一次"],
                ["twice-weekly", "每周两次"],
                ["off", "关闭"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={
                  preferences.careFrequency === value ? "selected" : ""
                }
                key={value}
                onClick={() =>
                  onPreferences({ ...preferences, careFrequency: value })
                }
              >
                <span>{label}</span>
                {preferences.careFrequency === value && <b>✓</b>}
              </button>
            ))}
          </div>
        )}
        {type === "记忆权限" && (
          <div className="preference-list">
            <PreferenceToggle
              label="日记"
              detail="允许 Agent 读取日记用于回忆"
              value={preferences.memoryDiary}
              onChange={() => toggle("memoryDiary")}
            />
            <PreferenceToggle
              label="便笺"
              detail="允许 Agent 整理与关联便笺"
              value={preferences.memoryNotes}
              onChange={() => toggle("memoryNotes")}
            />
            <PreferenceToggle
              label="聊天"
              detail="允许从对话中形成长期记忆"
              value={preferences.memoryChat}
              onChange={() => toggle("memoryChat")}
            />
          </div>
        )}
        {type === "导出与备份" && (
          <div className="export-panel">
            <Icon name="archive" />
            <h3>导出 Vesper 数据</h3>
            <p>
              Vesper 以当前设备为主存储，发布新版只替换程序和缓存，不会清空已填写的数据。
              导出文件会同时收录本地数据与可用的云端镜像。
            </p>
            <button className="save-profile" onClick={doExport}>
              下载备份文件
            </button>
            {message && <small>{message}</small>}
          </div>
        )}
        <button className="save-profile secondary-save" onClick={onClose}>
          完成
        </button>
      </section>
    </div>
  );
}

function PreferenceToggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button onClick={onChange}>
      <span>
        <b>{label}</b>
        <small>{detail}</small>
      </span>
      <i className={value ? "switch on" : "switch"}>
        <u />
      </i>
    </button>
  );
}

function VoiceSettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useLocalDocument<ConnectionSettings>("connections", {});
  const [form, setForm] = useState<Record<string, string>>(() => ({
    provider: "ElevenLabs",
    baseUrl: "https://api.elevenlabs.io",
    model: "eleven_multilingual_v2",
    speed: "1",
    autoPlay: "true",
    ...(settings["Agent 声音"] || {}),
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [micStatus, setMicStatus] = useState("尚未测试");
  const [apiStatus, setApiStatus] = useState("尚未测试");
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus("已授权");
    } catch { setMicStatus("未授权"); }
  };
  const testVoice = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "Vesper 声音连接成功。", connection: form }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "声音服务测试失败");
      }
      setSettings({ ...settings, "Agent 声音": form });
      setApiStatus("可调用");
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setMessage("参数已保存并完成试听");
    } catch (reason) {
      setApiStatus("调用失败");
      setMessage(reason instanceof Error ? reason.message : "声音服务测试失败");
    } finally { setBusy(false); }
  };
  const eleven = /eleven/i.test(form.provider || "");
  return (
    <div className="modal-layer settings-subpage-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal voice-settings-modal">
        <div className="modal-head"><button className="settings-back" aria-label="返回" onClick={onClose}><Icon name="chevron" /></button><div><small>VOICE</small><h2>语音</h2></div></div>
        <div className="parameter-form">
          <label className="profile-field"><span>声音服务</span><select value={form.provider} onChange={(event) => {
            const provider = event.target.value;
            const minimax = provider === "MiniMax";
            setForm((current) => ({ ...current, provider, baseUrl: provider === "ElevenLabs" ? "https://api.elevenlabs.io" : minimax ? "https://api.minimax.chat" : "https://api.openai.com/v1", model: provider === "ElevenLabs" ? "eleven_multilingual_v2" : minimax ? "speech-2.6-hd" : "gpt-4o-mini-tts" }));
          }}><option>ElevenLabs</option><option>MiniMax</option><option>OpenAI-compatible</option></select></label>
          <label className="profile-field"><span>API Base URL</span><input value={form.baseUrl || ""} onChange={(event) => update("baseUrl", event.target.value)} /></label>
          <label className="profile-field"><span>{eleven ? "ElevenLabs API Key" : "API Key"}</span><input type="password" value={form.apiKey || ""} onChange={(event) => update("apiKey", event.target.value)} /></label>
          <label className="profile-field"><span>{eleven ? "ElevenLabs Voice ID" : "声音 ID"}</span><input value={form.voiceId || ""} placeholder={form.provider === "MiniMax" ? "male-qn-qingse" : "alloy / 自定义声音 ID"} onChange={(event) => update("voiceId", event.target.value)} /></label>
          {form.provider === "MiniMax" && <label className="profile-field"><span>MiniMax Group ID（可选）</span><input value={form.groupId || ""} onChange={(event) => update("groupId", event.target.value)} /></label>}
          <label className="profile-field"><span>{eleven ? "ElevenLabs 模型" : "TTS 模型"}</span><input value={form.model || ""} onChange={(event) => update("model", event.target.value)} /></label>
          <label className="voice-speed"><span>语速 {Number(form.speed || 1).toFixed(1)}×</span><input type="range" min="0.7" max="1.3" step="0.1" value={form.speed || "1"} onChange={(event) => update("speed", event.target.value)} /></label>
          <button className="voice-autoplay" onClick={() => update("autoPlay", form.autoPlay === "false" ? "true" : "false")}><i className={form.autoPlay === "false" ? "switch" : "switch on"}><u /></i><span><b>语音消息自动播放</b><small>收到语音消息时直接响，不用点</small></span></button>
        </div>
        <button className="save-profile" disabled={busy} onClick={() => void testVoice()}>{busy ? "试听中…" : "试听"}</button>
        <section className="voice-test-panel"><div><b>语音测试</b><button onClick={() => void Promise.all([requestMic(), testVoice()])}>全部测试</button></div><p><span>1　麦克风权限</span><em><i className={micStatus === "已授权" ? "voice-status-dot ok" : "voice-status-dot"} />{micStatus}</em><button onClick={() => void requestMic()}>请求权限</button></p><p><span>2　声音服务可否调用</span><em><i className={apiStatus === "可调用" ? "voice-status-dot ok" : "voice-status-dot"} />{apiStatus}</em></p><p><span>3　当前打开界面</span><em><i className="voice-status-dot ok" />{window.matchMedia("(display-mode: standalone)").matches ? "iPhone 主屏幕 PWA" : "浏览器"}</em></p></section>
        {message && <p className="connection-message">{message}</p>}
      </section>
    </div>
  );
}

function ConnectionModal({
  type,
  environment,
  onEnvironment,
  onNotificationPermission,
  onClose,
}: {
  type: string;
  environment: EnvironmentSnapshot;
  onEnvironment: (value: EnvironmentSnapshot) => void;
  onNotificationPermission: (value: NotificationPermission) => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useLocalDocument<ConnectionSettings>(
    "connections",
    {},
  );
  const [form, setForm] = useState<Record<string, string>>(
    () => settings[type] || {},
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const definitions: Record<
    string,
    { label: string; key: string; type?: string; placeholder?: string }[]
  > = {
    "AI 连接": [
      {
        label: "服务商",
        key: "provider",
        placeholder: "OpenAI / Anthropic / 自定义",
      },
      {
        label: "API Base URL",
        key: "baseUrl",
        placeholder: "https://api.openai.com/v1",
      },
      { label: "模型", key: "model", placeholder: "模型 ID" },
      { label: "API Key", key: "apiKey", type: "password" },
    ],
    "Agent 声音": [
      { label: "TTS 服务商", key: "provider", placeholder: "OpenAI / ElevenLabs / 兼容服务" },
      { label: "API Base URL", key: "baseUrl", placeholder: "https://api.openai.com/v1" },
      { label: "完整请求地址（可选）", key: "endpoint", placeholder: "服务不兼容标准接口时填写" },
      { label: "模型", key: "model", placeholder: "gpt-4o-mini-tts" },
      { label: "声音 ID", key: "voiceId", placeholder: "alloy / 自定义声音 ID" },
      { label: "API Key", key: "apiKey", type: "password" },
    ],
    "MCP 服务": [
      { label: "MCP 服务地址", key: "url", placeholder: "https://…" },
      { label: "授权令牌", key: "token", type: "password" },
    ],
    "Web Push": [],
  };
  const fields = definitions[type] || [];
  const save = () => {
    setSettings({ ...settings, [type]: form });
    setMessage("参数已保存在此设备");
  };
  const test = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (type === "AI 连接") {
        const base = (form.baseUrl || "").replace(/\/$/, "");
        if (!base || !form.apiKey)
          throw new Error("请填写 Base URL 和 API Key");
        const response = await fetch(`${base}/models`, {
          headers: { authorization: `Bearer ${form.apiKey}` },
        });
        if (!response.ok) throw new Error(`连接失败（${response.status}）`);
      } else if (type === "MCP 服务") {
        if (!form.url) throw new Error("请填写 MCP 服务地址");
        const response = await fetch(form.url, {
          headers: form.token
            ? { authorization: `Bearer ${form.token}` }
            : undefined,
        });
        if (!response.ok) throw new Error(`连接失败（${response.status}）`);
      } else if (type === "Agent 声音") {
        if (!form.baseUrl || !form.apiKey)
          throw new Error("请填写 TTS Base URL 和 API Key");
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Vesper 声音连接成功。", connection: form }),
        });
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error || "TTS 测试失败");
        }
        await new Audio(URL.createObjectURL(await response.blob())).play();
      } else if (type === "Web Push") {
        if (!window.matchMedia("(display-mode: standalone)").matches && /iPhone|iPad|iPod/.test(navigator.userAgent))
          throw new Error("iPhone 需要先将 Vesper 添加到主屏幕，再从 PWA 内启用推送");
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const configResponse = await fetch(apiUrl("/api/push"));
        const config = (await configResponse.json()) as { configured?: boolean; publicKey?: string };
        if (!configResponse.ok || !config.configured || !config.publicKey)
          throw new Error("推送服务端尚未完成配置");
        const result = await subscribe(config.publicKey);
        if (result.status === "denied") {
          onNotificationPermission("denied");
          throw new Error("通知权限未授权");
        }
        if (result.status === "unsupported") throw new Error("当前环境不支持 Web Push");
        onNotificationPermission("granted");
        const subscription = serializeSubscription(result.subscription);
        const response = await fetch(apiUrl("/api/push"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "test", subscription }),
        });
        if (!response.ok) throw new Error("订阅已建立，但服务端测试推送失败");
      }
      save();
      setMessage("连接测试成功");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("当前浏览器不支持定位");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude,
          longitude = position.coords.longitude;
        try {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`,
          );
          const data = (await response.json()) as {
            timezone?: string;
            current?: { temperature_2m?: number; weather_code?: number };
          };
          onEnvironment({
            permission: "granted",
            latitude,
            longitude,
            temperature: data.current?.temperature_2m,
            weatherCode: data.current?.weather_code,
            timezone: data.timezone,
            updatedAt: new Date().toISOString(),
          });
          setMessage("定位与天气已更新");
        } catch {
          onEnvironment({
            permission: "granted",
            latitude,
            longitude,
            updatedAt: new Date().toISOString(),
            error: "天气获取失败",
          });
          setMessage("定位成功，天气获取失败");
        } finally {
          setBusy(false);
        }
      },
      (error) => {
        onEnvironment({ permission: "denied", error: error.message });
        setMessage(error.message);
        setBusy(false);
      },
      { timeout: 12000, maximumAge: 600000 },
    );
  };
  const isLocation = type === "定位与环境";
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal">
        <div className="modal-head">
          <div>
            <small>CONNECTION</small>
            <h2>{type}</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {isLocation ? (
          <div className="connection-fields">
            <div className="connection-field">
              <span>
                {environment.latitude
                  ? `${environment.latitude.toFixed(4)}, ${environment.longitude?.toFixed(4)}`
                  : "尚未定位"}
              </span>
            </div>
          </div>
        ) : (
          <div className="parameter-form">
            {type === "Web Push" && (
              <p className="settings-hint">Vesper 会自动使用 Cloudflare 推送服务。授权后将发送一条真实测试通知，不需要手工填写 VAPID 参数。</p>
            )}
            {fields.map((field) => (
              <label className="profile-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  type={field.type || "text"}
                  value={form[field.key] || ""}
                  placeholder={field.placeholder || ""}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(event) =>
                    setForm({ ...form, [field.key]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
        )}
        {message && <p className="connection-message">{message}</p>}
        <button
          className="save-profile"
          disabled={busy}
          onClick={isLocation ? locate : () => void test()}
        >
          {busy
            ? "处理中…"
            : isLocation
              ? "获取定位与天气"
              : type === "Agent 声音"
                ? "保存参数"
                : "保存并测试"}
        </button>
      </section>
    </div>
  );
}

function formatPlaybackTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value) % 60).padStart(2, "0")}`;
}
function useTogetherDuration(state: MusicTogetherState) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.status !== "connected") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.status]);
  const carried = Number.isFinite(state.totalListeningSeconds) ? Math.max(0, Number(state.totalListeningSeconds)) : 0;
  const started = Date.parse(state.sessionStartedAt || "");
  const session = state.status === "connected" && Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : 0;
  return Math.floor(carried + session);
}

function togetherTimeLabel(state: MusicTogetherState, totalSeconds: number) {
  if (state.status === "connected") return `一起听了 ${Math.floor(totalSeconds / 3600)} 小时 ${Math.floor(totalSeconds % 3600 / 60)} 分钟`;
  if (state.status === "invited") return "一起听邀请已发出";
  if (state.status === "offline") return "对方暂时离线";
  return "尚未开始一起听";
}

function MusicPlayerUI({
  queue, onQueue, selected, onTracks, playMode, onCycleMode, toast, adapter,
  userName, agentName, userAvatar, agentAvatar, together, onInvite,
  onRemoveQueueItem, playlistIntent, onPlaylistIntentConsumed,
}: {
  queue: Track[];
  onQueue: (value: Track[], options?: MusicQueueUpdate) => void;
  selected: number;
  onTracks: (value: Track[]) => void;
  playMode: MusicPlayMode;
  onCycleMode: () => void;
  toast: string;
  adapter: PlayerAdapter;
  userName: string;
  agentName: string;
  userAvatar: string;
  agentAvatar: string;
  together: MusicTogetherState;
  onInvite: () => void;
  onRemoveQueueItem: (index: number) => void;
  playlistIntent: MusicPlaylistIntent | null;
  onPlaylistIntentConsumed: () => void;
}) {
  const track = queue[selected];
  const state = adapter.getState();
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueDragY, setQueueDragY] = useState(0);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pendingPlaylistTrack, setPendingPlaylistTrack] = useState<MusicPlaylistIntent | null>(null);
  const queueDragStart = useRef<number | null>(null);
  const queueListRef = useRef<HTMLDivElement>(null);
  const canSeek = state.canSeek;
  const displayedTime = scrubValue ?? state.currentTime;
  const modeLabels: Record<MusicPlayMode, string> = { order: "顺序播放", repeat: "列表循环", single: "单曲循环", random: "随机播放" };
  const modeIcons: Record<MusicPlayMode, string> = { order: "menu", repeat: "repeat", single: "one", random: "shuffle" };
  const totalTogetherSeconds = useTogetherDuration(together);
  const playbackProgress = canSeek ? `${Math.max(0, Math.min(100, displayedTime / Math.max(state.duration, 1) * 100))}%` : "0%";
  const roomStyle = { "--music-tint": "99, 99, 96", "--music-on-tint": "17, 17, 17", "--playback-progress": playbackProgress } as CSSProperties;

  useEffect(() => {
    const openQueue = () => setQueueOpen(true);
    window.addEventListener("vesper-music-open-queue", openQueue);
    return () => window.removeEventListener("vesper-music-open-queue", openQueue);
  }, []);
  useEffect(() => {
    if (!queueOpen) return;
    const frame = window.requestAnimationFrame(() => {
      queueListRef.current?.querySelector<HTMLElement>("article.active")?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [queueOpen, selected, queue.length]);
  useEffect(() => {
    if (!playlistIntent) return;
    setPendingPlaylistTrack(playlistIntent);
    setLibraryOpen(true);
    onPlaylistIntentConsumed();
  }, [onPlaylistIntentConsumed, playlistIntent]);
  const commitSeek = () => {
    if (scrubValue != null) adapter.seek(scrubValue);
    setScrubValue(null);
  };
  return <div className="page-body listening-player" style={roomStyle}>
    <section className="listening-player-main">
      <div className="listening-library-bar"><button onClick={() => setLibraryOpen(true)}><Icon name="library" /><span>我的音乐</span></button></div>
      <button className="listening-together" onClick={together.status === "connected" ? undefined : onInvite} aria-label={together.status === "connected" ? `${agentName} 与 ${userName} 正在一起听` : "邀请一起听"}>
        <span className="listening-avatars"><AvatarMark src={userAvatar} label={userName} kind="user" /><i /><AvatarMark src={agentAvatar} label={agentName} kind="agent" /></span>
        <span>{togetherTimeLabel(together, totalTogetherSeconds)}</span>
      </button>
      {track ? <>
        <section className="listening-disc-stage" aria-label={`正在播放：${track.title}`}>
          <div className={state.playing ? "sound-halo is-playing" : "sound-halo"}>
            <div className="listening-disc">{track.cover ? <img src={track.cover} alt={`${track.title} 封面`} /> : <span>V</span>}</div>
          </div>
        </section>
        <section className="listening-track-copy"><h2>{track.title}</h2><p>{track.artist || "未知歌手"}{track.album ? ` · ${track.album}` : ""}</p></section>
        <section className="listening-progress" aria-label="播放进度"><input aria-label="播放进度" type="range" min="0" max={Math.max(state.duration, 1)} step="0.1" disabled={!canSeek} value={Math.min(displayedTime, Math.max(state.duration, 1))} onChange={(event) => setScrubValue(Number(event.target.value))} onPointerUp={commitSeek} onKeyUp={commitSeek} /><div><span>{canSeek ? formatPlaybackTime(displayedTime) : "--:--"}</span><span>{canSeek ? formatPlaybackTime(state.duration) : "--:--"}</span></div></section>
        <section className="listening-controls"><button className="listening-mode" aria-label={modeLabels[playMode]} title={modeLabels[playMode]} onClick={onCycleMode}><Icon name={modeIcons[playMode]} /></button><button aria-label="上一首" onClick={adapter.previous}><Icon name="back" /></button><button className="listening-play" aria-label={state.playing ? "暂停" : "播放"} onClick={adapter.toggle}><Icon name={state.playing ? "pause" : "play"} /></button><button aria-label="下一首" onClick={adapter.next}><Icon name="forward" /></button><button className="listening-queue-button" aria-label="打开播放队列" onClick={() => setQueueOpen(true)}><Icon name="queue" /><em>{queue.length}</em></button></section>
      </> : <section className="listening-empty"><Icon name="music" /><h2>还没有播放队列</h2><p>在我的音乐中连接网易云账号，选择歌单或搜索歌曲后即可播放。</p><button onClick={() => setLibraryOpen(true)}>打开我的音乐</button></section>}
    </section>
    {toast && <div className="music-toast" role="status">{toast}</div>}
    {queueOpen && <div className="music-queue-layer"><button className="music-queue-scrim" aria-label="关闭播放队列" onClick={() => setQueueOpen(false)} /><section className="music-queue-sheet" style={{ transform: `translateY(${queueDragY}px)` }}><div className="music-queue-drag-handle" onTouchStart={(event) => { queueDragStart.current = event.touches[0]?.clientY ?? null; }} onTouchMove={(event) => { const start = queueDragStart.current; const current = event.touches[0]?.clientY; if (start != null && current != null && current > start) setQueueDragY(Math.min(240, current - start)); }} onTouchEnd={() => { if (queueDragY > 88) setQueueOpen(false); setQueueDragY(0); queueDragStart.current = null; }} /><header><div><small>正在播放队列</small><h2>{queue.length} 首歌曲</h2></div><div><button className="queue-sync-action" onClick={() => { setQueueOpen(false); setLibraryOpen(true); }}>我的音乐</button><button aria-label="关闭播放队列" onClick={() => setQueueOpen(false)}><Icon name="close" /></button></div></header><div className="music-queue-list" ref={queueListRef}>{queue.length ? queue.map((item, index) => <article className={selected === index ? "active" : ""} key={item.id}><button className="music-queue-track" onClick={() => { adapter.select(index); setQueueOpen(false); }}>{item.cover ? <img src={item.cover} alt="" /> : <span>{index + 1}</span>}<div><b>{item.title}</b><small>{item.artist || "未知歌手"}</small></div><time>{item.duration || "--:--"}</time>{selected === index && <i className="music-queue-eq" aria-label="正在播放" />}</button><button className="music-queue-remove" aria-label={`移除 ${item.title}`} onClick={() => onRemoveQueueItem(index)}><Icon name="close" /></button></article>) : <EmptyState text="播放队列为空。" />}</div></section></div>}
    {libraryOpen && <NeteaseMusicLibrary onClose={() => { setLibraryOpen(false); setPendingPlaylistTrack(null); }} queue={queue} onQueue={onQueue} onTracks={onTracks} pendingPlaylistTrack={pendingPlaylistTrack} onPendingPlaylistTrackHandled={() => setPendingPlaylistTrack(null)} />}
  </div>;
}

function NeteaseMusicLibrary({
  onClose,
  queue,
  onQueue,
  onTracks,
  pendingPlaylistTrack,
  onPendingPlaylistTrackHandled,
}: {
  onClose: () => void;
  queue: Track[];
  onQueue: (value: Track[], options?: MusicQueueUpdate) => void;
  onTracks: (value: Track[]) => void;
  pendingPlaylistTrack: MusicPlaylistIntent | null;
  onPendingPlaylistTrackHandled: () => void;
}) {
  const [meta, setMeta] = useLocalDocument<Record<string, string>>("music-connection-meta", {});
  const [savedMusicCookie, setSavedMusicCookie] = useLocalDocument("netease-music-u", "");
  const [account, setAccount] = useState({ uid: meta.uid || "", cookie: savedMusicCookie });
  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [accountOpen, setAccountOpen] = useState(!meta.uid || !savedMusicCookie);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; trackCount?: number; cover?: string; description?: string }>>([]);
  const [collection, setCollection] = useState<MusicLibraryResult | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false);
  const [activeNeteasePlaylistId, setActiveNeteasePlaylistId] = useState("");
  const isConnected = Boolean(account.uid.trim() && account.cookie.trim());

  const invoke = async (
    action: Parameters<typeof requestNeteaseLibrary>[2]["action"],
    payload: Omit<Parameters<typeof requestNeteaseLibrary>[2], "action" | "uid" | "cookie"> = {},
  ) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await requestNeteaseLibrary(apiUrl("/api/music/library"), appHeaders(true), {
        action,
        uid: account.uid.trim(),
        cookie: account.cookie.trim(),
        ...payload,
      });
      return result;
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "网易云音乐服务暂时不可用";
      const normalized = detail.trim();
      setMessage(
        /^(load failed|failed to fetch|networkerror)$/i.test(normalized)
          ? "暂时无法连接音乐服务，请稍后重试。"
          : normalized === "Device not paired"
            ? "请先在 Vesper 设置中连接这台设备，再使用网易云音乐。"
            : detail,
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!isConnected) {
      setMessage("请填写网易云 UID 和 MUSIC_U");
      return;
    }
    setSavedMusicCookie(account.cookie.trim());
    setMeta((current) => ({ ...current, uid: account.uid.trim() }));
    const result = await invoke("playlists");
    if (!result) return;
    setPlaylists(result.playlists || []);
    setAccountOpen(false);
    setMessage(result.summary || "已连接网易云音乐");
  };

  const showCollection = async (
    action: Parameters<typeof requestNeteaseLibrary>[2]["action"],
    payload: Omit<Parameters<typeof requestNeteaseLibrary>[2], "action" | "uid" | "cookie"> = {},
  ) => {
    const result = await invoke(action, payload);
    if (result) {
      setCollection(result);
      setActiveNeteasePlaylistId(action === "playlist" ? String((payload as { playlistId?: string }).playlistId || "") : "");
      // Choosing a remote collection means choosing the active listening list.
      // Search remains non-destructive, but recommendations and playlist-like
      // sources replace the queue in their returned order without auto-playing.
      if (["playlist", "recommendations", "personal-fm", "recent-plays", "play-history", "liked-songs"].includes(action)) {
        await prepareTracks((result.tracks || []) as Track[], true);
      }
    }
  };

  const searchSongs = async () => {
    const query = search.trim();
    if (!query) {
      setMessage("请输入歌名、歌手或专辑");
      return;
    }
    setTab("discover");
    await showCollection("search", { query, limit: 30 });
  };

  async function prepareTracks(tracks: Track[], replaceQueue = false, autoplay = false) {
    const songIds = tracks.map((track) => track.neteaseId || track.id.replace(/^netease-/, "")).filter(Boolean);
    if (!songIds.length) return;
    const result = await invoke("resolve", { songIds, tracks });
    const resolved = (result?.tracks || []) as Track[];
    if (!resolved.length) return;
    onTracks(resolved);
    const seen = new Set<string>();
    const nextQueue = (replaceQueue ? resolved : [...queue, ...resolved]).filter((track) => {
      const key = track.neteaseId || track.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    onQueue(nextQueue, { autoplay, trackId: resolved[0]?.id });
    setMessage(replaceQueue ? `已同步 ${resolved.length} 首歌曲到当前播放列表` : result?.summary || `已加入 ${resolved.length} 首歌曲`);
  }

  const updateRemotePlaylist = async (action: "playlist-add" | "playlist-remove", playlistId: string, track: MusicPlaylistIntent | Track) => {
    if (!isConnected) {
      setMessage("请先连接网易云账号");
      return;
    }
    const neteaseId = track.neteaseId || track.id.replace(/^netease-/, "");
    const target = playlists.find((playlist) => playlist.id === playlistId);
    const verb = action === "playlist-add" ? "加入" : "移除";
    if (!window.confirm(`确定将《${track.title}》${verb}${target?.name || "这个网易云歌单"}吗？`)) return;
    const result = await invoke(action, { playlistId, songIds: [neteaseId] });
    if (!result) return;
    setMessage(result.summary || `已${verb}歌单`);
    if (action === "playlist-add") {
      setPlaylistPickerOpen(false);
      onPendingPlaylistTrackHandled();
    } else {
      setCollection((current) => current ? { ...current, tracks: (current.tracks || []).filter((item) => (item.neteaseId || item.id.replace(/^netease-/, "")) !== neteaseId) } : current);
    }
  };

  const contentTracks = (collection?.tracks || []) as Track[];
  return <div className="netease-library-layer" role="dialog" aria-modal="true" aria-label="网易云音乐">
    <section className="netease-library-sheet">
      <header className="netease-library-head">
        <button onClick={onClose} aria-label="关闭我的音乐"><Icon name="chevron" /></button>
        <div><small>NETEASE MUSIC</small><h2>网易云音乐</h2></div>
        <button className={busy ? "is-busy" : ""} disabled={busy} onClick={() => { if (tab === "mine") void connect(); else void searchSongs(); }} aria-label="刷新"><Icon name="repeat" /></button>
      </header>
      <nav className="netease-library-tabs" aria-label="音乐分类">
        <button className={tab === "mine" ? "active" : ""} onClick={() => { setTab("mine"); setCollection(null); }}>我的</button>
        <button className={tab === "discover" ? "active" : ""} onClick={() => { setTab("discover"); setCollection(null); }}>发现</button>
      </nav>
      <main className="netease-library-content">
        {collection ? <section className="netease-collection">
          <div className="netease-collection-head"><button onClick={() => setCollection(null)} aria-label="返回"><Icon name="chevron" /></button><div><small>{collection.subtitle || "网易云音乐"}</small><h3>{collection.title || "歌曲"}</h3></div><button disabled={busy || !contentTracks.length} onClick={() => void prepareTracks(contentTracks, true, true)}>播放全部</button></div>
          {contentTracks.length ? <div className="netease-track-list">{contentTracks.map((track, index) => <article className={activeNeteasePlaylistId ? "is-remote-playlist" : ""} key={`${track.id}-${index}`}><button className="netease-track-main" onClick={() => void prepareTracks([track], false, true)}>{track.cover ? <img src={track.cover} alt="" /> : <span>{index + 1}</span>}<div><b>{track.title}</b><small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small></div><time>{track.duration || "--:--"}</time></button><button className="netease-track-more" onClick={() => void prepareTracks([track])} aria-label={`加入 ${track.title} 到播放队列`}><Icon name="plus" /></button>{activeNeteasePlaylistId && <button className="netease-track-remove" onClick={() => void updateRemotePlaylist("playlist-remove", activeNeteasePlaylistId, track)} aria-label={`从网易云歌单移除 ${track.title}`}><Icon name="trash" /></button>}</article>)}</div> : <div className="netease-library-empty"><Icon name="music" /><p>这里还没有可展示的歌曲。</p></div>}
          {collection.lyrics && <pre className="netease-lyrics">{collection.lyrics}</pre>}
        </section> : tab === "mine" ? <>
          <section className={accountOpen ? "netease-account-card open" : "netease-account-card"}>
            <button className="netease-account-toggle" onClick={() => setAccountOpen((value) => !value)}><span><i className={isConnected ? "connected" : ""} />{isConnected ? "网易云账号已连接" : "连接网易云账号"}</span><Icon name="chevron" /></button>
            {accountOpen && <div className="netease-account-fields"><label><span>网易云 UID</span><input inputMode="numeric" autoComplete="off" value={account.uid} placeholder="例如 123456789" onChange={(event) => setAccount({ ...account, uid: event.target.value })} /></label><label><span>MUSIC_U</span><input type="password" autoComplete="off" value={account.cookie} placeholder="仅保存在此设备" onChange={(event) => setAccount({ ...account, cookie: event.target.value })} /></label><button disabled={busy} onClick={() => void connect()}>{busy ? "连接中…" : "连接并读取歌单"}</button></div>}
          </section>
          {pendingPlaylistTrack && <section className="netease-pending-playlist"><div><small>FROM CHAT</small><b>{pendingPlaylistTrack.title}</b><span>{pendingPlaylistTrack.artist || "未知歌手"}</span></div>{!isConnected ? <button onClick={() => setAccountOpen(true)}>先连接账号</button> : !playlists.length ? <button disabled={busy} onClick={() => void connect()}>读取歌单</button> : <button onClick={() => setPlaylistPickerOpen((value) => !value)}>加入歌单</button>}{playlistPickerOpen && <div className="netease-playlist-picker">{playlists.map((playlist) => <button key={playlist.id} disabled={busy} onClick={() => void updateRemotePlaylist("playlist-add", playlist.id, pendingPlaylistTrack)}><span>{playlist.name}</span><small>{playlist.trackCount || 0} 首</small></button>)}</div>}<button className="netease-pending-dismiss" onClick={onPendingPlaylistTrackHandled}>取消</button></section>}
          <section className="netease-shortcuts"><button disabled={busy || !isConnected} onClick={() => void showCollection("recommendations")}><Icon name="sparkles" /><span>每日推荐</span></button><button disabled={busy || !isConnected} onClick={() => void showCollection("personal-fm")}><Icon name="music" /><span>私人 FM</span></button><button disabled={busy || !isConnected} onClick={() => void showCollection("recent-plays")}><Icon name="repeat" /><span>最近播放</span></button><button disabled={busy || !isConnected} onClick={() => void showCollection("liked-songs")}><Icon name="heart" /><span>我喜欢的</span></button></section>
          <section className="netease-playlists"><div className="netease-section-heading"><div><small>MY PLAYLISTS</small><h3>我的歌单</h3></div><button disabled={busy || !isConnected} onClick={() => void connect()}>刷新</button></div>{playlists.length ? <div className="netease-playlist-list">{playlists.map((playlist) => <button key={playlist.id} onClick={() => void showCollection("playlist", { playlistId: playlist.id })}>{playlist.cover ? <img src={playlist.cover} alt="" /> : <span><Icon name="music" /></span>}<div><b>{playlist.name}</b><small>{playlist.trackCount || 0} 首歌曲{playlist.description ? ` · ${playlist.description}` : ""}</small></div><Icon name="chevron" /></button>)}</div> : <div className="netease-library-empty"><Icon name="library" /><p>{isConnected ? "点击刷新读取你的歌单。" : "连接账号后查看你的歌单、红心和播放记录。"}</p></div>}</section>
        </> : <>
          <form className="netease-search" onSubmit={(event) => { event.preventDefault(); void searchSongs(); }}><Icon name="search" /><input value={search} placeholder="搜索歌曲、歌手或专辑" onChange={(event) => setSearch(event.target.value)} /><button disabled={busy} type="submit">搜索</button></form>
          <section className="netease-discover-intro"><small>DISCOVER</small><h3>听见此刻想听的歌</h3><p>搜索任意歌曲，或连接账号后查看每日推荐、私人 FM 和本周常听。</p></section>
          <section className="netease-discover-actions"><button disabled={busy || !isConnected} onClick={() => void showCollection("recommendations")}><b>每日推荐</b><span>今天的 30 首专属歌曲</span></button><button disabled={busy || !isConnected} onClick={() => void showCollection("play-history")}><b>本周常听</b><span>回到最近循环的旋律</span></button></section>
        </>}
        {message && <p className="netease-library-message" role="status">{message}</p>}
      </main>
    </section>
  </div>;
}

type MemoryLibraryRecord = {
  id: string;
  type: "core" | "long_term" | "feeling" | "dream";
  body: string;
  mood: string;
  tags: string[];
  weight: number;
  pinned: boolean;
  source: string;
  reviewStatus: "approved" | "candidate";
  createdAt: string;
  updatedAt: string;
  lastSurfacedAt: string | null;
  surfaceCount: number;
  demotedAt: string | null;
};
type MemoryLibraryDetail = {
  memory: MemoryLibraryRecord;
  revisions: Array<{ id: string; body: string; mood: string; tags: string[]; reason: string; action: string; createdAt: string }>;
};
const memoryTypeLabel: Record<MemoryLibraryRecord["type"], string> = {
  core: "核心记忆",
  long_term: "长期记忆",
  feeling: "感受",
  dream: "梦",
};

function MemoryLibrary() {
  const [memories, setMemories] = useState<MemoryLibraryRecord[]>([]);
  const [filter, setFilter] = useState<"all" | MemoryLibraryRecord["type"]>("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [showDemoted, setShowDemoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<MemoryLibraryDetail | null>(null);
  const [addingCore, setAddingCore] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [coreDraft, setCoreDraft] = useState({ body: "", mood: "", tags: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeCandidates: "1" });
      if (filter !== "all") params.set("type", filter);
      if (appliedQuery.trim()) params.set("q", appliedQuery.trim());
      if (showDemoted) params.set("includeDemoted", "1");
      const response = await fetch(apiUrl("/api/memory?" + params.toString()), { headers: appHeaders(), cache: "no-store" });
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as { memories?: MemoryLibraryRecord[]; error?: string }
        : {};
      if (!response.ok) throw new Error(payload.error || "记忆暂时无法读取");
      setMemories(payload.memories || []);
      setMessage("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "记忆暂时无法读取");
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, filter, showDemoted]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openMemory = async (id: string) => {
    try {
      const response = await fetch(apiUrl("/api/memory?id=" + encodeURIComponent(id)), { headers: appHeaders(), cache: "no-store" });
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as MemoryLibraryDetail & { error?: string }
        : {} as MemoryLibraryDetail & { error?: string };
      if (!response.ok || !payload.memory) throw new Error(payload.error || "记忆详情暂时无法读取");
      setDetail(payload);
      setCorrecting(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "记忆详情暂时无法读取");
    }
  };

  const change = async (id: string, action: "pin" | "demote" | "restore" | "approve_core", pinned?: boolean) => {
    try {
      const response = await fetch(apiUrl("/api/memory"), {
        method: "PATCH", headers: appHeaders(true), cache: "no-store",
        body: JSON.stringify({ id, action, pinned }),
      });
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as MemoryLibraryDetail & { error?: string }
        : {} as MemoryLibraryDetail & { error?: string };
      if (!response.ok) throw new Error(payload.error || "记忆没有更新");
      if (payload.memory) setDetail(payload);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "记忆没有更新");
    }
  };

  const addCore = async () => {
    try {
      const response = await fetch(apiUrl("/api/memory"), {
        method: "POST", headers: appHeaders(true), cache: "no-store",
        body: JSON.stringify({ action: "create_core", body: coreDraft.body, mood: coreDraft.mood, tags: coreDraft.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean) }),
      });
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as { error?: string }
        : {} as { error?: string };
      if (!response.ok) throw new Error(payload.error || "核心记忆没有保存");
      setAddingCore(false);
      setCoreDraft({ body: "", mood: "", tags: "", reason: "" });
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "核心记忆没有保存");
    }
  };

  const correctCore = async () => {
    if (!detail) return;
    try {
      const response = await fetch(apiUrl("/api/memory"), {
        method: "PATCH", headers: appHeaders(true), cache: "no-store",
        body: JSON.stringify({
          id: detail.memory.id, action: "correct_core", body: coreDraft.body, mood: coreDraft.mood,
          tags: coreDraft.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean), reason: coreDraft.reason,
        }),
      });
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as MemoryLibraryDetail & { error?: string }
        : {} as MemoryLibraryDetail & { error?: string };
      if (!response.ok || !payload.memory) throw new Error(payload.error || "修正没有保存");
      setDetail(payload);
      setCorrecting(false);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "修正没有保存");
    }
  };

  const groups = (["core", "long_term", "feeling", "dream"] as const).map((type) => ({
    type,
    label: memoryTypeLabel[type],
    items: memories.filter((memory) => memory.type === type && (showDemoted || !memory.demotedAt)),
  }));
  const number = (type: MemoryLibraryRecord["type"]) => memories.filter((memory) => memory.type === type && !memory.demotedAt).length;
  const date = (value: string) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(timestamp)) : "时间未知";
  };

  return (
    <div className="page-body memory-library-page">
      <PageIntro eyebrow="SHARED MEMORY" title="记忆" text="Rowan 会把真正重要的事留在这里，不属于某一个聊天窗口。" />
      <section className="memory-library-intro surface">
        <div><small>只属于你和 Rowan</small><b>跨设备、跨对话保存</b></div>
        <button onClick={() => setAddingCore(true)}><Icon name="plus" />新增核心记忆</button>
      </section>
      <div className="memory-library-tools">
        <label><Icon name="search" /><input value={query} placeholder="搜索共同记忆" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setAppliedQuery(event.currentTarget.value); }} /></label>
        <button onClick={() => setAppliedQuery(query)} aria-label="搜索记忆"><Icon name="refresh" /></button>
      </div>
      <nav className="memory-library-tabs" aria-label="记忆分类">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
        {(["core", "long_term", "feeling", "dream"] as const).map((type) => <button key={type} className={filter === type ? "active" : ""} onClick={() => setFilter(type)}>{memoryTypeLabel[type]} <i>{number(type)}</i></button>)}
        <button className={showDemoted ? "active" : ""} onClick={() => setShowDemoted((value) => !value)}>沉底</button>
      </nav>
      {message && <p className="memory-library-message" role="status">{message}</p>}
      {loading ? <div className="memory-library-loading">正在整理记忆…</div> : groups.filter((group) => filter === "all" || group.type === filter).map((group) => (
        <section className="memory-library-section" key={group.type}>
          <div className="memory-library-section-head"><div><small>{group.type === "feeling" ? "ROWAN · FIRST PERSON" : group.type.toUpperCase()}</small><h2>{group.label}</h2></div><span>{group.items.length}</span></div>
          {group.items.length ? <div className="memory-card-list">{group.items.map((memory) => (
            <article className={"memory-card" + (memory.pinned ? " pinned" : "") + (memory.demotedAt ? " demoted" : "")} key={memory.id}>
              <button className="memory-card-open" onClick={() => void openMemory(memory.id)}>
                <div className="memory-card-meta"><span>{memory.reviewStatus === "candidate" ? "待确认" : memory.mood || memoryTypeLabel[memory.type]}</span><time>{date(memory.updatedAt)}</time></div>
                <p>{memory.body}</p>
                {memory.tags.length > 0 && <div className="memory-card-tags">{memory.tags.map((tag) => <span key={tag}>{"#" + tag}</span>)}</div>}
              </button>
              <div className="memory-card-actions">
                <button aria-label={memory.pinned ? "取消钉住" : "钉住记忆"} title={memory.pinned ? "取消钉住" : "钉住"} onClick={() => void change(memory.id, "pin", !memory.pinned)}><Icon name="bookmark" /></button>
                <button aria-label={memory.demotedAt ? "恢复记忆" : "沉底记忆"} title={memory.demotedAt ? "恢复记忆" : "沉底"} onClick={() => void change(memory.id, memory.demotedAt ? "restore" : "demote")}><Icon name={memory.demotedAt ? "refresh" : "chevron"} /></button>
              </div>
            </article>
          ))}</div> : <div className="memory-library-empty">{group.type === "dream" ? "梦会在准备好时住进这里。" : "还没有值得留下的内容。"}</div>}
        </section>
      ))}
      {addingCore && <div className="memory-modal-layer"><button className="memory-modal-scrim" aria-label="关闭" onClick={() => setAddingCore(false)} /><section className="memory-modal" role="dialog" aria-modal="true" aria-label="新增核心记忆"><header><div><small>CORE MEMORY</small><h2>留下一件长期重要的事</h2></div><button onClick={() => setAddingCore(false)} aria-label="关闭"><Icon name="close" /></button></header><label><span>内容</span><textarea value={coreDraft.body} placeholder="例如：我希望 Rowan 一直用这个称呼叫我。" onChange={(event) => setCoreDraft({ ...coreDraft, body: event.target.value })} /></label><label><span>感受（可选）</span><input value={coreDraft.mood} onChange={(event) => setCoreDraft({ ...coreDraft, mood: event.target.value })} /></label><label><span>标签（用逗号分开）</span><input value={coreDraft.tags} onChange={(event) => setCoreDraft({ ...coreDraft, tags: event.target.value })} /></label><button className="memory-primary-action" onClick={() => void addCore()}>保存核心记忆</button></section></div>}
      {detail && <div className="memory-modal-layer"><button className="memory-modal-scrim" aria-label="关闭" onClick={() => setDetail(null)} /><section className="memory-modal memory-detail-modal" role="dialog" aria-modal="true" aria-label="记忆详情"><header><div><small>{memoryTypeLabel[detail.memory.type].toUpperCase()}</small><h2>这段记忆</h2></div><button onClick={() => setDetail(null)} aria-label="关闭"><Icon name="close" /></button></header>{correcting ? <><label><span>修正内容</span><textarea value={coreDraft.body} onChange={(event) => setCoreDraft({ ...coreDraft, body: event.target.value })} /></label><label><span>修正原因</span><input value={coreDraft.reason} placeholder="例如：称呼改成新的名字" onChange={(event) => setCoreDraft({ ...coreDraft, reason: event.target.value })} /></label><button className="memory-primary-action" onClick={() => void correctCore()}>保存修正</button><button className="memory-secondary-action" onClick={() => setCorrecting(false)}>取消</button></> : <><p className="memory-detail-body">{detail.memory.body}</p>{detail.memory.tags.length > 0 && <div className="memory-card-tags">{detail.memory.tags.map((tag) => <span key={tag}>{"#" + tag}</span>)}</div>}<div className="memory-detail-actions"><button onClick={() => void change(detail.memory.id, "pin", !detail.memory.pinned)}><Icon name="bookmark" />{detail.memory.pinned ? "取消钉住" : "钉住"}</button>{detail.memory.type === "core" && detail.memory.reviewStatus === "candidate" && <button onClick={() => void change(detail.memory.id, "approve_core")}><Icon name="check" />确认核心记忆</button>}{detail.memory.type === "core" && detail.memory.reviewStatus === "approved" && <button onClick={() => { setCoreDraft({ body: detail.memory.body, mood: detail.memory.mood, tags: detail.memory.tags.join("，"), reason: "" }); setCorrecting(true); }}><Icon name="edit" />修正</button>}<button className="danger" onClick={() => void change(detail.memory.id, "demote")}><Icon name="chevron" />沉底</button></div><section className="memory-revision-list"><small>修改记录</small>{detail.revisions.length ? detail.revisions.map((revision) => <article key={revision.id}><b>{revision.action === "created" ? "创建" : "修正"}</b><span>{date(revision.createdAt)} · {revision.reason}</span></article>) : <p>还没有修正记录。</p>}</section></>}</section></div>}
    </div>
  );
}
function MusicCard({
  track,
  playing,
  onToggle,
}: {
  track?: Track;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="section-block music-section">
      <SectionTitle icon="music" title="Now playing" />
      {track ? (
        <article className="surface player-card">
          <div className="album-art">
            <span>V</span>
          </div>
          <div className="track">
            <small>VESPER FM</small>
            <h2>{track.title}</h2>
            <p>{track.artist}</p>
            <div className="track-line">
              <i />
            </div>
          </div>
          <button className="play-button" onClick={onToggle}>
            <Icon name={playing ? "pause" : "play"} />
          </button>
        </article>
      ) : (
        <EmptyState text="No music yet." />
      )}
    </section>
  );
}
function PageIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="page-intro">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  );
}
function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <Icon name={icon} />
        <h2>{title}</h2>
        {count && <span>{count}</span>}
      </div>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span>—</span>
      <p>{text}</p>
    </div>
  );
}
function Placeholder({ title }: { title: string }) {
  return (
    <div className="page-body placeholder">
      <Icon name={nav.find((x) => x.label === title)?.icon || "sparkles"} />
      <h1>{title}</h1>
      <p>暂时没有内容。</p>
    </div>
  );
}

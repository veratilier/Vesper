"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { subscribe, serializeSubscription } from "@mmmike/web-push/client";
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
          <b>CyberBoss 留言通道</b>
          <p>连接后，Agent 可以创建和更新便笺。</p>
        </div>
      </div>
    </div>
  );
}
const VESPER_API_ORIGIN = "https://api.vesper.r-vera.com";
const DEFAULT_APP_BACKGROUND = 'url("/vesper-default-bg.webp")';
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
function nextAnniversary(items: AnniversaryItem[]) {
  return [...items].sort(
    (a, b) => anniversaryTarget(a).getTime() - anniversaryTarget(b).getTime(),
  )[0];
}
function AnniversaryCard({ item }: { item: AnniversaryItem }) {
  const target = anniversaryTarget(item);
  return (
    <article className="surface anniversary">
      <div className="days">
        <small>距离</small>
        <b>{daysUntil(item)}</b>
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
            <small>还有</small>
            <b>{daysUntil(next)}</b>
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
            <span>
              <strong>{daysUntil(item)}</strong>天
            </span>
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
  pet: ["M3 16a9 9 0 1 1 4 4l-5 2 1-6", "M8 12c2-3 6-3 8 0l-4 4z"],
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
  pet: [
    "M5 6.2h10a2 2 0 0 1 2 2v6.3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.2a2 2 0 0 1 2-2z",
    "M10 6.2V3",
    "M8.8 2.5h2.4",
    "M6.75 10h.01M13.25 10h.01",
    "M7.2 13.1h5.6",
    "M1.5 11.3H3M17 11.3h1.5",
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

const nav = [
  { label: "今日", english: "Today", icon: "home" },
  { label: "聊天", english: "Letters", icon: "chat" },
  { label: "日记", english: "Journal", icon: "diary" },
  { label: "便笺", english: "Notes", icon: "note" },
  { label: "提醒", english: "Reminders", icon: "check" },
  { label: "纪念日", english: "Dates", icon: "calendar" },
  { label: "桌宠互动", english: "Companion", icon: "pet" },
  { label: "魔盒", english: "Cabinet", icon: "box" },
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
};
type MusicControl = { id: string; action: "play" | "pause" | "next" | "previous" | "play_track"; trackId?: string; processedAt?: string };
type BoxApp = {
  id: string;
  name: string;
  description: string;
  url?: string;
  kind: string;
};
type ConnectionSettings = Record<string, Record<string, string>>;
type ChatAttachment = {
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
};
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

export default function Home() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [splashVisible, setSplashVisible] = useState(() =>
    typeof window === "undefined" ? true : window.sessionStorage.getItem("vesper-splash-seen-v2") !== "1",
  );
  const [active, setActive] = useState("今日");
  const [profileOpen, setProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [conversationId, setConversationId] = useState("main");
  const initialProfile = readLocalValue("vesper-local-profile", { userName: "我", agentName: "Vesper", userAvatar: "", agentAvatar: "" });
  const initialAppearance = readLocalValue("vesper-local-appearance", { accent: "#b8dce8", background: DEFAULT_APP_BACKGROUND });
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
  const [musicControl, setMusicControl] = usePersistentDocument<MusicControl | null>("musicControl", null);
  const globalPlayer = useRef<HTMLAudioElement>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [environment, setEnvironment] =
    usePersistentDocument<EnvironmentSnapshot>("environment", {
      permission: "unknown",
    });
  const currentTrack = tracks[trackIndex];
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
      void navigator.serviceWorker.register("/sw.js?v=14", { scope: "/", updateViaCache: "none" }).then((registration) => registration.update());
    }
    const timer = window.setTimeout(() => {
      setSplashVisible(false);
      window.sessionStorage.setItem("vesper-splash-seen-v2", "1");
    }, splashVisible ? 760 : 0);
    return () => window.clearTimeout(timer);
  }, [splashVisible]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code");
    const state = query.get("state");
    const raw = window.sessionStorage.getItem("vesper-mcp-oauth-pending");
    if (!code || !state || !raw) return;
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
    if (!musicControl || musicControl.processedAt) return;
    const timer = window.setTimeout(() => {
      if (musicControl.action === "play") setPlaying(true);
      if (musicControl.action === "pause") setPlaying(false);
      if (musicControl.action === "next" && tracks.length) setTrackIndex((index) => (index + 1) % tracks.length);
      if (musicControl.action === "previous" && tracks.length) setTrackIndex((index) => (index - 1 + tracks.length) % tracks.length);
      if (musicControl.action === "play_track" && musicControl.trackId) {
        const index = tracks.findIndex((track) => track.id === musicControl.trackId || track.neteaseId === musicControl.trackId);
        if (index >= 0) { setTrackIndex(index); setPlaying(true); }
      }
      setMusicControl({ ...musicControl, processedAt: new Date().toISOString() });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [musicControl, setMusicControl, tracks]);
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(apiUrl("/api/state?key=musicControl"), { cache: "no-store", headers: appHeaders() });
        if (!response.ok) return;
        const result = await response.json() as { value?: MusicControl | null };
        if (result.value?.id && result.value.id !== musicControl?.id) setMusicControl(result.value);
      } catch {}
    };
    const timer = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(timer);
  }, [musicControl?.id, setMusicControl]);
  const shellStyle = {
    "--theme-accent": accent,
    backgroundImage: customBackground || DEFAULT_APP_BACKGROUND,
  } as CSSProperties;
  const navigateTo = (label: string) => {
    setDrawerOpen(false);
    if (label !== active) window.setTimeout(() => setActive(label), 290);
  };
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
          setAccent(appearance.accent || "#b8dce8");
          setCustomBackground(appearance.background || DEFAULT_APP_BACKGROUND);
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
      <div className={splashVisible ? "vesper-splash" : "vesper-splash leaving"} aria-hidden={!splashVisible}>
        <img src="/icon-192-20260823-v8.png" alt="" />
        <b>Vesper</b>
        <span />
      </div>
      <audio
        ref={globalPlayer}
        src={currentTrack?.url}
        onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setPlaybackDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() =>
          tracks.length && setTrackIndex((trackIndex + 1) % tracks.length)
        }
      />
      <section className="app-shell" style={shellStyle}>
        <header
          className={active === "聊天" ? "app-header chat-mode" : "app-header"}
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
                <img src="/icon-192-20260823-v8.png" alt="" />
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
            <h1 className="page-name">{active}</h1>
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
        <div className="scroll-view view-enter" key={active}>
          {active === "今日" ? (
            <Today
              track={currentTrack}
              playing={playing}
              onToggle={() => setPlaying(!playing)}
              environment={environment}
              userName={userName}
            />
          ) : active === "聊天" ? (
            <ConnectedChat
              key={conversationId}
              conversationId={conversationId}
              agentName={agentName}
              userName={userName}
              agentAvatar={agentAvatar}
              userAvatar={userAvatar}
            />
          ) : active === "日记" ? (
            <Diary />
          ) : active === "便笺" ? (
            <Notes />
          ) : active === "提醒" ? (
            <Todos />
          ) : active === "纪念日" ? (
            <Anniversaries />
          ) : active === "桌宠互动" ? (
            <PetPage />
          ) : active === "魔盒" ? (
            <MagicBox />
          ) : active === "音乐" ? (
            <MusicPage
              tracks={tracks}
              playing={playing}
              onToggle={() => setPlaying(!playing)}
              onSelect={setTrackIndex}
              selected={trackIndex}
              onTracks={setTracks}
              currentTime={playbackTime}
              duration={playbackDuration}
              onSeek={(time) => {
                if (globalPlayer.current) globalPlayer.current.currentTime = time;
                setPlaybackTime(time);
              }}
            />
          ) : active === "记忆库" ? (
            <MemoryLibrary />
          ) : active === "设置" ? (
            <SettingsPage
              accent={accent}
              background={customBackground}
              onAccent={setAccent}
              onBackground={setCustomBackground}
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
                  <img src="/icon-192-20260823-v8.png" alt="" />
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
                  <VesperNavIcon name={icon} />
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
            onSelect={(id) => {
              setConversationId(id);
              setHistoryOpen(false);
            }}
            onDelete={(id) => {
              if (id === conversationId) setConversationId("main");
            }}
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
            icon: "/icon-192.png",
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
}: {
  track?: Track;
  playing: boolean;
  onToggle: () => void;
  environment: EnvironmentSnapshot;
  userName: string;
}) {
  const [notes] = usePersistentDocument<NoteItem[]>("notes", []);
  const [todos, setTodos] = usePersistentDocument<TodoItem[]>("todos", []);
  const [anniversaries] = usePersistentDocument<AnniversaryItem[]>(
    "anniversaries",
    [],
  );
  const now = new Date();
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const hour = now.getHours();
  const greeting =
    hour < 6
      ? "夜深了"
      : hour < 11
        ? "早上好"
        : hour < 14
          ? "中午好"
          : hour < 18
            ? "下午好"
            : "晚上好";
  const weather =
    environment.permission === "granted" &&
    environment.temperature !== undefined
      ? `${Math.round(environment.temperature)}°`
      : "--°";
  return (
    <>
      <section className="welcome">
        <div className="date-row">
          <span>{dateText}</span>
          <span className="weather-pill">
            <Icon name="cloud" />
            {weather}
          </span>
        </div>
        <h1>
          {greeting}，{userName}。
        </h1>
      </section>
      <section className="section-block">
        <SectionTitle icon="note" title="便笺" count={String(notes.length)} />
        <div className="note-stack">
          {notes.slice(0, 2).map((note) => (
            <article className={`note-card ${note.tone}`} key={note.id}>
              <Icon name={note.kind === "agent" ? "sparkles" : "feather"} />
              <div>
                <p>{note.text}</p>
                <time>{new Date(note.createdAt).toLocaleString("zh-CN")}</time>
              </div>
            </article>
          ))}
          {!notes.length && <EmptyState text="还没有便笺" />}
        </div>
      </section>
      <section className="section-block">
        <SectionTitle
          icon="check"
          title="今日提醒"
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
          {!todos.length && <EmptyState text="还没有提醒" />}
        </div>
      </section>
      <section className="section-block">
        <SectionTitle icon="calendar" title="纪念日" />
        {nextAnniversary(anniversaries) ? (
          <AnniversaryCard item={nextAnniversary(anniversaries)!} />
        ) : (
          <div className="surface">
            <EmptyState text="还没有纪念日" />
          </div>
        )}
      </section>
      <MusicCard track={track} playing={playing} onToggle={onToggle} />
    </>
  );
}

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

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
  onSelect,
  onDelete,
  onClose,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(() =>
    readLocalValue<ConversationSummary[]>("vesper-local-conversation-index", []),
  );
  const [query, setQuery] = useState("");
  useEffect(() => {
    const token = deviceToken();
    if (!token) return;
    fetch(apiUrl("/api/chat?list=1"), {
      headers: { "x-vesper-device-token": token },
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
        apiUrl(`/api/chat?conversationId=${encodeURIComponent(item.id)}`),
        { method: "DELETE", headers: { "x-vesper-device-token": token } },
      );
      if (!response.ok && response.status !== 404) {
        window.alert("云端聊天记录删除失败，请稍后重试");
        return;
      }
    }
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("vesper-local-chat-") && key.endsWith(`-${item.id}`))
        window.localStorage.removeItem(key);
    }
    const next = conversations.filter((conversation) => conversation.id !== item.id);
    setConversations(next);
    window.localStorage.setItem("vesper-local-conversation-index", JSON.stringify(next));
    onDelete(item.id);
  };
  return (
    <div className="modal-layer history-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="history-modal">
        <div className="modal-head">
          <div>
            <small>CONVERSATIONS</small>
            <h2>历史聊天记录</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <label className="history-search">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索对话"
          />
        </label>
        <div className="history-list">
          {visible.length ? (
            visible.map((item) => (
              <article className={item.id === activeId ? "history-item-row selected" : "history-item-row"} key={item.id}>
                <button className="history-open" onClick={() => onSelect(item.id)}>
                  <b>{item.title || "未命名对话"}</b>
                  <span>
                    {new Date(item.updatedAt).toLocaleString("zh-CN")} · {item.messageCount} 条
                  </span>
                </button>
                <button className="history-delete" aria-label={`删除 ${item.title || "对话"}`} onClick={() => void remove(item)}>
                  <Icon name="trash" />
                </button>
              </article>
            ))
          ) : (
            <EmptyState text="还没有聊天记录。" />
          )}
        </div>
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
  };
  createdAt: string;
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
            <div className="thought-raw">{thought.metadata?.thoughtSummary}</div>
          </section>
        </div>
      )}
    </div>
  );
}

type CodexSocketMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};
type CodexInput =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "audio"; url: string };
type CodexPendingFile = { file: File; preview: string };

const CODEX_DYNAMIC_TOOLS = [
  {
    name: "read_vesper_state",
    description: "Read Vesper notes, reminders, journal, dates, music, or current section.",
    inputSchema: { type: "object", properties: { section: { type: "string" } } },
  },
  {
    name: "write_vesper_state",
    description: "Create a note, reminder, journal entry, or navigate Vesper.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["note", "reminder", "journal", "navigate"] },
        text: { type: "string" },
        title: { type: "string" },
        date: { type: "string" },
        section: { type: "string" },
      },
      required: ["kind"],
    },
  },
];

function codexSocketUrl() {
  const configured = readLocalValue<string>("vesper-codex-endpoint", "").trim();
  const base = configured || (typeof window !== "undefined" ? `${window.location.origin}/api/codex` : "");
  const url = new URL(base || "http://localhost/api/codex");
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  const token = deviceToken();
  if (token) url.searchParams.set("token", token);
  return url.toString();
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

function CodexChatMessage({
  item,
  agentName,
  userName,
  agentAvatar,
  userAvatar,
  onEdit,
  onThought,
}: {
  item: BridgeChatMessage;
  agentName: string;
  userName: string;
  agentAvatar: string;
  userAvatar: string;
  onEdit: (item: BridgeChatMessage) => void;
  onThought: (item: BridgeChatMessage) => void;
}) {
  const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.createdAt));
  const assistant = item.role === "agent";
  return (
    <div className={assistant ? "agent-turn" : "sent-turn"}>
      <time>{stamp}</time>
      <div className={assistant ? "message assistant" : "message mine sent-message"}>
        {assistant && <AvatarMark src={agentAvatar} label={agentName} kind="agent" />}
        <div>
          {assistant && <div className="codex-thinking-label"><i /> {item.metadata?.thoughtSummary ? "Thought complete" : "Codex"}</div>}
          <p>{item.content}</p>
          <MessageAttachments items={item.metadata?.attachments || []} />
          <small>{assistant ? agentName : userName} · {stamp}</small>
          {assistant && item.metadata?.thoughtSummary && <button className="thought-toggle" onClick={() => onThought(item)}><Icon name="clock" /> View reasoning summary <Icon name="chevron" /></button>}
          {!assistant && <button className="message-edit" aria-label="Edit message" title="Edit" onClick={() => onEdit(item)}><Icon name="edit" /></button>}
        </div>
        {!assistant && <AvatarMark src={userAvatar} label={userName} kind="user" />}
      </div>
    </div>
  );
}

function ConnectedChat({
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
  const [messages, setMessages] = useState<BridgeChatMessage[]>(() => readLocalValue(`vesper-codex-chat-${conversationId}`, []));
  const [pending, setPending] = useState<CodexPendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [streaming, setStreaming] = useState("");
  const [thought, setThought] = useState<BridgeChatMessage | null>(null);
  const [listening, setListening] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const rpcId = useRef(1);
  const rpc = useRef(new Map<number, { resolve: (value: CodexSocketMessage) => void; reject: (reason: Error) => void }>());
  const threadId = useRef(readLocalValue<Record<string, string>>("vesper-codex-threads", {})[conversationId] || "");
  const streamBuffers = useRef(new Map<string, string>());
  const thoughtBuffer = useRef("");
  const turnDone = useRef<((value?: unknown) => void) | null>(null);
  const streamEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = (next: BridgeChatMessage[]) => {
    setMessages(next);
    window.localStorage.setItem(`vesper-codex-chat-${conversationId}`, JSON.stringify(next));
  };
  const executeTool = (name: string, args: Record<string, unknown>) => {
    const section = String(args.section || "");
    if (name === "read_vesper_state") {
      const key = section === "journal" ? "diary" : section === "reminders" ? "todos" : section === "dates" ? "anniversaries" : section === "music" ? "music" : "notes";
      return JSON.stringify({ section: section || "notes", value: readLocalValue(`vesper-document-${key}`, key === "diary" ? {} : []) });
    }
    if (name === "write_vesper_state") {
      const kind = String(args.kind || "");
      if (kind === "navigate") {
        window.dispatchEvent(new CustomEvent("vesper-navigate", { detail: { section } }));
        return `Opened ${section || "Today"}.`;
      }
      if (kind === "note") {
        const notes = readLocalValue<NoteItem[]>("vesper-document-notes", []);
        const entry = { id: crypto.randomUUID(), text: String(args.text || args.title || ""), kind: "agent" as const, tone: "cool", createdAt: new Date().toISOString() };
        window.localStorage.setItem("vesper-document-notes", JSON.stringify([...notes, entry]));
        window.dispatchEvent(new CustomEvent("vesper-document-change", { detail: { key: "notes", value: [...notes, entry] } }));
        return `Saved note ${entry.id}.`;
      }
      if (kind === "reminder") {
        const todos = readLocalValue<TodoItem[]>("vesper-document-todos", []);
        const entry = { id: crypto.randomUUID(), title: String(args.title || args.text || "Reminder"), done: false, tag: "Codex", due: String(args.date || ""), createdAt: new Date().toISOString() };
        window.localStorage.setItem("vesper-document-todos", JSON.stringify([...todos, entry]));
        window.dispatchEvent(new CustomEvent("vesper-document-change", { detail: { key: "todos", value: [...todos, entry] } }));
        return `Saved reminder ${entry.id}.`;
      }
      if (kind === "journal") {
        const diary = readLocalValue<DiaryDocument>("vesper-document-diary", {});
        const date = String(args.date || new Date().toLocaleDateString("en-CA"));
        const value = { ...diary, [date]: { ...(diary[date] || { user: "" }), agent: String(args.text || ""), updatedAt: new Date().toISOString() } };
        window.localStorage.setItem("vesper-document-diary", JSON.stringify(value));
        window.dispatchEvent(new CustomEvent("vesper-document-change", { detail: { key: "diary", value } }));
        return `Updated journal for ${date}.`;
      }
    }
    return "Tool completed without changes.";
  };
  const sendRpc = (method: string, params: Record<string, unknown>) => new Promise<CodexSocketMessage>((resolve, reject) => {
    const current = socket.current;
    if (!current || current.readyState !== WebSocket.OPEN) return reject(new Error("Codex socket is not open"));
    const id = rpcId.current++;
    rpc.current.set(id, { resolve, reject });
    current.send(JSON.stringify({ id, method, params }));
  });
  const handleSocketMessage = (message: CodexSocketMessage) => {
    if (typeof message.id === "number" && rpc.current.has(message.id) && !message.method) {
      const pendingRpc = rpc.current.get(message.id)!;
      rpc.current.delete(message.id);
      if (message.error) pendingRpc.reject(new Error(message.error.message || "Codex request failed"));
      else pendingRpc.resolve(message);
      return;
    }
    if (message.method === "item/tool/call" && typeof message.id === "number") {
      const params = message.params || {};
      const result = executeTool(String(params.tool || ""), (params.arguments || {}) as Record<string, unknown>);
      socket.current?.send(JSON.stringify({ id: message.id, result: { contentItems: [{ type: "inputText", text: result }], success: true } }));
      return;
    }
    if (message.method === "attestation/generate" && typeof message.id === "number") {
      socket.current?.send(JSON.stringify({ id: message.id, result: { token: `v1.vesper-${crypto.randomUUID()}` } }));
      return;
    }
    if (message.method === "currentTime/read" && typeof message.id === "number") {
      socket.current?.send(JSON.stringify({ id: message.id, result: { currentTimeAt: Math.floor(Date.now() / 1000) } }));
      return;
    }
    if (message.method?.includes("requestApproval") && typeof message.id === "number") {
      socket.current?.send(JSON.stringify({ id: message.id, result: { decision: "decline" } }));
      setError("Codex requested a command approval; Vesper keeps shell actions disabled in the browser.");
      return;
    }
    const params = message.params || {};
    if (message.method === "item/agentMessage/delta") {
      const id = String(params.itemId || "agent");
      const next = `${streamBuffers.current.get(id) || ""}${String(params.delta || "")}`;
      streamBuffers.current.set(id, next);
      setStreaming(next);
    }
    if (message.method === "item/reasoning/summaryTextDelta") {
      thoughtBuffer.current += String(params.delta || "");
    }
    if (message.method === "item/completed") {
      const item = (params.item || {}) as { type?: string; id?: string; text?: string; summary?: string };
      if (item.type === "agentMessage") {
        const content = item.text || streamBuffers.current.get(String(item.id || "")) || streaming;
        if (content.trim()) {
          const agentMessage: BridgeChatMessage = { id: crypto.randomUUID(), conversationId, role: "agent", content, status: "delivered", metadata: { thoughtSummary: thoughtBuffer.current || undefined }, createdAt: new Date().toISOString() };
          save([...readLocalValue<BridgeChatMessage[]>(`vesper-codex-chat-${conversationId}`, []), agentMessage]);
        }
        setStreaming("");
        streamBuffers.current.clear();
        thoughtBuffer.current = "";
      }
    }
    if (message.method === "turn/completed") {
      setBusy(false);
      turnDone.current?.(params.turn);
      turnDone.current = null;
    }
  };
  const connect = async () => {
    if (socket.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(codexSocketUrl());
    socket.current = ws;
    ws.onmessage = (event) => {
      try { handleSocketMessage(JSON.parse(String(event.data)) as CodexSocketMessage); } catch { setError("Invalid message from Codex app-server"); }
    };
    ws.onclose = () => { setOnline(false); socket.current = null; };
    ws.onerror = () => setError("Codex app-server is offline");
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Codex app-server is offline"));
    });
    setOnline(true);
    await sendRpc("initialize", { clientInfo: { name: "vesper_web", title: "Vesper", version: "0.5.0" }, capabilities: { experimentalApi: true, requestAttestation: true } });
    ws.send(JSON.stringify({ method: "initialized" }));
    const stored = readLocalValue<Record<string, string>>("vesper-codex-threads", {});
    if (threadId.current || stored[conversationId]) {
      threadId.current = threadId.current || stored[conversationId];
      await sendRpc("thread/resume", { threadId: threadId.current });
    } else {
      const result = await sendRpc("thread/start", { dynamicTools: CODEX_DYNAMIC_TOOLS, approvalPolicy: "unlessTrusted", summary: "concise" });
      const thread = (result.result?.thread || {}) as { id?: string };
      if (!thread.id) throw new Error("Codex did not return a thread id");
      threadId.current = thread.id;
      window.localStorage.setItem("vesper-codex-threads", JSON.stringify({ ...stored, [conversationId]: thread.id }));
    }
  };
  const editMessage = (item: BridgeChatMessage) => {
    const content = window.prompt("Edit message", item.content)?.trim();
    if (!content || content === item.content) return;
    save(messages.map((message) => message.id === item.id ? { ...message, content } : message));
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
  const send = async () => {
    const content = draft.trim();
    if ((!content && !pending.length) || busy) return;
    setBusy(true); setError(""); setDraft("");
    const userMessage: BridgeChatMessage = { id: crypto.randomUUID(), conversationId, role: "user", content: content || "Attachment", status: "delivered", metadata: { attachments: [] }, createdAt: new Date().toISOString() };
    try {
      const prepared = await Promise.all(pending.map(prepareFile));
      userMessage.metadata = { attachments: prepared.map((item) => item.attachment) };
      const current = [...messages, userMessage];
      save(current);
      const input: CodexInput[] = [{ type: "text", text: [content, ...prepared.map((item) => item.text).filter(Boolean)].filter(Boolean).join("\n\n") || "Please inspect the attached files." }];
      for (const item of prepared) if (item.input) input.push(item.input);
      await connect();
      if (!threadId.current) throw new Error("No Codex thread");
      const done = new Promise<void>((resolve) => { turnDone.current = () => resolve(); });
      await sendRpc("turn/start", { threadId: threadId.current, clientUserMessageId: userMessage.id, input, summary: "concise" });
      await Promise.race([done, new Promise<void>((_, reject) => window.setTimeout(() => reject(new Error("Codex response timed out")), 120000))]);
      rememberConversation(conversationId, content.slice(0, 28) || "Attachment");
      setPending([]);
    } catch (reason) {
      setDraft(content); setError(reason instanceof Error ? reason.message : "Message failed"); setBusy(false);
    }
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
    void connect().catch((reason) => setError(reason instanceof Error ? reason.message : "Codex app-server is offline"));
    return () => { socket.current?.close(); socket.current = null; };
  }, [conversationId]);
  useLayoutEffect(() => { const scroller = streamEnd.current?.closest(".scroll-view") as HTMLElement | null; if (scroller) scroller.scrollTop = scroller.scrollHeight; }, [messages.length, streaming]);
  return (
    <div className="page-body chat-page codex-chat">
      <div className="bridge-presence"><i className={online ? "online" : ""} /><span>{online ? "Codex app-server connected" : "Codex app-server offline"}</span></div>
      <div className="chat-stream">
        {!messages.length && !streaming && <div className="chat-empty"><Icon name="chat" /><b>{error || "A quiet place to think"}</b><span>One private Codex connection · files, images, audio and tools ready</span></div>}
        {messages.map((item) => <CodexChatMessage key={item.id} item={item} agentName={agentName} userName={userName} agentAvatar={agentAvatar} userAvatar={userAvatar} onEdit={editMessage} onThought={setThought} />)}
        {streaming && <div className="agent-turn"><time>Now</time><div className="message assistant"><AvatarMark src={agentAvatar} label={agentName} kind="agent" /><div><div className="codex-thinking-label"><i /> Thinking…</div><p>{streaming}</p></div></div></div>}
        {busy && !streaming && <div className="agent-typing"><AvatarMark src={agentAvatar} label={agentName} kind="agent" /><div><i /><i /><i /><span>Thinking…</span></div></div>}
        <div ref={streamEnd} />
      </div>
      <div className="chat-compose">
        {pending.length > 0 && <div className="compose-previews">{pending.map((item, index) => <div className="compose-preview" key={`${item.file.name}-${index}`}>{item.file.type.startsWith("image/") ? <img src={item.preview} alt={item.file.name} /> : item.file.type.startsWith("video/") ? <video src={item.preview} muted /> : item.file.type.startsWith("audio/") ? <audio src={item.preview} controls /> : <span><Icon name="archive" />{item.file.name}</span>}<button aria-label="Remove attachment" onClick={() => setPending((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="close" /></button></div>)}</div>}
        <textarea placeholder="Write to Codex…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
        <div className="compose-actions"><button aria-label="Attach files" onClick={() => fileInput.current?.click()}><Icon name="plus" /></button><input ref={fileInput} hidden multiple type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.json,.html,.csv,.zip" onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /><span className="codex-connection-pill"><i className={online ? "online" : ""} /> Codex</span><span>{busy ? "Sending…" : listening ? "Listening…" : ""}</span><button className={listening ? "active" : ""} aria-label="Voice input" onClick={startStt}><Icon name="mic" /></button><button className="send-message-button" aria-label="Send message" disabled={busy || (!draft.trim() && !pending.length)} onClick={() => void send()}><Icon name="send" /></button></div>
      </div>
      {thought && <div className="thought-sheet-layer"><button className="thought-scrim" aria-label="Close reasoning" onClick={() => setThought(null)} /><section className="thought-sheet"><div className="thought-sheet-head"><button aria-label="Close" onClick={() => setThought(null)}><Icon name="close" /></button><h2>Thought process</h2></div><div className="thought-raw">{thought.metadata?.thoughtSummary}</div></section></div>}
    </div>
  );
}

function MessageAttachments({ items }: { items: ChatAttachment[] }) {
  if (!items.length) return null;
  return (
    <div className="message-attachments">
      {items.map((item) =>
        item.type.startsWith("image/") ? (
          <a href={item.url} target="_blank" rel="noreferrer" key={item.key}>
            <img src={item.url} alt={item.name} />
          </a>
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
                  CyberBoss 可写
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
  const [editingId, setEditingId] = useState("");
  const add = () => {
    const id = crypto.randomUUID();
    setServers((current) => [...current, { id, name: "", url: "", token: "", enabled: true, authMode: "none" }]);
    setEditingId(id);
  };
  const update = (id: string, patch: Partial<ExternalMcpEntry>) =>
    setServers((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const authorize = async (server: ExternalMcpEntry) => {
    if (!server.url) {
      setMessage("请先填写 MCP 服务地址");
      return;
    }
    setMessage("正在发现授权服务…");
    const redirectUri = `${window.location.origin}/?mcp-oauth=1`;
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
      setMessage(discovered.error || "无法自动发现 OAuth 授权页面");
      return;
    }
    if (discovered.needsClientId || !discovered.clientId) {
      setMessage("该服务不支持自动注册，请只填写它分配给 Vesper 的 Client ID 后重试");
      return;
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
  };
  const test = async (server: ExternalMcpEntry) => {
    if (!server.url) {
      setMessage("请先填写 MCP 服务地址");
      return;
    }
    setTestingId(server.id);
    setMessage("");
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: server.url, token: server.token }),
      });
      const result = (await response.json()) as { serverName?: string; toolCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "MCP 连接失败");
      setMessage(`连接成功${result.serverName ? ` · ${result.serverName}` : ""}${typeof result.toolCount === "number" ? ` · ${result.toolCount} 个工具` : ""}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "MCP 连接失败");
    } finally {
      setTestingId("");
    }
  };
  return (
    <div className="modal-layer settings-subpage-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal external-mcp-modal">
        <div className="modal-head">
          <button className="settings-back" onClick={onClose} aria-label="返回"><Icon name="chevron" /></button>
          <div><small>TOOL CONNECTIONS</small><h2>MCP 工具</h2></div>
          <button onClick={add} aria-label="添加 MCP"><Icon name="plus" /></button>
        </div>
        <p>在这里接入搜索、文件、记忆库或其他第三方 MCP。AI 连接中的 MCP 是对话运行端，这里则是提供给 AI 使用的工具目录。</p>
        <div className="mcp-server-list">
          {!servers.length && <EmptyState text="还没有接入第三方 MCP。" />}
          {servers.map((server) => (
            <article className="mcp-server-card" key={server.id}>
              <div className="mcp-server-summary">
                <span className={server.enabled ? "mcp-live-dot" : "mcp-live-dot off"} />
                <div><b>{server.name || "未命名 MCP"}</b><small>{server.url || "尚未填写地址"} · {server.authMode === "oauth" ? `OAuth ${server.oauthStatus === "authorized" ? "已授权" : "待授权"}` : "Bearer / 无授权"}</small></div>
              </div>
              <div className="mcp-card-actions">
                <button disabled={testingId === server.id} onClick={() => void test(server)}>{testingId === server.id ? "测试中" : "测试"}</button>
                {server.authMode === "oauth" && <button onClick={() => void authorize(server)}>授权</button>}
                <button onClick={() => setEditingId(server.id)}>编辑</button>
                <button onClick={() => setServers((current) => current.filter((item) => item.id !== server.id))}>删除</button>
              </div>
            </article>
          ))}
        </div>
        {message && <p className="connection-message">{message}</p>}
      </section>
      {editingId && (() => {
        const server = servers.find((item) => item.id === editingId);
        if (!server) return null;
        return <div className="mcp-editor-layer"><button className="modal-scrim" onClick={() => setEditingId("")} /><section className="mcp-editor-modal">
          <div className="modal-head"><div><small>MCP SERVER</small><h2>{server.name ? "编辑 MCP 服务器" : "添加 MCP 服务器"}</h2></div><button onClick={() => setEditingId("")}><Icon name="close" /></button></div>
          <label className="profile-field"><span>名称</span><input value={server.name} onChange={(event) => update(server.id, { name: event.target.value })} /></label>
          <label className="profile-field"><span>Streamable HTTP 地址</span><input value={server.url} placeholder="https://example.com/mcp" autoCapitalize="none" autoCorrect="off" onChange={(event) => update(server.id, { url: event.target.value })} /></label>
          <div className="mcp-auth-choice"><span>OAuth 授权</span><div><button className={(server.authMode || "none") === "none" ? "selected" : ""} onClick={() => update(server.id, { authMode: "none" })}>无</button><button className={server.authMode === "oauth" ? "selected" : ""} onClick={() => update(server.id, { authMode: "oauth" })}>有</button></div></div>
          {server.authMode === "oauth" ? <><p className="settings-hint">Vesper 会自动发现 OAuth 页面并直接跳转授权；通常无需手填授权地址。</p><label className="profile-field"><span>Client ID（服务要求时填写）</span><input value={server.clientId || ""} onChange={(event) => update(server.id, { clientId: event.target.value })} /></label></> : <label className="profile-field"><span>Bearer Token（可选）</span><input type="password" value={server.token} onChange={(event) => update(server.id, { token: event.target.value })} /></label>}
          <button className={server.enabled ? "mcp-enable on" : "mcp-enable"} onClick={() => update(server.id, { enabled: !server.enabled })}><span>{server.enabled ? "已启用" : "已停用"}</span><i><u /></i></button>
          <div className="mcp-editor-actions"><button onClick={() => setEditingId("")}>取消</button><button className="save-profile" onClick={() => setEditingId("")}>保存</button></div>
        </section></div>;
      })()}
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
  const [endpoint, setEndpoint] = useState(() => readLocalValue("vesper-codex-endpoint", ""));
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
        <p className="settings-hint">Run <code>codex app-server --listen ws://0.0.0.0:4500</code> on your VPS. Put the public WebSocket URL here, or leave it blank to use the Vesper same-origin proxy.</p>
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
  const [color, setColor] = useState("#dfe9ec");
  const accents = [
    ["冰川蓝", "#b8dce8"],
    ["雾灰", "#b8bec1"],
    ["冷杉灰", "#aebfba"],
    ["暮紫灰", "#c3becd"],
  ];
  const backgrounds = [
    ["冰雾", "linear-gradient(145deg,#f7faf9,#dfe9eb)"],
    [
      "月岩",
      "radial-gradient(circle at 24% 16%,#ffffff 0,transparent 24%),linear-gradient(145deg,#e9e9e6,#c8cccd)",
    ],
    [
      "夜色",
      "radial-gradient(circle at 72% 10%,#3e454b 0,transparent 25%),linear-gradient(145deg,#23282d,#0f1114)",
    ],
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
                style={{ backgroundImage: value }}
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
                onClick={() =>
                  onBackground(
                    `radial-gradient(circle at 72% 12%,rgba(255,255,255,.8),transparent 28%),linear-gradient(145deg,${color},#f7f7f5)`,
                  )
                }
              >
                用颜色生成
              </button>
            </div>
          </div>
          <button className="reset-background" onClick={() => onBackground("")}>
            恢复 Vesper 大理石背景
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
            setForm((current) => ({ ...current, provider, baseUrl: provider === "ElevenLabs" ? "https://api.elevenlabs.io" : "https://api.openai.com/v1", model: provider === "ElevenLabs" ? "eleven_multilingual_v2" : "gpt-4o-mini-tts" }));
          }}><option>ElevenLabs</option><option>OpenAI-compatible</option></select></label>
          <label className="profile-field"><span>API Base URL</span><input value={form.baseUrl || ""} onChange={(event) => update("baseUrl", event.target.value)} /></label>
          <label className="profile-field"><span>{eleven ? "ElevenLabs API Key" : "API Key"}</span><input type="password" value={form.apiKey || ""} onChange={(event) => update("apiKey", event.target.value)} /></label>
          <label className="profile-field"><span>{eleven ? "ElevenLabs Voice ID" : "声音 ID"}</span><input value={form.voiceId || ""} onChange={(event) => update("voiceId", event.target.value)} /></label>
          <label className="profile-field"><span>{eleven ? "ElevenLabs 模型" : "TTS 模型"}</span><input value={form.model || ""} onChange={(event) => update("model", event.target.value)} /></label>
          <label className="voice-speed"><span>语速 {Number(form.speed || 1).toFixed(1)}×</span><input type="range" min="0.7" max="1.3" step="0.1" value={form.speed || "1"} onChange={(event) => update("speed", event.target.value)} /></label>
          <button className="voice-autoplay" onClick={() => update("autoPlay", form.autoPlay === "false" ? "true" : "false")}><i className={form.autoPlay === "false" ? "switch" : "switch on"}><u /></i><span><b>语音消息自动播放</b><small>收到语音消息时直接响，不用点</small></span></button>
        </div>
        <button className="save-profile" disabled={busy} onClick={() => void testVoice()}>{busy ? "试听中…" : "试听"}</button>
        <section className="voice-test-panel"><div><b>语音测试</b><button onClick={() => void Promise.all([requestMic(), testVoice()])}>全部测试</button></div><p><span>1　麦克风权限</span><em>{micStatus}</em><button onClick={() => void requestMic()}>请求权限</button></p><p><span>2　声音服务可否调用</span><em>{apiStatus}</em></p><p><span>3　当前打开界面</span><em>{window.matchMedia("(display-mode: standalone)").matches ? "iPhone 主屏幕 PWA" : "浏览器"}</em></p></section>
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

function PetPage() {
  const [pet, setPet] = usePersistentDocument("pet", {
    mood: 50,
    energy: 50,
    lastAction: "",
  });
  const act = (kind: "陪伴" | "喂食" | "休息") => {
    setPet((current) => ({
      mood: Math.min(100, current.mood + (kind === "陪伴" ? 12 : 5)),
      energy: Math.min(
        100,
        Math.max(
          0,
          current.energy + (kind === "休息" ? 20 : kind === "喂食" ? 10 : -4),
        ),
      ),
      lastAction: `${kind} · ${new Date().toLocaleString("zh-CN")}`,
    }));
  };
  return (
    <div className="page-body">
      <PageIntro
        eyebrow="COMPANION"
        title="桌宠互动"
        text="互动状态会真实保存。"
      />
      <section className="surface pet-tool">
        <img src="/icon-192-20260823-v8.png" alt="Vesper 桌宠" />
        <div>
          <span>心情 {pet.mood}%</span>
          <progress max="100" value={pet.mood} />
          <span>精力 {pet.energy}%</span>
          <progress max="100" value={pet.energy} />
        </div>
      </section>
      <div className="pet-actions">
        <button onClick={() => act("陪伴")}>陪伴</button>
        <button onClick={() => act("喂食")}>喂食</button>
        <button onClick={() => act("休息")}>休息</button>
      </div>
      {pet.lastAction && <p className="settings-foot">{pet.lastAction}</p>}
    </div>
  );
}
function MagicBox() {
  const [apps, setApps] = usePersistentDocument<BoxApp[]>("magicBox", []);
  const input = useRef<HTMLInputElement>(null);
  const importApp = async (file?: File) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as Partial<BoxApp>;
      if (!raw.name) throw new Error();
      setApps((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          name: String(raw.name),
          description: String(raw.description || ""),
          url: raw.url ? String(raw.url) : undefined,
          kind: String(raw.kind || "扩展"),
        },
      ]);
    } catch {
      window.alert("扩展文件格式无效");
    }
    if (input.current) input.current.value = "";
  };
  return (
    <div className="page-body magic-page">
      <PageIntro
        eyebrow="VESPER BOX"
        title="魔盒"
        text="导入并打开自己的应用或游戏扩展。"
      />
      <div className="magic-actions">
        <span>{apps.length} 个扩展</span>
        <button className="import-app" onClick={() => input.current?.click()}>
          <Icon name="upload" />
          导入
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importApp(event.target.files?.[0])}
        />
      </div>
      {!apps.length ? (
        <EmptyState text="还没有扩展。导入包含 name、description、url、kind 的 JSON 文件。" />
      ) : (
        <div className="app-grid">
          {apps.map((app, index) => (
            <article className="app-tile" key={app.id}>
              <span className="app-art light">
                <i>{String(index + 1).padStart(2, "0")}</i>
              </span>
              <b>{app.name}</b>
              <small>{app.description || "无说明"}</small>
              <em>{app.kind}</em>
              <div className="tile-actions">
                {app.url && (
                  <button
                    onClick={() =>
                      window.open(app.url, "_blank", "noopener,noreferrer")
                    }
                  >
                    打开
                  </button>
                )}
                <button
                  onClick={() =>
                    setApps((current) =>
                      current.filter((entry) => entry.id !== app.id),
                    )
                  }
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
function formatPlaybackTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value) % 60).padStart(2, "0")}`;
}
function MusicPage({
  tracks,
  playing,
  onToggle,
  onSelect,
  selected,
  onTracks,
  currentTime,
  duration,
  onSeek,
}: {
  tracks: Track[];
  playing: boolean;
  onToggle: () => void;
  onSelect: (index: number) => void;
  selected: number;
  onTracks: (value: Track[]) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const track = tracks[selected];
  const [netease, setNetease] = useLocalDocument<Record<string, string>>(
    "netease-connection",
    {},
  );
  const [neteaseOpen, setNeteaseOpen] = useState(false);
  const add = () => {
    const title = window.prompt("歌曲名称");
    if (!title?.trim()) return;
    const url = window.prompt("可直接播放的音频 URL");
    if (!url?.trim()) return;
    const artist = window.prompt("歌手（可留空）") || "";
    onTracks([
      ...tracks,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        artist: artist.trim(),
        url: url.trim(),
      },
    ]);
    onSelect(tracks.length);
  };
  return (
    <div className="page-body music-page">
      <div className="music-top">
        <span>NOW PLAYING</span>
        <div>
          <button aria-label="网易云连接" onClick={() => setNeteaseOpen(true)}>
            <Icon name="link" />
          </button>
          <button aria-label="添加音乐" onClick={add}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
      {track ? (
        <>
          <div className="vinyl-stage">
            <div className={playing ? "vinyl spinning" : "vinyl"}>
              {track.cover ? (
                <img src={track.cover} alt="" />
              ) : (
                <div className="vinyl-label">V</div>
              )}
            </div>
          </div>
          <section className="now-track">
            <h1>{track.title}</h1>
            <p>{track.artist || "未知歌手"}</p>
          </section>
          <div className="music-progress live-progress">
            <input aria-label="播放进度" type="range" min="0" max={Math.max(duration, 1)} step="0.1" value={Math.min(currentTime, Math.max(duration, 1))} onChange={(event) => onSeek(Number(event.target.value))} />
            <span>{formatPlaybackTime(currentTime)}</span><span>{formatPlaybackTime(duration)}</span>
          </div>
          <div className="music-controls">
            <button
              onClick={() =>
                onSelect((selected - 1 + tracks.length) % tracks.length)
              }
            >
              <Icon name="back" />
            </button>
            <button className="main-play" onClick={onToggle}>
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button onClick={() => onSelect((selected + 1) % tracks.length)}>
              <Icon name="forward" />
            </button>
          </div>
          <section className="queue">
            <div className="queue-head">
              <h2>播放列表</h2>
              <span>{tracks.length} 首</span>
            </div>
            {tracks.map((item, index) => (
              <div
                className={
                  selected === index ? "queue-row active" : "queue-row"
                }
                key={item.id}
              >
                <button onClick={() => onSelect(index)}>
                  <span>{index + 1}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>{item.artist || "未知歌手"}</small>
                  </div>
                </button>
                <button
                  aria-label="删除歌曲"
                  onClick={() => {
                    const next = tracks.filter((entry) => entry.id !== item.id);
                    onTracks(next);
                    onSelect(Math.max(0, Math.min(selected, next.length - 1)));
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          <EmptyState text="还没有音乐。添加可直接播放的音频 URL 后，主页播放器会同步。" />
          <button className="primary-action" onClick={add}>
            <Icon name="plus" />
            添加音乐
          </button>
        </>
      )}
      <section className="netease-entry surface" onClick={() => setNeteaseOpen(true)}>
        <div>
          <small>NETEASE CLOUD MUSIC</small>
          <b>网易云音乐连接</b>
          <span>{netease.baseUrl ? "接口已配置" : "预留接口 · 后续同步歌单与播放"}</span>
        </div>
        <Icon name="chevron" />
      </section>
      {neteaseOpen && (
        <NeteaseConnectionModal
          value={netease}
          onChange={setNetease}
          onSync={(items) => {
            onTracks(items);
            onSelect(0);
          }}
          onClose={() => setNeteaseOpen(false)}
        />
      )}
    </div>
  );
}

function NeteaseConnectionModal({
  value,
  onChange,
  onSync,
  onClose,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  onSync: (tracks: Track[]) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(value);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const save = () => {
    onChange(form);
    setMessage("网易云参数已保存到此设备");
  };
  const sync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const base = (form.baseUrl || "https://music-api.r-vera.com").replace(/\/$/, "");
      const request = async (path: string, params: Record<string, string>) => {
        const response = await fetch(`${base}${path}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: new URLSearchParams({ ...params, ...(form.cookie ? { cookie: form.cookie } : {}) }),
        });
        const result = await response.json() as Record<string, unknown>;
        if (!response.ok || Number(result.code || 200) >= 400) throw new Error(`网易云接口返回 ${result.code || response.status}`);
        return result;
      };
      let playlistId = form.playlistId?.trim();
      if (!playlistId) {
        if (!form.uid?.trim()) throw new Error("请填写网易云 UID 或默认歌单 ID");
        const playlists = await request("/user/playlist", { uid: form.uid.trim(), limit: "50" });
        const first = (playlists.playlist as Array<{ id?: number | string }> | undefined)?.[0];
        playlistId = first?.id ? String(first.id) : "";
      }
      if (!playlistId) throw new Error("没有找到可同步的歌单");
      const detail = await request("/playlist/track/all", { id: playlistId, limit: "500", offset: "0" });
      const songs = (detail.songs as Array<{ id: number; name: string; dt?: number; ar?: Array<{ name?: string }>; al?: { name?: string; picUrl?: string } }> | undefined) || [];
      if (!songs.length) throw new Error("歌单中没有可同步歌曲");
      const urlMap = new Map<string, string>();
      for (let offset = 0; offset < songs.length; offset += 100) {
        const ids = songs.slice(offset, offset + 100).map((song) => song.id).join(",");
        const urls = await request("/song/url/v1", { id: ids, level: "standard" });
        for (const item of (urls.data as Array<{ id?: number; url?: string }> | undefined) || [])
          if (item.id && item.url) urlMap.set(String(item.id), item.url);
      }
      const next = songs.map((song) => ({
        id: `netease-${song.id}`,
        neteaseId: String(song.id),
        title: song.name,
        artist: song.ar?.map((artist) => artist.name).filter(Boolean).join(" / ") || "未知歌手",
        duration: song.dt ? `${Math.floor(song.dt / 60000)}:${String(Math.floor(song.dt / 1000) % 60).padStart(2, "0")}` : undefined,
        cover: song.al?.picUrl || "",
        url: urlMap.get(String(song.id)) || "",
      })).filter((track) => track.url);
      if (!next.length) throw new Error("当前歌单没有取得可播放链接，可能需要刷新 Cookie");
      const saved = { ...form, baseUrl: base, playlistId };
      onChange(saved);
      setForm(saved);
      onSync(next);
      setMessage(`已同步 ${next.length} 首歌曲，播放器与主页已更新`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <section className="connection-modal">
        <div className="modal-head">
          <div><small>NETEASE CLOUD MUSIC</small><h2>网易云音乐</h2></div>
          <button onClick={onClose}><Icon name="close" /></button>
        </div>
        <p>连接你的网易云适配接口后，可把默认歌单、封面和可播放地址同步到 Vesper 本地播放器。</p>
        <div className="parameter-form">
          {[
            ["baseUrl", "接口地址", "https://music-api.r-vera.com"],
            ["cookie", "登录 Cookie / Token", "MUSIC_U=…"],
            ["uid", "网易云 UID", "用户 ID"],
            ["playlistId", "默认歌单 ID", "歌单 ID"],
          ].map(([key, label, placeholder]) => (
            <label className="profile-field" key={key}>
              <span>{label}</span>
              <input
                type={key === "cookie" ? "password" : "text"}
                value={form[key] || ""}
                placeholder={placeholder}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
        {message && <p className="connection-message">{message}</p>}
        <button className="save-profile" onClick={save}>保存网易云参数</button>
        <button className="reset-background" disabled={syncing} onClick={() => void sync()}>{syncing ? "正在同步歌单…" : "同步到 Vesper 播放器"}</button>
      </section>
    </div>
  );
}

function MemoryLibrary() {
  const [, setDocuments] = useState<
    Record<string, { value: unknown }>
  >({});
  const [connections, setConnections] = useLocalDocument<
    Record<string, string>
  >("memory-connection", {});
  const [localNotes] = usePersistentDocument<NoteItem[]>("notes", []);
  const [localTodos] = usePersistentDocument<TodoItem[]>("todos", []);
  const [localAnniversaries] = usePersistentDocument<AnniversaryItem[]>("anniversaries", []);
  const [localDiary] = usePersistentDocument<DiaryDocument>("diary", {});
  const [externalMemory, setExternalMemory] = usePersistentDocument<
    Array<{ id: string; title: string; kind: string; source: string; updatedAt: string }>
  >("externalMemory", []);
  const [connect, setConnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [memoryPreview, setMemoryPreview] = useState<Array<{ id: string; title: string; kind: string; source: string; updatedAt: string }>>([]);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () =>
    fetch(apiUrl("/api/state"), { cache: "no-store", headers: appHeaders() })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) =>
        setDocuments(
          (data as { documents: Record<string, { value: unknown }> }).documents,
        ),
      )
      .catch(() => {});
  useEffect(() => {
    void refresh();
  }, []);
  const notes = localNotes.length;
  const todos = localTodos.length;
  const anniversaries = localAnniversaries.length;
  const diary = Object.keys(localDiary).length;
  const external = externalMemory.length;
  const total = notes + todos + anniversaries + diary + external;
  const syncExternalMemory = async () => {
    if (!connections.memoryUrl) {
      setSyncMessage("请先填写外置记忆库地址");
      return;
    }
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/memory/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: connections.memoryUrl, token: connections.memoryToken, toolName: connections.memoryTool || "memory.list" }),
      });
      const result = (await response.json()) as {
        items?: Array<{ id: string; title: string; kind: string; source: string; updatedAt: string }>;
        count?: number;
        error?: string;
      };
      if (!response.ok || !result.items) throw new Error(result.error || "同步失败");
      setMemoryPreview(result.items);
      setSyncMessage(`已从外置记忆库读取 ${result.count || 0} 条；确认后可整理进 Vesper`);
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : "外置记忆同步失败");
    } finally {
      setSyncing(false);
    }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        documents?: Record<string, { value?: unknown }>;
      };
      for (const [key, entry] of Object.entries(parsed.documents || {})) {
        if (entry && "value" in entry)
          await fetch(apiUrl("/api/state"), {
            method: "PUT",
            headers: appHeaders(true),
            body: JSON.stringify({ key, value: entry.value }),
          });
      }
      await refresh();
    } catch {
      window.alert("备份文件无效");
    }
  };
  return (
    <div className="page-body memory-page">
      <PageIntro
        eyebrow="MEMORY LIBRARY"
        title="记忆库"
        text="根据真实数据生成可视化。"
      />
      <div className="memory-actions">
        <button onClick={() => input.current?.click()}>
          <Icon name="upload" />
          导入
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => void restore(event.target.files?.[0])}
        />
        <button onClick={() => void exportVesperData()}>
          <Icon name="download" />
          导出
        </button>
      </div>
      <section className="memory-map surface">
        <div className="map-head">
          <div>
            <b>记忆星图</b>
            <small>共 {total} 个数据节点</small>
          </div>
        </div>
        {total ? (
          <>
            <div className="constellation">
              <i className="orbit one" />
              <i className="orbit two" />
              <span className="memory-node center">我</span>
              {notes > 0 && (
                <span className="memory-node mood">便笺 {notes}</span>
              )}
              {todos > 0 && (
                <span className="memory-node place">提醒 {todos}</span>
              )}
              {diary > 0 && (
                <span className="memory-node people">日记 {diary}</span>
              )}
              {anniversaries > 0 && (
                <span className="memory-node family">
                  纪念日 {anniversaries}
                </span>
              )}
              {external > 0 && (
                <span className="memory-node external">外置 {external}</span>
              )}
            </div>
            <div className="memory-stats">
              <span>
                <b>{diary}</b>日记
              </span>
              <span>
                <b>{notes}</b>便笺
              </span>
              <span>
                <b>{todos + anniversaries}</b>事项
              </span>
              <span>
                <b>{external}</b>外置
              </span>
            </div>
          </>
        ) : (
          <EmptyState text="还没有可视化数据。" />
        )}
      </section>
      <button className="external-memory" onClick={() => setConnect(true)}>
        <span>
          <Icon name="database" />
        </span>
        <div>
          <b>接入外置记忆库</b>
          <small>
            {connections.memoryUrl ? connections.memoryUrl : "尚未配置"}
          </small>
        </div>
        <Icon name="chevron" />
      </button>
      {connect && (
        <div className="modal-layer">
          <button className="modal-scrim" onClick={() => setConnect(false)} />
          <section className="connection-modal">
            <div className="modal-head">
              <div>
                <small>EXTERNAL MEMORY</small>
                <h2>外置记忆库</h2>
              </div>
              <button onClick={() => setConnect(false)}>
                <Icon name="close" />
              </button>
            </div>
            <label className="profile-field">
              <span>服务地址</span>
              <input
                value={connections.memoryUrl || ""}
                onChange={(event) =>
                  setConnections({
                    ...connections,
                    memoryUrl: event.target.value,
                  })
                }
                placeholder="https://…"
              />
            </label>
            <label className="profile-field">
              <span>访问令牌</span>
              <input
                type="password"
                value={connections.memoryToken || ""}
                onChange={(event) =>
                  setConnections({
                    ...connections,
                    memoryToken: event.target.value,
                  })
                }
              />
            </label>
            <label className="profile-field">
              <span>读取记忆的 MCP Tool</span>
              <input value={connections.memoryTool || "memory.list"} onChange={(event) => setConnections({ ...connections, memoryTool: event.target.value })} placeholder="memory.list" />
            </label>
            <button className="save-profile" onClick={() => setConnect(false)}>
              保存
            </button>
            <button
              className="reset-background"
              disabled={syncing || !connections.memoryUrl}
              onClick={() => void syncExternalMemory()}
            >
              {syncing ? "读取中…" : "同步外置记忆目录"}
            </button>
            {memoryPreview.length > 0 && (
              <>
                <div className="external-memory-preview">
                  {memoryPreview.slice(0, 8).map((item) => <article key={item.id}><small>{item.kind} · {item.source}</small><b>{item.title}</b></article>)}
                </div>
                <button className="save-profile" onClick={() => {
                  setExternalMemory(memoryPreview);
                  setSyncMessage(`已整理 ${memoryPreview.length} 条外置记忆到 Vesper 星图`);
                }}>让 Vesper 整理到记忆库</button>
              </>
            )}
            {syncMessage && <p className="connection-message">{syncMessage}</p>}
          </section>
        </div>
      )}
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
      <SectionTitle icon="music" title="此刻的音乐" />
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
        <EmptyState text="还没有音乐。" />
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

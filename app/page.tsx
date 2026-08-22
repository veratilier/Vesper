"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
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
  const add = () => {
    const title = window.prompt("纪念日名称");
    if (!title?.trim()) return;
    const date = window.prompt(
      "日期（YYYY-MM-DD）",
      new Date().toLocaleDateString("en-CA"),
    );
    if (!date || Number.isNaN(new Date(`${date}T12:00:00`).getTime())) return;
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        date,
        repeats: window.confirm("是否每年重复？"),
      },
    ]);
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
      <button className="primary-action" onClick={add}>
        <Icon name="plus" />
        添加纪念日
      </button>
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
  mic: [
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z",
    "M5 10v2a7 7 0 0 0 14 0v-2",
    "M12 19v3",
  ],
});
function Icon({ name }: { name: string }) {
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
        {iconPaths[name].map((d, i) => (
          <path d={d} key={`d${i}`} />
        ))}
      </g>
      <g>
        {iconPaths[name].map((d, i) => (
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
  { label: "今日", icon: "home" },
  { label: "聊天", icon: "chat" },
  { label: "日记", icon: "diary" },
  { label: "便笺", icon: "note" },
  { label: "提醒", icon: "check" },
  { label: "纪念日", icon: "calendar" },
  { label: "桌宠互动", icon: "pet" },
  { label: "魔盒", icon: "box" },
  { label: "音乐", icon: "music" },
  { label: "记忆库", icon: "library" },
  { label: "设置", icon: "settings" },
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
};
type BoxApp = {
  id: string;
  name: string;
  description: string;
  url?: string;
  kind: string;
};
type ConnectionSettings = Record<string, Record<string, string>>;
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
  const [userName, setUserName] = useState("我");
  const [agentName, setAgentName] = useState("Vesper");
  const [userAvatar, setUserAvatar] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("");
  const [accent, setAccent] = useState("#b8dce8");
  const [customBackground, setCustomBackground] = useState("");
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tracks, setTracks] = usePersistentDocument<Track[]>("music", []);
  const globalPlayer = useRef<HTMLAudioElement>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [environment, setEnvironment] =
    usePersistentDocument<EnvironmentSnapshot>("environment", {
      permission: "unknown",
    });
  const currentTrack = tracks[trackIndex];
  useEffect(() => {
    const audio = globalPlayer.current;
    if (!audio) return;
    if (playing && currentTrack)
      void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing, currentTrack]);
  const shellStyle = {
    "--theme-accent": accent,
    ...(customBackground ? { backgroundImage: customBackground } : {}),
  } as CSSProperties;
  const navigateTo = (label: string) => {
    setDrawerOpen(false);
    if (label !== active) window.setTimeout(() => setActive(label), 290);
  };
  useEffect(() => {
    let live = true;
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
        if (profile) {
          setUserName(profile.userName || "我");
          setAgentName(profile.agentName || "Vesper");
          setUserAvatar(profile.userAvatar || "");
          setAgentAvatar(profile.agentAvatar || "");
        }
        if (appearance) {
          setAccent(appearance.accent || "#b8dce8");
          setCustomBackground(appearance.background || "");
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
    <main className="stage">
      <audio
        ref={globalPlayer}
        src={currentTrack?.url}
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
                <img src="./icon-192.png" alt="" />
              </span>
              <b>VESPER</b>
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
              <button aria-label="新建对话">
                <Icon name="plus" />
              </button>
              <button aria-label="语音通话">
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
                  <img src="./icon-192.png" alt="" />
                </span>
                <div>
                  <b>VESPER</b>
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
              {nav.map(({ label, icon }) => (
                <button
                  key={label}
                  className={active === label ? "nav-row active" : "nav-row"}
                  onClick={() => navigateTo(label)}
                >
                  <VesperNavIcon name={icon} />
                  <span>{label}</span>
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
        {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
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
function usePersistentDocument<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(apiUrl(`/api/state?key=${encodeURIComponent(key)}`), {
      headers: appHeaders(),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((raw) => {
        const data = raw as { value: unknown };
        if (live && data.value !== null) setValue(data.value as T);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      fetch(apiUrl("/api/state"), {
        method: "PUT",
        headers: appHeaders(true),
        body: JSON.stringify({ key, value }),
      }).catch(() => {});
    }, 260);
    return () => window.clearTimeout(timer);
  }, [key, ready, value]);
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

function HistoryModal({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<BridgeChatMessage[]>([]);
  useEffect(() => {
    const token = deviceToken();
    if (!token) return;
    fetch(apiUrl("/api/chat?conversationId=main"), {
      headers: { "x-vesper-device-token": token },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setMessages((data as BridgeSnapshot).messages))
      .catch(() => {});
  }, []);
  const latest = messages[messages.length - 1];
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
        <div className="history-list">
          {latest ? (
            <>
              <small>当前对话</small>
              <button className="selected" onClick={onClose}>
                <b>{latest.content.slice(0, 28) || "未命名对话"}</b>
                <span>
                  {new Date(latest.createdAt).toLocaleString("zh-CN")}
                </span>
              </button>
            </>
          ) : (
            <EmptyState text="还没有聊天记录。" />
          )}
        </div>
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
    const { url } = await uploadImage(file);
    setter(url);
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
  metadata?: { thoughtSummary?: string; durationMs?: number; tools?: string[] };
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

function ConnectedChat({
  agentName,
  userName,
  agentAvatar,
  userAvatar,
}: {
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
  const streamEnd = useRef<HTMLDivElement>(null);
  const refresh = async () => {
    const token = deviceToken();
    if (!token) {
      setError("请先在设置中配对 CyberBoss");
      return;
    }
    try {
      const response = await fetch(apiUrl("/api/chat?conversationId=main"), {
        headers: { "x-vesper-device-token": token },
        cache: "no-store",
      });
      if (response.status === 401) throw new Error("配对口令无效");
      if (!response.ok) throw new Error("暂时无法读取对话");
      setData((await response.json()) as BridgeSnapshot);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接失败");
    }
  };
  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setDraft("");
    try {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: deviceHeaders(),
        body: JSON.stringify({ conversationId: "main", content }),
      });
      if (response.status === 401)
        throw new Error("请先在设置中配对 CyberBoss");
      if (!response.ok) throw new Error("消息发送失败");
      await refresh();
    } catch (reason) {
      setDraft(content);
      setError(reason instanceof Error ? reason.message : "消息发送失败");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);
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
  return (
    <div className="page-body chat-page">
      <div className="bridge-presence">
        <i className={data.bridge.online ? "online" : ""} />
        <span>
          {data.bridge.online ? "CyberBoss 已连接" : "CyberBoss 离线"}
        </span>
      </div>
      <div className="chat-stream">
        {!data.messages.length && (
          <div className="chat-empty">
            <Icon name="chat" />
            <b>{error || "还没有对话"}</b>
            <span>
              {error
                ? "前往设置 → 连接 → CyberBoss 桥接"
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
                  <small>
                    {item.metadata?.tools?.length
                      ? `已使用 ${item.metadata.tools.join("、")}`
                      : `${agentName} · CyberBoss`}
                  </small>
                </div>
              </div>
            </div>
          ) : (
            <div className="sent-turn" key={item.id}>
              <time>{stamp(item.createdAt)}</time>
              <div className="message mine sent-message">
                <div>
                  <p>{item.content}</p>
                  <small>
                    {item.status === "queued"
                      ? "等待 CyberBoss 接收"
                      : "已送达"}
                  </small>
                </div>
                <AvatarMark src={userAvatar} label={userName} kind="user" />
              </div>
            </div>
          ),
        )}
        <div ref={streamEnd} />
      </div>
      <div className="chat-compose">
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
          <button aria-label="添加附件">
            <Icon name="plus" />
          </button>
          <span>{busy ? "发送中…" : ""}</span>
          <button aria-label="语音输入">
            <Icon name="mic" />
          </button>
          {draft.trim() ? (
            <button
              className="send-message-button"
              aria-label="发送消息"
              onClick={() => void send()}
            >
              <Icon name="send" />
            </button>
          ) : (
            <button className="voice" aria-label="开始语音">
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
              <div>
                <small>RUNTIME SUMMARY</small>
                <h2>过程摘要</h2>
                <span>
                  <Icon name="clock" />
                  {thought.metadata?.durationMs
                    ? `${Math.max(1, Math.round(thought.metadata.durationMs / 1000))} 秒`
                    : "CyberBoss"}
                </span>
              </div>
              <button aria-label="关闭" onClick={() => setThought(null)}>
                <Icon name="close" />
              </button>
            </div>
            <p className="runtime-summary">
              {thought.metadata?.thoughtSummary}
            </p>
            <p>
              这里显示 CyberBoss 提供的可核对运行摘要，不包含模型的隐藏推理。
            </p>
          </section>
        </div>
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
  const [preferences, setPreferences] =
    usePersistentDocument<VesperPreferences>("settings", defaultPreferences);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default",
    );
  const [bridgePaired, setBridgePaired] = useState(() =>
    Boolean(deviceToken()),
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
  return (
    <div className="page-body">
      <PageIntro
        eyebrow="PREFERENCES"
        title="设置"
        text="让 Vesper 以你感到舒服的方式陪伴。"
      />
      <SettingsGroup title="连接">
        <SettingRow
          icon="chat"
          title="CyberBoss 桥接"
          sub={
            bridgePaired ? "设备已配对 · 等待运行端" : "未配对 · 连接 CyberBoss"
          }
          status={bridgePaired}
          onClick={() => setSelected("CyberBoss 桥接")}
        />
        <SettingRow
          icon="sparkles"
          title="AI 连接"
          sub="由 CyberBoss 运行时提供"
          onClick={() => setSelected("AI 连接")}
        />
        <SettingRow
          icon="volume"
          title="Agent 声音（TTS）"
          sub="尚未连接声音服务"
          onClick={() => setSelected("Agent 声音")}
        />
        <SettingRow
          icon="link"
          title="MCP 服务"
          sub="由 CyberBoss 项目工具提供"
          onClick={() => setSelected("MCP 服务")}
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
              : "尚未导出"
          }
          onClick={() => setSelected("导出与备份")}
        />
      </SettingsGroup>
      <p className="settings-foot">VESPER 0.3 · CYBERBOSS BRIDGE</p>
      {selected === "Appearance" ? (
        <AppearanceModal
          accent={accent}
          onAccent={onAccent}
          onBackground={onBackground}
          onClose={() => setSelected(null)}
        />
      ) : selected === "CyberBoss 桥接" ? (
        <CyberbossConnectionModal
          onPaired={setBridgePaired}
          onClose={() => setSelected(null)}
        />
      ) : selected &&
        ["通知偏好", "关心频率", "记忆权限", "导出与备份"].includes(
          selected,
        ) ? (
        <FunctionalSettingsModal
          type={selected}
          preferences={preferences}
          onPreferences={setPreferences}
          onClose={() => setSelected(null)}
        />
      ) : (
        selected && (
          <ConnectionModal
            type={selected}
            environment={environment}
            onEnvironment={onEnvironment}
            notificationPermission={notificationPermission}
            onNotificationPermission={setNotificationPermission}
            onClose={() => setSelected(null)}
          />
        )
      )}
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
    const { url } = await uploadImage(file);
    onBackground(
      `linear-gradient(rgba(245,247,247,.18),rgba(245,247,247,.18)),url("${url}")`,
    );
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
  const response = await fetch(apiUrl("/api/state"), { headers: appHeaders() });
  if (!response.ok) throw new Error("读取数据失败");
  const payload = (await response.json()) as {
    documents: Record<string, unknown>;
  };
  const blob = new Blob(
    [
      JSON.stringify(
        { exportedAt: new Date().toISOString(), version: 1, ...payload },
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
              生成包含资料、日记、便笺、提醒、聊天和设置的 JSON
              文件。图片仍保存在 R2，备份中记录其链接。
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

function vapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
function ConnectionModal({
  type,
  environment,
  onEnvironment,
  notificationPermission,
  onNotificationPermission,
  onClose,
}: {
  type: string;
  environment: EnvironmentSnapshot;
  onEnvironment: (value: EnvironmentSnapshot) => void;
  notificationPermission: NotificationPermission;
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
      { label: "TTS 服务商", key: "provider" },
      { label: "API Base URL", key: "baseUrl" },
      { label: "声音 ID", key: "voiceId" },
      { label: "API Key", key: "apiKey", type: "password" },
    ],
    "MCP 服务": [
      { label: "MCP 服务地址", key: "url", placeholder: "https://…" },
      { label: "授权令牌", key: "token", type: "password" },
    ],
    "Web Push": [
      {
        label: "VAPID 公钥",
        key: "vapidPublicKey",
        placeholder: "由推送服务端提供",
      },
    ],
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
      } else if (type === "Web Push") {
        const result = await Notification.requestPermission();
        onNotificationPermission(result);
        if (result !== "granted") throw new Error("通知权限未授权");
        const registration = await navigator.serviceWorker.ready;
        if (form.vapidPublicKey)
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey(form.vapidPublicKey),
          });
        await registration.showNotification("Vesper", {
          body: "通知工具工作正常",
          icon: "./icon-192.png",
        });
      } else {
        save();
        setMessage("TTS 参数已保存；CyberBoss 上线后使用这些参数");
        return;
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
        <img src="./icon-192.png" alt="Vesper 桌宠" />
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
function MusicPage({
  tracks,
  playing,
  onToggle,
  onSelect,
  selected,
  onTracks,
}: {
  tracks: Track[];
  playing: boolean;
  onToggle: () => void;
  onSelect: (index: number) => void;
  selected: number;
  onTracks: (value: Track[]) => void;
}) {
  const track = tracks[selected];
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
        <button onClick={add}>
          <Icon name="plus" />
        </button>
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
    </div>
  );
}

function MemoryLibrary() {
  const [documents, setDocuments] = useState<
    Record<string, { value: unknown }>
  >({});
  const [connections, setConnections] = useLocalDocument<
    Record<string, string>
  >("memory-connection", {});
  const [connect, setConnect] = useState(false);
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
  const notes = Array.isArray(documents.notes?.value)
    ? documents.notes.value.length
    : 0;
  const todos = Array.isArray(documents.todos?.value)
    ? documents.todos.value.length
    : 0;
  const anniversaries = Array.isArray(documents.anniversaries?.value)
    ? documents.anniversaries.value.length
    : 0;
  const diary =
    documents.diary?.value && typeof documents.diary.value === "object"
      ? Object.keys(documents.diary.value as object).length
      : 0;
  const total = notes + todos + anniversaries + diary;
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
            <button className="save-profile" onClick={() => setConnect(false)}>
              保存
            </button>
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

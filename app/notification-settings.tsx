"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";

type Status = "default" | "granted" | "denied" | "provisional" | "ephemeral" | "unknown";
const permission = registerPlugin<{
  check(): Promise<{ status: Status }>;
  request(): Promise<{ status: Status }>;
  openSettings(): Promise<void>;
}>("VesperNotificationPermission");

export function NotificationSettings({ onClose, onWebPush }: {
  onClose: () => void;
  onWebPush: () => void;
}) {
  const [status, setStatus] = useState<Status>("unknown");
  const [available, setAvailable] = useState(false);
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ios = Capacitor.getPlatform() === "ios";
    const ready = ios && Capacitor.isPluginAvailable("VesperNotificationPermission");
    setNative(ios);
    setAvailable(ready);
    let active = true;
    const refresh = () => {
      if (!ready) return;
      void permission.check().then(result => {
        if (active) setStatus(result.status);
      }).catch(() => { if (active) setMessage("读取权限失败，请重新打开此页面。"); });
    };
    refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const request = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (status === "denied") await permission.openSettings();
      else setStatus((await permission.request()).status);
    } catch {
      setMessage("未能获取通知权限，请稍后重试。");
    } finally { setBusy(false); }
  };
  const labels: Record<Status, string> = {
    default: "尚未授权", granted: "已授权", denied: "已拒绝，可前往系统设置开启",
    provisional: "已允许静默通知", ephemeral: "已临时授权", unknown: "正在读取权限",
  };

  return <div className="modal-layer">
    <button className="modal-scrim" onClick={onClose} aria-label="关闭通知设置" />
    <section className="connection-modal">
      <div className="modal-head"><h2>Notification</h2><button onClick={onClose} aria-label="关闭">×</button></div>
      <div className="parameter-form">
        <div>
          <h3>Web Push</h3>
          <p className="settings-hint">浏览器与主屏幕 PWA 的消息推送。</p>
          <button className="save-profile" onClick={onWebPush}>设置 Web Push</button>
        </div>
        <div>
          <h3>苹果通知权限</h3>
          <p className="settings-hint">{available ? labels[status] : native ? "请安装新版 Vesper App 后获取权限。" : "请在 iPhone 原生 Vesper App 中获取权限。"}</p>
          <button className="save-profile" disabled={!available || busy || status === "granted" || status === "unknown"} onClick={() => void request()}>
            {busy ? "处理中…" : status === "granted" ? "已获得通知权限" : status === "denied" ? "打开系统设置" : "获取苹果通知权限"}
          </button>
          <p className="settings-hint">授权允许 App 显示通知；远程消息推送尚待接入。</p>
        </div>
      </div>
      {message && <p className="connection-message" role="status">{message}</p>}
    </section>
  </div>;
}

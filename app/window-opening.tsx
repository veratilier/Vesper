"use client";
import { useEffect, useRef, useState } from "react";
import "./window-opening.css";
const LAYERS = ["/opening/sky-v5.png", "/opening/castle-v7.png", "/opening/trees-v7.png", "/opening/window-v7.png", "/opening/desk-v7.png"];
export function WindowOpening() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [hold, setHold] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {setReduced(query.matches); if(query.matches) setHold(true);};
    change(); query.addEventListener("change", change);
    let cancelled = false;
    Promise.all(LAYERS.map(src => new Promise<void>((resolve,reject) => {
      const img = new Image(); img.onload=()=>resolve(); img.onerror=reject; img.src=src;
    }))).then(()=>{if(!cancelled) setReady(true);}).catch(()=>{if(!cancelled) {setReady(true);setHold(true);}});
    // A stalled image request exposes the entry button, never auto-enters the app.
    const fallback = setTimeout(()=>{if(!cancelled) setHold(true);},15000);
    return ()=>{cancelled=true;clearTimeout(fallback);query.removeEventListener("change",change);node?.close();};
  },[]);
  useEffect(()=>{
    if(!ready) return;
    const timer=setTimeout(()=>setHold(true),4000);
    return ()=>clearTimeout(timer);
  },[ready]);
  useEffect(()=>{
    if(!leaving) return;
    const timer=setTimeout(()=>{dialog.current?.close();setVisible(false);},reduced?0:1000);
    return ()=>clearTimeout(timer);
  },[leaving,reduced]);
  if(!visible) return null;
  return <dialog ref={dialog} className={`window-opening${ready?' opening-ready':''}${hold?' opening-hold':''}${reduced?' opening-reduced':''}${leaving?' opening-leaving':''}`} aria-label="Vesper 开屏" onCancel={e=>{e.preventDefault();setLeaving(true);}}>
    <div className="opening-art" aria-hidden="true">
      {LAYERS.map((src,i)=><img key={src} src={src} className={`opening-plate opening-depth-${i}`} alt="" draggable={false}/>)}
    </div>
    <button className="opening-enter" disabled={!hold || leaving} onClick={()=>setLeaving(true)}>Enter Vesper <span aria-hidden="true">›</span></button>
  </dialog>;
}

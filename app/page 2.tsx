'use client';
import { useState } from 'react';

const nav = [['⌂','今日'],['✎','日记'],['▤','便笺'],['✓','提醒'],['◇','纪念日'],['♧','桌宠互动'],['□','魔盒'],['♫','音乐'],['◌','记忆库'],['⚙','设置']];

export default function Home() {
  const [active,setActive] = useState('今日');
  const [checked,setChecked] = useState([false,false,true]);
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">V</span><span>VESPER</span></div>
      <nav aria-label="主导航">{nav.map(([icon,label])=><button key={label} className={active===label?'nav-item active':'nav-item'} onClick={()=>setActive(label)}><span className="nav-icon">{icon}</span><span className="nav-label">{label}</span></button>)}</nav>
      <div className="profile"><span className="avatar">鹭</span><span><b>白露</b><small>愿此刻安静</small></span><i>···</i></div>
    </aside>
    <section className="content">
      <header className="topbar"><button className="menu" aria-label="收起侧边栏">☰</button><span className="crumb">VESPER / {active}</span><div className="top-actions"><button aria-label="搜索">⌕</button><button aria-label="通知">♢</button><span className="status-dot" /></div></header>
      <div className="dashboard">
        <section className="hero">
          <div className="weather"><span className="moon">◐</span><div><b>17°</b><small>新加坡 · 薄云</small></div></div>
          <div className="greeting"><p>2026年8月22日 · 星期六</p><h1>晚上好，白露。</h1><h2>愿你今日的疲惫，都有温柔的归处。</h2></div>
          <div className="care"><span>今日关心</span><p>“慢一点也没关系，月亮总会照见回家的路。”</p><small>—— Vesper</small></div>
        </section>
        <div className="grid">
          <section className="card notes-card"><CardHead title="便笺" meta="3 NOTES" action="＋"/><div className="note peach"><span>☼</span><p>周末去花市，买一束白色洋桔梗。</p><small>今天 14:30</small></div><div className="note blue"><span>⌁</span><p>摘抄：我们终将与美好重逢。</p><small>昨天</small></div><button className="text-link">查看全部便笺 →</button></section>
          <section className="card reminder-card"><CardHead title="提醒" meta="TODAY" action="＋"/>{['给绿植浇水','整理本周照片','回复妈妈的消息'].map((item,i)=><button className="todo" key={item} onClick={()=>setChecked(v=>v.map((x,j)=>j===i?!x:x))}><span className={checked[i]?'check done':'check'}>{checked[i]?'✓':''}</span><span className={checked[i]?'done-text':''}>{item}<small>{i===0?'19:00':i===1?'今晚':'已完成'}</small></span></button>)}</section>
          <section className="card anniversary-card"><CardHead title="纪念日" meta="NEXT"/><div className="anniversary"><div><small>距离</small><strong>27</strong><small>天</small></div><span><b>和小满认识的第 7 年</b><small>2026年9月18日</small></span></div><div className="mini-dates"><span>09 / 18</span><i/><span>12 / 24</span><i/><span>01 / 01</span></div></section>
          <section className="card music-card"><div className="album"><span>Ⅴ</span></div><div className="song"><small>正在播放 · VESPER FM</small><b>Mist Over The Lake</b><span>Hollow Coves</span><div className="progress"><i/></div><div className="player"><small>1:42</small><button>↶</button><button className="play">Ⅱ</button><button>↷</button><small>3:58</small></div></div></section>
        </div>
        <footer><span>晚风温柔，适合收藏今天。</span><span>VESPER · 19:42</span></footer>
      </div>
    </section>
  </main>;
}
function CardHead({title,meta,action}:{title:string;meta:string;action?:string}) { return <div className="card-head"><div><h3>{title}</h3><small>{meta}</small></div>{action&&<button aria-label={`添加${title}`}>{action}</button>}</div> }

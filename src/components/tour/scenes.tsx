// 導覽的 6 個畫面：手機畫面全部用程式畫出來（假資料），鏡頭動作寫在 tour.css
import type { ComponentType } from 'react'

export type Scene = {
  id: string
  title: string
  sub: string
  duration: number // 這個畫面播多久（毫秒）
  Screen: ComponentType
}

const C = {
  me: '#3D8FE0',
  her: '#E0577F',
  date: '#9B7BD8',
  red: '#E2534B',
  brown: '#9C7B6B',
  green: '#34A86B',
}

type Pill = { t: string; c: string }

// 2026 年 11 月：11/1 剛好是週日，畫 5 週
const DAYS = Array.from({ length: 35 }, (_, i) => (i < 30 ? i + 1 : i - 29))

function Pills({ list }: { list: Pill[] }) {
  return (
    <>
      {list.map((p, i) => (
        <span key={i} className="m-pill" style={{ background: `${p.c}2b`, color: p.c }}>
          {p.t}
        </span>
      ))}
    </>
  )
}

function Month({ events, tags = [], tap }: { events: Record<number, Pill[]>; tags?: number[]; tap?: number }) {
  return (
    <div className="m-month">
      <div className="m-wd">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <span key={w} className={i === 0 ? 'sun' : ''}>
            {w}
          </span>
        ))}
      </div>
      <div className="m-grid">
        {DAYS.map((d, i) => {
          const other = i >= 30
          const tagIndex = tags.indexOf(i)
          return (
            <div key={i} className={['m-cell', other ? 'other' : '', tap === i ? 'tapped' : ''].join(' ')}>
              <span className={['m-num', i % 7 === 0 ? 'sun' : '', i === 6 ? 'today' : ''].join(' ')}>
                {d}
                {tagIndex >= 0 && (
                  <i className="m-tag" style={{ animationDelay: `${1.2 + tagIndex * 0.12}s` }}>
                    可約
                  </i>
                )}
              </span>
              {!other && events[i] && <Pills list={events[i]} />}
              {tap === i && <span className="m-ripple" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Header({ seg, active = 0, moving }: { seg?: boolean; active?: number; moving?: boolean }) {
  return (
    <div className="m-head">
      <div className="m-status">
        <span>9:41</span>
        <span>●●● ▮</span>
      </div>
      {seg && (
        <div className={moving ? 'm-seg moving' : 'm-seg'} style={{ ['--seg' as string]: active }}>
          <span className="m-seg-thumb" />
          <span>我的</span>
          <span>共用</span>
          <span>宛的</span>
        </div>
      )}
      <div className="m-title">2026年11月</div>
    </div>
  )
}

function TabBar({ active }: { active: number }) {
  return (
    <div className="m-tabs">
      {['行事曆', '每日清單', '備忘錄', '列表'].map((t, i) => (
        <span key={t} className={i === active ? 'on' : ''}>
          {t}
        </span>
      ))}
    </div>
  )
}

// 1. 開場
function Intro() {
  return (
    <div className="t-cam cam-intro">
      <div className="intro">
        <img src="/icon-512.png" alt="" className="intro-icon" />
        <div className="intro-name">Time Manager</div>
        <div className="intro-chips">
          <span style={{ animationDelay: '1.4s' }}>行事曆</span>
          <span style={{ animationDelay: '1.7s' }}>每日清單</span>
          <span style={{ animationDelay: '2s' }}>備忘錄</span>
        </div>
      </div>
    </div>
  )
}

// 2. 三個行事曆
const MINE: Record<number, Pill[]> = {
  2: [{ t: '日文', c: C.red }],
  9: [{ t: '日文', c: C.red }, { t: '吃飯', c: C.brown }, { t: '看電影', c: C.date }],
  16: [{ t: '日文', c: C.red }],
  18: [{ t: '論文', c: '#EE9A2E' }],
  23: [{ t: '日文', c: C.red }],
  27: [{ t: '出遊', c: C.date }],
}
const SHARED: Record<number, Pill[]> = {
  2: [{ t: '點', c: C.me }],
  8: [{ t: '宛', c: C.her }],
  9: [{ t: '宛', c: C.her }, { t: '點', c: C.me }, { t: '看電影', c: C.date }],
  10: [{ t: '宛', c: C.her }],
  16: [{ t: '點', c: C.me }, { t: '宛', c: C.her }],
  18: [{ t: '點', c: C.me }],
  23: [{ t: '點', c: C.me }],
  27: [{ t: '出遊', c: C.date }],
}
const HERS: Record<number, Pill[]> = {
  8: [{ t: '宛', c: C.her }],
  9: [{ t: '宛', c: C.her }, { t: '看電影', c: C.date }],
  10: [{ t: '宛', c: C.her }],
  16: [{ t: '宛', c: C.her }],
  27: [{ t: '出遊', c: C.date }],
}

function Views() {
  return (
    <div className="t-cam cam-views">
      <Header seg moving />
      <div className="m-track">
        <Month events={MINE} />
        <Month events={SHARED} />
        <Month events={HERS} />
      </div>
      <TabBar active={0} />
    </div>
  )
}

// 3. 點日期先看當天
function DayTap() {
  return (
    <div className="t-cam cam-day">
      <Header seg active={0} />
      <Month events={MINE} tap={9} />
      <div className="m-sheet">
        <div className="m-sheet-head">
          <strong>11月10日（週二）</strong>
          <span className="m-plus">＋</span>
        </div>
        {[
          ['10:20', '日文', C.red],
          ['12:00', '吃飯', C.brown],
          ['19:00', '看電影', C.date],
        ].map(([time, title, c]) => (
          <div key={title} className="m-row">
            <span className="m-time">{time}</span>
            <span className="m-bar" style={{ background: c }} />
            <span>{title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 4. 新增：滾輪選時間、忙碌／一起
function NewItem() {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
  return (
    <div className="t-cam cam-form">
      <div className="m-status">
        <span>9:41</span>
        <span>●●● ▮</span>
      </div>
      <div className="f-head">
        <span className="f-x">✕</span>
        <span className="f-save">保存</span>
      </div>
      <div className="f-title">看電影</div>
      <div className="f-row">
        <span>行事曆</span>
        <span className="f-seg">
          <span className="f-seg-thumb" />
          <span>忙碌</span>
          <span>一起</span>
        </span>
      </div>
      <div className="f-row">
        <span>開始</span>
        <span className="f-chips">
          <span className="f-chip">11/10（二）</span>
          <span className="f-chip on">19:30</span>
        </span>
      </div>
      <div className="f-wheel">
        <span className="f-wheel-hl" />
        <div className="f-col">
          <div className="f-col-inner hours">
            {hours.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        </div>
        <span className="f-colon">:</span>
        <div className="f-col">
          <div className="f-col-inner mins">
            {mins.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="f-row">
        <span>標籤</span>
        <span className="f-tag">
          <i style={{ background: C.date }} />
          約會
        </span>
      </div>
      <div className="f-row">
        <span>重複</span>
        <span className="f-muted">不重複</span>
      </div>
      <div className="f-row">
        <span>地點</span>
        <span className="f-muted">信義威秀</span>
      </div>
      <div className="f-row tall">
        <span>備註</span>
        <span className="f-muted">買爆米花</span>
      </div>
    </div>
  )
}

// 5. 備忘錄 → 排到某天 → 每日清單的待辦
function Memo() {
  return (
    <div className="t-cam cam-memo">
      <div className="m-status">
        <span>9:41</span>
        <span>●●● ▮</span>
      </div>
      <div className="p-title">備忘錄</div>
      <div className="memo-card fly">
        <span>寄履歷給 A 公司</span>
        <span className="memo-btn">排到某天</span>
      </div>
      <div className="memo-card">
        <span>買生日禮物</span>
        <span className="memo-btn">排到某天</span>
      </div>
      <div className="memo-card">
        <span>想看的電影：沙丘</span>
        <span className="memo-btn">排到某天</span>
      </div>
      <div className="p-title second">每日清單・11/12（四）</div>
      <div className="daily-card">
        <span className="d-box">✓</span>
        <span className="d-label">待辦</span>
        <span>寄履歷給 A 公司</span>
      </div>
      <div className="daily-card static">
        <span className="d-box empty" />
        <span className="d-label">14:20</span>
        <span>R 上課</span>
      </div>
      <div className="daily-card static">
        <span className="d-box empty" />
        <span className="d-label">19:00</span>
        <span>da 上課</span>
      </div>
    </div>
  )
}

// 6. 共用行事曆：可約
function Free() {
  return (
    <div className="t-cam cam-free">
      <Header seg active={1} />
      <div className="m-upcoming">
        <b>接下來一週可約</b>
        <span>11/8（日）</span>
        <span>11/14（六）</span>
      </div>
      <Month events={SHARED} tags={[0, 3, 7, 13, 14, 20, 21, 25, 28]} />
    </div>
  )
}

export const SCENES: Scene[] = [
  { id: 'intro', title: '你的時間，一個地方管理。', sub: '行事曆、每日清單、備忘錄，都是同一份資料。', duration: 5000, Screen: Intro },
  { id: 'views', title: '三個行事曆，一鍵切換。', sub: '自己的行程完整顯示；對方的只看到「點」或「宛」。', duration: 7000, Screen: Views },
  { id: 'day', title: '點一下日期，先看當天。', sub: '想新增，就按右上角的 ＋。', duration: 6500, Screen: DayTap },
  { id: 'form', title: '滑一下，時間就選好。', sub: '選「一起」，就是兩個人都看得到的約會。', duration: 7000, Screen: NewItem },
  { id: 'memo', title: '想到什麼，先記下來。', sub: '決定好哪天做，按「排到某天」就變成那天的待辦。', duration: 7000, Screen: Memo },
  { id: 'free', title: '一起的時間，一眼就看到。', sub: '12–22 點連續空 5 小時，就是「可約」。', duration: 7000, Screen: Free },
]

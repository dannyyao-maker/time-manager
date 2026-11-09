// iPhone 主畫面小工具：產生要貼到 Scriptable App 的程式
// 程式裡會放：資料庫網址、公開金鑰（本來就公開）、小工具密碼（只在使用者手機上，不進 repo）。
// 小工具呼叫資料庫的 widget_week()，畫出這週 7 天（週日開始）每天的項目，樣式參考 TimeTree 的週小工具。

export type WidgetConfig = {
  supabaseUrl: string
  publishableKey: string
  token: string
  appUrl: string
}

// 注意：下面整段是「給 Scriptable 執行的程式」，所以裡面不用反引號，避免和這裡的字串混在一起
const SCRIPT_BODY = String.raw`
// ===== 以下不用改 =====
var WEEK = ['日', '一', '二', '三', '四', '五', '六']
var family = config.widgetFamily || 'large'
var BIG = family === 'large' || family === 'extraLarge'

function hexToRgb(hex) {
  var n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(hex, target, amount) {
  var c = hexToRgb(hex)
  var out = c.map(function (v, i) { return Math.round(v + (target[i] - v) * amount) })
  return '#' + out.map(function (v) { return ('0' + v.toString(16)).slice(-2) }).join('')
}
function dyn(light, dark) { return Color.dynamic(new Color(light), new Color(dark)) }
function pad(n) { return ('0' + n).slice(-2) }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }

// 小工具的寬度（點，pt）：依螢幕寬度估算
function widgetWidth() {
  var w = Device.screenSize().width
  if (w >= 428) return 364
  if (w >= 414) return 360
  if (w >= 393) return 338
  if (w >= 390) return 338
  return 329
}

async function load() {
  var fm = FileManager.local()
  var cache = fm.joinPath(fm.documentsDirectory(), 'time-manager-week.json')
  try {
    var req = new Request(SUPABASE_URL + '/rest/v1/rpc/widget_week')
    req.method = 'POST'
    req.headers = { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' }
    req.body = JSON.stringify({ p_token: TOKEN })
    req.timeoutInterval = 15
    var rows = await req.loadJSON()
    if (!Array.isArray(rows)) throw new Error((rows && rows.message) || '讀取失敗')
    fm.writeString(cache, JSON.stringify(rows))
    return { rows: rows, error: null }
  } catch (e) {
    // 沒網路時用上一次的資料
    if (fm.fileExists(cache)) return { rows: JSON.parse(fm.readString(cache)), error: null, stale: true }
    return { rows: [], error: String(e.message || e) }
  }
}

function build(data) {
  var w = new ListWidget()
  w.backgroundColor = dyn('#FFFDFB', '#1C1C1E')
  w.url = APP_URL
  w.setPadding(12, 8, 10, 8)
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

  var ink = dyn('#2B2622', '#F2F2F2')
  var muted = dyn('#8C837B', '#8E8E93')
  var sunday = new Color('#E2534B')
  var colW = Math.floor((widgetWidth() - 16) / 7)
  var pillH = BIG ? 22 : 14
  var maxItems = BIG ? 10 : 4

  var today = new Date()
  var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  var mid = new Date(start.getTime() + 3 * 86400000)

  // 標題：11月
  var head = w.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  head.setPadding(0, 6, 0, 6)
  var title = head.addText((mid.getMonth() + 1) + '月')
  title.font = Font.boldSystemFont(BIG ? 20 : 17)
  title.textColor = ink
  head.addSpacer()
  if (data.error) {
    var err = head.addText(data.error)
    err.font = Font.systemFont(9)
    err.textColor = sunday
    err.lineLimit = 1
  } else if (data.stale) {
    var st = head.addText('離線')
    st.font = Font.systemFont(9)
    st.textColor = muted
  }
  w.addSpacer(BIG ? 6 : 3)

  // 週日～週六、日期
  var byDay = {}
  data.rows.forEach(function (r) { (byDay[r.day] = byDay[r.day] || []).push(r) })

  var grid = w.addStack()
  grid.layoutHorizontally()
  grid.spacing = 0
  for (var i = 0; i < 7; i++) {
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    var key = iso(d)
    var isToday = key === iso(today)
    var col = grid.addStack()
    col.layoutVertically()
    col.size = new Size(colW, 0)
    col.spacing = BIG ? 3 : 2

    var wd = col.addStack()
    wd.size = new Size(colW, 12)
    wd.addSpacer()
    var wdt = wd.addText('週' + WEEK[i])
    wdt.font = Font.systemFont(9)
    wdt.textColor = muted
    wd.addSpacer()

    var num = col.addStack()
    num.size = new Size(colW, BIG ? 24 : 21)
    num.centerAlignContent()
    num.addSpacer()
    var circle = num.addStack()
    circle.size = new Size(BIG ? 22 : 19, BIG ? 22 : 19)
    circle.cornerRadius = BIG ? 11 : 9.5
    circle.centerAlignContent()
    if (isToday) circle.backgroundColor = dyn('#2B2622', '#FFFFFF')
    var nt = circle.addText(String(d.getDate()))
    nt.font = Font.semiboldSystemFont(BIG ? 13 : 12)
    nt.textColor = isToday ? dyn('#FFFFFF', '#1C1C1E') : i === 0 ? sunday : ink
    nt.minimumScaleFactor = 0.7
    nt.lineLimit = 1
    num.addSpacer()

    var list = byDay[key] || []
    list.slice(0, maxItems).forEach(function (r) {
      var pill = col.addStack()
      pill.size = new Size(colW - 2, pillH)
      pill.cornerRadius = 3
      pill.centerAlignContent()
      pill.setPadding(0, 2, 0, 2)
      var c = r.color || '#A39A92'
      if (r.all_day && !r.is_task) {
        pill.backgroundColor = new Color(c, 0.9)
      } else {
        pill.backgroundColor = Color.dynamic(new Color(c, 0.18), new Color(c, 0.28))
      }
      var label = (r.is_task ? (r.is_done ? '☑' : '☐') : '') + r.title
      var t = pill.addText(label)
      t.font = Font.semiboldSystemFont(BIG ? 11.5 : 9)
      t.lineLimit = 1
      t.minimumScaleFactor = 0.75
      t.textColor = r.all_day && !r.is_task ? Color.white() : dyn(mix(c, [0, 0, 0], 0.3), mix(c, [255, 255, 255], 0.35))
      if (r.is_done) t.textOpacity = 0.45
    })
    if (list.length > maxItems) {
      var more = col.addText('+' + (list.length - maxItems))
      more.font = Font.systemFont(9)
      more.textColor = muted
    }
    col.addSpacer()
  }
  w.addSpacer()
  return w
}

var data = await load()
var widget = build(data)
if (config.runsInWidget) {
  Script.setWidget(widget)
} else if (family === 'medium') {
  await widget.presentMedium()
} else {
  await widget.presentLarge()
}
Script.complete()
`

export function buildWidgetScript(c: WidgetConfig): string {
  const q = (s: string) => JSON.stringify(s)
  return `// Time Manager：這週的行事曆（iPhone 主畫面小工具）
// 用法：在 Scriptable App 新增一個 Script，整段貼上；主畫面加 Scriptable 小工具（中或大），選這個 Script。
// 下面的 TOKEN 是你的小工具密碼：只能讀「這週的我的行事曆」，不要傳給別人。
// 在網站「設定 → 手機小工具」重新產生密碼後，這裡的舊密碼就失效了。
var SUPABASE_URL = ${q(c.supabaseUrl)}
var PUBLISHABLE_KEY = ${q(c.publishableKey)}
var TOKEN = ${q(c.token)}
var APP_URL = ${q(c.appUrl)}
${SCRIPT_BODY}`
}

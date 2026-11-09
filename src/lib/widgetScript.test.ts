import { describe, expect, it } from 'vitest'
import { buildWidgetScript } from './widgetScript'

const cfg = { supabaseUrl: 'https://x.supabase.co', publishableKey: 'sb_publishable_abc', token: 'a'.repeat(64), appUrl: 'https://app.example' }

describe('iPhone 小工具程式', () => {
  it('放進網址、公開金鑰、密碼', () => {
    const s = buildWidgetScript(cfg)
    expect(s).toContain('var SUPABASE_URL = "https://x.supabase.co"')
    expect(s).toContain('var TOKEN = "' + 'a'.repeat(64) + '"')
    expect(s).toContain('/rest/v1/rpc/widget_week')
  })

  it('是可以執行的 JavaScript（Scriptable 允許最外層 await）', () => {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    expect(() => new AsyncFunction(buildWidgetScript(cfg))).not.toThrow()
  })

  it('密碼裡有引號也不會弄壞程式', () => {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    expect(() => new AsyncFunction(buildWidgetScript({ ...cfg, token: 'a"b\c' }))).not.toThrow()
  })
})

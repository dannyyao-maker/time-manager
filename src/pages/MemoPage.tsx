import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createMemo, deleteMemo, listMemos, scheduleMemo, type Memo } from '../data/memos'
import { chipDate } from '../lib/formTime'
import { todayISO } from '../lib/dates'
import MiniMonth from '../components/MiniMonth'

type Props = { canEdit: boolean }

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// 備忘錄：先記下來；決定好日期就「排到某天」變成那天的待辦，用不到就直接刪
export default function MemoPage({ canEdit }: Props) {
  const [memos, setMemos] = useState<Memo[] | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null) // 正在選日期的那一筆
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setMemos(await listMemos())
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function add(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setBusy(true)
    try {
      const m = await createMemo(t)
      setMemos((prev) => [...(prev ?? []), m])
      setText('')
      setError(null)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function schedule(memo: Memo, date: string) {
    setBusy(true)
    try {
      await scheduleMemo(memo.id, date)
      setMemos((prev) => (prev ?? []).filter((m) => m.id !== memo.id))
      setScheduling(null)
      setNotice(`已排到 ${chipDate(date)} 的每日清單：${memo.text}`)
      setError(null)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(memo: Memo) {
    setBusy(true)
    try {
      await deleteMemo(memo.id)
      setMemos((prev) => (prev ?? []).filter((m) => m.id !== memo.id))
      setConfirmDelete(null)
      setError(null)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="narrow">
      <div className="page-title">
        <h1>備忘錄</h1>
      </div>
      <p className="muted small memo-intro">先記下來；決定好哪天要做，就按「排到某天」，它會變成那天每日清單的待辦。</p>

      {canEdit && (
        <form className="inline-form memo-add" onSubmit={add}>
          <input placeholder="記一件事，按 Enter" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary" type="submit" disabled={busy || !text.trim()}>
            新增
          </button>
        </form>
      )}

      {notice && (
        <p className="form-note memo-notice" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}
      {error && <p className="error">發生錯誤：{error}</p>}
      {!memos && !error && <p className="muted">載入中…</p>}
      {memos && memos.length === 0 && <div className="empty-box">還沒有備忘錄。</div>}

      <ul className="memo-list">
        {memos?.map((m) => (
          <li key={m.id} className="memo-row">
            <div className="memo-line">
              <span className="memo-text">{m.text}</span>
              {canEdit && (
                <span className="memo-actions">
                  <button
                    className={scheduling === m.id ? 'chip active' : 'chip'}
                    onClick={() => {
                      setScheduling(scheduling === m.id ? null : m.id)
                      setConfirmDelete(null)
                    }}
                    disabled={busy}
                  >
                    排到某天
                  </button>
                  {confirmDelete === m.id ? (
                    <>
                      <button className="btn-danger btn-small" onClick={() => remove(m)} disabled={busy}>
                        刪除
                      </button>
                      <button className="btn-ghost btn-small" onClick={() => setConfirmDelete(null)}>
                        不要
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-icon memo-delete"
                      onClick={() => {
                        setConfirmDelete(m.id)
                        setScheduling(null)
                      }}
                      aria-label={`刪除「${m.text}」`}
                      disabled={busy}
                    >
                      🗑
                    </button>
                  )}
                </span>
              )}
            </div>
            {scheduling === m.id && (
              <div className="memo-schedule">
                <p className="muted small">選一天，這筆會變成那天的待辦：</p>
                <MiniMonth value={todayISO()} onChange={(d) => schedule(m, d)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

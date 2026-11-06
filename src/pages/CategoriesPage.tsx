import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../data/types'
import {
  PALETTE,
  UNCATEGORIZED_COLOR,
  countDeleteImpact,
  createCategory,
  createStarterCategories,
  deleteCategory,
  listCategories,
  topLevel,
  updateCategory,
} from '../data/categories'
import ConfirmDialog from '../components/ConfirmDialog'
import ColorSwatches from '../components/ColorSwatches'

type Props = { canEdit: boolean }

type PendingDelete = { category: Category; items: number }

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function CategoriesPage({ canEdit }: Props) {
  const [all, setAll] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null) // 正在編輯的類別
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      setAll(await listCategories())
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const categories = topLevel(all)

  function add() {
    const name = newName.trim()
    if (!name) return
    run(async () => {
      // 預設用還沒被用過的顏色
      const used = new Set(categories.map((c) => c.color?.toLowerCase()))
      const color = (PALETTE.find((p) => !used.has(p.hex.toLowerCase())) ?? PALETTE[categories.length % PALETTE.length]).hex
      await createCategory({ name, color, sort_order: categories.length })
      setNewName('')
    })
  }

  function toggleOpen(cat: Category) {
    if (openId === cat.id) {
      setOpenId(null)
    } else {
      setOpenId(cat.id)
      setRenameValue(cat.name)
    }
  }

  function saveName(cat: Category) {
    const name = renameValue.trim()
    if (!name || name === cat.name) return
    run(() => updateCategory(cat.id, { name }))
  }

  async function askDelete(category: Category) {
    setBusy(true)
    try {
      const impact = await countDeleteImpact(category)
      setPendingDelete({ category, ...impact })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">載入中…</p>

  return (
    <section className="narrow">
      <div className="page-title">
        <h1>類別</h1>
      </div>

      {error && <p className="error">發生錯誤：{error}</p>}

      {canEdit && (
        <form
          className="inline-form add-top"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            placeholder="新類別名稱，例如「論文」"
            value={newName}
            maxLength={50}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy || !newName.trim()}>
            新增
          </button>
        </form>
      )}

      {canEdit && categories.length === 0 && (
        <div className="empty-box">
          <p>還沒有任何類別。</p>
          <button className="btn-secondary" onClick={() => run(createStarterCategories)} disabled={busy}>
            一鍵建立提案裡的初始類別
          </button>
          <p className="muted small">研所課程、CG、DA、論文、約會、生活、其它重要</p>
        </div>
      )}

      <ul className="cat-list">
        {categories.map((cat) => {
          const color = cat.color ?? UNCATEGORIZED_COLOR
          const open = openId === cat.id
          return (
            <li key={cat.id} className={open ? 'cat-card open' : 'cat-card'}>
              <button
                className="cat-head"
                onClick={() => canEdit && toggleOpen(cat)}
                disabled={!canEdit}
                aria-expanded={open}
              >
                <span className="cat-bar" style={{ background: color }} />
                <span className="cat-name">{cat.name}</span>
                {canEdit && <span className="cat-chevron">{open ? '收起' : '編輯'}</span>}
              </button>

              {open && (
                <div className="cat-body">
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveName(cat)
                    }}
                  >
                    <input value={renameValue} maxLength={50} onChange={(e) => setRenameValue(e.target.value)} aria-label="類別名稱" />
                    <button
                      className="btn-secondary btn-small"
                      type="submit"
                      disabled={busy || !renameValue.trim() || renameValue.trim() === cat.name}
                    >
                      改名
                    </button>
                  </form>
                  <ColorSwatches value={cat.color} disabled={busy} onPick={(hex) => run(() => updateCategory(cat.id, { color: hex }))} />
                  <button className="btn-ghost btn-small danger-text cat-delete" onClick={() => askDelete(cat)} disabled={busy}>
                    刪除這個類別
                  </button>
                </div>
              )}
            </li>
          )
        })}

        <li className="cat-card">
          <div className="cat-head static">
            <span className="cat-bar" style={{ background: UNCATEGORIZED_COLOR }} />
            <span className="cat-name">未分類</span>
            <span className="muted small">沒選類別時，固定灰色</span>
          </div>
        </li>
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          title="刪除類別"
          danger
          confirmLabel="確定刪除"
          message={
            <>
              <p>
                刪除「<strong>{pendingDelete.category.name}</strong>」會一併刪除 <strong>{pendingDelete.items}</strong> 筆項目。
              </p>
              <p className="error">刪除後無法復原。</p>
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteCategory(pendingDelete.category.id)
            setPendingDelete(null)
            setOpenId(null)
            await reload()
          }}
        />
      )}
    </section>
  )
}

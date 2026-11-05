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
  sortAsTree,
  updateCategory,
} from '../data/categories'
import ConfirmDialog from '../components/ConfirmDialog'
import ColorField from '../components/ColorField'

type Props = { canEdit: boolean }

type PendingDelete = { category: Category; children: number; items: number }

export default function CategoriesPage({ canEdit }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTopName, setNewTopName] = useState('')
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null)
  const [newChildName, setNewChildName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      setCategories(await listCategories())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // 包一層：執行時鎖住按鈕、出錯顯示訊息、完成後重新讀取
  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const tree = sortAsTree(categories)

  function addTop() {
    const name = newTopName.trim()
    if (!name) return
    run(async () => {
      const tops = categories.filter((c) => !c.parent_id)
      await createCategory({
        name,
        parent_id: null,
        color: PALETTE[tops.length % PALETTE.length],
        sort_order: tops.length,
      })
      setNewTopName('')
    })
  }

  function addChild(parentId: string) {
    const name = newChildName.trim()
    if (!name) return
    run(async () => {
      const siblings = categories.filter((c) => c.parent_id === parentId)
      await createCategory({ name, parent_id: parentId, color: null, sort_order: siblings.length })
      setNewChildName('')
      setAddingChildFor(null)
    })
  }

  function saveRename(id: string) {
    const name = renameValue.trim()
    if (!name) return
    run(async () => {
      await updateCategory(id, { name })
      setRenamingId(null)
    })
  }

  function changeColor(id: string, color: string | null) {
    run(() => updateCategory(id, { color }))
  }

  async function askDelete(category: Category) {
    setBusy(true)
    try {
      const impact = await countDeleteImpact(category, categories)
      setPendingDelete({ category, ...impact })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function renderRow(cat: Category, isChild: boolean, parentColor?: string | null) {
    const shownColor = cat.color ?? parentColor ?? UNCATEGORIZED_COLOR
    const renaming = renamingId === cat.id
    return (
      <div className={`cat-row ${isChild ? 'cat-child' : ''}`} key={cat.id}>
        {canEdit ? (
          <ColorField value={shownColor} disabled={busy} onCommit={(c) => changeColor(cat.id, c)} />
        ) : (
          <span className="dot" style={{ background: shownColor }} />
        )}

        {renaming ? (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              saveRename(cat.id)
            }}
          >
            <input
              autoFocus
              value={renameValue}
              maxLength={50}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <button className="btn-small" type="submit" disabled={busy}>
              儲存
            </button>
            <button className="btn-small btn-ghost" type="button" onClick={() => setRenamingId(null)}>
              取消
            </button>
          </form>
        ) : (
          <span className="cat-name">
            {cat.name}
            {isChild && !cat.color && <span className="muted">（沿用上層顏色）</span>}
          </span>
        )}

        {canEdit && !renaming && (
          <span className="cat-actions">
            {isChild && cat.color && (
              <button className="btn-small btn-ghost" onClick={() => changeColor(cat.id, null)} disabled={busy}>
                改回上層顏色
              </button>
            )}
            {!isChild && (
              <button
                className="btn-small btn-ghost"
                onClick={() => {
                  setAddingChildFor(cat.id)
                  setNewChildName('')
                }}
                disabled={busy}
              >
                ＋子類別
              </button>
            )}
            <button
              className="btn-small btn-ghost"
              onClick={() => {
                setRenamingId(cat.id)
                setRenameValue(cat.name)
              }}
              disabled={busy}
            >
              改名
            </button>
            <button className="btn-small btn-ghost danger-text" onClick={() => askDelete(cat)} disabled={busy}>
              刪除
            </button>
          </span>
        )}
      </div>
    )
  }

  if (loading) return <p className="muted">載入中…</p>

  return (
    <section>
      <div className="page-title">
        <h1>類別</h1>
      </div>

      {error && <p className="error">發生錯誤：{error}</p>}

      {canEdit && (
        <form
          className="inline-form add-top"
          onSubmit={(e) => {
            e.preventDefault()
            addTop()
          }}
        >
          <input
            placeholder="新增第一層類別，例如「論文」"
            value={newTopName}
            maxLength={50}
            onChange={(e) => setNewTopName(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy || !newTopName.trim()}>
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
          <p className="muted small">研所課程（日文、R、國金）、CG、DA、論文、約會、生活、其它重要</p>
        </div>
      )}

      <div className="cat-list">
        {tree.map(({ top, children }) => (
          <div className="cat-group" key={top.id}>
            {renderRow(top, false)}
            {children.map((child) => renderRow(child, true, top.color))}
            {addingChildFor === top.id && (
              <form
                className="inline-form cat-child"
                onSubmit={(e) => {
                  e.preventDefault()
                  addChild(top.id)
                }}
              >
                <input
                  autoFocus
                  placeholder={`「${top.name}」底下的子類別`}
                  value={newChildName}
                  maxLength={50}
                  onChange={(e) => setNewChildName(e.target.value)}
                />
                <button className="btn-small" type="submit" disabled={busy || !newChildName.trim()}>
                  新增
                </button>
                <button className="btn-small btn-ghost" type="button" onClick={() => setAddingChildFor(null)}>
                  取消
                </button>
              </form>
            )}
          </div>
        ))}

        <div className="cat-group">
          <div className="cat-row">
            <span className="dot" style={{ background: UNCATEGORIZED_COLOR }} />
            <span className="cat-name">
              未分類 <span className="muted">（項目沒選類別時，固定是灰色，不能刪除）</span>
            </span>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="刪除類別"
          danger
          confirmLabel="確定刪除"
          message={
            <>
              <p>
                刪除「<strong>{pendingDelete.category.name}</strong>」會一併刪除：
              </p>
              <ul>
                {!pendingDelete.category.parent_id && <li>{pendingDelete.children} 個子類別</li>}
                <li>
                  <strong>{pendingDelete.items}</strong> 筆項目
                </li>
              </ul>
              <p className="error">刪除後無法復原。</p>
            </>
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteCategory(pendingDelete.category.id)
            setPendingDelete(null)
            await reload()
          }}
        />
      )}
    </section>
  )
}

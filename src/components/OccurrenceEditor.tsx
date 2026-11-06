import { useState } from 'react'
import type { Category, Occurrence } from '../data/types'
import { createItem, deleteItem, updateItem } from '../data/items'
import { cancelThisOccurrence, saveThisOccurrence } from '../data/occurrences'
import type { ItemDefaults } from '../lib/calendarEvents'
import { formatShortDate } from '../lib/dates'
import { describeRepeat } from '../lib/recurrence'
import ItemForm from './ItemForm'
import Modal from './Modal'

export type EditTarget = { kind: 'new'; defaults: ItemDefaults } | { kind: 'occ'; occ: Occurrence }

type Props = {
  target: EditTarget
  categories: Category[]
  onClose: () => void
  onChanged: () => void // 存檔或刪除後：讓頁面重新讀資料
}

// 新增／編輯的共用入口。重複項目會先問「只改這一次」還是「改整串」
export default function OccurrenceEditor({ target, categories, onClose, onChanged }: Props) {
  const [scope, setScope] = useState<'this' | 'series' | null>(null)

  const done = () => {
    onClose()
    onChanged()
  }

  if (target.kind === 'new') {
    return (
      <ItemForm
        item={null}
        defaults={target.defaults}
        categories={categories}
        onClose={onClose}
        onSave={async (input) => {
          await createItem(input)
          done()
        }}
      />
    )
  }

  const { occ } = target
  const series = occ.series

  // 一般項目
  if (!series) {
    return (
      <ItemForm
        item={occ}
        defaults={{ startDate: occ.start_date }}
        categories={categories}
        onClose={onClose}
        onSave={async (input) => {
          await updateItem(occ.id, input)
          done()
        }}
        onDelete={async () => {
          await deleteItem(occ.id)
          done()
        }}
      />
    )
  }

  // 重複項目：先選範圍
  if (!scope) {
    return (
      <Modal title="重複項目" onClose={onClose}>
        <p>
          「<strong>{occ.title}</strong>」是重複項目（{describeRepeat(series.start_date, series.repeat_freq, series.repeat_until)}）。
        </p>
        <div className="scope-choices">
          <button className="btn-primary" onClick={() => setScope('this')}>
            只改這一次（{formatShortDate(occ.start_date)}）
          </button>
          <button className="btn-secondary" onClick={() => setScope('series')}>
            改整串
          </button>
        </div>
      </Modal>
    )
  }

  if (scope === 'series') {
    return (
      <ItemForm
        item={series}
        mode="series"
        defaults={{ startDate: series.start_date }}
        categories={categories}
        onClose={onClose}
        onSave={async (input) => {
          await updateItem(series.id, input)
          done()
        }}
        onDelete={async () => {
          await deleteItem(series.id)
          done()
        }}
      />
    )
  }

  return (
    <ItemForm
      item={occ}
      mode="occurrence"
      defaults={{ startDate: occ.start_date }}
      categories={categories}
      onClose={onClose}
      onSave={async (input) => {
        await saveThisOccurrence(occ, input)
        done()
      }}
      onDelete={async () => {
        await cancelThisOccurrence(occ)
        done()
      }}
    />
  )
}

import { PALETTE } from '../data/categories'

type Props = {
  value: string | null
  onPick: (hex: string) => void
  disabled?: boolean
}

// 10 個顏色標籤，點一下就選好
export default function ColorSwatches({ value, onPick, disabled }: Props) {
  return (
    <div className="swatches" role="radiogroup" aria-label="顏色">
      {PALETTE.map((c) => {
        const selected = value?.toLowerCase() === c.hex.toLowerCase()
        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            className={selected ? 'swatch selected' : 'swatch'}
            style={{ background: c.hex }}
            onClick={() => onPick(c.hex)}
            disabled={disabled}
          />
        )
      })}
    </div>
  )
}

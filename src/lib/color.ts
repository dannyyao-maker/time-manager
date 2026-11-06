// 顏色工具：做出「淡底色＋深一點的同色字」的標籤效果

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

// 和白色混合：amount = 顏色佔幾成（0.16 = 很淡的底色）
export function tint(hex: string, amount: number): string {
  const [r, g, b] = parse(hex)
  return toHex([r, g, b].map((v) => 255 + (v - 255) * amount))
}

// 加深：amount = 加入幾成黑色（0.25 = 深一點，文字比較好讀）
export function shade(hex: string, amount: number): string {
  return toHex(parse(hex).map((v) => v * (1 - amount)))
}

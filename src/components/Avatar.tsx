// 行事曆頭貼：有照片就顯示照片，沒有就用顏色圓圈＋一個字（點／宛／約）
type Props = { image?: string; letter: string; color: string; size?: number }

export default function Avatar({ image, letter, color, size = 26 }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.5 }
  if (image) return <img className="avatar" src={image} alt="" style={style} />
  return (
    <span className="avatar avatar-letter" style={{ ...style, background: color }} aria-hidden="true">
      {letter.slice(0, 1)}
    </span>
  )
}

import { useEffect, useState } from 'react'

// 監聽 CSS 媒體條件（例如「螢幕寬度小於 640px」），視窗改變時自動更新
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// 手機版面（窄螢幕）
export const useIsNarrow = () => useMedia('(max-width: 640px)')

// 觸控螢幕（手指點，而不是滑鼠）
export const useIsTouch = () => useMedia('(pointer: coarse)')

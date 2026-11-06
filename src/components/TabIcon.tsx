// 分頁圖示（簡單的線條圖，跟著文字顏色變化）
type Props = { name: 'calendar' | 'daily' | 'memo' | 'items' | 'categories' | 'settings' }

export default function TabIcon({ name }: Props) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      )
    case 'daily':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      )
    case 'items':
      return (
        <svg {...common}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1" />
          <circle cx="4.5" cy="12" r="1" />
          <circle cx="4.5" cy="18" r="1" />
        </svg>
      )
    case 'memo':
      return (
        <svg {...common}>
          <path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z" />
          <path d="M14.5 3.5V8h4.5M8.5 12.5h7M8.5 16h5" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
        </svg>
      )
    case 'categories':
      return (
        <svg {...common}>
          <path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5L20.5 11.5l-9 9z" />
          <circle cx="8" cy="8" r="1.4" />
        </svg>
      )
  }
}

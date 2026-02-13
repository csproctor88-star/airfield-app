// Card matching prototype: translucent dark bg, subtle border, 10px radius

interface CardProps {
  children: React.ReactNode
  className?: string
  borderColor?: string
  onClick?: () => void
  style?: React.CSSProperties
}

export function Card({ children, className = '', borderColor, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        ...(borderColor ? { borderLeft: `3px solid ${borderColor}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

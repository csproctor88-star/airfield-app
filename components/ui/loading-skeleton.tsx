export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(56, 189, 248, 0.04)',
        borderRadius: 6,
        animation: 'pulse 2s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <Skeleton style={{ height: 14, width: '40%', marginBottom: 8 }} />
      <Skeleton style={{ height: 12, width: '80%', marginBottom: 6 }} />
      <Skeleton style={{ height: 10, width: '60%' }} />
    </div>
  )
}

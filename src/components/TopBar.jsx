export default function TopBar({ showTimer = false, elapsed = 0, showProgress = false, title = '' }) {
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-8"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0' }}>

      {/* Progress bar (loading screen only) */}
      {showProgress && (
        <div className="absolute bottom-0 left-0 w-full h-[2px]" style={{ background: '#dbeafe' }}>
          <div className="h-full animate-progress" style={{ background: '#2563EB' }} />
        </div>
      )}

      {/* Left: contextual title */}
      <div className="flex items-center gap-3">
        {showTimer ? (
          <>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#2563EB' }}>autorenew</span>
            <span className="font-sans text-[12px] uppercase tracking-wider font-medium" style={{ color: '#475569' }}>
              {title || 'Evaluation in Progress'}
            </span>
          </>
        ) : (
          <span className="font-sans text-[13px] font-medium" style={{ color: '#64748B' }}>{title}</span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {showTimer ? (
          <div className="flex items-center gap-1.5 font-sans text-[13px] font-mono" style={{ color: '#475569' }}>
            {m}:{s}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-sans text-[12px] font-medium"
               style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
            <span className="material-symbols-outlined text-[15px]">science</span>
            <span>Research Prototype</span>
          </div>
        )}
      </div>
    </header>
  )
}

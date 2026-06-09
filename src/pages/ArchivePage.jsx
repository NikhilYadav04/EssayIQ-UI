import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SideNav from '../components/SideNav'
import TopBar  from '../components/TopBar'

const BACKEND = 'http://localhost:8000'

const ASPECT_COLORS = ['#2563EB','#10B981','#F59E0B','#D97706','#E11D48']
const ASPECTS = ['Task Response','Argument Quality','Organisation','Language & Style','Grammar & Mechanics']

// Robust score lookup: exact → case-insensitive partial → positional
function getAspectScore(scores, asp, idx) {
  if (!scores) return null
  // 1. exact match
  if (scores[asp] != null) return scores[asp]
  // 2. case-insensitive partial match (e.g. "Grammar" matches "Grammar & Mechanics")
  const keyword = asp.split(' ')[0].toLowerCase()
  const found = Object.entries(scores).find(([k]) => k.toLowerCase().includes(keyword))
  if (found) return found[1]
  // 3. positional fallback
  const byPos = Object.values(scores)[idx]
  return byPos ?? null
}

function ScoreBadge({ score }) {
  const color = score >= 5 ? '#10B981' : score >= 4 ? '#2563EB' : score >= 3 ? '#F59E0B' : '#E11D48'
  return (
    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-[20px]"
         style={{ background: color + '14', color }}>{score ?? '–'}</div>
  )
}

function ArchiveCard({ entry, onDelete, onClick }) {
  const date  = new Date(entry.created_at)
  const label = date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  const time  = date.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })

  return (
    <div
      className="rounded-2xl p-5 cursor-pointer lift relative group shadow-card"
      style={{ background: '#ffffff', border: '1px solid #eef2f8' }}
      onClick={() => onClick(entry.id)}
    >
      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
        title="Delete"
      >
        <span className="material-symbols-outlined text-[16px]" style={{ color: '#E11D48' }}>delete</span>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-wide mb-1" style={{ color: '#8A96AA' }}>
            {label} · {time}
          </p>
          <p className="font-sans text-[14px] font-medium line-clamp-2" style={{ color: '#1A2340', maxWidth: '78%' }}>
            {entry.prompt || 'No prompt recorded'}
          </p>
        </div>
        <div className="shrink-0 ml-4">
          <ScoreBadge score={entry.score} />
        </div>
      </div>

      {/* Aspect mini-bars */}
      <div className="flex flex-col gap-1.5 mt-3">
        {ASPECTS.map((asp, i) => {
          const s   = entry.aspect_scores?.[asp]
          const pct = s != null ? Math.round((s / 6) * 100) : 0
          return (
            <div key={asp} className="flex items-center gap-2">
              <span className="font-sans text-[10px] w-24 shrink-0" style={{ color: '#8A96AA' }}>
                {asp.split(' ')[0]}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5fb' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ASPECT_COLORS[i] }} />
              </div>
              <span className="font-sans text-[11px] font-medium w-4 text-right" style={{ color: ASPECT_COLORS[i] }}>{s ?? '–'}</span>
            </div>
          )
        })}
      </div>

      {entry.word_count > 0 && (
        <p className="mt-3 font-sans text-[11px]" style={{ color: '#b0bbc8' }}>
          {entry.word_count} words
        </p>
      )}
    </div>
  )
}

function DetailDrawer({ id, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    fetch(`${BACKEND}/archive/${id}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="bg-white p-8 flex items-center gap-3">
        <span className="material-symbols-outlined animate-spin text-[24px]" style={{ color: '#2563eb' }}>progress_activity</span>
        <span className="font-mono text-sm">Loading...</span>
      </div>
    </div>
  )

  if (!detail) return null

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(15,23,42,0.5)' }} onClick={onClose}>
      <div
        className="ml-auto h-full w-full max-w-2xl overflow-y-auto flex flex-col"
        style={{ background: '#ffffff' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-6 sticky top-0 bg-white z-10"
             style={{ borderBottom: '1px solid #eef2f8' }}>
          <div>
            <h2 className="font-display text-[19px] font-bold" style={{ color: '#1A2340' }}>Evaluation Detail</h2>
            <p className="font-sans text-[11px] mt-0.5" style={{ color: '#8A96AA' }}>
              {new Date(detail.created_at).toLocaleString('en-GB')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sessionStorage.setItem('essayiq_result', JSON.stringify(detail))
                navigate('/results')
              }}
              className="font-sans text-[12px] font-semibold px-3.5 py-2 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: '#2563EB', color: '#ffffff' }}
            >
              View Full Results
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#f1f5fb]">
              <span className="material-symbols-outlined text-[20px]" style={{ color: '#64748B' }}>close</span>
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Score + prompt */}
          <div className="flex items-center gap-6 p-5 rounded-2xl" style={{ background: '#F8FAFC', border: '1px solid #eef2f8' }}>
            <div className="flex flex-col items-center">
              <span className="font-display font-extrabold text-[40px] leading-none" style={{ color: '#D97706' }}>{detail.score}</span>
              <span className="font-sans text-[10px] mt-1" style={{ color: '#8A96AA' }}>OUT OF 6</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[10px] uppercase tracking-wide mb-1" style={{ color: '#8A96AA' }}>Prompt</p>
              <p className="font-sans text-[14px]" style={{ color: '#1A2340' }}>{detail.prompt || '—'}</p>
              {detail.word_count > 0 && (
                <p className="font-sans text-[11px] mt-1" style={{ color: '#b0bbc8' }}>{detail.word_count} words</p>
              )}
            </div>
          </div>

          {/* Holistic feedback */}
          {detail.feedback && (
            <div className="p-5 rounded-2xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="font-display text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#B45309' }}>Holistic Assessment</p>
              <p className="font-sans text-[14px] leading-relaxed" style={{ color: '#1A2340', whiteSpace: 'pre-wrap' }}>{detail.feedback}</p>
            </div>
          )}

          {/* Per-aspect scores + comments */}
          <div>
            <p className="font-display text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>Dimension Breakdown</p>
            <div className="flex flex-col gap-3">
              {ASPECTS.map((asp, i) => {
                const s       = detail.aspect_scores?.[asp]
                const comment = detail.agent_comments?.[asp]
                return (
                  <div key={asp} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #eef2f8', borderLeft: `3px solid ${ASPECT_COLORS[i]}` }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-display text-[14px] font-semibold" style={{ color: '#1A2340' }}>{asp}</span>
                      <span className="font-display font-bold text-[17px]" style={{ color: ASPECT_COLORS[i] }}>{s ?? '–'}<span className="text-[11px] font-normal" style={{ color: '#8A96AA' }}>/6</span></span>
                    </div>
                    {comment && (
                      <p className="font-sans text-[13.5px] leading-relaxed" style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>{comment}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ArchivePage() {
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const load = () => {
    setLoading(true)
    fetch(`${BACKEND}/archive`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => { setError('Could not connect to backend.'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    await fetch(`${BACKEND}/archive/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="bg-app min-h-screen flex">
      <SideNav />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar title="History" />

        <main className="flex-1 overflow-y-auto p-7 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-[24px] font-bold" style={{ color: '#1A2340' }}>Evaluation History</h1>
                {!loading && (
                  <span className="font-sans text-[11px] px-2.5 py-1 rounded-full" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                    {entries.length} evaluations
                  </span>
                )}
              </div>
              <button onClick={load} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white transition-colors" title="Refresh">
                <span className="material-symbols-outlined text-[19px]" style={{ color: '#64748B' }}>refresh</span>
              </button>
            </div>

          {loading ? (
            <div className="flex items-center justify-center h-64 gap-3">
              <span className="material-symbols-outlined animate-spin text-[28px]" style={{ color: '#2563EB' }}>progress_activity</span>
              <span className="font-sans text-[14px]" style={{ color: '#475569' }}>Loading history...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <span className="material-symbols-outlined text-[40px]" style={{ color: '#E11D48' }}>error</span>
              <p className="font-sans text-[14px]" style={{ color: '#E11D48' }}>{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <span className="material-symbols-outlined text-[56px]" style={{ color: '#cbd5e1' }}>history</span>
              <p className="font-sans text-[14px] font-medium" style={{ color: '#8A96AA' }}>No evaluations saved yet</p>
              <Link to="/"
                    className="mt-2 px-4 py-2 rounded-xl font-sans text-[13px] font-semibold transition-opacity hover:opacity-90"
                    style={{ background: '#2563EB', color: '#ffffff' }}>
                Run an Evaluation
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map(entry => (
                <ArchiveCard
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDelete}
                  onClick={id => setSelectedId(id)}
                />
              ))}
            </div>
          )}
          </div>
        </main>
      </div>

      {selectedId && (
        <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}

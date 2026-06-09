import { useState, useEffect, useRef } from 'react'

const BACKEND = 'http://localhost:8000'
import { Link } from 'react-router-dom'
import TopBar  from '../components/TopBar'
import SideNav from '../components/SideNav'

// Aspect name → display color mapping (matches agent order from backend)
const ASPECT_COLORS = [
  '#2563eb',  // 0: Task Response
  '#0891b2',  // 1: Argument Quality
  '#f59e0b',  // 2: Organisation
  '#d97706',  // 3: Language & Style
  '#e11d48',  // 4: Grammar & Mechanics
]

// Strip raw JSON if the LLM leaked it into a feedback string
function sanitize(raw) {
  const text = (raw || '').trim()
  if (!text.startsWith('{')) return text
  try {
    const obj = JSON.parse(text)
    return obj.examiner_comment || obj.feedback || obj.comment || text
  } catch {
    // Try regex fallback
    const m = text.match(/"(?:examiner_comment|feedback|comment)"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/)
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    return text
  }
}

function FeedbackCard({ num, title, score, scoreColor, borderColor, bg, comment, rubricMatch, evidenceUsed }) {
  const [expanded, setExpanded] = useState(false)
  const cleanComment = sanitize(comment)

  // Show a preview (first ~280 chars) when collapsed; full text when expanded
  const PREVIEW_LEN = 280
  const hasAudit = !!(rubricMatch || evidenceUsed)   // AutoScore extras worth expanding for
  const isLong = cleanComment.length > PREVIEW_LEN || hasAudit
  const preview = cleanComment.length > PREVIEW_LEN ? cleanComment.slice(0, PREVIEW_LEN).trimEnd() + '…' : cleanComment

  return (
    <div
      className="p-6 relative group rounded-2xl lift"
      style={{ background: '#ffffff', border: '1px solid #eef2f8', borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Header row */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-sans text-[11px] font-semibold tracking-wider mb-1" style={{ color: scoreColor }}>
            METRIC {num}
          </h4>
          <h3 className="font-display text-[19px] font-bold" style={{ color: '#1A2340' }}>
            {title}
          </h3>
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-[16px] font-bold shrink-0 ml-4"
          style={{ background: scoreColor + '14', color: scoreColor }}
        >
          {score ?? '–'}
        </div>
      </div>

      {/* Comment body */}
      <div className="font-sans text-[15px] leading-relaxed" style={{ color: '#475569' }}>
        {expanded || !isLong ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{cleanComment || 'Evaluation complete.'}</p>
        ) : (
          <p>{preview || 'Evaluation complete.'}</p>
        )}
      </div>

      {/* AutoScore auditability — rubric match + evidence cited */}
      {expanded && (rubricMatch || evidenceUsed) && (
        <div className="mt-4 pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid #f1f5fb' }}>
          {rubricMatch && (
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A96AA' }}>Rubric match</p>
              <p className="font-sans text-[13px] leading-relaxed" style={{ color: '#475569' }}>{rubricMatch}</p>
            </div>
          )}
          {evidenceUsed && (
            <div className="px-3 py-2 rounded-lg" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: '#059669' }}>
                <span className="material-symbols-outlined text-[13px]">link</span> Evidence cited
              </p>
              <p className="font-sans text-[12.5px] leading-relaxed" style={{ color: '#047857' }}>{evidenceUsed}</p>
            </div>
          )}
        </div>
      )}

      {/* Score line (always visible in expanded) */}
      {expanded && (
        <div
          className="mt-4 pt-4 font-sans text-[14px]"
          style={{ borderTop: '1px solid #f1f5fb', color: '#1A2340' }}
        >
          Score: <strong>{score}/6</strong> for this dimension.
        </div>
      )}

      {/* Toggle button — only show if comment is long enough to need it */}
      {(isLong || expanded) && (
        <button
          onClick={() => setExpanded(x => !x)}
          className="mt-4 font-sans text-[12px] font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
          style={{ color: scoreColor }}
        >
          {expanded ? 'Collapse details' : (hasAudit ? 'View evidence & rubric match' : 'Read full feedback')}
          <span className="material-symbols-outlined text-[17px]">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      )}
    </div>
  )
}

// ── AutoScore: Evidence Trail (featured panel) ──────────────────────────────────
// Renders the structured evidence_dict the SRCE agent extracted, as readable cards.
function EvidenceTrail({ evidence }) {
  if (!evidence || Object.keys(evidence).length === 0) return null

  const meta = evidence.essay_metadata || {}
  const t1 = evidence.trait_1_task_response     || {}
  const t2 = evidence.trait_2_argument_quality  || {}
  const t3 = evidence.trait_3_organisation      || {}
  const t4 = evidence.trait_4_language_style     || {}
  const t5 = evidence.trait_5_grammar_mechanics || {}

  const Chip = ({ ok, label }) => (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-sans text-[11px] font-medium"
          style={{ background: ok ? '#ECFDF5' : '#FEF2F2', color: ok ? '#059669' : '#DC2626' }}>
      <span className="material-symbols-outlined text-[14px]">{ok ? 'check' : 'close'}</span>
      {label}
    </span>
  )

  const Stat = ({ value, label }) => (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #eef2f8' }}>
      <span className="font-display text-[20px] font-bold" style={{ color: '#2563EB' }}>{value}</span>
      <span className="font-sans text-[10px]" style={{ color: '#8A96AA' }}>{label}</span>
    </div>
  )

  const examples = Array.isArray(t2.examples) ? t2.examples : []
  const langIssues = Array.isArray(t4.language_issues) ? t4.language_issues : []
  const grammarErrs = Array.isArray(t5.error_examples) ? t5.error_examples : []

  return (
    <div className="rounded-2xl overflow-hidden shadow-card" style={{ background: '#ffffff', border: '1px solid #A7F3D0' }}>
      <div className="p-5" style={{ background: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#D1FAE5' }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#059669' }}>fact_check</span>
          </div>
          <div>
            <h3 className="font-display text-[17px] font-bold" style={{ color: '#065F46' }}>Evidence Trail</h3>
            <p className="font-sans text-[12px]" style={{ color: '#059669' }}>
              What Agent 1 recorded before any score was assigned — the audit basis for every grade.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Metadata stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={meta.word_count_estimate ?? '–'} label="WORDS" />
          <Stat value={meta.paragraph_count ?? t3.paragraph_count ?? '–'} label="PARAGRAPHS" />
          <Stat value={t2.example_count ?? examples.length ?? '–'} label="EXAMPLES" />
        </div>

        {/* Trait evidence flags */}
        <div className="flex flex-wrap gap-2">
          <Chip ok={!!t1.has_clear_position}   label="Clear position" />
          <Chip ok={!!t1.addresses_prompt_directly} label="Addresses prompt" />
          <Chip ok={!!t2.has_counter_argument} label="Counter-argument" />
          <Chip ok={!!t3.has_introduction}     label="Introduction" />
          <Chip ok={!!t3.has_conclusion}       label="Conclusion" />
          <Chip ok={!!t3.has_transitions}      label="Transitions" />
        </div>

        {/* Qualitative evidence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {t1.position_quote ? (
            <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #eef2f8' }}>
              <p className="font-sans text-[10px] uppercase tracking-wide mb-1" style={{ color: '#8A96AA' }}>Detected thesis</p>
              <p className="font-sans text-[13px] italic" style={{ color: '#1A2340' }}>"{t1.position_quote}"</p>
            </div>
          ) : null}

          <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #eef2f8' }}>
            <p className="font-sans text-[10px] uppercase tracking-wide mb-1" style={{ color: '#8A96AA' }}>Reasoning depth</p>
            <p className="font-sans text-[13px] capitalize" style={{ color: '#1A2340' }}>{t2.reasoning_depth || '–'}</p>
            <p className="font-sans text-[10px] uppercase tracking-wide mt-2 mb-1" style={{ color: '#8A96AA' }}>Vocabulary range</p>
            <p className="font-sans text-[13px] capitalize" style={{ color: '#1A2340' }}>{t4.vocabulary_range || '–'}</p>
          </div>
        </div>

        {/* Examples found */}
        {examples.length > 0 && (
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Examples found ({examples.length})</p>
            <ul className="flex flex-col gap-1.5">
              {examples.slice(0, 5).map((ex, i) => (
                <li key={i} className="flex items-start gap-2 font-sans text-[13px]" style={{ color: '#475569' }}>
                  <span className="material-symbols-outlined text-[15px] mt-0.5" style={{ color: '#10B981' }}>check_circle</span>
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Issues found */}
        {(langIssues.length > 0 || grammarErrs.length > 0) && (
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Issues recorded</p>
            <ul className="flex flex-col gap-1.5">
              {[...langIssues, ...grammarErrs].slice(0, 5).map((iss, i) => (
                <li key={i} className="flex items-start gap-2 font-sans text-[13px]" style={{ color: '#475569' }}>
                  <span className="material-symbols-outlined text-[15px] mt-0.5" style={{ color: '#E11D48' }}>error</span>
                  {iss}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="font-sans text-[11px]" style={{ color: '#8A96AA' }}>
          Grammar: {t5.error_frequency || '–'} errors · {t5.overall_coherence || '–'} coherence
        </p>
      </div>
    </div>
  )
}


export default function ResultsPage() {
  const gaugeRef  = useRef(null)
  const [gaugeAnimated, setGaugeAnimated] = useState(false)
  const [result, setResult] = useState(null)

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('essayiq_result')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        parsed.feedback = sanitize(parsed.feedback || '')
        if (parsed.agent_comments) {
          Object.keys(parsed.agent_comments).forEach(k => {
            parsed.agent_comments[k] = sanitize(parsed.agent_comments[k] || '')
          })
        }
        setResult(parsed)

        // Auto-save ONLY for fresh evaluations (payload exists), not when re-opened from archive
        const payload = window.__essayiq_payload
        if (payload) {
          window.__essayiq_payload = null  // clear immediately to prevent double-save
          fetch(`${BACKEND}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt:         payload.prompt || '',
              score:          parsed.score,
              feedback:       parsed.feedback,
              aspect_scores:  parsed.aspect_scores  || {},
              agent_comments: parsed.agent_comments || {},
              word_count:     parsed.word_count     || 0,
            }),
          })
            .then(r => r.ok && setSaved(true))
            .catch(() => {})
        }
      } catch { /* ignore parse errors */ }
    }
    const t = setTimeout(() => setGaugeAnimated(true), 300)
    return () => clearTimeout(t)
  }, [])


  const score  = result?.score  ?? 4
  const pct    = score / 6
  const gaugeOffset = gaugeAnimated ? 283 * (1 - pct) : 283

  // Build metric bars from aspect_scores
  const aspectScores  = result?.aspect_scores  ?? {}
  const agentComments = result?.agent_comments  ?? {}

  // Ordered list of aspects (matches backend agent_index 0–4)
  const ASPECTS = [
    { key: 'Task Response',       label: 'TASK RESPONSE',       idx: 0 },
    { key: 'Argument Quality',    label: 'ARGUMENT QUALITY',    idx: 1 },
    { key: 'Organisation',        label: 'ORGANISATION',        idx: 2 },
    { key: 'Language & Style',    label: 'LANGUAGE & STYLE',    idx: 3 },
    { key: 'Grammar & Mechanics', label: 'GRAMMAR & MECHANICS', idx: 4 },
  ]

  // Find score for an aspect (try by name or by index)
  function getScore(aspect) {
    if (aspectScores[aspect.key] != null) return aspectScores[aspect.key]
    const byIdx = Object.values(aspectScores)[aspect.idx]
    return byIdx ?? null
  }

  function getComment(aspect, i) {
    return (
      agentComments[aspect.key]   ||
      agentComments[aspect.label] ||
      Object.values(agentComments)[i] ||
      ''
    )
  }

  const allScores = ASPECTS.map(a => getScore(a)).filter(s => s != null)
  const avgScore  = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '–'
  const strongest = allScores.length ? ASPECTS[allScores.indexOf(Math.max(...allScores))].label.split(' ')[0] : '–'
  const weakest   = allScores.length ? ASPECTS[allScores.indexOf(Math.min(...allScores))].label.split(' ')[0] : '–'

  const isAutoScore   = result?.pipeline === 'autoscore'
  const traitDetails  = result?.trait_details || {}

  return (
    <div className="bg-app h-screen overflow-hidden flex">
      <SideNav />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar title="Your Results" />

      <main className="flex-1 flex flex-row overflow-hidden relative z-10">

        {/* LEFT: Score overview */}
        <section className="w-full md:w-[36%] h-full overflow-y-auto flex flex-col flex-shrink-0 p-5">
          <div className="flex flex-col gap-5 flex-1">

            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#2563EB' }} />
              <h2 className="font-display text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#2563EB' }}>Your Results</h2>
            </div>

            {/* Gauge */}
            <div className="flex flex-col items-center justify-center py-5 rounded-2xl shadow-card" style={{ background: '#ffffff', border: '1px solid #eef2f8' }}>
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full absolute top-0 left-0" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#eef2f8" strokeWidth="7" />
                  <circle ref={gaugeRef} cx="50" cy="50" r="45" fill="none"
                    stroke="#F59E0B" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset={gaugeOffset}
                    style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
                </svg>
                <div className="flex flex-col items-center text-center z-10">
                  <span className="font-display font-extrabold text-[44px] leading-none" style={{ color: '#D97706' }}>{score}</span>
                  <span className="font-sans text-[10px] mt-1.5 pt-1.5 px-3" style={{ color: '#8A96AA', borderTop: '1px solid #e2e8f0' }}>OUT OF 6</span>
                </div>
              </div>
            </div>

            {/* Metric Bars */}
            <div className="flex flex-col gap-3.5 p-5 rounded-2xl shadow-card" style={{ background: '#ffffff', border: '1px solid #eef2f8' }}>
              {ASPECTS.map((aspect, i) => {
                const s   = getScore(aspect)
                const pct = s != null ? Math.round((s / 6) * 100) : 0
                return (
                  <div key={aspect.key}>
                    <div className="flex justify-between font-sans text-[11px] font-medium mb-1.5" style={{ color: '#475569' }}>
                      <span>{aspect.label}</span>
                      <span className="font-bold" style={{ color: ASPECT_COLORS[i] }}>{s ?? '–'}</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: '#f1f5fb' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                           style={{ width: `${pct}%`, background: ASPECT_COLORS[i] }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'AVERAGE',   val: avgScore,  color: '#64748B' },
                { label: 'STRONGEST', val: strongest, color: '#10B981' },
                { label: 'WEAKEST',   val: weakest,   color: '#E11D48' },
              ].map(s => (
                <div key={s.label} className="flex flex-col p-3 rounded-xl" style={{ background: '#ffffff', border: '1px solid #eef2f8' }}>
                  <span className="font-sans text-[10px] mb-1" style={{ color: '#8A96AA' }}>{s.label}</span>
                  <span className="font-display font-bold text-[18px] leading-none" style={{ color: s.color }}>{s.val}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 mt-1">
              {saved && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg font-sans text-[12px] font-medium" style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Saved to Archive
                </div>
              )}
              <button onClick={() => window.print()}
                      className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-sans text-[13px] font-semibold transition-opacity hover:opacity-90 shadow-soft"
                      style={{ background: '#2563EB', color: '#ffffff' }}>
                <span className="material-symbols-outlined text-[18px]">download</span> Download Report
              </button>
              <Link to="/archive"
                    className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-sans text-[13px] font-medium transition-colors hover:bg-[#f8fafc]"
                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569' }}>
                <span className="material-symbols-outlined text-[18px]">history</span> View History
              </Link>
              <Link to="/"
                    className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-sans text-[13px] font-medium transition-colors hover:bg-[#f8fafc]"
                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569' }}>
                <span className="material-symbols-outlined text-[18px]">refresh</span> Evaluate Another
              </Link>
            </div>
          </div>
        </section>

        {/* RIGHT: Detailed Feedback */}
        <section className="flex-1 h-full overflow-y-auto p-5 pb-32">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-fadein">

            {/* Overall Feedback — clean text, never raw JSON */}
            <div className="relative p-7 rounded-2xl overflow-hidden shadow-card"
                 style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <div className="absolute -right-8 -bottom-12 font-display font-extrabold select-none pointer-events-none leading-none z-0 opacity-[0.18]"
                   style={{ fontSize: '120px', color: '#FCD34D' }}>OVERALL</div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FEF3C7' }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ color: '#D97706' }}>psychology</span>
                  </div>
                  <h3 className="font-display text-[20px] font-bold" style={{ color: '#B45309' }}>
                    Holistic Assessment
                  </h3>
                </div>

                {/* Overall score pill */}
                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full"
                     style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                  <span className="font-sans text-[11px] font-medium uppercase tracking-wide" style={{ color: '#92400e' }}>Overall Score</span>
                  <span className="font-display font-bold text-[16px]" style={{ color: '#D97706' }}>{score} / 6</span>
                </div>

                <div className="font-sans text-[15px] leading-relaxed" style={{ color: '#1A2340' }}>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {result?.feedback || 'Evaluation complete. Results are displayed on the left.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Evidence Trail — AutoScore only, featured panel */}
            {isAutoScore && <EvidenceTrail evidence={result?.evidence} />}

            {/* Detailed Breakdown */}
            <div>
              <h2 className="font-display text-[24px] font-bold mb-6" style={{ color: '#1A2340' }}>
                Detailed Diagnostic Breakdown
              </h2>
              <div className="flex flex-col gap-4">
                {ASPECTS.map((aspect, i) => (
                  <FeedbackCard
                    key={aspect.key}
                    num={String(i + 1).padStart(2, '0')}
                    title={aspect.key}
                    score={getScore(aspect)}
                    scoreColor={ASPECT_COLORS[i]}
                    borderColor={ASPECT_COLORS[i]}
                    comment={getComment(aspect, i)}
                    rubricMatch={isAutoScore ? traitDetails[aspect.key]?.rubric_match : ''}
                    evidenceUsed={isAutoScore ? traitDetails[aspect.key]?.evidence_used : ''}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid #e2e8f0' }}>
              <p className="font-sans text-[11px] uppercase tracking-wider" style={{ color: '#8A96AA' }}>
                EssayIQ · {isAutoScore ? 'AutoScore 2-Agent Pipeline' : 'MAGIC 5-Agent Pipeline'} · Research Prototype · Powered by Google Gemini
              </p>
            </div>
          </div>
        </section>

      </main>
      </div>
    </div>
  )
}

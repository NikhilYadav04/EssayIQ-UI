import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Evaluate', icon: 'add_circle', to: '/'        },
  { label: 'History',  icon: 'history',    to: '/archive' },
]

export default function SideNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed left-0 top-0 h-full z-40 flex flex-col pt-6 pb-6 w-64 hidden md:flex"
         style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }}>

      {/* Brand */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg shadow-soft"
             style={{ background: '#2563EB', color: '#ffffff' }}>E</div>
        <div>
          <div className="font-display text-[17px] font-bold leading-tight" style={{ color: '#1A2340' }}>EssayIQ</div>
          <div className="font-sans text-[11px]" style={{ color: '#8A96AA' }}>Analytical Rigor</div>
        </div>
      </div>

      {/* New Evaluation */}
      <div className="px-4 mb-6">
        <Link to="/" className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-sans text-[13px] font-semibold transition-all hover:opacity-90 shadow-soft"
              style={{ background: '#2563EB', color: '#ffffff' }}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Evaluation
        </Link>
      </div>

      {/* Nav Items */}
      <ul className="flex-1 flex flex-col gap-1 px-4">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.to || (item.to === '/' && pathname === '/results')
          return (
            <li key={item.label}>
              <Link to={item.to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-sans text-[14px] font-medium transition-all"
                    style={active
                      ? { background: '#EFF6FF', color: '#2563EB' }
                      : { color: '#475569' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f1f5fb' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div className="px-4 mt-auto pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
        <ul className="flex flex-col gap-1">
          {[['menu_book','Docs'],['contact_support','Help Center']].map(([icon, label]) => (
            <li key={label}>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-sans text-[13px] transition-all"
                 style={{ color: '#64748B' }}
                 onMouseEnter={e => e.currentTarget.style.background = '#f1f5fb'}
                 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

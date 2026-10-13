import { useEffect, useState } from 'react'
import { Activity, BookOpenCheck, ClipboardList, GraduationCap, RefreshCw, Users } from 'lucide-react'

type Lang = 'en' | 'rw'
type ResultRow = { id?: string; assessment_title: string; learner_name: string; score: number | string | null; max_score: number | string | null; percentage: number | string; submitted_at: string | null }
type AssessmentRow = { id: string; title: string; grade_level: string | null; is_published: boolean; question_count: number; attempts: number }
type Payload = { stats?: Record<string, number | string>; recentResults?: ResultRow[]; assessments?: AssessmentRow[]; error?: string }

export default function RoleDashboard({ lang, role }: { lang: Lang; role: string }) {
  const rw = lang === 'rw'
  const admin = role === 'school_admin' || role === 'platform_admin'
  const [data, setData] = useState<Payload>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch(admin ? '/api/admin/overview' : '/api/teacher/overview', { credentials: 'same-origin' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not load dashboard.')
      setData(payload)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load dashboard.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [role])
  const stats = data.stats || {}
  const cards = admin
    ? [
      { label: rw ? 'Abanyeshuri' : 'Active learners', value: stats.students ?? 0, icon: GraduationCap },
      { label: rw ? 'Abarimu' : 'Teachers', value: stats.teachers ?? 0, icon: Users },
      { label: rw ? 'Amashuri' : 'Classes', value: stats.classes ?? 0, icon: BookOpenCheck },
      { label: rw ? 'Ibizamini byatanzwe' : 'Submitted attempts', value: stats.submitted_attempts ?? 0, icon: ClipboardList },
    ]
    : [
      { label: rw ? 'Ibizamini byose' : 'Assessments', value: stats.total ?? 0, icon: ClipboardList },
      { label: rw ? 'Byatangajwe' : 'Published', value: stats.published ?? 0, icon: BookOpenCheck },
      { label: rw ? 'Drafts' : 'Drafts', value: stats.drafts ?? 0, icon: Activity },
      { label: rw ? 'Ibisubizo byatanzwe' : 'Attempts', value: stats.attempts ?? 0, icon: GraduationCap },
    ]
  return <div className="role-dashboard">
    <div className="page-heading"><div><span className="section-kicker">{admin ? (rw ? 'UBUYOBOZI BW’ISHURI' : 'SCHOOL MANAGEMENT') : (rw ? 'UMWANYA W’UMWARIMU' : 'TEACHER WORKSPACE')}</span><h2>{admin ? (rw ? 'Incamake y’ubuyobozi' : 'School admin dashboard') : (rw ? 'Incamake y’umwarimu' : 'Teacher dashboard')}</h2><p>{admin ? (rw ? 'Kurikirana abanyeshuri, abarimu, amasomo n’ibizamini.' : 'Monitor school activity, learners, teachers and assessment outcomes.') : (rw ? 'Cunga ibizamini kandi ukurikirane amanota y’abanyeshuri.' : 'Manage your assessments and review learner results.')}</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{rw ? 'Ongera urebe' : 'Refresh'}</button></div>
    {error && <p className="account-error" role="alert">{error}</p>}
    {loading && <p className="history-empty">{rw ? 'Turimo gupakira amakuru…' : 'Loading dashboard data…'}</p>}
    <div className="role-dashboard-stats">{cards.map(({label,value,icon:Icon}) => <div className="panel role-stat" key={label}><span className="role-stat-icon"><Icon size={18}/></span><span className="section-kicker">{label}</span><strong>{String(value)}</strong></div>)}</div>
    {admin && <div className="panel role-admin-extra"><div><b>{rw ? 'Ibikoresho byatangajwe' : 'Published learning resources'}</b><strong>{String(stats.published_resources ?? 0)}</strong></div><div><b>{rw ? 'Ibisubizo bigitegereje gusuzumwa' : 'Submissions awaiting review'}</b><strong>{String(stats.pending_submissions ?? 0)}</strong></div><div><b>{rw ? 'Ibizamini byose' : 'All assessments'}</b><strong>{String(stats.assessments ?? 0)}</strong></div></div>}
    {!admin && <section className="panel role-table-panel"><div className="role-section-heading"><h3>{rw ? 'Ibizamini byawe' : 'Your assessments'}</h3><span>{data.assessments?.length ?? 0}</span></div>{!data.assessments?.length ? <p className="history-empty">{rw ? 'Nta kizamini urategura. Jya kuri Ibizamini kugira ngo ukore ikizamini gishya.' : 'No assessments yet. Open Exams & quizzes to create your first assessment.'}</p> : <div className="role-table-scroll"><table className="role-table"><thead><tr><th>{rw ? 'Izina' : 'Assessment'}</th><th>{rw ? 'Icyiciro' : 'Level'}</th><th>{rw ? 'Ibibazo' : 'Questions'}</th><th>{rw ? 'Igeragezwa' : 'Attempts'}</th><th>{rw ? 'Imiterere' : 'Status'}</th></tr></thead><tbody>{data.assessments.map(item=><tr key={item.id}><td>{item.title}</td><td>{item.grade_level || '—'}</td><td>{item.question_count}</td><td>{item.attempts}</td><td><span className={'role-status '+(item.is_published?'published':'draft')}>{item.is_published?(rw?'Byatangajwe':'Published'):(rw?'Draft':'Draft')}</span></td></tr>)}</tbody></table></div>}</section>}
    <section className="panel role-table-panel"><div className="role-section-heading"><h3>{rw ? 'Amanota aheruka' : 'Recent learner results'}</h3><span>{data.recentResults?.length ?? 0}</span></div>{!data.recentResults?.length ? <p className="history-empty">{rw ? 'Nta manota y’ibizamini yatanzwe aragaragara.' : 'No submitted assessment results to show yet.'}</p> : <div className="role-table-scroll"><table className="role-table"><thead><tr><th>{rw ? 'Umunyeshuri' : 'Learner'}</th><th>{rw ? 'Ikizamini' : 'Assessment'}</th><th>{rw ? 'Amanota' : 'Score'}</th><th>%</th><th>{rw ? 'Itariki' : 'Submitted'}</th></tr></thead><tbody>{data.recentResults.map((item,i)=><tr key={item.id || (item.assessment_title+item.learner_name+i)}><td>{item.learner_name}</td><td>{item.assessment_title}</td><td>{item.score ?? 0}/{item.max_score ?? 0}</td><td>{Number(item.percentage || 0).toFixed(1)}%</td><td>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>}</section>
  </div>
}

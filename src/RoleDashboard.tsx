import { useEffect, useState } from 'react'
import { Activity, BookOpenCheck, ClipboardList, GraduationCap, Plus, RefreshCw, Users, UserPlus } from 'lucide-react'

type Lang = 'en' | 'rw'
type ResultRow = { id?: string; assessment_title: string; learner_name: string; score: number | string | null; max_score: number | string | null; percentage: number | string; submitted_at: string | null }
type AssessmentRow = { id: string; title: string; grade_level: string | null; is_published: boolean; question_count: number; attempts: number }
type ClassRow = { id: string; name: string; grade_level: string; academic_year: number; school_name?: string; student_count: number; teacher_count: number }
type Payload = { stats?: Record<string, number | string>; recentResults?: ResultRow[]; assessments?: AssessmentRow[]; error?: string }

export default function RoleDashboard({ lang, role }: { lang: Lang; role: string }) {
  const rw = lang === 'rw'
  const admin = role === 'school_admin' || role === 'platform_admin'
  const [data, setData] = useState<Payload>({})
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [className, setClassName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('S1')
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()))
  const [creatingClass, setCreatingClass] = useState(false)
  const [enrollingClass, setEnrollingClass] = useState('')
  const [studentEmails, setStudentEmails] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  async function load() {
    setLoading(true); setError('')
    try {
      const endpoints = await Promise.all([
        fetch(admin ? '/api/admin/overview' : '/api/teacher/overview', { credentials: 'same-origin' }),
        fetch('/api/classes', { credentials: 'same-origin' }),
      ])
      const payload = await endpoints[0].json().catch(() => ({}))
      const classPayload = await endpoints[1].json().catch(() => ({}))
      if (!endpoints[0].ok) throw new Error(payload.error || 'Could not load dashboard.')
      if (!endpoints[1].ok) throw new Error(classPayload.error || 'Could not load classes.')
      setData(payload)
      setClasses(Array.isArray(classPayload.classes) ? classPayload.classes : [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load dashboard.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [role])
  const stats = data.stats || {}
  const cards = admin
    ? [
      { label: rw ? 'Abanyeshuri' : 'Active learners', value: stats.students ?? 0, icon: GraduationCap },
      { label: rw ? 'Abarimu' : 'Teachers', value: stats.teachers ?? 0, icon: Users },
      { label: rw ? 'Amashuri / ibyiciro' : 'Classes', value: stats.classes ?? 0, icon: BookOpenCheck },
      { label: rw ? 'Ibizamini byatanzwe' : 'Submitted attempts', value: stats.submitted_attempts ?? 0, icon: ClipboardList },
    ]
    : [
      { label: rw ? 'Ibizamini byose' : 'Assessments', value: stats.total ?? 0, icon: ClipboardList },
      { label: rw ? 'Byatangajwe' : 'Published', value: stats.published ?? 0, icon: BookOpenCheck },
      { label: 'Drafts', value: stats.drafts ?? 0, icon: Activity },
      { label: rw ? 'Igeragezwa' : 'Attempts', value: stats.attempts ?? 0, icon: GraduationCap },
    ]
  async function createClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreatingClass(true); setFeedback('')
    try {
      const response = await fetch('/api/classes', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:className.trim(),gradeLevel,academicYear:Number(academicYear)}) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not create class.')
      setClassName('')
      setFeedback(rw ? 'Icyiciro cy’ishuri cyakozwe neza.' : 'Class created successfully.')
      await load()
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Could not create class.') }
    finally { setCreatingClass(false) }
  }
  async function enrollStudent(event: React.FormEvent<HTMLFormElement>, classId: string) {
    event.preventDefault(); setEnrollingClass(classId); setFeedback('')
    try {
      const response = await fetch('/api/classes/'+encodeURIComponent(classId)+'/students', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:(studentEmails[classId] || '').trim()}) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not add student.')
      setStudentEmails(previous => ({...previous, [classId]: ''}))
      setFeedback(rw ? 'Umunyeshuri yongewe muri iki cyiciro.' : 'Student added to the class.')
      await load()
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Could not add student.') }
    finally { setEnrollingClass('') }
  }
  return <div className="role-dashboard">
    <div className="page-heading"><div><span className="section-kicker">{admin ? (rw ? 'UBUYOBOZI BW’ISHURI' : 'SCHOOL MANAGEMENT') : (rw ? 'UMWANYA W’UMWARIMU' : 'TEACHER WORKSPACE')}</span><h2>{admin ? (rw ? 'Incamake y’ubuyobozi' : 'School admin dashboard') : (rw ? 'Incamake y’umwarimu' : 'Teacher dashboard')}</h2><p>{admin ? (rw ? 'Kurikirana abanyeshuri, abarimu, amasomo n’ibizamini.' : 'Monitor school activity, learners, teachers and assessment outcomes.') : (rw ? 'Cunga ibizamini, ibyiciro n’amanota y’abanyeshuri.' : 'Manage assessments, classes and learner results.')}</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{rw ? 'Ongera urebe' : 'Refresh'}</button></div>
    {error && <p className="account-error" role="alert">{error}</p>}
    {feedback && <p className="profile-feedback" role="status">{feedback}</p>}
    {loading && <p className="history-empty">{rw ? 'Turimo gupakira amakuru…' : 'Loading dashboard data…'}</p>}
    <div className="role-dashboard-stats">{cards.map(({label,value,icon:Icon}) => <div className="panel role-stat" key={label}><span className="role-stat-icon"><Icon size={18}/></span><span className="section-kicker">{label}</span><strong>{String(value)}</strong></div>)}</div>
    {admin && <div className="panel role-admin-extra"><div><b>{rw ? 'Ibikoresho byatangajwe' : 'Published learning resources'}</b><strong>{String(stats.published_resources ?? 0)}</strong></div><div><b>{rw ? 'Imirimo itegereje gusuzumwa' : 'Submissions awaiting review'}</b><strong>{String(stats.pending_submissions ?? 0)}</strong></div><div><b>{rw ? 'Ibizamini byose' : 'All assessments'}</b><strong>{String(stats.assessments ?? 0)}</strong></div></div>}
    <section className="panel role-table-panel">
      <div className="role-section-heading"><h3>{rw ? 'Ibyiciro by’amashuri' : 'Class management'}</h3><span>{classes.length}</span></div>
      <form className="role-class-create" onSubmit={createClass}>
        <label>{rw ? 'Izina ry’icyiciro' : 'Class name'}<input value={className} onChange={e=>setClassName(e.target.value)} minLength={2} maxLength={120} placeholder={rw?'Urugero: S3 A':'e.g. S3 A'} required /></label>
        <label>{rw ? 'Urwego' : 'Grade level'}<select value={gradeLevel} onChange={e=>setGradeLevel(e.target.value)}>{['P1','P2','P3','P4','P5','P6','S1','S2','S3','S4','S5','S6','TVET L1','TVET L2','TVET L3','TVET L4','TVET L5'].map(level=><option key={level}>{level}</option>)}</select></label>
        <label>{rw ? 'Umwaka w’amashuri' : 'Academic year'}<input type="number" min="2020" max="2100" value={academicYear} onChange={e=>setAcademicYear(e.target.value)} required /></label>
        <button className="button button-primary" type="submit" disabled={creatingClass}><Plus size={15}/>{creatingClass?(rw?'Birakorwa…':'Creating…'):(rw?'Kora icyiciro':'Create class')}</button>
      </form>
      {!classes.length ? <p className="history-empty">{rw ? 'Nta byiciro biboneka. Kugira ngo ukore icyiciro, konti yawe igomba kuba ihujwe n’ishuri.' : 'No classes found. Your account must be linked to a school to create a class.'}</p> : <div className="role-class-list">{classes.map(item=><article className="role-class-card" key={item.id}><div className="role-class-heading"><div><b>{item.name}</b><small>{item.grade_level} · {item.academic_year}{admin && item.school_name ? ' · '+item.school_name : ''}</small></div><span className="role-status published">{item.student_count} {rw?'abanyeshuri':'learners'}</span></div><form className="role-enroll-form" onSubmit={e=>void enrollStudent(e,item.id)}><label><UserPlus size={14}/><input type="email" value={studentEmails[item.id] || ''} onChange={e=>setStudentEmails(previous => ({...previous, [item.id]: e.target.value}))} placeholder={rw?'Email y’umunyeshuri':'Student account email'} required /></label><button className="button button-secondary" type="submit" disabled={enrollingClass===item.id}>{enrollingClass===item.id?(rw?'Birongerwa…':'Adding…'):(rw?'Ongeramo':'Add learner')}</button></form></article>)}</div>}
    </section>
    {!admin && <section className="panel role-table-panel"><div className="role-section-heading"><h3>{rw ? 'Ibizamini byawe' : 'Your assessments'}</h3><span>{data.assessments?.length ?? 0}</span></div>{!data.assessments?.length ? <p className="history-empty">{rw ? 'Nta kizamini urategura. Jya kuri Ibizamini kugira ngo ukore ikizamini gishya.' : 'No assessments yet. Open Exams & quizzes to create your first assessment.'}</p> : <div className="role-table-scroll"><table className="role-table"><thead><tr><th>{rw ? 'Izina' : 'Assessment'}</th><th>{rw ? 'Icyiciro' : 'Level'}</th><th>{rw ? 'Ibibazo' : 'Questions'}</th><th>{rw ? 'Igeragezwa' : 'Attempts'}</th><th>{rw ? 'Imiterere' : 'Status'}</th></tr></thead><tbody>{data.assessments.map(item=><tr key={item.id}><td>{item.title}</td><td>{item.grade_level || '—'}</td><td>{item.question_count}</td><td>{item.attempts}</td><td><span className={'role-status '+(item.is_published?'published':'draft')}>{item.is_published?(rw?'Byatangajwe':'Published'):(rw?'Draft':'Draft')}</span></td></tr>)}</tbody></table></div>}</section>}
    <section className="panel role-table-panel"><div className="role-section-heading"><h3>{rw ? 'Amanota aheruka' : 'Recent learner results'}</h3><span>{data.recentResults?.length ?? 0}</span></div>{!data.recentResults?.length ? <p className="history-empty">{rw ? 'Nta manota y’ibizamini yatanzwe aragaragara.' : 'No submitted assessment results to show yet.'}</p> : <div className="role-table-scroll"><table className="role-table"><thead><tr><th>{rw ? 'Umunyeshuri' : 'Learner'}</th><th>{rw ? 'Ikizamini' : 'Assessment'}</th><th>{rw ? 'Amanota' : 'Score'}</th><th>%</th><th>{rw ? 'Itariki' : 'Submitted'}</th></tr></thead><tbody>{data.recentResults.map((item,i)=><tr key={item.id || (item.assessment_title+item.learner_name+i)}><td>{item.learner_name}</td><td>{item.assessment_title}</td><td>{item.score ?? 0}/{item.max_score ?? 0}</td><td>{Number(item.percentage || 0).toFixed(1)}%</td><td>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>}</section>
  </div>
}

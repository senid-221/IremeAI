import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpen, BookOpenCheck, ExternalLink, FileText, Search, ShieldCheck } from 'lucide-react'

type Lang = 'en' | 'rw'
type Source = { id: string; title: string; publisher: string; kind: string; levels: string[]; url: string; official: boolean }
type Result = { document_id: string; title: string; publisher: string; document_type: string; education_level: string | null; subject_name: string | null; language: string | null; academic_year: string | null; source_url: string | null; file_url: string | null; heading: string | null; content: string; chunk_grade_level: string | null; chunk_subject: string | null }

const levels = [
  { value: 'Primary P1-P6', label: 'Primary P1–P6' }, { value: 'Secondary S1-S6', label: 'Secondary S1–S6' },
  { value: 'TVET Level 1', label: 'TVET Level 1' }, { value: 'TVET Level 2', label: 'TVET Level 2' },
  { value: 'TVET Level 3', label: 'TVET Level 3' }, { value: 'TVET Level 4', label: 'TVET Level 4' },
  { value: 'TVET Level 5', label: 'TVET Level 5' },
]
const subjects = ['Mathematics', 'English', 'Kinyarwanda', 'Biology', 'Chemistry', 'Physics', 'ICT', 'Computer Systems', 'Construction', 'Agriculture', 'Hospitality', 'Electrical Installation', 'Graphic Art']

export default function CurriculumWorkspace({ lang }: { lang: Lang }) {
  const rw = lang === 'rw'
  const [sources, setSources] = useState<Source[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    fetch('/api/education/sources')
      .then(async response => response.ok ? response.json() : { sources: [] })
      .then(payload => setSources(Array.isArray(payload.sources) ? payload.sources : []))
      .catch(() => setSources([]))
  }, [])

  async function searchResources(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!query.trim() && !level && !subject) {
      setError(rw ? 'Hitamo urwego, isomo cyangwa wandike icyo ushaka.' : 'Choose a level or subject, or enter a search term.')
      return
    }
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (level) params.set('level', level)
      if (subject) params.set('subject', subject)
      const response = await fetch('/api/education/search?' + params.toString())
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not search curriculum resources.')
      setResults(Array.isArray(payload.results) ? payload.results : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not search curriculum resources.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return <div className="curriculum-workspace">
    <div className="page-heading"><div><span className="section-kicker">{rw ? 'INTEGANYANYIGISHO ZEMEWE' : 'CURRICULUM-ALIGNED LEARNING'}</span><h2>{rw ? 'Shakisha amasomo' : 'Explore your curriculum'}</h2><p>{rw ? 'Shakisha ibikoresho by’amasomo ukurikije urwego, isomo n’ibikubiye mu nyandiko zemewe.' : 'Find curriculum resources by school level, subject, or topic using indexed official learning documents.'}</p></div><span className="page-chip"><BookOpenCheck size={15}/>{rw ? 'REB · NESA · RTB' : 'REB · NESA · RTB'}</span></div>
    <form className="curriculum-search panel" onSubmit={searchResources}>
      <label className="curriculum-query"><span>{rw ? 'Ijambo cyangwa ingingo' : 'Search topic or keyword'}</span><div><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} maxLength={300} placeholder={rw ? 'Urugero: imibare, algebra, electrical installation…' : 'e.g. algebra, biology, electrical installation…'} /></div></label>
      <div className="curriculum-filter-grid">
        <label><span>{rw ? 'Urwego rw’amashuri' : 'Education level'}</span><select value={level} onChange={event => setLevel(event.target.value)}><option value="">{rw ? 'Urwego rwose' : 'All levels'}</option>{levels.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>{rw ? 'Isomo / umwuga' : 'Subject / trade'}</span><select value={subject} onChange={event => setSubject(event.target.value)}><option value="">{rw ? 'Amasomo yose' : 'All subjects'}</option>{subjects.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? (rw ? 'Turashakisha…' : 'Searching…') : <><Search size={15}/>{rw ? 'Shakisha amasomo' : 'Search learning resources'}</>}</button>
    </form>
    {error && <p className="account-error" role="alert">{error}</p>}
    {searched && !loading && !error && <section className="curriculum-results"><div className="section-heading"><div><span className="section-kicker">{rw ? 'IBYAVUYEMO' : 'SEARCH RESULTS'}</span><h3>{rw ? 'Ibikoresho byabonetse' : 'Matching resources'}</h3></div><span className="page-chip">{results.length} {rw ? 'ibisubizo' : 'results'}</span></div>
      {results.length === 0 ? <div className="panel learning-tip"><span className="tip-icon"><FileText size={20}/></span><div><b>{rw ? 'Nta nyandiko ihuye n’ishakisha yabonetse' : 'No matching indexed document found'}</b><p>{rw ? 'Gerageza amagambo make cyangwa urebe ku mbuga zemewe ziri hasi. Ibi ntibivuze ko isomo ridahari.' : 'Try different keywords or browse the official source portals below. No indexed match does not mean the material does not exist.'}</p></div></div> : <div className="curriculum-result-list">{results.map((item, index) => <article className="panel curriculum-result" key={item.document_id + '-' + index}><span className="tip-icon"><FileText size={19}/></span><div className="curriculum-result-copy"><span className="resource-tag">{item.publisher || 'Education resource'}{item.education_level ? ' · ' + item.education_level : ''}{item.subject_name ? ' · ' + item.subject_name : ''}</span><h3>{item.heading || item.title}</h3><p>{item.content.length > 620 ? item.content.slice(0, 620).trimEnd() + '…' : item.content}</p><div className="curriculum-result-meta"><span><ShieldCheck size={13}/>{rw ? 'Inyandiko iri mu bubiko bwagenzuwe' : 'Verified indexed document'}</span>{item.academic_year && <span>{item.academic_year}</span>}</div>{(item.file_url || item.source_url) && <a href={item.file_url || item.source_url || '#'} target="_blank" rel="noreferrer">{rw ? 'Fungura inyandiko y’umwimerere' : 'Open original document'} <ArrowUpRight size={14}/></a>}</div></article>)}</div>}
    </section>}
    <section className="curriculum-official"><div className="section-heading"><div><span className="section-kicker">{rw ? 'INKOMOKO ZEMEWE' : 'OFFICIAL SOURCE PORTALS'}</span><h3>{rw ? 'Amasomo n’ibizamini byemewe' : 'Official learning & assessment sources'}</h3></div><span className="page-chip"><ShieldCheck size={14}/>{rw ? 'Reba inkomoko' : 'Source links'}</span></div><p className="curriculum-source-note">{rw ? 'Ireme AI itandukanya inyandiko zabitswe mu bubiko n’ibiri ku mbuga zo hanze. Kanda ku rubuga kugira ngo urebe inyandiko z’umwimerere.' : 'Ireme AI distinguishes indexed content from external source portals. Open a publisher to verify the original material and the latest curriculum.'}</p>
      <div className="curriculum-source-grid">{sources.filter(source => source.official).map(source => <article className="panel curriculum-source" key={source.id}><span className="tip-icon"><BookOpen size={18}/></span><div><span className="resource-tag">{source.publisher} · {source.kind.replaceAll('_', ' ')}</span><h4>{source.title}</h4><p>{source.levels.join(' · ')}</p><a href={source.url} target="_blank" rel="noreferrer">{rw ? 'Fungura urubuga' : 'Open source portal'} <ExternalLink size={13}/></a></div></article>)}</div>
    </section>
  </div>
}

import { useCallback, useEffect, useState } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import './App.css';
import './AdminDashboard.css';

type Step = 'MAIN_ACTIVITY' | 'THEORY' | 'REINFORCEMENT' | 'COMPLETED';
interface Pathway {
  topics: { id: number; title: string; status: 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED' }[];
  progress: { currentTopicId: number; currentStep: Step; completed: boolean; theoryViewed: boolean };
  activity: { id: string; type: string; prompt: string; options: { id: string; text: string }[] } | null;
  theory: string | null;
  attempts: { activityId: string; selectedOptionId: string; isCorrect: number; createdAt: string }[];
}
interface Student { id: number; name: string; role: 'STUDENT' | 'ADMIN' }
interface Dashboard {
  student: Student;
  progress: { percent: number; completedTopics: number; totalTopics: number; currentTopicId: number; currentTopic: string | null; currentStep: string; completed: boolean; completedAt: string | null };
  attempts: { id: string; topicId: number; topicTitle: string; activityId: string | null; activityType: string; prompt: string; selectedOption: string | null; isCorrect: number | null; timestamp: string; completedAt: string | null; attemptNumber: number }[];
}
const API = '/api';
const math = /\$(.+?)\$/g;

function RichText({ text }: { text: string }) {
  return <>{text.split(math).map((part, index) => index % 2 ? <InlineMath key={index} math={part} /> : <span key={index}>{part}</span>)}</>;
}

function AdminDashboard({ adminId, students }: { adminId: number; students: Student[] }) {
  const [studentId, setStudentId] = useState(() => {
    const saved = Number(window.localStorage.getItem('dashboard-student-id'));
    return saved === 2 ? 2 : 1;
  });
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${API}/admin/dashboard/${studentId}?adminId=${adminId}`)
      .then(async response => {
        const result = await response.json() as Dashboard & { error?: string };
        if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar el dashboard.');
        return result;
      })
      .then(result => { if (active) { setDashboard(result); setError(''); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Error al cargar analítica.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminId, studentId]);
  const studentOptions = students.filter(student => student.role === 'STUDENT');

  return <section className="dashboard">
    <div className="dashboard-heading"><div><span className="section-kicker">PANEL DE ADMINISTRACIÓN</span><h2>Progreso de aprendizaje</h2><p>Consulta el avance y la actividad de cada estudiante.</p></div><label className="dashboard-filter">ESTUDIANTE<select className="student-select" value={studentId} onChange={event => { const value = Number(event.target.value); setStudentId(value); window.localStorage.setItem('dashboard-student-id', String(value)); }}>{studentOptions.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {loading && !dashboard ? <p className="dashboard-empty">Cargando analítica…</p> : dashboard && <>
      <div className="dashboard-metrics">
        <article className="metric-card progress-metric"><span className="section-kicker">PROGRESO DEL TEMARIO</span><strong>{dashboard.progress.percent}%</strong><div className="progress-track"><span style={{ width: `${dashboard.progress.percent}%` }} /></div><span className="metric-caption">{dashboard.progress.completedTopics} de {dashboard.progress.totalTopics} temas completados</span></article>
        <article className="metric-card"><span className="section-kicker">ESTUDIANTE</span><strong className="metric-text">{dashboard.student.name}</strong><span className="metric-caption">Ruta individual</span></article>
        <article className="metric-card"><span className="section-kicker">ESTADO ACTUAL</span><strong className="metric-text">{dashboard.progress.completed ? 'Completado' : `${dashboard.progress.currentStep} · Tema ${dashboard.progress.currentTopicId}`}</strong><span className="metric-caption">{dashboard.progress.currentTopic ?? 'Ruta finalizada'}</span></article>
      </div>
      <section className="history-card"><div className="history-heading"><div><span className="section-kicker">TRAZABILIDAD</span><h3>Historial de intentos</h3></div><span className="history-count">{dashboard.attempts.length} registros</span></div>
        {dashboard.attempts.length === 0 ? <p className="dashboard-empty">Este estudiante todavía no ha realizado intentos.</p> : <div className="table-scroll"><table><thead><tr><th>Tema / actividad</th><th>Opción elegida</th><th>Resultado</th><th>Intento</th><th>Fecha y hora</th></tr></thead><tbody>{dashboard.attempts.map(attempt => <tr key={attempt.id}><td><strong>{attempt.topicTitle}</strong><span className="table-detail">{attempt.activityType === 'MAIN_ACTIVITY' ? 'Actividad principal · A' : attempt.activityType === 'REINFORCEMENT' ? 'Refuerzo · R' : 'Teoría consultada · T'}{attempt.topicId}</span></td><td>{attempt.selectedOption ? <RichText text={attempt.selectedOption} /> : '—'}</td><td><span className={`result-badge ${attempt.isCorrect === null ? 'consulted' : attempt.isCorrect ? 'correct' : 'wrong'}`}>{attempt.isCorrect === null ? 'Consultada' : attempt.isCorrect ? '✓ Correcto' : '× Incorrecto'}</span></td><td>{attempt.attemptNumber}</td><td><time dateTime={attempt.timestamp}>{new Date(attempt.timestamp).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' })}</time>{attempt.completedAt && attempt.isCorrect === 1 && <span className="table-detail">Completitud registrada</span>}</td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </section>;
}

function App() {
  const [users, setUsers] = useState<Student[]>([]);
  const [userId, setUserId] = useState(() => {
    const saved = Number(window.localStorage.getItem('learning-user-id'));
    return saved === 1 || saved === 2 || saved === 3 ? saved : 1;
  });
  const [data, setData] = useState<Pathway | null>(null);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch(`${API}/progress/${userId}`);
    if (!response.ok) throw new Error('No se pudo cargar tu ruta de aprendizaje.');
    const pathway = await response.json() as Pathway;
    if (Number(window.localStorage.getItem('learning-user-id') ?? 1) === userId) setData(pathway);
  }, [userId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`${API}/users`).then(response => {
        if (!response.ok) throw new Error('No se pudo cargar la lista de estudiantes.');
        return response.json() as Promise<Student[]>;
      }),
      userId === 3 ? Promise.resolve(null) : refresh(),
    ]).then(([students]) => {
      if (active) setUsers(students);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo conectar con el servidor.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refresh, userId]);

  function changeUser(value: string) {
    const nextUserId = Number(value);
    if (nextUserId !== 1 && nextUserId !== 2 && nextUserId !== 3) return;
    window.localStorage.setItem('learning-user-id', String(nextUserId));
    setSelected('');
    setFeedback('');
    setError('');
    setUserId(nextUserId);
  }

  async function send(path: string, body?: object) {
    setLoading(true);
    setError('');
    try {
      const payload = path === 'attempts'
        ? { ...body, userId, activityId: data?.activity?.id }
        : { ...body, userId };
      const response = await fetch(`${API}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; feedback?: string };
      if (!response.ok) throw new Error(result.error ?? 'Ocurrió un error.');
      setSelected('');
      setFeedback(result.feedback === 'correct' ? '¡Muy bien! Respuesta correcta.' : result.feedback === 'incorrect' ? 'No es correcto. Revisemos la explicación y vuelve a intentarlo.' : result.feedback === 'theory_required' ? 'Aún no. Repasa la teoría antes de volver a intentarlo.' : '');
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ocurrió un error.'); }
    finally { setLoading(false); }
  }

  if (loading && !data) return <main className="shell"><p className="loading">Preparando tu espacio de aprendizaje…</p></main>;
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#" aria-label="Álgebra, inicio"><span className="brand-icon">∑</span> álgebra<span className="brand-dot">.</span></a><span className="top-label">TU ESPACIO DE APRENDIZAJE</span><label className="student-select-label">Estudiante actual<select className="student-select" value={userId} onChange={event => changeUser(event.target.value)} aria-label="Estudiante actual">{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></header>
    {userId === 3 ? <AdminDashboard adminId={userId} students={users} /> : <>
    <section className="hero"><div className="eyebrow"><span className="spark">✳</span> TU RUTA, A TU RITMO</div><h1>Aprender matemáticas<br /><em>puede sentirse distinto.</em></h1><p>Un paso a la vez. Si algo cuesta, aquí tienes una nueva forma de verlo.</p><div className="progress-caption"><span>Tu recorrido</span><span>{data?.topics.filter(t => t.status === 'COMPLETED').length ?? 0} de {data?.topics.length ?? 3} temas</span></div><div className="progress-track"><span style={{ width: `${((data?.topics.filter(t => t.status === 'COMPLETED').length ?? 0) / (data?.topics.length || 3)) * 100}%` }} /></div></section>
    <div className="layout">
      <aside className="path-card"><div className="card-heading"><div><span className="section-kicker">EL RECORRIDO</span><h2>Tu ruta de aprendizaje</h2></div><span className="topic-count">0{data?.topics.length ?? 3} temas</span></div><div className="topic-list">{data?.topics.map((topic, index) => <div className={`topic ${topic.status.toLowerCase()}`} key={topic.id}><div className="topic-marker">{topic.status === 'COMPLETED' ? '✓' : topic.status === 'LOCKED' ? '·' : `0${index + 1}`}</div><div className="topic-copy"><strong>{topic.title}</strong><span>{topic.status === 'COMPLETED' ? 'Tema completado' : topic.status === 'LOCKED' ? 'Se desbloquea al avanzar' : 'Estás aquí'}</span></div><span className="topic-status">{topic.status === 'COMPLETED' ? 'LISTO' : topic.status === 'IN_PROGRESS' ? 'AHORA' : 'PRONTO'}</span></div>)}</div><div className="aside-note"><span>✳</span><p>Cada paso cuenta. <strong>Avanza a tu manera.</strong></p></div></aside>
      <section className="activity-card" aria-live="polite">
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => refresh().catch(() => setError('No se pudo conectar con el servidor.'))}>Reintentar</button></div>}
        {feedback && <p className={`feedback ${feedback.startsWith('¡') ? 'good' : 'incorrect'}`} role="status">{feedback}</p>}
        {data?.progress.completed ? <div className="complete-state"><span className="activity-icon">✦</span><span className="section-kicker">RECORRIDO COMPLETADO</span><h2>¡Lo lograste!</h2><p>Has completado todos los temas de tu ruta. Cada problema que resolviste te trajo hasta aquí.</p></div>
          : data?.progress.currentStep === 'THEORY' ? <><div className="activity-top"><div className="activity-icon theory-icon">T</div><span className="section-kicker">UN MOMENTO PARA ENTENDER</span><span className="step-count">TEORÍA · T{data.progress.currentTopicId}</span></div><h2>Volvamos a la idea, sin prisa.</h2><p className="subcopy">Una explicación puede hacer que todo encaje.</p><div className="theory-box"><span className="theory-label">LA IDEA CLAVE</span><p><RichText text={data.theory ?? ''} /></p></div><div className="hint"><span>✳</span> Cuando estés listo, prueba una actividad más.</div><button className="primary-btn" disabled={loading} onClick={() => send('theory/consult')}>Entendido, continuar <span>→</span></button></>
          : <><div className="activity-top"><div className="activity-icon">{data?.progress.currentStep === 'REINFORCEMENT' ? 'R' : 'A'}</div><span className="section-kicker">{data?.progress.currentStep === 'REINFORCEMENT' ? 'UN POCO MÁS DE PRÁCTICA' : 'TU SIGUIENTE PASO'}</span><span className="step-count">{data?.progress.currentStep === 'REINFORCEMENT' ? 'REFUERZO' : 'ACTIVIDAD'} · {data?.progress.currentStep === 'REINFORCEMENT' ? 'R' : 'A'}{data?.progress.currentTopicId}</span></div><h2>{data?.progress.currentStep === 'REINFORCEMENT' ? 'Inténtalo con este ejercicio.' : 'Empecemos con algo concreto.'}</h2><p className="question"><RichText text={data?.activity?.prompt ?? ''} /></p><p className="select-label">ELIGE UNA RESPUESTA</p><div className="options">{data?.activity?.options.map((option, index) => <button key={option.id} className={`option ${selected === option.id ? 'selected' : ''}`} onClick={() => { setSelected(option.id); setFeedback(''); }}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span className="option-text"><RichText text={option.text} /></span><span className="radio">{selected === option.id && <span />}</span></button>)}</div><button className="primary-btn" disabled={!selected || loading} onClick={() => send('attempts', { optionId: selected })}>{loading ? 'Guardando…' : 'Comprobar respuesta'} <span>→</span></button><p className="privacy-note"><span>⌁</span> Tu progreso se guarda automáticamente.</p></>}
      </section>
    </div>
    </>}
    <footer><span>ÁLGEBRA <span className="brand-dot">.</span> · APRENDER, A TU RITMO</span><span>UN PASO A LA VEZ <span className="spark">✳</span></span></footer>
  </main>;
}
export default App;

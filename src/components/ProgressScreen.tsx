import { useMemo, useRef, useState } from 'react'
import { addDays, daysBetween, fromIsoDate, isoDate } from '../lib/date'
import { BODY_FIELDS, BODY_LABELS, formatDuration, formatPace, isValidLog, type FitnessLog } from '../fitness/log'
import { LIFT_NAMES, PLAN, PLAN_START, PLAN_WEEKS, RACE_DAY, getSession, weekOf, type LiftId } from '../fitness/plan'
import type { GarminWeeks } from '../fitness/merge'
import { formatPaceSeconds, pacesFor, strengthTargets, type Profile } from '../fitness/profile'
import { bodySeries, garminRestingHr, latest, liftHistory, movingAverage, nutritionAdvice, plannedWeight, runHistory, weeklyLoss, weeklyMiles } from '../fitness/stats'
import type { SyncStatus } from '../fitness/useFitnessLog'
import { Legend, LineChart, PlanColumns } from './charts'
import { Sheet } from './Sheet'

interface Props {
  today: Date
  log: FitnessLog
  garmin: GarminWeeks
  profile: Profile
  goalWeight: number
  goalWaist: number
  sync: SyncStatus
  onSyncNow: () => void
  onImport: (log: FitnessLog) => void
  onClose: () => void
}

const START_WEIGHT = 195
const CHART_FROM = '2026-10-11'

/** Waist checkpoints from the plan's milestones. */
const WAIST_PLAN = [
  { date: '2026-10-11', value: 36 },
  { date: '2026-11-01', value: 35.5 },
  { date: '2026-12-13', value: 34.5 },
  { date: '2027-01-10', value: 34 },
  { date: '2027-02-14', value: 33 },
  { date: '2027-03-15', value: 32.5 },
  { date: RACE_DAY, value: 32 },
]

const MILESTONES = [
  { date: '2026-11-01', text: 'Weeks 2 and 3 done; long run 6 mi', waist: 35.5 },
  { date: '2026-12-13', text: 'Long run 10 mi', waist: 34.5 },
  { date: '2027-01-10', text: 'Base phase done (12 mi long run); test 5-rep maxes', waist: 34 },
  { date: '2027-02-14', text: 'Long run 16 mi; 10K tune-up race the following week', waist: 33 },
  { date: '2027-03-15', text: 'On pace; 18 mi long run; test 5-rep maxes', waist: 32.5 },
  { date: '2027-03-27', text: '20-mile peak long run', waist: null },
  { date: RACE_DAY, text: 'OKC Marathon', waist: 32 },
]

/** Your current maxes (from settings) and the plan's targets worked out from them. */
function strengthRows(p: Profile): { id: LiftId; start: number | null; target: number | null }[] {
  const t = strengthTargets(p)
  return [
    { id: 'squat', start: p.squatMax, target: t.squat },
    { id: 'bench', start: p.benchMax, target: t.bench },
    { id: 'deadlift', start: p.deadliftMax, target: t.deadlift },
    { id: 'row', start: null, target: null },
    { id: 'ohp', start: null, target: null },
  ]
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  fromIsoDate(iso).toLocaleDateString('en-GB', opts)

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per day: body metrics, the run, and each lift's sets as "160x5 160x5". */
export function toCsv(log: FitnessLog): string {
  const lifts = Object.keys(LIFT_NAMES) as LiftId[]
  const header = ['date', ...BODY_FIELDS, 'run_miles', 'run_time', 'run_avg_hr', 'run_effort', ...lifts, 'notes']
  const rows = Object.keys(log)
    .sort()
    .map((date) => {
      const d = log[date]
      return [
        date,
        ...BODY_FIELDS.map((f) => d.body?.[f]),
        d.run?.miles,
        d.run?.seconds != null ? formatDuration(d.run.seconds) : '',
        d.run?.hr,
        d.run?.effort,
        ...lifts.map((id) =>
          (d.lifts?.[id]?.sets ?? [])
            .filter((s) => s.r != null)
            .map((s) => (s.w != null ? `${s.w}x${s.r}` : String(s.r)))
            .join(' '),
        ),
        d.notes,
      ]
        .map(csvCell)
        .join(',')
    })
  return [header.join(','), ...rows].join('\n')
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function syncText(sync: SyncStatus): string {
  switch (sync.state) {
    case 'off':
      return 'Saved on this device only. Add a sync passcode in settings to back it up to the cloud.'
    case 'syncing':
      return 'Syncing…'
    case 'synced':
      return `Synced to the cloud at ${new Date(sync.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
    case 'error':
      return `Not synced: ${sync.message}. Your data is still saved on this device.`
  }
}

export function ProgressScreen({ today, log, garmin, profile, goalWeight, goalWaist, sync, onSyncNow, onImport, onClose }: Props) {
  const [liftId, setLiftId] = useState<LiftId>('squat')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const todayIso = isoDate(today)

  const weights = useMemo(() => bodySeries(log, 'weight'), [log])
  const avg = useMemo(() => movingAverage(weights), [weights])
  const waists = useMemo(() => bodySeries(log, 'waist'), [log])
  const runs = useMemo(() => runHistory(log), [log])
  const miles = useMemo(() => weeklyMiles(log, garmin), [log, garmin])
  const restingWeekly = useMemo(() => garminRestingHr(garmin), [garmin])
  const restingDaily = useMemo(() => bodySeries(log, 'restingHr'), [log])
  const garminWeeks = useMemo(() => Object.values(garmin).sort((a, b) => b.weekStart.localeCompare(a.weekStart)), [garmin])
  const advice = nutritionAdvice(weights, today)
  const rate = weeklyLoss(weights, today)

  const week = weekOf(today)
  const chartTo = todayIso > RACE_DAY ? todayIso : RACE_DAY
  const planLine = [CHART_FROM, '2027-04-04', RACE_DAY].map((date) => ({ date, value: plannedWeight(fromIsoDate(date), START_WEIGHT, goalWeight) }))
  const avgNow = latest(avg)
  const waistNow = latest(waists)
  const daysToRace = daysBetween(today, fromIsoDate(RACE_DAY))
  const thisWeek = week ? miles[week - 1] : null

  const history = liftHistory(log, liftId)
  const STRENGTH = strengthRows(profile)
  const strength = STRENGTH.find((s) => s.id === liftId)!
  const paces = pacesFor(profile)

  // Monday-to-Sunday of the current (or first) plan week.
  const weekStart = week ? fromIsoDate(PLAN[week - 1].start) : fromIsoDate(PLAN_START)
  const days = Array.from({ length: 7 }, (_, i) => getSession(addDays(weekStart, i), profile))

  const onFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      const data = parsed?.log ?? parsed
      if (!isValidLog(data)) throw new Error()
      onImport(data)
      setImportMsg(`Imported ${Object.keys(data).length} days. Where both had the same day, the newer edit was kept.`)
    } catch {
      setImportMsg('That file isn’t a training-log backup.')
    }
  }

  return (
    <Sheet label="Progress" aside={<span className="sheet-title">Progress</span>} onClose={onClose}>
      <section className="section">
        <div className="stat-grid">
          <Stat
            label="Weight, 7-day avg"
            value={avgNow ? `${avgNow.value.toFixed(1)} lb` : '—'}
            sub={avgNow ? `${(START_WEIGHT - avgNow.value).toFixed(1)} lb lost · goal ${goalWeight}` : `Goal ${goalWeight} lb`}
          />
          <Stat
            label="Waist"
            value={waistNow ? `${waistNow.value} in` : '—'}
            sub={waistNow ? `${fmt(waistNow.date)} · goal ${goalWaist}` : `Goal ${goalWaist} in`}
          />
          <Stat
            label="OKC Marathon"
            value={daysToRace > 0 ? `${daysToRace} days` : daysToRace === 0 ? 'Today' : 'Done'}
            sub={week ? `Week ${week} of ${PLAN_WEEKS} · ${PLAN[week - 1].phase}` : fmt(RACE_DAY, { day: 'numeric', month: 'long', year: 'numeric' })}
          />
          <Stat
            label="Miles this week"
            value={thisWeek ? `${Math.round(thisWeek.actual * 10) / 10}` : '—'}
            sub={thisWeek ? `of ${thisWeek.planned} planned` : 'Plan not running'}
          />
        </div>
        {advice ? (
          <p className={`advice advice--${advice.tone}`}>
            <strong>{advice.tone === 'good' ? 'On track. ' : 'Adjust. '}</strong>
            {advice.text}
          </p>
        ) : (
          <p className="advice">Weigh in 3 or more mornings a week. After four weeks this shows your rate of loss and whether to change calories.</p>
        )}
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Body</span>
          {rate != null && <span className="kicker-meta">{rate >= 0 ? `−${rate.toFixed(1)}` : `+${(-rate).toFixed(1)}`} lb / week</span>}
        </div>
        <LineChart
          title="Weight (lb)"
          from={CHART_FROM}
          to={chartTo}
          unit="lb"
          goal={{ value: goalWeight, label: `Goal ${goalWeight}` }}
          legend={<Legend items={[{ label: 'Weigh-ins', kind: 'dot' }, { label: '7-day average', kind: 'line' }, { label: 'Plan', kind: 'reference' }]} />}
          series={[
            { id: 'plan', label: 'Plan', points: planLine, style: 'reference' },
            { id: 'raw', label: 'Weigh-in', points: weights, style: 'dots' },
            { id: 'avg', label: '7-day avg', points: avg, style: 'line' },
          ]}
        />
        <LineChart
          title="Waist (in)"
          from={CHART_FROM}
          to={chartTo}
          unit="in"
          goal={{ value: goalWaist, label: `Goal ${goalWaist}` }}
          legend={<Legend items={[{ label: 'Measured', kind: 'line' }, { label: 'Plan milestones', kind: 'reference' }]} />}
          series={[
            { id: 'plan', label: 'Plan', points: WAIST_PLAN, style: 'reference' },
            { id: 'waist', label: 'Waist', points: waists, style: 'line' },
          ]}
        />
        {(restingWeekly.length > 0 || restingDaily.length > 0) && (
          <LineChart
            title="Resting heart rate (bpm)"
            from={[restingWeekly[0]?.date, restingDaily[0]?.date, CHART_FROM].filter(Boolean).sort()[0]!}
            to={chartTo}
            unit="bpm"
            digits={0}
            legend={
              restingWeekly.length > 0 && restingDaily.length > 0 ? (
                <Legend items={[{ label: 'Garmin weekly average', kind: 'line' }, { label: 'Your check-ins', kind: 'dot' }]} />
              ) : undefined
            }
            series={[
              { id: 'daily', label: 'Check-in', points: restingDaily, style: 'dots' },
              { id: 'garmin', label: 'Garmin week avg', points: restingWeekly, style: 'line' },
            ]}
          />
        )}
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Strength</span>
          <span className="kicker-meta">Estimated 1-rep max</span>
        </div>
        <table className="data-table tnum">
          <thead>
            <tr>
              <th>Lift</th>
              <th>Your max</th>
              <th>Best logged</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {STRENGTH.map((s) => {
              const best = Math.max(0, ...liftHistory(log, s.id).map((p) => p.e1rm))
              return (
                <tr key={s.id}>
                  <td>{LIFT_NAMES[s.id]}</td>
                  <td>{s.start ?? '—'}</td>
                  <td className={s.start && best > s.start ? 'pr' : ''}>{best ? Math.round(best) : '—'}</td>
                  <td>{s.target ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="fine">Estimated from your logged sets of 10 reps or fewer (Epley formula). Gold means above your max in settings. Update your maxes there after a test, and the plan’s weights recalculate.</p>
        <div className="seg chart-seg" role="radiogroup" aria-label="Lift">
          {STRENGTH.map((s) => (
            <label key={s.id} className="seg-opt">
              <input type="radio" name="lift" checked={liftId === s.id} onChange={() => setLiftId(s.id)} />
              {LIFT_NAMES[s.id].replace('Overhead press', 'OHP').replace('Barbell row', 'Row').replace('Bench press', 'Bench')}
            </label>
          ))}
        </div>
        {history.length ? (
          <LineChart
            title={`${LIFT_NAMES[liftId]}, estimated max (lb)`}
            from={CHART_FROM}
            to={chartTo}
            unit="lb"
            digits={0}
            goal={strength.target ? { value: strength.target, label: `Target ${strength.target}` } : undefined}
            series={[{ id: 'e1rm', label: 'Est. max', points: history.map((p) => ({ date: p.date, value: p.e1rm })), style: 'line' }]}
          />
        ) : (
          <p className="empty-note">No {LIFT_NAMES[liftId].toLowerCase()} sets logged yet.</p>
        )}
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Your paces</span>
          <span className="kicker-meta">From your 2-mile · VDOT {paces.vdot.toFixed(0)}</span>
        </div>
        <table className="data-table tnum">
          <tbody>
            <tr>
              <td>Easy and long runs</td>
              <td>
                {formatPaceSeconds(paces.easy[0])}–{formatPaceSeconds(paces.easy[1])} /mi
              </td>
            </tr>
            <tr>
              <td>Tempo</td>
              <td>{formatPaceSeconds(paces.tempo)} /mi</td>
            </tr>
            <tr>
              <td>800 m repeats</td>
              <td>
                {formatPaceSeconds(paces.interval800, 1)} each ({formatPaceSeconds(paces.interval)} /mi)
              </td>
            </tr>
            <tr>
              <td>Marathon pace (for now)</td>
              <td>{formatPaceSeconds(paces.marathon)} /mi</td>
            </tr>
          </tbody>
        </table>
        <p className="fine">
          Worked out with Jack Daniels’ VDOT formulas from your 2-mile time in settings. The marathon figure assumes full marathon training, so treat it
          as a ceiling; your February 10K sets the real goal pace.
        </p>
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Running</span>
          <span className="kicker-meta">
            {runs.length ? `${Math.round(runs.reduce((a, r) => a + r.miles, 0))} mi logged · longest ${Math.max(...runs.map((r) => r.miles))} mi` : 'No runs yet'}
          </span>
        </div>
        <PlanColumns
          title="Miles per week"
          unit="mi"
          legend={<Legend items={[{ label: 'Planned', kind: 'planned' }, { label: 'Actual', kind: 'bar' }]} />}
          data={miles.map((w) => ({
            key: String(w.week),
            label: String(w.week),
            planned: w.planned,
            actual: w.actual,
            current: w.week === week,
            tip: `Week ${w.week} · ${fmt(w.start)}`,
            detail:
              w.garmin != null
                ? `Logged ${Math.round(w.logged * 10) / 10} · Garmin ${w.garmin} (counted once)`
                : w.logged
                  ? 'From your logged runs'
                  : undefined,
          }))}
        />
        <p className="fine">Each week counts the larger of your logged runs and Garmin’s weekly total, so a run recorded in both places is counted once.</p>
        {runs.length > 0 && (
          <table className="data-table tnum">
            <thead>
              <tr>
                <th>Date</th>
                <th>Miles</th>
                <th>Time</th>
                <th>Pace</th>
                <th>HR</th>
              </tr>
            </thead>
            <tbody>
              {runs
                .slice(-10)
                .reverse()
                .map((r) => (
                  <tr key={r.date}>
                    <td>{fmt(r.date)}</td>
                    <td>{r.miles}</td>
                    <td>{formatDuration(r.seconds) || '—'}</td>
                    <td>{formatPace(r.miles, r.seconds)?.replace(' /mi', '') ?? '—'}</td>
                    <td>{r.hr ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {garminWeeks.length > 0 && (
        <section className="section">
          <div className="kicker-row">
            <span className="kicker">Garmin weekly reports</span>
            <span className="kicker-meta">Imported from your email</span>
          </div>
          <table className="data-table tnum">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Runs</th>
                <th>Miles</th>
                <th>Pace</th>
                <th>Resting HR</th>
              </tr>
            </thead>
            <tbody>
              {garminWeeks.slice(0, 12).map((w) => (
                <tr key={w.weekStart}>
                  <td>{fmt(w.weekStart)}</td>
                  <td>{w.runs || '—'}</td>
                  <td>{w.miles || '—'}</td>
                  <td>{formatPace(w.miles, w.seconds)?.replace(' /mi', '') ?? '—'}</td>
                  <td>{w.restingHr ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">{week ? `Week ${week}` : 'Week 1'}</span>
          <span className="kicker-meta">{fmt(isoDate(weekStart))} to {fmt(isoDate(addDays(weekStart, 6)))}</span>
        </div>
        <ul className="week-list">
          {days.map((s) => (
            <li key={s.date} className={s.date === todayIso ? 'week-today' : ''}>
              <span className="week-day">{fmt(s.date, { weekday: 'short' })}</span>
              <span>{s.run ? s.run.title : s.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Milestones</span>
        </div>
        <table className="data-table tnum">
          <thead>
            <tr>
              <th>Date</th>
              <th>Waist</th>
              <th>Checkpoint</th>
            </tr>
          </thead>
          <tbody>
            {MILESTONES.map((ms) => (
              <tr key={ms.date} className={ms.date < todayIso ? 'past' : ''}>
                <td>{fmt(ms.date)}</td>
                <td>{ms.waist ?? '—'}</td>
                <td className="wrap">{ms.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Body log</span>
          <span className="kicker-meta">Latest 14</span>
        </div>
        <table className="data-table tnum">
          <thead>
            <tr>
              <th>Date</th>
              {(['weight', 'waist', 'bodyFat', 'restingHr'] as const).map((f) => (
                <th key={f}>{BODY_LABELS[f].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(log)
              .filter((d) => log[d].body && Object.values(log[d].body!).some((v) => v != null))
              .sort()
              .slice(-14)
              .reverse()
              .map((d) => (
                <tr key={d}>
                  <td>{fmt(d)}</td>
                  {(['weight', 'waist', 'bodyFat', 'restingHr'] as const).map((f) => (
                    <td key={f}>{log[d].body?.[f] ?? '—'}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <div className="kicker-row">
          <span className="kicker">Your data</span>
        </div>
        <p className="fine">
          {syncText(sync)}{' '}
          {sync.state !== 'off' && (
            <button className="link-btn" onClick={onSyncNow}>
              Sync now
            </button>
          )}
        </p>
        <div className="data-actions">
          <button className="btn btn-secondary" onClick={() => download(`training-log-${todayIso}.json`, JSON.stringify(log, null, 1), 'application/json')}>
            Back up (JSON)
          </button>
          <button className="btn btn-secondary" onClick={() => download(`training-log-${todayIso}.csv`, toCsv(log), 'text/csv')}>
            Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Restore…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {importMsg && <p className="fine">{importMsg}</p>}
      </section>
    </Sheet>
  )
}

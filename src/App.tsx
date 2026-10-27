import { useEffect, useMemo, useState } from 'react'
import { DaySection } from './components/DaySection'
import { Masthead } from './components/Masthead'
import { PullToRefresh } from './components/PullToRefresh'
import { SettingsScreen } from './components/SettingsScreen'
import { CheckInSection } from './components/CheckInSection'
import { ProgressScreen } from './components/ProgressScreen'
import { TrainingSection } from './components/TrainingSection'
import { WeatherSection } from './components/WeatherSection'
import { getSession } from './fitness/plan'
import { bodySeries, movingAverage } from './fitness/stats'
import { useFitnessLog } from './fitness/useFitnessLog'
import { addDays, daysBetween, fromIsoDate, isoDate } from './lib/date'
import { dailyVerseSettings } from './scripture'
import { ScriptureSection } from './scripture/ScriptureSection'
import { useSettings } from './settings'
import { useBriefing, useToday } from './useBriefing'

export default function App() {
  const [settings, saveSettings] = useSettings()
  const today = useToday()
  const briefing = useBriefing(settings, today)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Set when returning from Google's sign-in page (/?google=connected|cancelled|failed).
  const [googleResult, setGoogleResult] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const result = url.searchParams.get('google')
    if (!result) return
    url.searchParams.delete('google')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    if (result === 'connected') saveSettings({ ...settings, calendarSource: 'google' })
    setGoogleResult(result)
    setSettingsOpen(true)
    // Runs once on load; settings are read as they were then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const fitness = useFitnessLog(settings.syncKey)
  const [progressOpen, setProgressOpen] = useState(false)
  // Training and check-in can show another day, to log something late.
  const [offset, setOffset] = useState(0)
  const viewDate = useMemo(() => addDays(today, offset), [today, offset])
  const viewIso = isoDate(viewDate)
  const session = useMemo(() => getSession(viewDate, settings.profile), [viewDate, settings.profile])
  const viewDay = fitness.log[viewIso]
  const avgWeight = useMemo(() => {
    const upTo = bodySeries(fitness.log, 'weight').filter((p) => p.date <= viewIso)
    const last = movingAverage(upTo).at(-1)
    return last && daysBetween(fromIsoDate(last.date), viewDate) < 7 ? last.value : null
  }, [fitness.log, viewIso, viewDate])

  const date = isoDate(today)
  const scriptureSettings = useMemo(
    () => dailyVerseSettings(today, settings.translation),
    [today, settings.translation],
  )

  return (
    <>
      <PullToRefresh refreshing={briefing.refreshing} onRefresh={briefing.refresh} />
      <main className="page">
        <Masthead today={today} city={settings.city} onOpenSettings={() => setSettingsOpen(true)} />
        <WeatherSection state={briefing.weather} />
        <DaySection key={date} state={briefing.events} linked={briefing.calendarLinked} needsAuth={briefing.calendarNeedsAuth} />
        <ScriptureSection today={today} settings={scriptureSettings} state={briefing.scripture} worshipUrl={settings.worshipUrl} />
        <TrainingSection
          key={viewIso}
          date={viewDate}
          isToday={offset === 0}
          onStep={(n) => setOffset((o) => o + n)}
          onToday={() => setOffset(0)}
          session={session}
          day={viewDay}
          log={fitness.log}
          onUpdate={(change) => fitness.updateDay(viewIso, change)}
          onOpenProgress={() => setProgressOpen(true)}
        />
        <CheckInSection
          key={`checkin-${viewIso}`}
          body={viewDay?.body ?? {}}
          notes={viewDay?.notes ?? ''}
          avgWeight={avgWeight}
          goalWeight={settings.goalWeight}
          onChange={(field, value) => fitness.updateDay(viewIso, (d) => ({ ...d, body: { ...d.body, [field]: value } }))}
          onNotes={(notes) => fitness.updateDay(viewIso, (d) => ({ ...d, notes }))}
        />
        <footer className="colophon">— Fin —</footer>
      </main>
      {progressOpen && (
        <ProgressScreen
          today={today}
          log={fitness.log}
          garmin={fitness.garmin}
          profile={settings.profile}
          goalWeight={settings.goalWeight}
          goalWaist={settings.goalWaist}
          sync={fitness.sync}
          onSyncNow={() => void fitness.syncNow()}
          onImport={fitness.importLog}
          onClose={() => setProgressOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsScreen
          settings={settings}
          weatherSource={briefing.weatherSource}
          googleResult={googleResult}
          onSave={saveSettings}
          onClose={() => {
            setSettingsOpen(false)
            setGoogleResult(null)
          }}
        />
      )}
    </>
  )
}

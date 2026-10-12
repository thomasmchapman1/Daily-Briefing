import { useMemo, useState } from 'react'
import { DaySection } from './components/DaySection'
import { Masthead } from './components/Masthead'
import { PullToRefresh } from './components/PullToRefresh'
import { SettingsScreen } from './components/SettingsScreen'
import { TrainingSection } from './components/TrainingSection'
import { WeatherSection } from './components/WeatherSection'
import { isoDate } from './lib/date'
import { ScriptureSection } from './scripture/ScriptureSection'
import { useSettings } from './settings'
import { useBriefing, useToday } from './useBriefing'
import { getWorkout, loadWorkoutLog, toggleExercise } from './workout'

export default function App() {
  const [settings, saveSettings] = useSettings()
  const today = useToday()
  const briefing = useBriefing(settings, today)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [workoutLog, setWorkoutLog] = useState(loadWorkoutLog)

  const date = isoDate(today)
  const workout = useMemo(() => getWorkout(today, settings.programStart), [today, settings.programStart])
  const scriptureSettings = useMemo(
    () => ({ plan: settings.plan, planStart: settings.planStart, translation: settings.translation }),
    [settings.plan, settings.planStart, settings.translation],
  )

  return (
    <>
      <PullToRefresh refreshing={briefing.refreshing} onRefresh={briefing.refresh} />
      <main className="page">
        <Masthead today={today} city={settings.city} onOpenSettings={() => setSettingsOpen(true)} />
        <WeatherSection state={briefing.weather} />
        <DaySection key={date} state={briefing.events} linked={briefing.calendarLinked} />
        <ScriptureSection today={today} settings={scriptureSettings} state={briefing.scripture} />
        <TrainingSection
          key={`${date}|${settings.programStart}`}
          workout={workout}
          done={workoutLog[date] ?? {}}
          onToggle={(i) => setWorkoutLog((log) => toggleExercise(log, date, i))}
        />
        <footer className="colophon">— Fin —</footer>
      </main>
      {settingsOpen && <SettingsScreen settings={settings} weatherSource={briefing.weatherSource} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

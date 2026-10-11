import type { TodayWorkout } from '../workout'

interface Props {
  workout: TodayWorkout
  done: Record<number, true>
  onToggle: (index: number) => void
}

export function TrainingSection({ workout, done, onToggle }: Props) {
  const count = workout.exercises.filter((_, i) => done[i]).length
  return (
    <section className="section section--training" aria-label="Training">
      <div className="kicker-row">
        <span className="kicker">Training</span>
        {!workout.rest && (
          <span className="kicker-meta">
            {count} of {workout.exercises.length} done
          </span>
        )}
      </div>
      {workout.rest ? (
        <div className="training-title">Rest day</div>
      ) : (
        <>
          <div className="training-title">{workout.title}</div>
          <div className="training-meta">
            Week {workout.week} · Day {workout.day} · about {workout.minutes} min
          </div>
          {workout.exercises.map((ex, i) => (
            <button
              key={i}
              className={`exercise tap${done[i] ? ' exercise--done' : ''}`}
              role="checkbox"
              aria-checked={Boolean(done[i])}
              onClick={() => onToggle(i)}
            >
              <span className="check" aria-hidden="true">
                {done[i] ? '✓' : ''}
              </span>
              <span className="exercise-name">{ex.name}</span>
              <span className="exercise-spec">{ex.spec}</span>
            </button>
          ))}
        </>
      )}
    </section>
  )
}

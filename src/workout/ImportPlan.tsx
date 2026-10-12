import { Check, Copy } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { addDays, fromIsoDate } from '../lib/date'
import { parsePlanText, planPrompt, type Program } from '.'

interface Props {
  current: Program
  programStart: string
  /** Load the imported plan into the editor (not saved until the editor's Save). */
  onUse: (program: Program) => void
  onClose: () => void
}

/** Get a plan from a Claude chat: copy a prompt out, paste Claude's reply back in. */
export function ImportPlan({ current, programStart, onUse, onClose }: Props) {
  const [includeCurrent, setIncludeCurrent] = useState(true)
  const [copied, setCopied] = useState(false)
  const [reply, setReply] = useState('')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const prompt = useMemo(() => planPrompt(programStart, includeCurrent ? current : undefined), [programStart, includeCurrent, current])
  const parsed = useMemo(() => (reply.trim() ? parsePlanText(reply) : null), [reply])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      // Clipboard blocked: select the text so it can be copied by hand.
      promptRef.current?.select()
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const weekday = (day: number) => addDays(fromIsoDate(programStart), day).toLocaleDateString('en-GB', { weekday: 'short' })

  return (
    <Sheet label="Import from Claude" backLabel="Training plan" aside={<span className="sheet-title">Import</span>} onClose={onClose}>
      <div className="settings">
        <div className="field">
          <label htmlFor="import-prompt">1. Copy this into a Claude chat</label>
          <textarea id="import-prompt" ref={promptRef} className="input import-text" readOnly rows={6} value={prompt} />
          <label className="checkbox" style={{ margin: '10px 0' }}>
            <input type="checkbox" checked={includeCurrent} onChange={(e) => setIncludeCurrent(e.target.checked)} />
            Include my current plan, so Claude can change it
          </label>
          <button type="button" className="btn btn-primary btn-wide" onClick={copy}>
            {copied ? <Check size={15} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.5} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
          <span className="field-hint">
            In the chat, finish the last line with what you want, such as “4 days a week, upper/lower split, add 5 lb a week”.
          </span>
        </div>

        <div className="field">
          <label htmlFor="import-reply">2. Paste Claude’s reply</label>
          <textarea
            id="import-reply"
            className="input import-text"
            rows={6}
            placeholder="Paste the whole reply here"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {parsed && !parsed.ok && <span className="field-hint import-error">{parsed.error}</span>}
        </div>

        {parsed?.ok && (
          <div className="field">
            <label>3. Check it</label>
            <div className="import-preview">
              <div className="training-title" style={{ marginTop: 0 }}>
                {parsed.program.name}
              </div>
              <div className="training-meta">
                {parsed.program.weeks.length} {parsed.program.weeks.length === 1 ? 'week' : 'weeks'}, repeating · week 1:
              </div>
              {parsed.program.weeks[0].days.map((d, i) => (
                <div key={i} className="import-day">
                  <span className="editor-day-num">
                    Day {i + 1} · {weekday(i)}
                  </span>
                  <span>
                    {d.title}
                    {d.exercises.length > 0 && <span className="muted"> · {d.exercises.map((e) => e.name).join(', ')}</span>}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-wide"
              style={{ marginTop: 14 }}
              onClick={() => {
                onUse(parsed.program)
                onClose()
              }}
            >
              Use this plan
            </button>
            <span className="field-hint">It replaces the plan in the editor. Look it over, then tap Save training plan.</span>
          </div>
        )}
      </div>
    </Sheet>
  )
}

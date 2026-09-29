import { useState, type KeyboardEvent } from 'react'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
}

/** Clickable chips plus a box to type your own interest. */
export default function InterestPicker({ value, onChange, suggestions }: Props) {
  const [custom, setCustom] = useState('')
  const toggle = (tag: string) => onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag])
  const all = [...new Set([...suggestions, ...value])]

  function addCustom(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const tag = custom.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setCustom('')
  }

  return (
    <div className="interest-picker">
      <div className="chips">
        {all.map((tag) => (
          <button type="button" key={tag} className={`chip ${value.includes(tag) ? 'chip-on' : ''}`} onClick={() => toggle(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <input placeholder="Add your own and press Enter" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={addCustom} />
    </div>
  )
}

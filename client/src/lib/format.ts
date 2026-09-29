const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatRange = (start: string, end: string) => `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`

/** Value for <input type="datetime-local"> in the user's own timezone */
export function toLocalInput(iso: string) {
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export const mapsUrl = (name: string, address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(', '))}`

/** Each category gets its own colour pair for banners and badges */
const PALETTE: Record<string, [string, string]> = {
  Academic: ['#1d4ed8', '#60a5fa'],
  Career: ['#0b2545', '#3b6ea5'],
  Tech: ['#4338ca', '#a78bfa'],
  Sports: ['#b45309', '#f2b134'],
  Arts: ['#be185d', '#f9a8d4'],
  Music: ['#7c3aed', '#f472b6'],
  Social: ['#0f766e', '#5eead4'],
  Wellness: ['#15803d', '#86efac'],
  Volunteering: ['#c2410c', '#fdba74'],
  Workshop: ['#334155', '#94a3b8'],
}
export const categoryColors = (c: string) => PALETTE[c] ?? ['#0b2545', '#3b6ea5']

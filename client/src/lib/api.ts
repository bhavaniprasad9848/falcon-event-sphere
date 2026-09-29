import type { Attendee, EventInput, EventItem, Meta, Recommendation, RsvpStatus, User } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'falcon_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`)
  return data as T
}

type Auth = { token: string; user: User }
type One = { event: EventItem }

export interface EventQuery {
  q?: string
  category?: string
  sort?: 'soonest' | 'popular'
  page?: number
}

export const api = {
  meta: () => request<Meta>('GET', '/meta'),

  register: (body: { name: string; email: string; password: string; role: string; department: string; interests: string[] }) =>
    request<Auth>('POST', '/auth/register', body),
  login: (email: string, password: string) => request<Auth>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User }>('GET', '/auth/me'),
  updateProfile: (body: Partial<Pick<User, 'name' | 'department' | 'interests'>>) =>
    request<{ user: User }>('PATCH', '/auth/me', body),

  listEvents: (query: EventQuery) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)))
    return request<{ events: EventItem[]; page: number; pages: number; total: number }>('GET', `/events?${params}`)
  },
  getEvent: (id: string) => request<One>('GET', `/events/${id}`),
  createEvent: (body: EventInput) => request<One>('POST', '/events', body),
  updateEvent: (id: string, body: Partial<EventInput & { cancelled: boolean }>) => request<One>('PATCH', `/events/${id}`, body),
  deleteEvent: (id: string) => request<void>('DELETE', `/events/${id}`),
  attendees: (id: string) => request<{ attendees: Attendee[] }>('GET', `/events/${id}/attendees`),
  calendarUrl: (id: string) => `${BASE}/api/events/${id}/calendar.ics`,

  rsvp: (id: string, status: RsvpStatus) => request<One>('PUT', `/events/${id}/rsvp`, { status }),
  cancelRsvp: (id: string) => request<One>('DELETE', `/events/${id}/rsvp`),

  myEvents: () => request<{ going: EventItem[]; interested: EventItem[]; hosting: EventItem[] }>('GET', '/me/events'),
  recommendations: () =>
    request<{ source: 'ai' | 'personalized' | 'popular'; items: Recommendation[] }>('GET', '/me/recommendations'),
}

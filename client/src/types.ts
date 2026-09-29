export type Role = 'student' | 'organizer'
export type RsvpStatus = 'going' | 'interested'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  department: string
  interests: string[]
}

export interface EventItem {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  location: { name: string; address: string }
  startsAt: string
  endsAt: string
  imageUrl: string
  organizer: { id: string; name: string }
  capacity: number | null
  seatsLeft: number | null
  goingCount: number
  interestedCount: number
  cancelled: boolean
  myRsvp?: RsvpStatus | null
}

export interface Recommendation {
  event: EventItem
  reason: string
}

export interface Meta {
  categories: string[]
  interestSuggestions: string[]
  aiEnabled: boolean
}

export interface Attendee {
  name: string
  email: string
  department: string
  status: RsvpStatus
  at: string
}

export type EventInput = {
  title: string
  description: string
  category: string
  tags: string[]
  location: { name: string; address: string }
  startsAt: string
  endsAt: string
  capacity: number | null
  imageUrl: string
}

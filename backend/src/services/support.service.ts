/**
 * Support tickets: users open a ticket (optionally about a reservation),
 * the support team replies from the admin panel. Both sides get notified.
 */
import { Reservation, SupportTicket, User, type TicketCategory, type TicketStatus } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { hasPermission, type Actor } from './access.service.js'
import { notify } from './notification.service.js'

type TicketDoc = InstanceType<typeof SupportTicket>

async function serialize(ticket: TicketDoc, withMessages = true) {
  const ids = [ticket.user, ...ticket.messages.map((m) => m.author)]
  const users = new Map((await User.find({ _id: { $in: ids } }).select('name email').lean()).map((u) => [u._id.toString(), u]))
  const owner = users.get(ticket.user.toString())
  return {
    id: ticket.id as string,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    reservationId: ticket.reservation?.toString(),
    user: owner ? { id: owner._id.toString(), name: owner.name, email: owner.email } : null,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
    messageCount: ticket.messages.length,
    ...(withMessages
      ? {
          messages: ticket.messages.map((m) => ({
            body: m.body,
            fromTeam: m.fromTeam,
            author: m.fromTeam ? 'Zalogaj podrška' : (users.get(m.author.toString())?.name ?? 'Korisnik'),
            createdAt: m.createdAt.toISOString(),
          })),
        }
      : {}),
  }
}

async function supportTeam() {
  const team = await User.find({ role: { $in: ['admin', 'support'] }, deletedAt: null }).select('_id').lean()
  return team.map((u) => u._id)
}

export async function create(actor: Actor, input: { subject: string; category: TicketCategory; message: string; reservationId?: string }) {
  if (input.reservationId && !(await Reservation.exists({ _id: input.reservationId, user: actor.id }))) {
    throw ApiError.notFound('Rezervacija nije pronađena.')
  }
  const ticket = await SupportTicket.create({
    user: actor.id,
    subject: input.subject,
    category: input.category,
    reservation: input.reservationId,
    messages: [{ author: actor.id, fromTeam: false, body: input.message }],
  })
  void notify(await supportTeam(), { type: 'support_new', title: `Nov tiket: ${ticket.subject}`, body: input.message.slice(0, 140), link: `/admin?tab=support` })
  return serialize(ticket)
}

export async function mine(actor: Actor) {
  const tickets = await SupportTicket.find({ user: actor.id }).sort({ lastMessageAt: -1 }).limit(50)
  return Promise.all(tickets.map((t) => serialize(t, false)))
}

async function loadAuthorized(id: string, actor: Actor) {
  const ticket = await SupportTicket.findById(id)
  const isTeam = hasPermission(actor, 'support.manage')
  if (!ticket || (ticket.user.toString() !== actor.id && !isTeam)) throw ApiError.notFound('Tiket nije pronađen.')
  return { ticket, isTeam: isTeam && ticket.user.toString() !== actor.id }
}

export async function get(id: string, actor: Actor) {
  const { ticket } = await loadAuthorized(id, actor)
  return serialize(ticket)
}

export async function reply(id: string, body: string, actor: Actor) {
  const { ticket, isTeam } = await loadAuthorized(id, actor)
  if (ticket.status === 'closed' && !isTeam) throw ApiError.conflict('Tiket je zatvoren. Otvori novi ako ti treba pomoć.', 'TICKET_CLOSED')
  ticket.messages.push({ author: actor.id as never, fromTeam: isTeam, body, createdAt: new Date() })
  ticket.status = isTeam ? 'answered' : 'open'
  ticket.lastMessageAt = new Date()
  await ticket.save()
  if (isTeam) {
    void notify([ticket.user], { type: 'support_reply', title: `Odgovor podrške: ${ticket.subject}`, body: body.slice(0, 140), link: `/support/${ticket.id}` })
  } else {
    void notify(await supportTeam(), { type: 'support_new', title: `Nova poruka: ${ticket.subject}`, body: body.slice(0, 140), link: `/admin?tab=support` })
  }
  return serialize(ticket)
}

export async function close(id: string, actor: Actor) {
  const { ticket } = await loadAuthorized(id, actor)
  ticket.status = 'closed'
  await ticket.save()
  return serialize(ticket)
}

export async function adminList(status: TicketStatus | undefined, page: number, limit: number) {
  const filter = status ? { status } : {}
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit),
    SupportTicket.countDocuments(filter),
  ])
  return { items: await Promise.all(tickets.map((t) => serialize(t, false))), meta: { page, limit, total } }
}

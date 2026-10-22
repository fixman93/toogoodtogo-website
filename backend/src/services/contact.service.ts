/**
 * Public contact form ("Kontakt"): the message is e-mailed to CONTACT_EMAIL with
 * Reply-To set to the sender, so the team simply answers the e-mail. Nothing is
 * stored in the database, and the sender gets no automatic e-mail (no relay for spam).
 */
import { env, isProduction } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import type { ContactInput } from '../validators/contact.validators.js'
import { sendMail } from './mail.service.js'

const TOPICS: Record<ContactInput['topic'], string> = {
  partnership: 'Partnerstvo',
  support: 'Podrška',
  privacy: 'Privatnost i podaci',
  other: 'Drugo',
}

/** One line, no control characters (subject and header-like fields). */
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').trim()

export async function send(input: ContactInput, userId?: string) {
  const name = oneLine(input.name)
  const subject = `Kontakt forma: ${TOPICS[input.topic]} – ${name}`
  const body = [
    `Nova poruka sa kontakt forme (${TOPICS[input.topic]}).`,
    `Ime: ${name}`,
    `E-pošta: ${input.email}`,
    ...(input.phone ? [`Telefon: ${oneLine(input.phone)}`] : []),
    ...(input.company ? [`Firma / lokal: ${oneLine(input.company)}`] : []),
    ...(userId ? [`Nalog u aplikaciji: ${userId}`] : []),
    'Poruka:',
    input.message,
    'Odgovori direktno na ovaj e-mail – odgovor ide pošiljaocu.',
  ].join('\n')
  const reply = `mailto:${input.email}?subject=${encodeURIComponent(`Re: ${TOPICS[input.topic]}`)}`
  const result = await sendMail(env.CONTACT_EMAIL, subject, body, reply, 'Odgovori pošiljaocu', { replyTo: input.email })
  // Without e-mail configured the message would be lost — tell the sender (only logged in development).
  if (result.status === 'failed' || (result.status === 'skipped' && isProduction)) {
    throw new ApiError(503, 'CONTACT_UNAVAILABLE', `Poruka trenutno ne može da se pošalje. Pokušaj ponovo kasnije ili nam piši na ${env.CONTACT_EMAIL}.`)
  }
  return { sent: true }
}

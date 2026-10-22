import { z } from 'zod'

export const contactBody = z.object({
  name: z.string().trim().min(2, 'Upiši ime.').max(80),
  email: z.email('Upiši ispravnu e-poštu.').trim().toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(120).optional(),
  topic: z.enum(['partnership', 'support', 'privacy', 'other']),
  message: z.string().trim().min(10, 'Poruka je prekratka.').max(3000, 'Poruka je predugačka (najviše 3000 znakova).'),
  /** Honeypot: hidden field, real people leave it empty. */
  website: z.string().max(200).optional(),
})

export type ContactInput = z.infer<typeof contactBody>

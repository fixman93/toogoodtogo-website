/**
 * Transactional e-mail via SMTP (any provider: Brevo, Mailgun, SES, Gmail…).
 * Optional: without SMTP_URL nothing is sent and nothing breaks.
 */
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null

export const mailEnabled = () => transport != null

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function sendMail(to: string, subject: string, body: string, link?: string) {
  if (!transport) return
  const url = link ? new URL(link, env.APP_URL).toString() : env.APP_URL
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f5ef;padding:24px">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:24px">
    <p style="font-size:20px;font-weight:bold;color:#0f4c3a;margin:0 0 12px">Zalogaj</p>
    <p style="font-size:16px;font-weight:bold;margin:0 0 8px">${escape(subject)}</p>
    <p style="font-size:14px;color:#444;margin:0 0 20px">${escape(body)}</p>
    <a href="${escape(url)}" style="display:inline-block;background:#0f4c3a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Otvori Zalogaj</a>
  </div></body></html>`
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text: `${body}\n\n${url}`, html })
  } catch (error) {
    console.error('E-mail failed', error)
  }
}

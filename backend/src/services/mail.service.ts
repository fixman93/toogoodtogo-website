/**
 * Transactional e-mail via MailerSend (HTTP API). Without MAILERSEND_API_KEY
 * nothing is sent; in development every e-mail is also logged (with its link)
 * so flows like password reset can be tested locally.
 */
import { env, isProduction } from '../config/env.js'

const API_URL = 'https://api.mailersend.com/v1/email'

function parseFrom(value: string) {
  const match = /^(.*)<(.+)>$/.exec(value.trim())
  return match ? { name: match[1].trim() || 'Zalogaj', email: match[2].trim() } : { name: 'Zalogaj', email: value.trim() }
}

export const mailEnabled = () => Boolean(env.MAILERSEND_API_KEY)

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Optional richer content: a key/value table and an inline image (e.g. the pickup QR code). */
export interface MailExtras {
  details?: [label: string, value: string][]
  /** PNG embedded in the e-mail (inline attachment), shown above the button. */
  image?: { png: Buffer; alt: string; caption?: string }
}

const IMAGE_CID = 'zalogaj-image'

function html(subject: string, body: string, url: string, button: string, extras: MailExtras = {}) {
  const image = extras.image
    ? `<div style="text-align:center;margin:8px 0 16px"><img src="cid:${IMAGE_CID}" alt="${escape(extras.image.alt)}" width="220" height="220" style="display:inline-block;width:220px;height:220px;border:0" />${
        extras.image.caption ? `<p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#0f4c3a;margin:10px 0 0;font-family:'Courier New',monospace">${escape(extras.image.caption)}</p>` : ''
      }</div>`
    : ''
  const details = extras.details?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px">${extras.details
        .map(([label, value]) => `<tr><td style="padding:8px 0;color:#888;border-top:1px solid #eee;vertical-align:top">${escape(label)}</td><td style="padding:8px 0;color:#1d2b25;font-weight:bold;text-align:right;border-top:1px solid #eee">${escape(value)}</td></tr>`)
        .join('')}</table>`
    : ''
  const paragraphs = body
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p style="font-size:14px;line-height:1.5;color:#444;margin:0 0 12px">${escape(line)}</p>`)
    .join('')
  return `<!doctype html><html lang="sr"><body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f7f5ef;padding:24px">
  <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:16px;padding:28px">
    <p style="font-size:22px;font-weight:bold;color:#0f4c3a;margin:0 0 16px">Zalogaj</p>
    <p style="font-size:17px;font-weight:bold;color:#1d2b25;margin:0 0 12px">${escape(subject)}</p>
    ${paragraphs}
    ${image}
    ${details}
    <a href="${escape(url)}" style="display:inline-block;margin-top:8px;background:#0f4c3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">${escape(button)}</a>
    <p style="font-size:12px;color:#888;margin:24px 0 0">Ako dugme ne radi, otvori ovaj link: ${escape(url)}</p>
  </div></body></html>`
}

/**
 * Send one e-mail. `link` is an in-app path ("/reservations/123") or a full URL.
 * Never throws — a failed e-mail must not break the action that triggered it.
 */
export async function sendMail(to: string, subject: string, body: string, link?: string, button = 'Otvori Zalogaj', extras: MailExtras = {}) {
  const url = link ? new URL(link, env.APP_URL).toString() : env.APP_URL
  if (!isProduction) console.log(`[mail] → ${to} | ${subject} | ${url}${extras.image ? ' | +QR' : ''}`)
  if (!env.MAILERSEND_API_KEY) return
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.MAILERSEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: parseFrom(env.MAIL_FROM),
        to: [{ email: to }],
        subject,
        text: [body, ...(extras.image?.caption ? [`Kod: ${extras.image.caption}`] : []), ...(extras.details ?? []).map(([l, v]) => `${l}: ${v}`), url].join('\n\n'),
        html: html(subject, body, url, button, extras),
        ...(extras.image
          ? { attachments: [{ content: extras.image.png.toString('base64'), filename: 'qr-kod.png', disposition: 'inline', id: IMAGE_CID }] }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error('MailerSend error', res.status, (await res.text()).slice(0, 300))
  } catch (error) {
    console.error('E-mail failed', error)
  }
}

/**
 * Transactional e-mail via MailerSend (HTTP API). Without MAILERSEND_API_KEY
 * nothing is sent; in development every e-mail is also logged (with its link)
 * so flows like password reset can be tested locally.
 */
import { env, isProduction } from '../config/env.js'

const API_URL = 'https://api.mailersend.com/v1/email'

function parseFrom(value: string) {
  const match = /^(.*)<(.+)>$/.exec(value.trim())
  // A MAIL_FROM left over from before the rename ("Zalogaj <…>") still shows "Foodnesi".
  const name = (match?.[1].trim() || 'Foodnesi').replace(/zalogaj/gi, 'Foodnesi')
  return { name, email: (match ? match[2] : value).trim() }
}

export const mailEnabled = () => Boolean(env.MAILERSEND_API_KEY)

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Optional richer content: a key/value table and an inline image (e.g. the pickup QR code). */
export interface MailExtras {
  details?: [label: string, value: string][]
  /** PNG embedded in the e-mail (inline attachment), shown above the button. */
  image?: { png: Buffer; alt: string; caption?: string }
  /** Reply-To for this e-mail (e.g. the sender of a contact form); default MAIL_REPLY_TO. */
  replyTo?: string
}

const IMAGE_CID = 'foodnesi-image'

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
    <img src="${escape(new URL('/brand/foodnesi-logo.png', env.APP_URL).toString())}" alt="Foodnesi – dobra hrana, manje otpada" width="170" style="display:block;width:170px;height:auto;margin:0 0 16px;border:0;font-size:22px;font-weight:bold;color:#0f4c3a" />
    <p style="font-size:17px;font-weight:bold;color:#1d2b25;margin:0 0 12px">${escape(subject)}</p>
    ${paragraphs}
    ${image}
    ${details}
    <a href="${escape(url)}" style="display:inline-block;margin-top:8px;background:#0f4c3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">${escape(button)}</a>
    <p style="font-size:12px;color:#888;margin:24px 0 0">Ako dugme ne radi, otvori ovaj link: ${escape(url)}</p>
  </div></body></html>`
}

/** `skipped` = no MAILERSEND_API_KEY (only logged); `error` never contains credentials. */
export type MailResult = { status: 'sent' | 'skipped' | 'failed'; error?: string }

/**
 * Send one e-mail. `link` is an in-app path ("/reservations/123") or a full URL.
 * Never throws — a failed e-mail must not break the action that triggered it.
 */
export async function sendMail(to: string, subject: string, body: string, link?: string, button = 'Otvori Foodnesi', extras: MailExtras = {}): Promise<MailResult> {
  const url = link ? new URL(link, env.APP_URL).toString() : env.APP_URL
  if (!isProduction) console.log(`[mail] → ${to} | ${subject} | ${url}${extras.image ? ' | +QR' : ''}`)
  if (!env.MAILERSEND_API_KEY) return { status: 'skipped' }
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.MAILERSEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: parseFrom(env.MAIL_FROM),
        to: [{ email: to }],
        ...(extras.replyTo || env.MAIL_REPLY_TO ? { reply_to: { email: extras.replyTo ?? env.MAIL_REPLY_TO } } : {}),
        subject,
        text: [body, ...(extras.image?.caption ? [`Kod: ${extras.image.caption}`] : []), ...(extras.details ?? []).map(([l, v]) => `${l}: ${v}`), url].join('\n\n'),
        html: html(subject, body, url, button, extras),
        ...(extras.image
          ? { attachments: [{ content: extras.image.png.toString('base64'), filename: 'qr-kod.png', disposition: 'inline', id: IMAGE_CID }] }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      console.error('MailerSend error', res.status, detail)
      return { status: 'failed', error: `MailerSend ${res.status}: ${detail}`.slice(0, 500) }
    }
    return { status: 'sent' }
  } catch (error) {
    console.error('E-mail failed', error)
    return { status: 'failed', error: (error instanceof Error ? error.message : String(error)).slice(0, 500) }
  }
}

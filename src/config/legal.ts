/**
 * Company details shown in the privacy policy, terms and footer.
 * Required by GDPR / Serbian ZZPL (who the controller is) and the law on
 * e-commerce (provider identification). Fill in before going live — values in
 * [brackets] are placeholders and are flagged on the legal pages.
 */
export const LEGAL = {
  company: 'FIXMAN, IT storitve in poslovno svetovanje, d.o.o.',
  address: 'Ulica Vita Kraigherja 5, 2000 Maribor, Slovenija',
  registrationNumber: '7378289000',
  /** Slovenian davčna številka (not a Serbian PIB). */
  taxId: '45280223',
  /** Contact for privacy requests (access, deletion, complaints). */
  privacyEmail: 'civcicboris93@gmail.com',
  supportEmail: 'civcicboris93@gmail.com',
  /** Date of the current version of the documents (YYYY-MM-DD). */
  updatedAt: '2026-10-19',
}

export const legalHasPlaceholders = Object.values(LEGAL).some((v) => v.startsWith('['))

/**
 * Versions sent with an acceptance — keep equal to backend/src/config/legal.ts
 * (the API rejects an acceptance of another version).
 */
export const LEGAL_VERSIONS = {
  terms: LEGAL.updatedAt,
  privacy: LEGAL.updatedAt,
  /** "Pravni i operativni paket" verzija 2.0 (22. 10. 2026) — Prilog C is accepted in the app. */
  partnerTerms: '2026-10-22',
}

/** Public pages (Serbian) linked next to the checkboxes and from e-mails. */
export const LEGAL_PATHS = { terms: '/uslovi', privacy: '/privatnost', partnerTerms: '/partner-uslovi' }

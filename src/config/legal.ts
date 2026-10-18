/**
 * Company details shown in the privacy policy, terms and footer.
 * Required by GDPR / Serbian ZZPL (who the controller is) and the law on
 * e-commerce (provider identification). Fill in before going live — values in
 * [brackets] are placeholders and are flagged on the legal pages.
 */
export const LEGAL = {
  company: '[Naziv firme ili preduzetnika]',
  address: '[Ulica i broj, poštanski broj, grad, država]',
  registrationNumber: '[Matični broj]',
  taxId: '[PIB]',
  /** Contact for privacy requests (access, deletion, complaints). */
  privacyEmail: '[privatnost@vas-domen]',
  supportEmail: '[podrska@vas-domen]',
  /** Date of the current version of the documents (YYYY-MM-DD). */
  updatedAt: '2026-10-18',
}

export const legalHasPlaceholders = Object.values(LEGAL).some((v) => v.startsWith('['))

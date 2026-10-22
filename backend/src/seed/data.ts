/**
 * Test data: ONE fictional partner (a small bakery chain with three
 * locations) plus one test customer. Clearly marked "Test" so it is never
 * mistaken for a real business.
 */
import type { Allergen, Category } from '../models/index.js'

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

export const TEST_PARTNER = { name: 'Test Partner', email: 'test.partner@foodnesi.test', role: 'business' } as const
export const TEST_CUSTOMER = { name: 'Test Kupac', email: 'test.kupac@foodnesi.test', role: 'customer' } as const
/** Also the pre-rename addresses, so a database seeded earlier still counts as test data. */
export const TEST_EMAILS: string[] = [TEST_PARTNER.email, TEST_CUSTOMER.email, 'test.partner@zalogaj.rs', 'test.kupac@zalogaj.rs']

export interface SeedLocation {
  name: string
  category: Category
  street: string
  city: string
  postalCode: string
  lat: number
  lng: number
  cover: string
  logo: string
  description: string
  instructions: string
  phone: string
  openingHours: string
}

export const testLocations: SeedLocation[] = [
  {
    name: 'Test Pekara – Dorćol',
    category: 'bakery',
    street: 'Cara Dušana 45',
    city: 'Beograd',
    postalCode: '11000',
    lat: 44.8236,
    lng: 20.4655,
    cover: img('1509440159596-0249088772ff'),
    logo: img('1555507036-ab1f4038808a', 160),
    description: 'Test lokacija. Hleb na kiselom testu, kifle i pite.',
    instructions: 'Pokaži QR kod na kasi. Kese su spremne iza pulta.',
    phone: '+381 11 000 0001',
    openingHours: 'Pon–Sub 7–21, Ned 8–14',
  },
  {
    name: 'Test Pekara – Vračar',
    category: 'bakery',
    street: 'Njegoševa 30',
    city: 'Beograd',
    postalCode: '11000',
    lat: 44.8031,
    lng: 20.4781,
    cover: img('1586444248902-2f64eddc13df'),
    logo: img('1549931319-a545dcf3bc73', 160),
    description: 'Test lokacija. Zanatska peciva i slatki program.',
    instructions: 'Preuzimanje na pultu desno od ulaza.',
    phone: '+381 11 000 0002',
    openingHours: 'Pon–Pet 7–20, Sub 8–15, Ned zatvoreno',
  },
  {
    name: 'Test Pekara – Novi Beograd',
    category: 'bakery',
    street: 'Bulevar Mihajla Pupina 10',
    city: 'Beograd',
    postalCode: '11070',
    lat: 44.8178,
    lng: 20.4182,
    cover: img('1568254183919-78a4f43a2877'),
    logo: img('1517433670267-08bbd4be890f', 160),
    description: 'Test lokacija. Peciva i kafa za poneti.',
    instructions: 'Pokaži kod na kasi, bez čekanja u redu.',
    phone: '+381 11 000 0003',
    openingHours: 'Svaki dan 6–22',
  },
]

export interface SeedOfferTemplate {
  title: string
  description: string
  category: Category
  price: number
  original: number
  quantity: number
  from: string
  to: string
  tags?: string[]
  allergens?: Allergen[]
  contents?: string[]
  /** Only at these location indexes (default: all). */
  locations?: number[]
}

/** Repeated for today (if the window hasn't passed), tomorrow and the day after. */
export const testOfferTemplates: SeedOfferTemplate[] = [
  {
    title: 'Jutarnja kesa',
    description: 'Jučerašnji hleb i peciva – idealno za doručak, tost i sendviče.',
    category: 'bakery',
    price: 199,
    original: 600,
    quantity: 4,
    from: '07:30',
    to: '08:30',
    allergens: ['gluten', 'milk', 'sesame'],
  },
  {
    title: 'Kesa iznenađenja – pecivo',
    description: 'Hleb, kifle, peciva i pite koje ostanu na kraju dana.',
    category: 'bakery',
    price: 299,
    original: 900,
    quantity: 6,
    from: '19:30',
    to: '20:30',
    tags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'eggs'],
  },
  {
    title: 'Slatka kesa',
    description: 'Kroasani, mafini i kolači koji nisu prodati danas.',
    category: 'sweets',
    price: 349,
    original: 1050,
    quantity: 3,
    from: '18:00',
    to: '19:00',
    allergens: ['gluten', 'milk', 'eggs', 'nuts'],
    contents: ['2 kroasana', '1 mafin', '2 kolača po izboru pekara'],
    locations: [1],
  },
]

export const SEED_DAYS = 3

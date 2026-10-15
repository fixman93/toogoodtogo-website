/**
 * Demo dataset used when VITE_API_MODE=mock. Shapes match the REST API
 * responses exactly; the backend seed script (backend/src/seed) mirrors it.
 */
import type { Business, Category, Offer, Reservation, Review, User } from '@/api/types'
import { zonedTime } from '@/lib/time'

const TZ = 'Europe/Belgrade'
const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

export const DEMO_PASSWORD = 'lozinka123'

export const mockUsers: (User & { password: string })[] = [
  {
    id: 'u-ana',
    name: 'Ana Petrović',
    email: 'ana@primer.rs',
    password: DEMO_PASSWORD,
    role: 'customer',
    locale: 'sr-Latn-RS',
    countryCode: 'RS',
    createdAt: '2026-03-02T10:00:00.000Z',
  },
  {
    id: 'u-marko',
    name: 'Marko Jovanović',
    email: 'marko@pekaraklas.rs',
    password: DEMO_PASSWORD,
    role: 'business',
    locale: 'sr-Latn-RS',
    countryCode: 'RS',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
]

type Seed = Omit<Business, 'id' | 'timezone' | 'currency' | 'isActive' | 'ownerId' | 'address'> & {
  id: string
  street: string
  city: string
  postalCode: string
  ownerId?: string
}

const businessSeeds: Seed[] = [
  {
    id: 'b-klas',
    name: 'Pekara Klas',
    category: 'bakery',
    street: 'Cara Dušana 45',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8236, lng: 20.4655 },
    coverUrl: img('1509440159596-0249088772ff'),
    logoUrl: img('1555507036-ab1f4038808a', 160),
    rating: { average: 4.7, count: 312 },
    description: 'Porodična pekara na Dorćolu od 1998. Hleb na kiselom testu, kifle i pite pečene svakog jutra.',
    collectionInstructions: 'Uđi na glavni ulaz i pokaži kod za preuzimanje na kasi. Ponesi svoju kesu ako možeš.',
    phone: '+381 11 123 4567',
    ownerId: 'u-marko',
  },
  {
    id: 'b-zrno',
    name: 'Zrno – zanatska pekara',
    category: 'bakery',
    street: 'Njegoševa 30',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8031, lng: 20.4781 },
    coverUrl: img('1586444248902-2f64eddc13df'),
    logoUrl: img('1549931319-a545dcf3bc73', 160),
    rating: { average: 4.8, count: 198 },
    description: 'Zanatski hleb od integralnog brašna, kroasani na putru i sezonska peciva sa Vračara.',
    collectionInstructions: 'Preuzimanje na pultu desno od ulaza. Zaposleni će proveriti tvoj kod.',
  },
  {
    id: 'b-savamala',
    name: 'Bistro Savamala',
    category: 'meals',
    street: 'Karađorđeva 43',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8149, lng: 20.4521 },
    coverUrl: img('1559339352-11d035aa65de'),
    logoUrl: img('1504674900247-0877df9cc836', 160),
    rating: { average: 4.5, count: 141 },
    description: 'Moderna balkanska kuhinja – dnevni meni, rižota i domaći deserti.',
    collectionInstructions: 'Javi se konobaru za šankom i reci da preuzimaš Zalogaj kesu.',
  },
  {
    id: 'b-cinija',
    name: 'Zdrava činija',
    category: 'meals',
    street: 'Knez Mihailova 20',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8169, lng: 20.4579 },
    coverUrl: img('1546069901-ba9599a7e63c'),
    logoUrl: img('1512621776951-a57141f2eefd', 160),
    rating: { average: 4.6, count: 87 },
    description: 'Salate, poke činije i smutiji od svežih sastojaka.',
    collectionInstructions: 'Kese su spremne u frižideru pored kase.',
  },
  {
    id: 'b-dvabrata',
    name: 'Picerija Dva brata',
    category: 'meals',
    street: 'Glavna 12',
    city: 'Beograd',
    postalCode: '11080',
    location: { lat: 44.8452, lng: 20.4118 },
    coverUrl: img('1513104890138-7c749659a591'),
    logoUrl: img('1565299624946-b28f40a0ae38', 160),
    rating: { average: 4.4, count: 256 },
    description: 'Pica iz peći na drva u srcu Zemuna, sa testom koje odležava 48 sati.',
    collectionInstructions: 'Preuzimanje na šalteru za poneti.',
  },
  {
    id: 'b-zelena',
    name: 'Zelena pijaca market',
    category: 'groceries',
    street: 'Bulevar kralja Aleksandra 120',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.7981, lng: 20.4849 },
    coverUrl: img('1542838132-92c53300491e'),
    logoUrl: img('1610832958506-aa56368176cf', 160),
    rating: { average: 4.3, count: 402 },
    description: 'Komšijski market sa svežim voćem, povrćem i mlečnim proizvodima.',
    collectionInstructions: 'Kese preuzmi na informacijama, odmah pored ulaza.',
  },
  {
    id: 'b-lista',
    name: 'Organska bakalnica Lista',
    category: 'groceries',
    street: 'Gospodar Jevremova 30',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8219, lng: 20.4611 },
    coverUrl: img('1488459716781-31db52582fe9'),
    logoUrl: img('1534723452862-4c874018d66d', 160),
    rating: { average: 4.9, count: 64 },
    description: 'Organske namirnice lokalnih proizvođača: povrće, sirevi, med i suvo voće.',
    collectionInstructions: 'Pozvoni ako su vrata zatvorena – tu smo do kraja termina.',
  },
  {
    id: 'b-secerko',
    name: 'Poslastičarnica Šećerko',
    category: 'sweets',
    street: 'Svetogorska 15',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8112, lng: 20.4702 },
    coverUrl: img('1578985545062-69928b1d9587'),
    logoUrl: img('1488477181946-6428a0291777', 160),
    rating: { average: 4.7, count: 233 },
    description: 'Torte, kolači i sitni kolačići po receptima naših baka.',
    collectionInstructions: 'Pokaži kod u vitrini za poneti.',
  },
  {
    id: 'b-krofnica',
    name: 'Krofnica',
    category: 'sweets',
    street: 'Bulevar Mihajla Pupina 10',
    city: 'Beograd',
    postalCode: '11070',
    location: { lat: 44.8178, lng: 20.4182 },
    coverUrl: img('1551024601-bec78aea704b'),
    logoUrl: img('1558961363-fa8fdf82db35', 160),
    rating: { average: 4.5, count: 119 },
    description: 'Punjene krofne, kolačići i kafa za poneti na Novom Beogradu.',
    collectionInstructions: 'Preuzimanje na kasi, bez čekanja u redu.',
  },
  {
    id: 'b-jutro',
    name: 'Kafeterija Jutro',
    category: 'bakery',
    street: 'Strahinjića Bana 22',
    city: 'Beograd',
    postalCode: '11000',
    location: { lat: 44.8197, lng: 20.4628 },
    coverUrl: img('1517433670267-08bbd4be890f'),
    logoUrl: img('1509042239860-f550ce710b93', 160),
    rating: { average: 4.2, count: 76 },
    description: 'Specijalna kafa i sveža peciva od ranog jutra.',
    collectionInstructions: 'Kese su na polici iza šanka – reci ime i kod.',
  },
  {
    id: 'b-zavicaj',
    name: 'Kafana Zavičaj',
    category: 'meals',
    street: 'Ustanička 50',
    city: 'Beograd',
    postalCode: '11050',
    location: { lat: 44.7879, lng: 20.4953 },
    coverUrl: img('1555396273-367ea4eb4db5'),
    logoUrl: img('1550617931-e17a7b70dce2', 160),
    rating: { average: 4.4, count: 178 },
    description: 'Domaća kuhinja: kuvana jela, roštilj i sveže salate.',
    collectionInstructions: 'Preuzimanje na šanku. Kese su upakovane za poneti.',
  },
  {
    id: 'b-petrovaradin',
    name: 'Pekara Petrovaradin',
    category: 'bakery',
    street: 'Zmaj Jovina 10',
    city: 'Novi Sad',
    postalCode: '21000',
    location: { lat: 45.2554, lng: 19.8449 },
    coverUrl: img('1568254183919-78a4f43a2877'),
    logoUrl: img('1509440159596-0249088772ff', 160),
    rating: { average: 4.6, count: 143 },
    description: 'Pekara u centru Novog Sada – burek, kifle i hleb iz kamene peći.',
    collectionInstructions: 'Pokaži kod na kasi.',
  },
  {
    id: 'b-dunav',
    name: 'Bistro Dunav',
    category: 'meals',
    street: 'Dunavska 7',
    city: 'Novi Sad',
    postalCode: '21000',
    location: { lat: 45.2567, lng: 19.8503 },
    coverUrl: img('1517248135467-4c7edcad34c4'),
    logoUrl: img('1621996346565-e3dbc646d9a9', 160),
    rating: { average: 4.5, count: 92 },
    description: 'Paste, rižota i dnevna jela pored Dunavskog parka.',
    collectionInstructions: 'Javi se osoblju na ulazu.',
  },
  {
    id: 'b-tvrdjava',
    name: 'Poslastičarnica Tvrđava',
    category: 'sweets',
    street: 'Obrenovićeva 25',
    city: 'Niš',
    postalCode: '18000',
    location: { lat: 43.3218, lng: 21.8957 },
    coverUrl: img('1563805042-7684c019e1cb'),
    logoUrl: img('1578985545062-69928b1d9587', 160),
    rating: { average: 4.8, count: 167 },
    description: 'Sladoled, baklave i torte u centru Niša.',
    collectionInstructions: 'Preuzimanje u vitrini za poneti.',
  },
]

export const mockBusinesses: Business[] = businessSeeds.map(({ street, city, postalCode, ownerId, ...rest }) => ({
  ...rest,
  address: { street, city, postalCode, countryCode: 'RS' },
  timezone: TZ,
  currency: 'RSD',
  isActive: true,
  ownerId: ownerId ?? 'u-partner',
}))

interface OfferSeed {
  id: string
  businessId: string
  title: string
  description: string
  price: number
  original: number
  quantity: number
  available: number
  day: number
  from: string
  to: string
  reserved: number
  tags?: string[]
  imageId?: string
}

const DESCRIPTIONS: Record<Category, string> = {
  bakery: 'Spasi kesu punu peciva od danas: hleb, kifle, pogačice ili slatka peciva – šta god ostane posle dana.',
  meals: 'Ukusni obroci i prilozi koji su ostali posle ručka i večere. Sveže pripremljeno, spakovano za poneti.',
  groceries: 'Voće, povrće, mlečni i drugi proizvodi kojima uskoro ističe rok ili ne izgledaju savršeno, a sasvim su dobri.',
  sweets: 'Kolači, krofne, torte i slatkiši koji nisu prodati danas. Savršeno za desert ili jutarnju kafu.',
}

const offerSeeds: OfferSeed[] = [
  { id: 'o-klas-vece', businessId: 'b-klas', title: 'Kesa iznenađenja – pecivo', description: '', price: 299, original: 900, quantity: 8, available: 3, day: 0, from: '19:30', to: '20:30', reserved: 1240 },
  { id: 'o-klas-jutro', businessId: 'b-klas', title: 'Jutarnja kesa', description: 'Jučerašnji hleb i peciva, idealni za tost i sendviče.', price: 199, original: 600, quantity: 5, available: 5, day: 1, from: '07:00', to: '08:00', reserved: 410 },
  { id: 'o-zrno', businessId: 'b-zrno', title: 'Zanatska kesa', description: '', price: 349, original: 1050, quantity: 6, available: 2, day: 0, from: '18:00', to: '19:00', reserved: 860, tags: ['vegetarian'] },
  { id: 'o-savamala', businessId: 'b-savamala', title: 'Obrok iznenađenja', description: '', price: 499, original: 1500, quantity: 4, available: 4, day: 0, from: '21:30', to: '22:30', reserved: 530 },
  { id: 'o-cinija', businessId: 'b-cinija', title: 'Zdrava kesa', description: 'Salate, činije i smutiji pripremljeni tog dana.', price: 449, original: 1350, quantity: 5, available: 1, day: 0, from: '20:00', to: '21:00', reserved: 380, tags: ['vegetarian'] },
  { id: 'o-dvabrata', businessId: 'b-dvabrata', title: 'Pica kesa', description: 'Dve do tri parčadi pice i hleb iz peći na drva.', price: 399, original: 1200, quantity: 6, available: 6, day: 0, from: '22:00', to: '23:00', reserved: 970 },
  { id: 'o-zelena', businessId: 'b-zelena', title: 'Kesa namirnica', description: '', price: 799, original: 2400, quantity: 10, available: 7, day: 0, from: '20:00', to: '21:30', reserved: 1510 },
  { id: 'o-zelena-voce', businessId: 'b-zelena', title: 'Voće i povrće', description: 'Sezonsko voće i povrće nesavršenog izgleda, savršenog ukusa.', price: 399, original: 1200, quantity: 6, available: 0, day: 0, from: '20:00', to: '21:30', reserved: 640, tags: ['vegan'] },
  { id: 'o-lista', businessId: 'b-lista', title: 'Organska kesa', description: '', price: 899, original: 2700, quantity: 3, available: 2, day: 1, from: '17:00', to: '18:00', reserved: 220, tags: ['vegetarian'] },
  { id: 'o-secerko', businessId: 'b-secerko', title: 'Slatka kesa', description: '', price: 399, original: 1200, quantity: 5, available: 4, day: 0, from: '20:30', to: '21:00', reserved: 1120 },
  { id: 'o-krofnica', businessId: 'b-krofnica', title: 'Kesa krofni', description: 'Četiri do šest punjenih krofni i kolačića.', price: 299, original: 900, quantity: 8, available: 5, day: 0, from: '19:00', to: '20:00', reserved: 700 },
  { id: 'o-jutro', businessId: 'b-jutro', title: 'Peciva uz kafu', description: 'Kroasani, mafini i peciva od jutra.', price: 249, original: 750, quantity: 4, available: 2, day: 0, from: '18:30', to: '19:30', reserved: 300 },
  { id: 'o-zavicaj', businessId: 'b-zavicaj', title: 'Domaći obrok', description: 'Kuvano jelo dana sa prilogom i salatom.', price: 449, original: 1400, quantity: 5, available: 3, day: 0, from: '21:00', to: '22:00', reserved: 450 },
  { id: 'o-petrovaradin', businessId: 'b-petrovaradin', title: 'Kesa iznenađenja – pecivo', description: '', price: 249, original: 750, quantity: 6, available: 4, day: 0, from: '19:00', to: '20:00', reserved: 390 },
  { id: 'o-dunav', businessId: 'b-dunav', title: 'Obrok iznenađenja', description: '', price: 449, original: 1350, quantity: 4, available: 2, day: 0, from: '21:00', to: '22:00', reserved: 260 },
  { id: 'o-tvrdjava', businessId: 'b-tvrdjava', title: 'Slatka kesa', description: '', price: 349, original: 1050, quantity: 5, available: 3, day: 0, from: '20:00', to: '21:00', reserved: 510 },
]

function toSummary(b: Business) {
  const { id, name, category, logoUrl, coverUrl, address, location, timezone, rating } = b
  return { id, name, category, logoUrl, coverUrl, address, location, timezone, rating }
}

/** Build offers relative to "now" so the demo always shows upcoming pickups. */
export function buildMockOffers(now = new Date()): Offer[] {
  return offerSeeds.map((seed) => {
    const business = mockBusinesses.find((b) => b.id === seed.businessId)!
    let day = seed.day
    // If today's window already passed, roll the offer over to tomorrow.
    if (zonedTime(day, seed.to, TZ, now) <= now) day += 1
    return {
      id: seed.id,
      businessId: business.id,
      business: toSummary(business),
      title: seed.title,
      description: seed.description || DESCRIPTIONS[business.category],
      category: business.category,
      imageUrl: business.coverUrl,
      tags: seed.tags ?? [],
      priceMinor: seed.price * 100,
      originalPriceMinor: seed.original * 100,
      currency: 'RSD',
      quantityTotal: seed.quantity,
      quantityAvailable: seed.available,
      maxPerReservation: Math.min(4, seed.quantity),
      pickupStart: zonedTime(day, seed.from, TZ, now).toISOString(),
      pickupEnd: zonedTime(day, seed.to, TZ, now).toISOString(),
      timezone: TZ,
      status: 'active',
      reservedCount: seed.reserved,
    }
  })
}

export function buildMockReservations(offers: Offer[], now = new Date()): (Reservation & { userId: string })[] {
  const klas = offers.find((o) => o.id === 'o-klas-vece')!
  const zrno = mockBusinesses.find((b) => b.id === 'b-zrno')!
  const secerko = mockBusinesses.find((b) => b.id === 'b-secerko')!
  const past = (days: number, hhmm: string) => zonedTime(-days, hhmm, TZ, now).toISOString()
  return [
    {
      id: 'r-1001',
      userId: 'u-ana',
      code: 'ZL-4F7K',
      status: 'confirmed',
      quantity: 1,
      unitPriceMinor: klas.priceMinor,
      originalUnitPriceMinor: klas.originalPriceMinor,
      totalMinor: klas.priceMinor,
      currency: 'RSD',
      pickupStart: klas.pickupStart,
      pickupEnd: klas.pickupEnd,
      timezone: TZ,
      offer: { id: klas.id, title: klas.title, imageUrl: klas.imageUrl },
      business: klas.business,
      payment: { status: 'not_required', method: 'pay_at_pickup' },
      canCancel: true,
      createdAt: new Date(now.getTime() - 3_600_000).toISOString(),
    },
    {
      id: 'r-0990',
      userId: 'u-ana',
      code: 'ZL-9QW2',
      status: 'collected',
      quantity: 2,
      unitPriceMinor: 34900,
      originalUnitPriceMinor: 105000,
      totalMinor: 69800,
      currency: 'RSD',
      pickupStart: past(3, '18:00'),
      pickupEnd: past(3, '19:00'),
      timezone: TZ,
      offer: { id: 'o-zrno', title: 'Zanatska kesa', imageUrl: zrno.coverUrl },
      business: toSummary(zrno),
      payment: { status: 'not_required', method: 'pay_at_pickup' },
      canCancel: false,
      collectedAt: past(3, '18:20'),
      createdAt: past(3, '12:10'),
    },
    {
      id: 'r-0954',
      userId: 'u-ana',
      code: 'ZL-2M8D',
      status: 'cancelled',
      quantity: 1,
      unitPriceMinor: 39900,
      originalUnitPriceMinor: 120000,
      totalMinor: 39900,
      currency: 'RSD',
      pickupStart: past(9, '20:30'),
      pickupEnd: past(9, '21:00'),
      timezone: TZ,
      offer: { id: 'o-secerko', title: 'Slatka kesa', imageUrl: secerko.coverUrl },
      business: toSummary(secerko),
      payment: { status: 'not_required', method: 'pay_at_pickup' },
      canCancel: false,
      cancelledAt: past(9, '15:00'),
      createdAt: past(9, '11:00'),
    },
  ]
}

const reviewSeeds: [string, number, string][] = [
  ['Jelena M.', 5, 'Ogromna kesa za ovu cenu! Hleb je bio savršen i sutradan.'],
  ['Nikola S.', 4, 'Ljubazno osoblje i brzo preuzimanje. Preporuka.'],
  ['Milica R.', 5, 'Uvek se iznenadim koliko toga dobijem. Spašavam hranu svake nedelje!'],
  ['Stefan P.', 4, 'Dobar izbor, malo gužva u vreme preuzimanja.'],
]

export function buildMockReviews(businessId: string): Review[] {
  const offset = businessId.length % reviewSeeds.length
  return [...reviewSeeds.slice(offset), ...reviewSeeds.slice(0, offset)].slice(0, 3).map(([name, rating, comment], i) => ({
    id: `${businessId}-rev-${i}`,
    rating,
    comment,
    user: { id: `u-rev-${i}`, name },
    createdAt: new Date(Date.now() - (i + 1) * 5 * 86_400_000).toISOString(),
  }))
}

export { toSummary }

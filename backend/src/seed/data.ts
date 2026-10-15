/** Demo data for Serbia (mirrors the frontend mock dataset in src/mocks). */
import type { Category } from '../models/index.js'

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

export const seedUsers = [
  { key: 'ana', name: 'Ana Petrović', email: 'ana@primer.rs', role: 'customer' },
  { key: 'jelena', name: 'Jelena Marković', email: 'jelena@primer.rs', role: 'customer' },
  { key: 'marko', name: 'Marko Jovanović', email: 'marko@pekaraklas.rs', role: 'business' },
  { key: 'partner', name: 'Partner Demo', email: 'partner@zalogaj.rs', role: 'business' },
  { key: 'admin', name: 'Admin Zalogaj', email: 'admin@zalogaj.rs', role: 'admin' },
] as const

export interface SeedBusiness {
  key: string
  owner: (typeof seedUsers)[number]['key']
  name: string
  category: Category
  street: string
  city: string
  postalCode: string
  lat: number
  lng: number
  cover: string
  logo: string
  rating: [number, number]
  description: string
  instructions: string
}

export const seedBusinesses: SeedBusiness[] = [
  { key: 'klas', owner: 'marko', name: 'Pekara Klas', category: 'bakery', street: 'Cara Dušana 45', city: 'Beograd', postalCode: '11000', lat: 44.8236, lng: 20.4655, cover: img('1509440159596-0249088772ff'), logo: img('1555507036-ab1f4038808a', 160), rating: [4.7, 312], description: 'Porodična pekara na Dorćolu od 1998. Hleb na kiselom testu, kifle i pite pečene svakog jutra.', instructions: 'Uđi na glavni ulaz i pokaži kod za preuzimanje na kasi. Ponesi svoju kesu ako možeš.' },
  { key: 'zrno', owner: 'partner', name: 'Zrno – zanatska pekara', category: 'bakery', street: 'Njegoševa 30', city: 'Beograd', postalCode: '11000', lat: 44.8031, lng: 20.4781, cover: img('1586444248902-2f64eddc13df'), logo: img('1549931319-a545dcf3bc73', 160), rating: [4.8, 198], description: 'Zanatski hleb od integralnog brašna, kroasani na putru i sezonska peciva sa Vračara.', instructions: 'Preuzimanje na pultu desno od ulaza. Zaposleni će proveriti tvoj kod.' },
  { key: 'savamala', owner: 'partner', name: 'Bistro Savamala', category: 'meals', street: 'Karađorđeva 43', city: 'Beograd', postalCode: '11000', lat: 44.8149, lng: 20.4521, cover: img('1559339352-11d035aa65de'), logo: img('1504674900247-0877df9cc836', 160), rating: [4.5, 141], description: 'Moderna balkanska kuhinja – dnevni meni, rižota i domaći deserti.', instructions: 'Javi se konobaru za šankom i reci da preuzimaš Zalogaj kesu.' },
  { key: 'cinija', owner: 'partner', name: 'Zdrava činija', category: 'meals', street: 'Knez Mihailova 20', city: 'Beograd', postalCode: '11000', lat: 44.8169, lng: 20.4579, cover: img('1546069901-ba9599a7e63c'), logo: img('1512621776951-a57141f2eefd', 160), rating: [4.6, 87], description: 'Salate, poke činije i smutiji od svežih sastojaka.', instructions: 'Kese su spremne u frižideru pored kase.' },
  { key: 'dvabrata', owner: 'partner', name: 'Picerija Dva brata', category: 'meals', street: 'Glavna 12', city: 'Beograd', postalCode: '11080', lat: 44.8452, lng: 20.4118, cover: img('1513104890138-7c749659a591'), logo: img('1565299624946-b28f40a0ae38', 160), rating: [4.4, 256], description: 'Pica iz peći na drva u srcu Zemuna, sa testom koje odležava 48 sati.', instructions: 'Preuzimanje na šalteru za poneti.' },
  { key: 'zelena', owner: 'partner', name: 'Zelena pijaca market', category: 'groceries', street: 'Bulevar kralja Aleksandra 120', city: 'Beograd', postalCode: '11000', lat: 44.7981, lng: 20.4849, cover: img('1542838132-92c53300491e'), logo: img('1610832958506-aa56368176cf', 160), rating: [4.3, 402], description: 'Komšijski market sa svežim voćem, povrćem i mlečnim proizvodima.', instructions: 'Kese preuzmi na informacijama, odmah pored ulaza.' },
  { key: 'lista', owner: 'partner', name: 'Organska bakalnica Lista', category: 'groceries', street: 'Gospodar Jevremova 30', city: 'Beograd', postalCode: '11000', lat: 44.8219, lng: 20.4611, cover: img('1488459716781-31db52582fe9'), logo: img('1534723452862-4c874018d66d', 160), rating: [4.9, 64], description: 'Organske namirnice lokalnih proizvođača: povrće, sirevi, med i suvo voće.', instructions: 'Pozvoni ako su vrata zatvorena – tu smo do kraja termina.' },
  { key: 'secerko', owner: 'partner', name: 'Poslastičarnica Šećerko', category: 'sweets', street: 'Svetogorska 15', city: 'Beograd', postalCode: '11000', lat: 44.8112, lng: 20.4702, cover: img('1578985545062-69928b1d9587'), logo: img('1488477181946-6428a0291777', 160), rating: [4.7, 233], description: 'Torte, kolači i sitni kolačići po receptima naših baka.', instructions: 'Pokaži kod u vitrini za poneti.' },
  { key: 'krofnica', owner: 'partner', name: 'Krofnica', category: 'sweets', street: 'Bulevar Mihajla Pupina 10', city: 'Beograd', postalCode: '11070', lat: 44.8178, lng: 20.4182, cover: img('1551024601-bec78aea704b'), logo: img('1558961363-fa8fdf82db35', 160), rating: [4.5, 119], description: 'Punjene krofne, kolačići i kafa za poneti na Novom Beogradu.', instructions: 'Preuzimanje na kasi, bez čekanja u redu.' },
  { key: 'jutro', owner: 'partner', name: 'Kafeterija Jutro', category: 'bakery', street: 'Strahinjića Bana 22', city: 'Beograd', postalCode: '11000', lat: 44.8197, lng: 20.4628, cover: img('1517433670267-08bbd4be890f'), logo: img('1509042239860-f550ce710b93', 160), rating: [4.2, 76], description: 'Specijalna kafa i sveža peciva od ranog jutra.', instructions: 'Kese su na polici iza šanka – reci ime i kod.' },
  { key: 'zavicaj', owner: 'partner', name: 'Kafana Zavičaj', category: 'meals', street: 'Ustanička 50', city: 'Beograd', postalCode: '11050', lat: 44.7879, lng: 20.4953, cover: img('1555396273-367ea4eb4db5'), logo: img('1550617931-e17a7b70dce2', 160), rating: [4.4, 178], description: 'Domaća kuhinja: kuvana jela, roštilj i sveže salate.', instructions: 'Preuzimanje na šanku. Kese su upakovane za poneti.' },
  { key: 'petrovaradin', owner: 'partner', name: 'Pekara Petrovaradin', category: 'bakery', street: 'Zmaj Jovina 10', city: 'Novi Sad', postalCode: '21000', lat: 45.2554, lng: 19.8449, cover: img('1568254183919-78a4f43a2877'), logo: img('1509440159596-0249088772ff', 160), rating: [4.6, 143], description: 'Pekara u centru Novog Sada – burek, kifle i hleb iz kamene peći.', instructions: 'Pokaži kod na kasi.' },
  { key: 'dunav', owner: 'partner', name: 'Bistro Dunav', category: 'meals', street: 'Dunavska 7', city: 'Novi Sad', postalCode: '21000', lat: 45.2567, lng: 19.8503, cover: img('1517248135467-4c7edcad34c4'), logo: img('1621996346565-e3dbc646d9a9', 160), rating: [4.5, 92], description: 'Paste, rižota i dnevna jela pored Dunavskog parka.', instructions: 'Javi se osoblju na ulazu.' },
  { key: 'tvrdjava', owner: 'partner', name: 'Poslastičarnica Tvrđava', category: 'sweets', street: 'Obrenovićeva 25', city: 'Niš', postalCode: '18000', lat: 43.3218, lng: 21.8957, cover: img('1563805042-7684c019e1cb'), logo: img('1578985545062-69928b1d9587', 160), rating: [4.8, 167], description: 'Sladoled, baklave i torte u centru Niša.', instructions: 'Preuzimanje u vitrini za poneti.' },
]

export const categoryDescriptions: Record<Category, string> = {
  bakery: 'Spasi kesu punu peciva od danas: hleb, kifle, pogačice ili slatka peciva – šta god ostane posle dana.',
  meals: 'Ukusni obroci i prilozi koji su ostali posle ručka i večere. Sveže pripremljeno, spakovano za poneti.',
  groceries: 'Voće, povrće, mlečni i drugi proizvodi kojima uskoro ističe rok ili ne izgledaju savršeno, a sasvim su dobri.',
  sweets: 'Kolači, krofne, torte i slatkiši koji nisu prodati danas. Savršeno za desert ili jutarnju kafu.',
}

/** [businessKey, title, description?, priceRSD, originalRSD, quantity, available, dayOffset, from, to, reservedCount, tags] */
export const seedOffers: [string, string, string | null, number, number, number, number, number, string, string, number, string[]][] = [
  ['klas', 'Kesa iznenađenja – pecivo', null, 299, 900, 8, 3, 0, '19:30', '20:30', 1240, []],
  ['klas', 'Jutarnja kesa', 'Jučerašnji hleb i peciva, idealni za tost i sendviče.', 199, 600, 5, 5, 1, '07:00', '08:00', 410, []],
  ['zrno', 'Zanatska kesa', null, 349, 1050, 6, 2, 0, '18:00', '19:00', 860, ['vegetarian']],
  ['savamala', 'Obrok iznenađenja', null, 499, 1500, 4, 4, 0, '21:30', '22:30', 530, []],
  ['cinija', 'Zdrava kesa', 'Salate, činije i smutiji pripremljeni tog dana.', 449, 1350, 5, 1, 0, '20:00', '21:00', 380, ['vegetarian']],
  ['dvabrata', 'Pica kesa', 'Dve do tri parčadi pice i hleb iz peći na drva.', 399, 1200, 6, 6, 0, '22:00', '23:00', 970, []],
  ['zelena', 'Kesa namirnica', null, 799, 2400, 10, 7, 0, '20:00', '21:30', 1510, []],
  ['zelena', 'Voće i povrće', 'Sezonsko voće i povrće nesavršenog izgleda, savršenog ukusa.', 399, 1200, 6, 0, 0, '20:00', '21:30', 640, ['vegan']],
  ['lista', 'Organska kesa', null, 899, 2700, 3, 2, 1, '17:00', '18:00', 220, ['vegetarian']],
  ['secerko', 'Slatka kesa', null, 399, 1200, 5, 4, 0, '20:30', '21:00', 1120, []],
  ['krofnica', 'Kesa krofni', 'Četiri do šest punjenih krofni i kolačića.', 299, 900, 8, 5, 0, '19:00', '20:00', 700, []],
  ['jutro', 'Peciva uz kafu', 'Kroasani, mafini i peciva od jutra.', 249, 750, 4, 2, 0, '18:30', '19:30', 300, []],
  ['zavicaj', 'Domaći obrok', 'Kuvano jelo dana sa prilogom i salatom.', 449, 1400, 5, 3, 0, '21:00', '22:00', 450, []],
  ['petrovaradin', 'Kesa iznenađenja – pecivo', null, 249, 750, 6, 4, 0, '19:00', '20:00', 390, []],
  ['dunav', 'Obrok iznenađenja', null, 449, 1350, 4, 2, 0, '21:00', '22:00', 260, []],
  ['tvrdjava', 'Slatka kesa', null, 349, 1050, 5, 3, 0, '20:00', '21:00', 510, []],
]

export const seedReviewComments = [
  'Ogromna kesa za ovu cenu! Hleb je bio savršen i sutradan.',
  'Ljubazno osoblje i brzo preuzimanje. Preporuka.',
  'Uvek se iznenadim koliko toga dobijem. Spašavam hranu svake nedelje!',
]

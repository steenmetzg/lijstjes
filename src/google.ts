// Google, automatisch (F48, F49): Lijstjes zet items met een datum en tijd in Google Agenda en items met alleen een
// datum in Google Tasks, en houdt ze daar bij als je ze wijzigt, afvinkt of weggooit. Alles gaat rechtstreeks van de
// telefoon naar Google; er is geen server van Lijstjes.

import { DUUR_MINUTEN, heeftTijdDeel, toDate, volgendeKeer, zichtbaar } from './agenda'
import { heeftDatum, heeftTijd, heeftZonderJaar, heelInGoogle, naarGoogle, type Lijstje } from './lists'
import { KEY_PREFIX } from './storageKey'

/**
 * Het Client-ID van het Google Cloud-project van Lijstjes (een webclient met als JavaScript-oorsprong
 * https://steenmetzg.github.io). Dit ID is niet geheim. Leeg: Google, automatisch is nog niet ingesteld (F48).
 */
const CLIENT_ID = '343927118158-nfff51nmvcq8f6mhols7ih3udoieqkb8.apps.googleusercontent.com'

export function googleClientId(): string {
  // Bij het bouwen (of in een test) kan VITE_GOOGLE_CLIENT_ID het vervangen; leeg betekent: niet ingesteld.
  const env: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return env ?? CLIENT_ID
}

/** Alleen agenda-items en taken maken, wijzigen en verwijderen; Lijstjes leest verder niets van je account. */
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks'

/** Welke items Lijstjes in Google heeft gezet: per item het soort, het id bij Google en wat er toen stond. */
export const GOOGLE_KEY = `${KEY_PREFIX}google`
/** De toegang tot Google (geldt een uur), en of je ooit bent ingelogd. Niet in de backup. */
export const TOKEN_KEY = `${KEY_PREFIX}google-token`
export const INGELOGD_KEY = `${KEY_PREFIX}google-ingelogd`

export type Soort = 'agenda' | 'tasks'

/** Hoe een item in Google hoort te staan. */
export interface Doel {
  soort: Soort
  titel: string
  notitie?: string
  lijstje: string
  /** "2026-11-27T09:30" (agenda) of "2026-11-28" (tasks), lokale tijd. Zonder jaar: de eerstvolgende keer. */
  moment: string
  /** Zonder jaar: het agenda-item komt elk jaar terug (F44). */
  jaarlijks: boolean
  af: boolean
  /** Het hele lijstje in Google Tasks (F52): het id van de eigen takenlijst bij Google. Anders je standaardlijst. */
  takenlijst?: string
}

export interface Gezet {
  /** `takenlijst`: de eigen lijst van een lijstje in Google Tasks (F52), onder de sleutel `lijst:<id van het lijstje>`. */
  soort: Soort | 'takenlijst'
  id: string
  hash: string
  /** Een taak in de eigen takenlijst van het lijstje (F52): het id van die takenlijst bij Google. */
  takenlijst?: string
  /** Bij een taak in de eigen takenlijst: afgevinkt zoals Lijstjes het daar het laatst zette (F52). */
  af?: boolean
  /** In Google Tasks verwijderd: het item is in Lijstjes afgevinkt; zet je het weer open, dan komt het terug (F52). */
  verwijderd?: true
}

/** Achter het item-id: de taak in de eigen takenlijst van het lijstje (F52). */
export const IN_LIJST = '#lijst'
/** Voor het id van een lijstje: de eigen takenlijst van dat lijstje in Google Tasks (F52). */
export const LIJST_PREFIX = 'lijst:'

export type GoogleOpslag = Record<string, Gezet>

export type Actie =
  | { soort: 'maak'; itemId: string; doel: Doel }
  | { soort: 'wijzig'; itemId: string; doel: Doel; gezet: Gezet }
  | { soort: 'weg'; itemId: string; gezet: Gezet }

/**
 * Met een tijd in Google Agenda, met alleen een datum in Google Tasks (F48). Zonder jaar (zoals een verjaardag) altijd
 * in Google Agenda, want alleen daar komt het elk jaar terug.
 */
export function soortVan(moment: string, jaarlijks = false): Soort {
  return jaarlijks || heeftTijdDeel(moment) ? 'agenda' : 'tasks'
}

/**
 * Hoe alle items die naar Google horen er daar uit moeten zien, per item-id (F48). Met het hele lijstje in Google
 * Tasks (F52) staat elk item als taak in de eigen takenlijst (sleutel `<item-id>#lijst`, zodra die takenlijst er is);
 * een item met een tijd komt daarnaast in Google Agenda, een item met alleen een datum niet nog eens in je
 * standaardlijst.
 */
export function doelen(
  lijstjes: readonly Lijstje[],
  now: Date = new Date(),
  opslag: GoogleOpslag = {},
): Map<string, Doel> {
  const result = new Map<string, Doel>()
  for (const l of lijstjes) {
    const tijd = heeftTijd(l)
    const jaarlijks = heeftZonderJaar(l)
    const heel = heelInGoogle(l)
    const takenlijst = heel ? opslag[LIJST_PREFIX + l.id]?.id : undefined
    for (const item of l.items) {
      const titel = item.aantal && l.kenmerken?.aantal ? `${item.aantal} ${item.tekst}` : item.tekst
      const notitie = l.kenmerken?.notitie ? item.notitie : undefined
      if (takenlijst) {
        const dag = heeftDatum(l) && item.wanneer ? item.wanneer.slice(0, 10) : ''
        result.set(item.id + IN_LIJST, {
          soort: 'tasks',
          titel,
          ...(notitie && { notitie }),
          lijstje: l.naam,
          moment: jaarlijks && dag ? volgendeKeer(dag, now) : dag,
          jaarlijks: false,
          af: item.af,
          takenlijst,
        })
      }
      if (!naarGoogle(l, item) || !item.wanneer) continue
      const zien = zichtbaar(item.wanneer, tijd)
      const soort = soortVan(zien, jaarlijks)
      // Het hele lijstje in Google Tasks: een item met alleen een datum staat al in de eigen takenlijst.
      if (heel && soort === 'tasks') continue
      result.set(item.id, {
        soort,
        titel,
        ...(notitie && { notitie }),
        lijstje: l.naam,
        moment: jaarlijks ? volgendeKeer(zien, now) : zien,
        jaarlijks,
        af: item.af,
      })
    }
  }
  return result
}

/** De takenlijsten die er moeten zijn (F52): per sleutel `lijst:<id>` de naam van het lijstje. */
export function gewensteLijsten(lijstjes: readonly Lijstje[]): Map<string, string> {
  return new Map(lijstjes.filter(heelInGoogle).map((l) => [LIJST_PREFIX + l.id, l.naam]))
}

/** Moet er bij Google iets gebeuren: een takenlijst maken, hernoemen of weghalen, of een item bijwerken? */
export function werkNodig(lijstjes: readonly Lijstje[], opslag: GoogleOpslag, now: Date = new Date()): boolean {
  const lijsten = gewensteLijsten(lijstjes)
  for (const [key, gezet] of Object.entries(opslag)) {
    if (key.startsWith(LIJST_PREFIX) && lijsten.get(key) !== gezet.hash) return true
  }
  for (const key of lijsten.keys()) if (!Object.hasOwn(opslag, key)) return true
  return plan(doelen(lijstjes, now, opslag), opslag).length > 0
}

/** Zonder de takenlijst `key` en de taken daarin (die gaan met de takenlijst mee). */
export function zonderTakenlijst(opslag: GoogleOpslag, key: string): GoogleOpslag {
  const lijst = opslag[key]?.id
  return Object.fromEntries(Object.entries(opslag).filter(([k, g]) => k !== key && (!lijst || g.takenlijst !== lijst)))
}

/** Wat er bij Google moet kloppen; een afgevinkt agenda-item krijgt een vinkje zonder melding, een taak wordt afgevinkt. */
export function hashDoel(d: Doel): string {
  return JSON.stringify([d.soort, d.titel, d.notitie ?? '', d.lijstje, d.moment, d.jaarlijks, d.af])
}

/**
 * Wat er bij Google moet gebeuren om gelijk te lopen met Lijstjes (F48): nieuwe items maken, gewijzigde bijwerken,
 * weggegooide (of niet meer gewenste) verwijderen. Verandert een item van agenda naar taak, dan weg en opnieuw. Een
 * afgevinkt item dat nog niet in Google staat, komt er niet meer in.
 */
export function plan(gewenst: Map<string, Doel>, opslag: GoogleOpslag): Actie[] {
  const acties: Actie[] = []
  for (const [itemId, gezet] of Object.entries(opslag)) {
    if (itemId.startsWith(LIJST_PREFIX)) continue
    const doel = gewenst.get(itemId)
    if (gezet.verwijderd) {
      // In Google Tasks verwijderd (F52): weer open gezet in Lijstjes, dan opnieuw maken; anders niets.
      if (!doel) acties.push({ soort: 'weg', itemId, gezet })
      else if (!doel.af) acties.push({ soort: 'maak', itemId, doel })
      continue
    }
    if (!doel) acties.push({ soort: 'weg', itemId, gezet })
    else if (doel.soort !== gezet.soort) {
      acties.push({ soort: 'weg', itemId, gezet })
      if (!doel.af || doel.takenlijst) acties.push({ soort: 'maak', itemId, doel })
    } else if (hashDoel(doel) !== gezet.hash) acties.push({ soort: 'wijzig', itemId, doel, gezet })
  }
  for (const [itemId, doel] of gewenst) {
    // In de eigen takenlijst komen ook afgevinkte items (F52); elders niet meer.
    if (!Object.hasOwn(opslag, itemId) && (!doel.af || doel.takenlijst)) acties.push({ soort: 'maak', itemId, doel })
  }
  return acties
}

/** Staat dit item zoals het nu is in Google? Dan staat er een icoontje vóór de datum (F48). */
export function staatInGoogle(opslag: GoogleOpslag, itemId: string, doel: Doel | undefined): Soort | null {
  const gezet = opslag[itemId]
  return gezet && doel && gezet.soort === doel.soort && gezet.hash === hashDoel(doel) ? gezet.soort : null
}

function beschrijving(d: Doel): string {
  return d.notitie ? `${d.notitie}\n\nUit Lijstjes: ${d.lijstje}` : `Uit Lijstjes: ${d.lijstje}`
}

function tijdzone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam'
  } catch {
    return 'Europe/Amsterdam'
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function lokaal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/**
 * Een agenda-item van een half uur, of zonder tijd een item voor de hele dag, met de standaardmeldingen van je agenda
 * (F48). Het andere veld (`date` of `dateTime`) staat op `null`, zodat bijwerken van tijd naar hele dag ook werkt.
 */
export function agendaBody(d: Doel, tz: string = tijdzone()) {
  const start = toDate(d.moment)
  const tijden = heeftTijdDeel(d.moment)
    ? {
        start: { dateTime: lokaal(start), timeZone: tz, date: null },
        end: { dateTime: lokaal(new Date(start.getTime() + DUUR_MINUTEN * 60000)), timeZone: tz, date: null },
      }
    : {
        start: { date: lokaal(start).slice(0, 10), dateTime: null },
        end: {
          date: lokaal(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)).slice(0, 10),
          dateTime: null,
        },
      }
  return {
    // Afgevinkt: het agenda-item blijft staan, met een vinkje voor de titel en zonder melding (F48).
    summary: d.af ? `✓ ${d.titel}` : d.titel,
    description: beschrijving(d),
    ...tijden,
    recurrence: d.jaarlijks ? ['RRULE:FREQ=YEARLY'] : [],
    reminders: d.af ? { useDefault: false, overrides: [] } : { useDefault: true },
  }
}

/** Een taak op de dag zelf; Google Tasks bewaart alleen de datum (F48). */
export function taakBody(d: Doel) {
  return {
    title: d.titel,
    notes: beschrijving(d),
    due: d.moment ? `${d.moment.slice(0, 10)}T00:00:00.000Z` : null,
    status: d.af ? 'completed' : 'needsAction',
  }
}

const AGENDA_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TASKS_BASIS = 'https://tasks.googleapis.com/tasks/v1'
/** De eigen takenlijsten (F52). */
const LIJSTEN_URL = `${TASKS_BASIS}/users/@me/lists`

/** De taken van je standaardlijst, of van een eigen takenlijst (F52). */
function takenUrl(takenlijst?: string): string {
  return `${TASKS_BASIS}/lists/${takenlijst ? encodeURIComponent(takenlijst) : '@default'}/tasks`
}

/** Een antwoord van Google dat niet goed is; 401 betekent dat je opnieuw moet inloggen. */
export class GoogleFout extends Error {
  status: number
  constructor(status: number) {
    super(`Google gaf ${status}`)
    this.status = status
  }
}

async function roep(token: string, method: string, url: string, body?: unknown): Promise<{ id?: string } | null> {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
  if (!r.ok) throw new GoogleFout(r.status)
  return r.status === 204 ? null : ((await r.json()) as { id?: string })
}

const weg = (status: number) => status === 404 || status === 410

async function maak(token: string, doel: Doel): Promise<Gezet> {
  const res =
    doel.soort === 'agenda'
      ? await roep(token, 'POST', AGENDA_URL, agendaBody(doel))
      : await roep(token, 'POST', takenUrl(doel.takenlijst), taakBody(doel))
  if (!res?.id) throw new GoogleFout(500)
  return {
    soort: doel.soort,
    id: res.id,
    hash: hashDoel(doel),
    ...(doel.takenlijst && { takenlijst: doel.takenlijst, af: doel.af }),
  }
}

/**
 * Voert één actie uit bij Google en geeft wat er daarna staat (`null`: niets meer; `'verdwenen'`: het item is bij
 * Google zelf verwijderd, F48).
 */
export async function voerUit(token: string, actie: Actie): Promise<Gezet | null | 'verdwenen'> {
  if (actie.soort === 'maak') return maak(token, actie.doel)
  const url = `${actie.gezet.soort === 'agenda' ? AGENDA_URL : takenUrl(actie.gezet.takenlijst)}/${encodeURIComponent(actie.gezet.id)}`
  if (actie.soort === 'weg') {
    if (actie.gezet.verwijderd) return null
    try {
      await roep(token, 'DELETE', url)
    } catch (e) {
      // Al weg bij Google (bijv. daar zelf verwijderd): ook goed.
      if (!(e instanceof GoogleFout && weg(e.status))) throw e
    }
    return null
  }
  try {
    await roep(token, 'PATCH', url, actie.doel.soort === 'agenda' ? agendaBody(actie.doel) : taakBody(actie.doel))
    return { ...actie.gezet, hash: hashDoel(actie.doel), ...(actie.gezet.takenlijst && { af: actie.doel.af }) }
  } catch (e) {
    // Bij Google zelf verwijderd: niet opnieuw maken (F48); in de eigen takenlijst wel, want die volgt het lijstje (F52).
    if (e instanceof GoogleFout && weg(e.status)) return actie.doel.takenlijst ? maak(token, actie.doel) : 'verdwenen'
    throw e
  }
}

export function loadOpslag(): GoogleOpslag {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GOOGLE_KEY) ?? '{}')
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
    const result: GoogleOpslag = {}
    for (const [id, g] of Object.entries(v as Record<string, Partial<Gezet>>)) {
      if (
        (g?.soort === 'agenda' || g?.soort === 'tasks' || g?.soort === 'takenlijst') &&
        typeof g.id === 'string' &&
        typeof g.hash === 'string'
      ) {
        result[id] = {
          soort: g.soort,
          id: g.id,
          hash: g.hash,
          ...(typeof g.takenlijst === 'string' && { takenlijst: g.takenlijst }),
          ...(typeof g.af === 'boolean' && { af: g.af }),
          ...(g.verwijderd === true && { verwijderd: true as const }),
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveOpslag(opslag: GoogleOpslag): void {
  try {
    localStorage.setItem(GOOGLE_KEY, JSON.stringify(opslag))
  } catch {
    // Opslag niet beschikbaar.
  }
}

/** Maakt, hernoemt en verwijdert de eigen takenlijsten (F52). Verwijderen neemt de taken erin mee. */
async function lijstenBijwerken(
  token: string,
  lijstjes: readonly Lijstje[],
  opslag: GoogleOpslag,
  onStap: (opslag: GoogleOpslag) => void,
): Promise<GoogleOpslag> {
  let huidig = opslag
  const lijsten = gewensteLijsten(lijstjes)
  for (const [key, gezet] of Object.entries(huidig)) {
    if (!key.startsWith(LIJST_PREFIX) || lijsten.has(key)) continue
    try {
      await roep(token, 'DELETE', `${LIJSTEN_URL}/${encodeURIComponent(gezet.id)}`)
    } catch (e) {
      if (!(e instanceof GoogleFout && weg(e.status))) throw e
    }
    huidig = zonderTakenlijst(huidig, key)
    onStap(huidig)
  }
  for (const [key, naam] of lijsten) {
    const gezet = huidig[key]
    if (!gezet) {
      const res = await roep(token, 'POST', LIJSTEN_URL, { title: naam })
      if (!res?.id) throw new GoogleFout(500)
      huidig = { ...huidig, [key]: { soort: 'takenlijst', id: res.id, hash: naam } }
      onStap(huidig)
    } else if (gezet.hash !== naam) {
      try {
        await roep(token, 'PATCH', `${LIJSTEN_URL}/${encodeURIComponent(gezet.id)}`, { title: naam })
        huidig = { ...huidig, [key]: { ...gezet, hash: naam } }
      } catch (e) {
        if (!(e instanceof GoogleFout && weg(e.status))) throw e
        // Bij Google verwijderd: de volgende ronde maakt hem opnieuw.
        huidig = zonderTakenlijst(huidig, key)
      }
      onStap(huidig)
    }
  }
  return huidig
}

/**
 * Brengt Google gelijk met Lijstjes. Een 401 (opnieuw inloggen) of een netwerkfout gaat door naar de aanroeper.
 * `onVerdwenen`: items die bij Google zelf zijn verwijderd; die zet Lijstjes uit in plaats van opnieuw te maken (F48).
 */
export async function bijwerken(
  token: string,
  lijstjes: readonly Lijstje[],
  opslag: GoogleOpslag,
  onStap: (opslag: GoogleOpslag) => void,
  onVerdwenen: (itemIds: string[]) => void = () => {},
  now: Date = new Date(),
): Promise<GoogleOpslag> {
  let huidig = { ...opslag }
  const verdwenen: string[] = []
  // Twee rondes: is een eigen takenlijst bij Google verwijderd, dan maakt de tweede ronde hem opnieuw (F52).
  for (let ronde = 0; ronde < 2; ronde++) {
    huidig = await lijstenBijwerken(token, lijstjes, huidig, onStap)
    let nogEens = false
    for (const actie of plan(doelen(lijstjes, now, huidig), huidig)) {
      if (verdwenen.includes(actie.itemId)) continue
      let gezet: Gezet | null | 'verdwenen'
      try {
        gezet = await voerUit(token, actie)
      } catch (e) {
        const lijst = actie.soort === 'weg' ? actie.gezet.takenlijst : actie.doel.takenlijst
        const key = lijst && Object.keys(huidig).find((k) => k.startsWith(LIJST_PREFIX) && huidig[k].id === lijst)
        if (!(key && e instanceof GoogleFout && weg(e.status))) throw e
        huidig = zonderTakenlijst(huidig, key)
        onStap(huidig)
        nogEens = true
        break
      }
      huidig = { ...huidig }
      if (gezet === 'verdwenen') {
        delete huidig[actie.itemId]
        verdwenen.push(actie.itemId)
      } else if (gezet) huidig[actie.itemId] = gezet
      else if (actie.soort === 'weg' && huidig[actie.itemId]?.id === actie.gezet.id) delete huidig[actie.itemId]
      onStap(huidig)
    }
    if (!nogEens) break
  }
  if (verdwenen.length > 0) onVerdwenen(verdwenen)
  return huidig
}

/** Een taak zoals Google Tasks hem teruggeeft (F52). */
export interface Taak {
  id: string
  title?: string
  status?: string
  due?: string
  notes?: string
  deleted?: boolean
}

/** Alle taken van een eigen takenlijst, ook afgevinkte (F52). */
export async function haalTakenOp(token: string, takenlijst: string): Promise<Taak[]> {
  const result: Taak[] = []
  let pagina: string | undefined
  do {
    const url = `${takenUrl(takenlijst)}?showCompleted=true&showHidden=true&maxResults=100${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`
    const res = (await roep(token, 'GET', url)) as { items?: Taak[]; nextPageToken?: string } | null
    result.push(...(res?.items ?? []))
    pagina = res?.nextPageToken
  } while (pagina)
  return result
}

/** Een wijziging in de eigen takenlijst bij Google die terug moet naar een item in Lijstjes (F52). */
export interface Terug {
  itemId: string
  af?: boolean
  tekst?: string
  aantal?: string
  notitie?: string
}

/** Wat er in de eigen takenlijst bij Google anders is dan Lijstjes het daar zette (F52). */
export interface VanGoogle {
  /** In Google afgevinkt, weer open gezet, of de titel of notitie gewijzigd; of verwijderd (dan afgevinkt). */
  wijzig: Terug[]
  /** In Google nieuw toegevoegd. */
  nieuw: Taak[]
  /** In Google verwijderd: in Lijstjes afgevinkt, en niet opnieuw in Google gezet. */
  weg: string[]
}

/** Wat Lijstjes het laatst als titel en notitie naar Google stuurde (uit de hash, F52); `null` als dat niet bekend is. */
function laatstGestuurd(gezet: Gezet): { titel: string; notitie: string } | null {
  try {
    const h = JSON.parse(gezet.hash) as unknown
    return Array.isArray(h) && typeof h[1] === 'string' && typeof h[2] === 'string'
      ? { titel: h[1], notitie: h[2] }
      : null
  } catch {
    return null
  }
}

/** De notitie uit de notities bij Google, zonder "Uit Lijstjes: …" eronder. */
function notitieUit(notes: string | undefined): string {
  return (notes ?? '').replace(/\s*Uit Lijstjes: [^\n]*$/, '').trim()
}

export function vergelijkTaken(l: Lijstje, opslag: GoogleOpslag, taken: readonly Taak[]): VanGoogle {
  const takenlijst = opslag[LIJST_PREFIX + l.id]?.id
  const result: VanGoogle = { wijzig: [], nieuw: [], weg: [] }
  if (!takenlijst) return result
  const perId = new Map(taken.filter((t) => !t.deleted).map((t) => [t.id, t]))
  const bekend = new Set(
    Object.values(opslag)
      .filter((g) => g.takenlijst === takenlijst)
      .map((g) => g.id),
  )
  for (const item of l.items) {
    const key = item.id + IN_LIJST
    const gezet = opslag[key]
    if (!gezet || gezet.takenlijst !== takenlijst || gezet.verwijderd) continue
    const taak = perId.get(gezet.id)
    if (!taak) {
      result.weg.push(key)
      if (!item.af) result.wijzig.push({ itemId: item.id, af: true })
      continue
    }
    const terug: Terug = { itemId: item.id }
    const af = taak.status === 'completed'
    if (af !== (gezet.af ?? false) && af !== item.af) terug.af = af
    const gestuurd = laatstGestuurd(gezet)
    const titel = (taak.title ?? '').trim()
    if (gestuurd && titel && titel !== gestuurd.titel) {
      // Met Aantal: een getal vooraan is het aantal (F41).
      const m = l.kenmerken?.aantal ? /^(\d\S*)\s+(.+)$/.exec(titel) : null
      terug.tekst = m ? m[2] : titel
      if (l.kenmerken?.aantal) terug.aantal = m ? m[1] : ''
    }
    const notitie = notitieUit(taak.notes)
    if (gestuurd && l.kenmerken?.notitie && notitie !== gestuurd.notitie) terug.notitie = notitie
    if (Object.keys(terug).length > 1) result.wijzig.push(terug)
  }
  result.nieuw = taken.filter((t) => !t.deleted && !bekend.has(t.id) && t.title?.trim())
  return result
}

/**
 * Staat dit item nog bij Google? Nee als Google 404 of 410 geeft, of het als verwijderd (agenda: `cancelled`, taak:
 * `deleted`) teruggeeft. Andere fouten (401, geen internet) gaan door naar de aanroeper.
 */
export async function staatNogInGoogle(token: string, gezet: Gezet): Promise<boolean> {
  const url = `${gezet.soort === 'agenda' ? AGENDA_URL : takenUrl(gezet.takenlijst)}/${encodeURIComponent(gezet.id)}`
  try {
    const res = (await roep(token, 'GET', url)) as { status?: string; deleted?: boolean } | null
    return res?.status !== 'cancelled' && res?.deleted !== true
  } catch (e) {
    if (e instanceof GoogleFout && weg(e.status)) return false
    throw e
  }
}

/** Kijkt bij het openen van de app (en als je terugkomt) welke items je bij Google zelf hebt verwijderd (F48). */
export async function controleer(token: string, opslag: GoogleOpslag): Promise<string[]> {
  const verdwenen: string[] = []
  for (const [itemId, gezet] of Object.entries(opslag)) {
    if (!(await staatNogInGoogle(token, gezet))) verdwenen.push(itemId)
  }
  return verdwenen
}

// --- Inloggen (F49) met Google Identity Services: een token dat een uur geldt, zonder server. ---

interface Token {
  token: string
  /** Tot wanneer (ms sinds 1970). */
  tot: number
}

export function loadToken(now: number = Date.now()): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null
    return t && typeof t.token === 'string' && t.tot > now + 60000 ? t.token : null
  } catch {
    return null
  }
}

function saveToken(token: string, seconden: number) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, tot: Date.now() + seconden * 1000 }))
    localStorage.setItem(INGELOGD_KEY, '1')
  } catch {
    // Opslag niet beschikbaar.
  }
}

export function vergeetToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Opslag niet beschikbaar.
  }
}

/** Ooit ingelogd en niet uitgelogd? */
export function isIngelogd(): boolean {
  try {
    return localStorage.getItem(INGELOGD_KEY) === '1'
  } catch {
    return false
  }
}

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
}

interface TokenClient {
  callback: (r: TokenResponse) => void
  error_callback?: (e: unknown) => void
  requestAccessToken: (o?: { prompt?: string }) => void
}

interface GoogleGis {
  accounts: {
    oauth2: {
      initTokenClient: (o: {
        client_id: string
        scope: string
        callback: (r: TokenResponse) => void
        error_callback?: (e: unknown) => void
      }) => TokenClient
      revoke: (token: string, done?: () => void) => void
    }
  }
}

let gisLaden: Promise<void> | null = null
let client: TokenClient | null = null

function gis(): GoogleGis | undefined {
  return (window as unknown as { google?: GoogleGis }).google
}

/** Laadt het script van Google vooraf, zodat inloggen meteen kan bij een tik (anders houdt de browser het tegen). */
export function laadGoogle(): Promise<void> {
  if (!googleClientId()) return Promise.reject(new Error('geen client-id'))
  gisLaden ??= new Promise<void>((resolve, reject) => {
    if (gis()?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisLaden = null
      reject(new Error('script niet geladen'))
    }
    document.head.appendChild(s)
  })
  return gisLaden
}

/**
 * Vraagt Google om toegang (F49). Roep dit aan direct bij een tik, anders houdt de browser het venster van Google
 * tegen. `opnieuw`: al eerder toestemming gegeven, dan sluit het venster meestal vanzelf.
 */
export function vraagToegang(opnieuw: boolean): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const start = () => {
      const g = gis()
      if (!g?.accounts?.oauth2) return reject(new Error('geen Google'))
      client ??= g.accounts.oauth2.initTokenClient({
        client_id: googleClientId(),
        scope: GOOGLE_SCOPES,
        callback: () => {},
      })
      client.callback = (r) => {
        if (r.access_token) {
          saveToken(r.access_token, Number(r.expires_in) || 3600)
          resolve(r.access_token)
        } else reject(new Error(r.error ?? 'geweigerd'))
      }
      client.error_callback = (e) => reject(e instanceof Error ? e : new Error('venster gesloten'))
      client.requestAccessToken({ prompt: opnieuw ? '' : 'consent' })
    }
    if (gis()?.accounts?.oauth2) start()
    else laadGoogle().then(start, reject)
  })
}

/** Uitloggen (F49): de toegang intrekken en vergeten. Wat al in Google staat, blijft daar staan. */
export function uitloggen(): void {
  const token = loadToken(0)
  if (token) gis()?.accounts?.oauth2?.revoke(token)
  vergeetToken()
  try {
    localStorage.removeItem(INGELOGD_KEY)
  } catch {
    // Opslag niet beschikbaar.
  }
}

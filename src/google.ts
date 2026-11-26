// Google, automatisch (F48, F49): Lijstjes zet items met een datum en tijd in Google Agenda en items met alleen een
// datum in Google Tasks, en houdt ze daar bij als je ze wijzigt, afvinkt of weggooit. Alles gaat rechtstreeks van de
// telefoon naar Google; er is geen server van Lijstjes.

import { DUUR_MINUTEN, heeftTijdDeel, toDate, volgendeKeer, zichtbaar } from './agenda'
import { heeftTijd, heeftZonderJaar, naarGoogle, type Lijstje } from './lists'
import { KEY_PREFIX } from './storageKey'

/**
 * Het Client-ID van het Google Cloud-project van Lijstjes (een webclient met als JavaScript-oorsprong
 * https://steenmetzg.github.io). Dit ID is niet geheim. Leeg: Google, automatisch is nog niet ingesteld (F48).
 */
const CLIENT_ID = ''

export function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || CLIENT_ID
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
}

export interface Gezet {
  soort: Soort
  id: string
  hash: string
}

export type GoogleOpslag = Record<string, Gezet>

export type Actie =
  | { soort: 'maak'; itemId: string; doel: Doel }
  | { soort: 'wijzig'; itemId: string; doel: Doel; gezet: Gezet }
  | { soort: 'weg'; itemId: string; gezet: Gezet }

/** Met een tijd in Google Agenda, met alleen een datum in Google Tasks (F48). */
export function soortVan(moment: string): Soort {
  return heeftTijdDeel(moment) ? 'agenda' : 'tasks'
}

/** Hoe alle items die naar Google horen er daar uit moeten zien, per item-id (F48). */
export function doelen(lijstjes: readonly Lijstje[], now: Date = new Date()): Map<string, Doel> {
  const result = new Map<string, Doel>()
  for (const l of lijstjes) {
    const tijd = heeftTijd(l)
    const jaarlijks = heeftZonderJaar(l)
    for (const item of l.items) {
      if (!naarGoogle(l, item) || !item.wanneer) continue
      const zien = zichtbaar(item.wanneer, tijd)
      const notitie = l.kenmerken?.notitie ? item.notitie : undefined
      result.set(item.id, {
        soort: soortVan(zien),
        titel: item.aantal && l.kenmerken?.aantal ? `${item.aantal} ${item.tekst}` : item.tekst,
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

/** Wat er bij Google moet kloppen; een afgevinkt agenda-item blijft gewoon staan, een taak wordt afgevinkt. */
export function hashDoel(d: Doel): string {
  return JSON.stringify([
    d.soort,
    d.titel,
    d.notitie ?? '',
    d.lijstje,
    d.moment,
    d.jaarlijks,
    d.soort === 'tasks' && d.af,
  ])
}

/**
 * Wat er bij Google moet gebeuren om gelijk te lopen met Lijstjes (F48): nieuwe items maken, gewijzigde bijwerken,
 * weggegooide (of niet meer gewenste) verwijderen. Verandert een item van agenda naar taak, dan weg en opnieuw. Een
 * afgevinkt item dat nog niet in Google staat, komt er niet meer in.
 */
export function plan(gewenst: Map<string, Doel>, opslag: GoogleOpslag): Actie[] {
  const acties: Actie[] = []
  for (const [itemId, gezet] of Object.entries(opslag)) {
    const doel = gewenst.get(itemId)
    if (!doel) acties.push({ soort: 'weg', itemId, gezet })
    else if (doel.soort !== gezet.soort) {
      acties.push({ soort: 'weg', itemId, gezet })
      if (!doel.af) acties.push({ soort: 'maak', itemId, doel })
    } else if (hashDoel(doel) !== gezet.hash) acties.push({ soort: 'wijzig', itemId, doel, gezet })
  }
  for (const [itemId, doel] of gewenst) {
    if (!Object.hasOwn(opslag, itemId) && !doel.af) acties.push({ soort: 'maak', itemId, doel })
  }
  return acties
}

/** Staat dit item zoals het nu is in Google? Dan staat er een icoontje achter de datum (F48). */
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

/** Een agenda-item van een half uur, met de standaardmeldingen van je agenda (F48). */
export function agendaBody(d: Doel, tz: string = tijdzone()) {
  const start = toDate(d.moment)
  const eind = new Date(start.getTime() + DUUR_MINUTEN * 60000)
  return {
    summary: d.titel,
    description: beschrijving(d),
    start: { dateTime: lokaal(start), timeZone: tz },
    end: { dateTime: lokaal(eind), timeZone: tz },
    recurrence: d.jaarlijks ? ['RRULE:FREQ=YEARLY'] : [],
    reminders: { useDefault: true },
  }
}

/** Een taak op de dag zelf; Google Tasks bewaart alleen de datum (F48). */
export function taakBody(d: Doel) {
  return {
    title: d.titel,
    notes: beschrijving(d),
    due: `${d.moment.slice(0, 10)}T00:00:00.000Z`,
    status: d.af ? 'completed' : 'needsAction',
  }
}

const AGENDA_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TASKS_URL = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

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
      : await roep(token, 'POST', TASKS_URL, taakBody(doel))
  if (!res?.id) throw new GoogleFout(500)
  return { soort: doel.soort, id: res.id, hash: hashDoel(doel) }
}

/** Voert één actie uit bij Google en geeft wat er daarna staat (`null`: niets meer). */
export async function voerUit(token: string, actie: Actie): Promise<Gezet | null> {
  if (actie.soort === 'maak') return maak(token, actie.doel)
  const url = `${actie.gezet.soort === 'agenda' ? AGENDA_URL : TASKS_URL}/${encodeURIComponent(actie.gezet.id)}`
  if (actie.soort === 'weg') {
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
    return { ...actie.gezet, hash: hashDoel(actie.doel) }
  } catch (e) {
    // Bij Google verwijderd: opnieuw maken.
    if (e instanceof GoogleFout && weg(e.status)) return maak(token, actie.doel)
    throw e
  }
}

export function loadOpslag(): GoogleOpslag {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GOOGLE_KEY) ?? '{}')
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
    const result: GoogleOpslag = {}
    for (const [id, g] of Object.entries(v as Record<string, Partial<Gezet>>)) {
      if ((g?.soort === 'agenda' || g?.soort === 'tasks') && typeof g.id === 'string' && typeof g.hash === 'string') {
        result[id] = { soort: g.soort, id: g.id, hash: g.hash }
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

/** Brengt Google gelijk met Lijstjes. Een 401 (opnieuw inloggen) of een netwerkfout gaat door naar de aanroeper. */
export async function bijwerken(
  token: string,
  lijstjes: readonly Lijstje[],
  opslag: GoogleOpslag,
  onStap: (opslag: GoogleOpslag) => void,
  now: Date = new Date(),
): Promise<GoogleOpslag> {
  let huidig = { ...opslag }
  for (const actie of plan(doelen(lijstjes, now), huidig)) {
    const gezet = await voerUit(token, actie)
    huidig = { ...huidig }
    if (gezet) huidig[actie.itemId] = gezet
    else if (actie.soort === 'weg' && huidig[actie.itemId]?.id === actie.gezet.id) delete huidig[actie.itemId]
    onStap(huidig)
  }
  return huidig
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

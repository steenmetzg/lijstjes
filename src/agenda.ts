// Kenmerk Datum en Tijd (F33 t/m F35): datum en tijd van een item tonen, en een item in je agenda zetten.
// Lijstjes zelf stuurt geen meldingen; de herinnering komt van je agenda.

/** De agenda's waar een herinneringslijstje zijn items in kan zetten (F34). */
export type Agenda = 'google' | 'outlook' | 'outlook-werk' | 'ics' | 'delen'

export const AGENDAS: readonly { id: Agenda; label: string }[] = [
  { id: 'google', label: 'Google Agenda' },
  { id: 'outlook', label: 'Outlook (privé)' },
  { id: 'outlook-werk', label: 'Outlook (werk)' },
  { id: 'ics', label: 'Andere agenda' },
  { id: 'delen', label: 'Delen…' },
]

export function isAgenda(value: unknown): value is Agenda {
  return AGENDAS.some((a) => a.id === value)
}

/**
 * De keuze van een lijstje met Datum: een vaste agenda, per item kiezen (F34), Google automatisch (F48) of geen
 * agenda (F50). Zonder keuze is er nog niets gekozen; de eerste keer in de agenda zetten vraagt dan welke agenda.
 */
export type AgendaKeuze = Agenda | 'per-item' | 'google-auto' | 'geen'

export const PER_ITEM = 'per-item' as const
/** Lijstjes zet de items zelf in Google Agenda (met tijd) of Google Tasks (zonder tijd) en houdt ze bij (F48). */
export const GOOGLE_AUTO = 'google-auto' as const
/** De datums staan alleen in Lijstjes; er is geen knop In agenda zetten (F50). */
export const GEEN = 'geen' as const

export function isAgendaKeuze(value: unknown): value is AgendaKeuze {
  return value === PER_ITEM || value === GOOGLE_AUTO || value === GEEN || isAgenda(value)
}

/** Hoe de keuze heet op de regel "Agenda: …" in het vak met de schuifjes (F41). */
export function keuzeLabel(keuze: AgendaKeuze): string {
  if (keuze === PER_ITEM) return 'per item kiezen'
  if (keuze === GOOGLE_AUTO) return 'Google, automatisch'
  if (keuze === GEEN) return 'geen'
  return agendaLabel(keuze)
}

export function agendaLabel(agenda: Agenda): string {
  return AGENDAS.find((a) => a.id === agenda)?.label ?? agenda
}

/** Zo lang duurt een agenda-item, in minuten. */
export const DUUR_MINUTEN = 30

/** Datum en tijd zoals het datumveld ze geeft: "2026-11-08T14:00" (lokale tijd). */
const WANNEER = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** Alleen een datum: "2026-11-08" (kenmerk Datum zonder Tijd, F41). */
const DATUM = /^\d{4}-\d{2}-\d{2}$/

/** Datum met tijd, zoals versie 1.4 t/m 1.6 die kennen. */
export function isWanneer(value: unknown): value is string {
  return typeof value === 'string' && WANNEER.test(value) && geldig(value)
}

/** Datum met of zonder tijd. */
export function isMoment(value: unknown): value is string {
  return typeof value === 'string' && (WANNEER.test(value) || DATUM.test(value)) && geldig(value)
}

function geldig(value: string): boolean {
  const d = toDate(value)
  return !isNaN(d.getTime()) && dagSleutel(d) === value.slice(0, 10)
}

export function heeftTijdDeel(wanneer: string): boolean {
  return wanneer.length > 10
}

/** De datum (en tijd) zoals je die ziet: zonder tijd als het kenmerk Tijd uit staat (F41). */
export function zichtbaar(wanneer: string, tijd: boolean): string {
  return tijd ? wanneer : wanneer.slice(0, 10)
}

/** Is `inAgenda` dezelfde datum (en tijd) als die je bij het item ziet (F34)? */
export function momentGelijk(inAgenda: string, wanneer: string | undefined, tijd: boolean): boolean {
  return wanneer !== undefined && zichtbaar(wanneer, tijd) === inAgenda
}

/** "2026-11-08T14:00" of "2026-11-08" (dan 00:00) als datum in de tijdzone van de telefoon. */
export function toDate(wanneer: string): Date {
  const [d, t = '00:00'] = wanneer.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, min] = t.split(':').map(Number)
  return new Date(y, m - 1, day, h, min)
}

/** "2026-11-08" voor een datum. */
export function dagSleutel(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/**
 * Bijv. "za 8 nov 14:00", zonder tijd "za 8 nov"; in een ander jaar met het jaartal erbij: "vr 1 jan 2027 09:30"
 * (F33).
 */
export function formatWanneer(wanneer: string, now: Date = new Date(), jaarlijks = false): string {
  const d = toDate(wanneer)
  const tijd = heeftTijdDeel(wanneer) ? ` ${wanneer.slice(11)}` : ''
  // Zonder jaar (elk jaar): geen dag van de week, want die verschilt per jaar (F44).
  if (jaarlijks) return `${d.getDate()} ${MAANDEN[d.getMonth()]}${tijd}`
  const jaar = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}${jaar}${tijd}`
}

/**
 * Is het moment al voorbij (zonder tijd: is de dag voorbij)? Dan staat de datum in rood (F33). Zonder jaar komt de
 * dag elk jaar terug en is hij nooit voorbij (F44).
 */
export function isVoorbij(wanneer: string, now: Date = new Date(), jaarlijks = false): boolean {
  if (jaarlijks) return false
  if (!heeftTijdDeel(wanneer)) return wanneer < dagSleutel(now)
  return toDate(wanneer).getTime() < now.getTime()
}

/**
 * Zonder jaar: de eerstvolgende keer (vandaag of later) dat dag en maand terugkomen, als "2026-11-25" (met de tijd
 * erachter als die er is) (F44). 29 februari valt in een gewoon jaar op 28 februari.
 */
export function volgendeKeer(wanneer: string, now: Date = new Date()): string {
  const vandaag = dagSleutel(now)
  const rest = wanneer.slice(10)
  const md = wanneer.slice(5, 10)
  for (let jaar = now.getFullYear(); ; jaar++) {
    let dag = `${jaar}-${md}`
    if (!isMoment(dag)) dag = `${jaar}-02-28`
    if (dag >= vandaag) return dag + rest
  }
}

/**
 * Items van een lijstje met Datum op datum: de eerstvolgende bovenaan, items zonder datum onderaan
 * in hun eigen volgorde (F33). Zonder jaar op de eerstvolgende keer dat de dag terugkomt (F44).
 */
export function opDatum<T extends { wanneer?: string }>(
  items: readonly T[],
  jaarlijks = false,
  now: Date = new Date(),
): T[] {
  const sleutel = (w: string) => (jaarlijks ? volgendeKeer(w, now) : w)
  const met = items.filter((i) => i.wanneer).sort((a, b) => sleutel(a.wanneer!).localeCompare(sleutel(b.wanneer!)))
  return [...met, ...items.filter((i) => !i.wanneer)]
}

export interface Afspraak {
  id: string
  titel: string
  /** De naam van het lijstje, in de omschrijving van het agenda-item. */
  lijstje: string
  wanneer: string
  /** Zonder jaar: het agenda-item komt elk jaar terug (F44). */
  jaarlijks?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "20261108T140000" in lokale tijd. */
function compactLocal(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

/** "20261108T130000Z" in UTC. */
function compactUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function times(wanneer: string): { start: Date; eind: Date } {
  const start = toDate(wanneer)
  return { start, eind: new Date(start.getTime() + DUUR_MINUTEN * 60000) }
}

/** Zonder tijd: een agenda-item voor de hele dag, tot de volgende dag. */
function heleDag(wanneer: string): { start: Date; eind: Date } {
  const start = toDate(wanneer)
  return { start, eind: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) }
}

const compactDag = (d: Date) => dagSleutel(d).replace(/-/g, '')

function omschrijving(a: Afspraak): string {
  return `Uit Lijstjes: ${a.lijstje}`
}

function tijdzone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam'
  } catch {
    return 'Europe/Amsterdam'
  }
}

/** Een ingevuld nieuw afspraak-scherm in Google Agenda. */
export function googleUrl(a: Afspraak): string {
  const dag = !heeftTijdDeel(a.wanneer)
  const { start, eind } = dag ? heleDag(a.wanneer) : times(a.wanneer)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: a.titel,
    dates: dag ? `${compactDag(start)}/${compactDag(eind)}` : `${compactLocal(start)}/${compactLocal(eind)}`,
    ctz: tijdzone(),
    details: omschrijving(a),
    ...(a.jaarlijks && { recur: 'RRULE:FREQ=YEARLY' }),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** Een ingevuld nieuw afspraak-scherm in Outlook op het web: privé (outlook.com) of werk (Microsoft 365). */
export function outlookUrl(a: Afspraak, werk: boolean): string {
  const dag = !heeftTijdDeel(a.wanneer)
  const { start, eind } = dag ? heleDag(a.wanneer) : times(a.wanneer)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: a.titel,
    startdt: dag ? dagSleutel(start) : start.toISOString(),
    enddt: dag ? dagSleutel(eind) : eind.toISOString(),
    ...(dag && { allday: 'true' }),
    body: omschrijving(a),
  })
  const host = werk ? 'outlook.office.com' : 'outlook.live.com'
  return `https://${host}/calendar/0/deeplink/compose?${params}`
}

function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Een agenda-bestand (.ics) dat elke agenda-app kan openen. */
export function icsBestand(a: Afspraak, now: Date = new Date()): string {
  const dag = !heeftTijdDeel(a.wanneer)
  const { start, eind } = dag ? heleDag(a.wanneer) : times(a.wanneer)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lijstjes//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.id}-${compactUtc(start)}@lijstjes`,
    `DTSTAMP:${compactUtc(now)}`,
    dag ? `DTSTART;VALUE=DATE:${compactDag(start)}` : `DTSTART:${compactUtc(start)}`,
    dag ? `DTEND;VALUE=DATE:${compactDag(eind)}` : `DTEND:${compactUtc(eind)}`,
    ...(a.jaarlijks ? ['RRULE:FREQ=YEARLY'] : []),
    `SUMMARY:${icsText(a.titel)}`,
    `DESCRIPTION:${icsText(omschrijving(a))}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/** De tekst voor het deelmenu van de telefoon, bijv. voor Google Tasks. */
export function deelTekst(a: Afspraak): string {
  return a.jaarlijks
    ? `${a.titel}, elk jaar op ${formatWanneer(a.wanneer, undefined, true)}`
    : `${a.titel}, ${formatWanneer(a.wanneer)}`
}

/** Bestandsnaam van het agenda-bestand: alleen letters, cijfers en streepjes. */
export function icsNaam(a: Afspraak): string {
  const naam = a.titel
    .toLocaleLowerCase('nl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${naam || 'herinnering'}.ics`
}

/**
 * Zet het item in de gekozen agenda (F34). Geeft `false` als dat op deze telefoon niet kan
 * (bijv. Delen zonder deelmenu); het agenda-scherm of deelmenu zelf opent buiten de app.
 */
export async function zetInAgenda(agenda: Agenda, a: Afspraak): Promise<boolean> {
  switch (agenda) {
    case 'google':
      window.open(googleUrl(a), '_blank', 'noopener')
      return true
    case 'outlook':
    case 'outlook-werk':
      window.open(outlookUrl(a, agenda === 'outlook-werk'), '_blank', 'noopener')
      return true
    case 'ics': {
      const url = URL.createObjectURL(new Blob([icsBestand(a)], { type: 'text/calendar' }))
      const link = document.createElement('a')
      link.href = url
      link.download = icsNaam(a)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      return true
    }
    case 'delen': {
      if (typeof navigator.share !== 'function') return false
      try {
        await navigator.share({ title: a.titel, text: deelTekst(a) })
        return true
      } catch {
        // Deelmenu gesloten zonder te kiezen.
        return false
      }
    }
  }
}

/** "2026-11-25" als "25-11-2026", zoals je een datum typt (F33); zonder jaar "25-11" (F44). */
export function datumTekst(datum: string, zonderJaar = false): string {
  const [y, m, d] = datum.split('-')
  return zonderJaar ? `${d}-${m}` : `${d}-${m}-${y}`
}

/** Een getypte dag en maand zonder jaar (F44): zoals `leesDatum`, en 29-02 kan ook (in een schrikkeljaar). */
export function leesDagMaand(tekst: string, now: Date = new Date()): string | null {
  return leesDatum(tekst, now) ?? leesDatum(tekst, new Date(2000, 0, 1))
}

/**
 * Een getypte datum als "2026-11-25" (F33): dag-maand-jaar met -, /, . of een spatie ertussen ("25-11-2026",
 * "25/11/26", "25 11"), of alleen cijfers ("25112026", "2511"). Zonder jaar het huidige jaar. Leeg geeft "",
 * een onbekende datum `null`.
 */
export function leesDatum(tekst: string, now: Date = new Date()): string | null {
  const t = tekst.trim()
  if (!t) return ''
  let d: string, m: string, y: string | undefined
  const delen = t.split(/[-/.\s]+/)
  if (delen.length >= 2 && delen.length <= 3 && delen.every((x) => /^\d+$/.test(x))) {
    ;[d, m, y] = delen
  } else if (/^\d{4}(\d{2}|\d{4})?$/.test(t)) {
    d = t.slice(0, 2)
    m = t.slice(2, 4)
    y = t.length > 4 ? t.slice(4) : undefined
  } else return null
  let jaar = y === undefined ? now.getFullYear() : Number(y)
  if (y !== undefined && y.length <= 2) jaar += 2000
  if (y !== undefined && y.length !== 2 && y.length !== 4) return null
  const datum = `${jaar}-${pad(Number(m))}-${pad(Number(d))}`
  return isMoment(datum) ? datum : null
}

/** Een getypte tijd als "09:30" (F33): "9:30", "9.30", "930", "0930" of "9". Leeg geeft "", onbekend `null`. */
export function leesTijd(tekst: string): string | null {
  const t = tekst.trim()
  if (!t) return ''
  let h: number, min: number
  const m = /^(\d{1,2})(?:[:.\s](\d{2}))?$/.exec(t)
  if (m) {
    h = Number(m[1])
    min = m[2] ? Number(m[2]) : 0
  } else if (/^\d{3,4}$/.test(t)) {
    h = Number(t.slice(0, t.length - 2))
    min = Number(t.slice(-2))
  } else return null
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null
}

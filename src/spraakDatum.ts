// Een ingesproken datum en tijd in het vak van een item (F46), zoals Chrome ze in het Nederlands uitschrijft.

const MAANDEN = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
]
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const GETALLEN: Record<string, number> = {
  een: 1,
  één: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vijf: 5,
  zes: 6,
  zeven: 7,
  acht: 8,
  negen: 9,
  tien: 10,
  elf: 11,
  twaalf: 12,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getal(woord: string): number | null {
  if (/^\d+$/.test(woord)) return Number(woord)
  return GETALLEN[woord] ?? null
}

/** De tijd uit wat je zei ("om 14:30", "14.30 uur", "14 uur 30", "half 3", "kwart over 9"), of `null`. */
function leesTijd(t: string): string | null {
  let h: number | null = null
  let min = 0
  let m: RegExpExecArray | null
  if ((m = /(\d{1,2})[:.](\d{2})/.exec(t))) {
    h = Number(m[1])
    min = Number(m[2])
  } else if ((m = /(\d{1,2}) uur(?: (\d{1,2}))?/.exec(t))) {
    h = Number(m[1])
    min = m[2] ? Number(m[2]) : 0
  } else if ((m = /half (\w+)/.exec(t)) && getal(m[1]) !== null) {
    h = getal(m[1])! - 1
    min = 30
  } else if ((m = /kwart over (\w+)/.exec(t)) && getal(m[1]) !== null) {
    h = getal(m[1])!
    min = 15
  } else if ((m = /kwart voor (\w+)/.exec(t)) && getal(m[1]) !== null) {
    h = getal(m[1])! - 1
    min = 45
  } else if ((m = /\bom (\w+)\b/.exec(t)) && getal(m[1]) !== null) {
    h = getal(m[1])
  }
  if (h === null) return null
  // 's Middags en 's avonds: een uur van 1 tot 11 is na twaalf uur.
  if (/(middags|avonds)/.test(t) && h >= 1 && h < 12) h += 12
  if (h < 0) h += 12
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null
}

/** De datum uit wat je zei ("25 november", "25-11", "morgen", "vrijdag"), als "2026-11-25", of `null`. */
function leesDatum(t: string, now: Date, zonderJaar: boolean): string | null {
  const vandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const plus = (n: number) => iso(new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate() + n))
  if (/\bovermorgen\b/.test(t)) return plus(2)
  if (/\bmorgen\b/.test(t)) return plus(1)
  if (/\bvandaag\b/.test(t)) return plus(0)
  let m: RegExpExecArray | null
  const maand = new RegExp(`(\\d{1,2})(?:e|ste|de)? (${MAANDEN.join('|')})(?: (\\d{4}))?`)
  let d: number, mnd: number, y: number | undefined
  if ((m = maand.exec(t))) {
    d = Number(m[1])
    mnd = MAANDEN.indexOf(m[2]) + 1
    y = m[3] ? Number(m[3]) : undefined
  } else if ((m = /\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/.exec(t))) {
    d = Number(m[1])
    mnd = Number(m[2])
    y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined
  } else {
    // Een dag van de week: de eerstvolgende, vandaag niet meegerekend; "volgende week" een week later.
    const dag = DAGEN.findIndex((naam) => new RegExp(`\\b${naam}\\b`).test(t))
    if (dag < 0) return null
    let n = (dag - vandaag.getDay() + 7) % 7 || 7
    if (/volgende week/.test(t) && n < 7) n += 7
    return plus(n)
  }
  // Zonder jaar: het huidige jaar, of volgend jaar als die dag dit jaar al voorbij is (niet bij Zonder jaar).
  let jaar = y ?? vandaag.getFullYear()
  if (zonderJaar) jaar = y ?? 2000
  const datum = new Date(jaar, mnd - 1, d)
  if (datum.getMonth() !== mnd - 1 || datum.getDate() !== d) return null
  if (y === undefined && !zonderJaar && datum < vandaag) datum.setFullYear(jaar + 1)
  return iso(datum)
}

/**
 * Een ingesproken datum en/of tijd (F46). `null` als er geen datum en geen tijd in te herkennen is. Bij Zonder jaar
 * telt alleen dag en maand.
 */
export function gesprokenMoment(
  tekst: string,
  zonderJaar = false,
  now: Date = new Date(),
): { datum: string | null; tijd: string | null } | null {
  const t = tekst.toLocaleLowerCase('nl').replace(/[,!?]/g, ' ').replace(/\s+/g, ' ').trim()
  // Een tijd met een punt eerst apart lezen, zodat 14.30 geen datum wordt.
  const tijd = leesTijd(t)
  const zonderTijd = t.replace(/\d{1,2}[:.]\d{2}/g, ' ')
  const datum = leesDatum(zonderTijd, now, zonderJaar)
  // Alleen een tijd kan ook: dan blijft de datum zoals hij was.
  return datum || tijd ? { datum, tijd } : null
}

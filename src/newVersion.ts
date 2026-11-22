// Melding na het bijwerken van de app (F45), zoals in WoonWerk.

import { INSTALL_LATER_KEY } from './installPrompt'
import { CURRENT_KEY, LISTS_KEY } from './lists'
import { SPEECH_KEY } from './speech'
import { KEY_PREFIX } from './storageKey'

/** De versie van de app die het laatst is geopend. De testversie heeft zijn eigen sleutel (`lijstjes-test-…`). */
export const LAATSTE_VERSIE_KEY = `${KEY_PREFIX}laatst-geopende-versie`

// Staat een van deze er al, dan is de app eerder gebruikt (ook als hij van voor F45 is).
const BESTAANDE_GEGEVENS = [LAATSTE_VERSIE_KEY, LISTS_KEY, CURRENT_KEY, SPEECH_KEY, INSTALL_LATER_KEY]

/**
 * Welke nieuwe versie gemeld moet worden, of `null`. Bij de eerste keer openen (nog niets opgeslagen) is er niets
 * te melden: dan is de app net geïnstalleerd, niet bijgewerkt.
 */
export function versionToAnnounce(current: string): string | null {
  try {
    const last = localStorage.getItem(LAATSTE_VERSIE_KEY)
    if (last === current) return null
    if (last === null && !BESTAANDE_GEGEVENS.some((key) => localStorage.getItem(key) !== null)) return null
    return current
  } catch {
    return null
  }
}

/** Onthoudt dat deze versie is geopend en gemeld. */
export function markVersionSeen(current: string): void {
  try {
    localStorage.setItem(LAATSTE_VERSIE_KEY, current)
  } catch {
    // Geen opslag: dan komt de melding de volgende keer gewoon nog eens.
  }
}

/** Of het welkom al gesloten is: 'open' zolang hij er staat, 'gezien' na het kruisje (F47). */
export const WELKOM_KEY = `${KEY_PREFIX}welkom`

/**
 * Of het welkom getoond moet worden (F47): bij de allereerste keer openen (nog niets opgeslagen, ook in een net
 * geïnstalleerde app op de iPhone) en daarna tot je hem sluit.
 */
export function welkomTonen(): boolean {
  try {
    const welkom = localStorage.getItem(WELKOM_KEY)
    if (welkom !== null) return welkom === 'open'
    if (BESTAANDE_GEGEVENS.some((key) => localStorage.getItem(key) !== null)) return false
    localStorage.setItem(WELKOM_KEY, 'open')
    return true
  } catch {
    return false
  }
}

/** Onthoudt dat het welkom gesloten is; daarna komt het niet meer terug. */
export function welkomGezien(): void {
  try {
    localStorage.setItem(WELKOM_KEY, 'gezien')
  } catch {
    // Geen opslag: dan staat het welkom er de volgende keer weer.
  }
}

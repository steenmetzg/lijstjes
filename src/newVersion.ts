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

// Herinneringen in de app (F36): bij het openen van de app een melding met de items die vandaag zijn of waarvan
// de datum voorbij is. Alleen de dag telt, niet de tijd.

import { dagSleutel, volgendeKeer, zichtbaar } from './agenda'
import { heeftDatum, heeftTijd, heeftZonderJaar, type Item, type Lijstje } from './lists'

export interface Due {
  lijstjeId: string
  lijstjeNaam: string
  item: Item & { wanneer: string }
  /** `true` als de dag voorbij is, `false` als het vandaag is. */
  voorbij: boolean
}

/**
 * Open (niet afgevinkte) items van lijstjes met het kenmerk Datum met een datum van vandaag of eerder, de oudste
 * eerst. `wanneer` is de datum zoals je hem ziet: zonder tijd als het kenmerk Tijd uit staat.
 */
export function dueItems(lijstjes: readonly Lijstje[], now: Date = new Date()): Due[] {
  const today = dagSleutel(now)
  const result: Due[] = []
  for (const l of lijstjes) {
    if (!heeftDatum(l)) continue
    const tijd = heeftTijd(l)
    const jaarlijks = heeftZonderJaar(l)
    for (const item of l.items) {
      if (item.af || !item.wanneer) continue
      // Zonder jaar: alleen op de dag zelf, elk jaar (F44).
      const moment = jaarlijks ? volgendeKeer(item.wanneer, now) : item.wanneer
      const day = moment.slice(0, 10)
      if (day > today) continue
      const wanneer = zichtbaar(moment, tijd)
      result.push({ lijstjeId: l.id, lijstjeNaam: l.naam, item: { ...item, wanneer }, voorbij: day < today })
    }
  }
  return result.sort((a, b) => a.item.wanneer.localeCompare(b.item.wanneer))
}

// Herinneringen in de app (F36): bij het openen van de app een melding met de items die vandaag zijn of waarvan
// de datum voorbij is. Alleen de dag telt, niet de tijd.

import { dagSleutel, zichtbaar } from './agenda'
import { heeftDatum, heeftTijd, type Item, type Lijstje } from './lists'

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
    for (const item of l.items) {
      if (item.af || !item.wanneer) continue
      const day = item.wanneer.slice(0, 10)
      if (day > today) continue
      const wanneer = zichtbaar(item.wanneer, tijd)
      result.push({ lijstjeId: l.id, lijstjeNaam: l.naam, item: { ...item, wanneer }, voorbij: day < today })
    }
  }
  return result.sort((a, b) => a.item.wanneer.localeCompare(b.item.wanneer))
}

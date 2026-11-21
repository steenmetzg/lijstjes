/**
 * De korte tekst bij de melding "Nieuwe versie geïnstalleerd" (F45), per versie, zoals in WoonWerk.
 *
 * Bij elke nieuwe versie komt hier een regel bij met de tekst die Greco kiest.
 * Geen tekst voor een versie (een lege tekst ''), dan toont de melding alleen de titel.
 *
 * Een icoon in de tekst zet je tussen blokhaken:
 *   [schuifjes]  de knop met schuifjes (naam en kenmerken van een lijstje)
 *   [kalender]   het kalendertje
 *   [klok]       het klokje
 *   [microfoon]  de microfoon
 *   [prullenbak] het prullenbakje
 */
export const RELEASE_TEKSTEN: Record<string, string> = {
  '1.7.5':
    'Een lijstje kan nu extra kenmerken hebben: Datum, Zonder jaar, Tijd, Notitie en Aantal. Zet ze aan met de knop [schuifjes] bovenaan het lijstje.',
}

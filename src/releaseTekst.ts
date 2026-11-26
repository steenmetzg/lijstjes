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
  '1.9.0':
    'Kies bij een lijstje met datums [schuifjes] Google, automatisch: items met een tijd komen dan vanzelf in Google Agenda, items zonder tijd in Google Tasks. Of kies Geen agenda.',
  '1.8.6': 'De naam van een lijstje mag nu 50 tekens lang zijn. De rondjes en knoppen op Mijn lijstjes staan dichter bij elkaar.',
  // Alleen de rondjes en knoppen op Mijn lijstjes netjes uitgelijnd: geen eigen tekst.
  '1.8.5': '',
  // Alleen het rode rondje even groot als het blauwe: geen eigen tekst.
  '1.8.4': '',
  '1.8.3':
    'Op Mijn lijstjes staat naast het blauwe rondje nu een rood rondje met het aantal verlopen items. Samen zijn ze het aantal open items.',
  '1.8.2':
    'In het opengeschoven kaartje van een item kun je het item nu ook afvinken met het rondje.',
  '1.8.1':
    'Op een lijstje met kenmerken schuift het kaartje van een item nu open in het lijstje zelf, ook voor een nieuw item. Elk veld heeft een kruisje om het leeg te maken.',
  '1.8.0':
    'Op een lijstje met kenmerken schuift het kaartje van een item nu open in het lijstje zelf, ook voor een nieuw item. Aantal en Notitie hebben een kruisje om het veld leeg te maken.',
  '1.7.12':
    'Alle of de afgevinkte items weggooien kun je nu 10 seconden ongedaan maken. Op een lijstje met kenmerken opent het invoervak meteen als je in de invoerregel tikt of de [microfoon] gebruikt.',
  // Zelfde tekst als 1.7.5: wie die versie oversloeg, ziet alleen de melding van de nieuwste (F45).
  '1.7.11':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
  '1.7.10':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
  '1.7.9':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
  '1.7.8':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
  '1.7.7':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
  '1.7.6':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
  '1.7.5':
    'Je kan nu zelf bepalen welke informatie je wilt bijhouden in een Lijstje. Kies voor Datum, Tijd, Datum zonder jaar, Aantal en Notities.',
}

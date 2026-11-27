import { ArrowLeft } from 'lucide-react'
import { speechSupported } from './speech'

interface Props {
  onClose: () => void
}

/** Informatiepagina met een korte uitleg van wat je met de app kunt (F21). */
export default function Info({ onClose }: Props) {
  return (
    <main className="app">
      <header className="settings-header">
        <button type="button" className="back-button" aria-label="Terug" onClick={onClose}>
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <h1>Over Lijstjes</h1>
      </header>

      <section className="setting info">
        <h2>Wat doet Lijstjes?</h2>
        <p>
          Lijstjes is een eenvoudige app voor al je lijstjes: boodschappen, klusjes, dingen om in te pakken of wat je
          maar wilt. Je zet items snel op een lijstje, vinkt ze af als ze klaar zijn, past ze aan of gooit ze weg. De
          volgorde van de items bepaal je zelf. Lijstjes werkt ook zonder internet en bewaart alles alleen op je
          telefoon.
        </p>
      </section>

      <section className="setting info">
        <h2>Mijn lijstjes</h2>
        <p>
          Je kunt zoveel lijstjes bijhouden als je wilt, elk met een eigen naam. Ook de volgorde van je lijstjes bepaal
          je zelf. Lijstjes onthoudt welk lijstje je het laatst gebruikte en opent dat meteen. Een lijstje gooi je weg
          op Mijn lijstjes. In een lijstje gooi je met één tik alle afgevinkte items weg, of alle items.
        </p>
      </section>

      <section className="setting info">
        <h2>Kenmerken</h2>
        <p>
          Je kan zelf bepalen welke informatie je wilt bijhouden in een lijstje. Kies voor Datum, Tijd, Datum zonder
          jaar, Aantal en Notities. Met een datum staan de items op datum, kun je ze in je agenda zetten en zie je bij
          het openen een herinnering als het zover is.
        </p>
      </section>

      {speechSupported() && (
        <section className="setting info">
          <h2>Inspreken</h2>
          <p>
            Je kunt de naam van nieuwe lijstjes inspreken. Je kunt in een lijstje ook items inspreken, meerdere
            tegelijk. Lijstjes maakt van alles wat tussen het woord "komma" staat een apart item, dus "melk komma brood
            komma twee pakken koffie" wordt drie items. Inspreken werkt alleen met internet.
          </p>
        </section>
      )}

      <section className="setting info">
        <h2>Instellingen</h2>
        {speechSupported() && <p>Zet de microfoon voor inspreken aan of uit.</p>}
        <p>Met een backup bewaar je al je lijstjes in een bestand en zet je ze terug, ook op een andere telefoon.</p>
        <p>
          Lijstjes telt anoniem hoe vaak de app wordt geïnstalleerd en geopend; wat je op je lijstjes zet, wordt nooit
          verstuurd, behalve naar Google als je bij een lijstje Google, automatisch kiest.
        </p>
      </section>

      <section className="setting info">
        <h2>Privacy</h2>
        <p>
          Lees wat Lijstjes met je gegevens doet in de{' '}
          <a href="./privacy.html" target="_blank" rel="noopener">
            privacyverklaring
          </a>
          .
        </p>
      </section>
    </main>
  )
}

// Het scherm "… synchroniseren of delen" (F34, F48, F50): drie hoofdkeuzes, met de agenda's onder Zelf per item.

import { useState, type ReactNode } from 'react'
import { CalendarPlus, RefreshCw, Smartphone } from 'lucide-react'
import { AGENDAS, GEEN, GOOGLE_AUTO, isAgenda, PER_ITEM, type Agenda, type AgendaKeuze } from './agenda'

type Hoofd = 'google' | 'zelf' | 'alleen'

interface Props {
  naam: string
  /** Wat het lijstje nu heeft; `undefined`: nog niets gekozen. */
  huidig: AgendaKeuze | undefined
  /** Google, automatisch: komen alle items met een datum in Google (F48)? */
  googleAlle: boolean
  /** Google, automatisch: staat het hele lijstje als eigen lijst in Google Tasks (F52)? */
  heel: boolean
  /** Heeft het lijstje het kenmerk Datum? Anders is er geen schakelaar Items met een datum. */
  datum: boolean
  ingelogd: boolean
  onInloggen: () => void
  onUitloggen: () => void
  onAnnuleren: () => void
  onBewaren: (keuze: AgendaKeuze, googleAlle: boolean, heel: boolean) => void
}

function hoofdVan(k: AgendaKeuze | undefined): Hoofd | null {
  if (k === GOOGLE_AUTO) return 'google'
  if (k === GEEN) return 'alleen'
  return k ? 'zelf' : null
}

export function SyncKeuze({
  naam,
  huidig,
  googleAlle: alleBegin,
  heel: heelBegin,
  datum,
  ingelogd,
  onInloggen,
  onUitloggen,
  onAnnuleren,
  onBewaren,
}: Props) {
  const [hoofd, setHoofd] = useState<Hoofd | null>(hoofdVan(huidig))
  const [agenda, setAgenda] = useState<Agenda | typeof PER_ITEM>(
    isAgenda(huidig) || huidig === PER_ITEM ? huidig : PER_ITEM,
  )
  const [alle, setAlle] = useState(alleBegin)
  const [heel, setHeel] = useState(heelBegin)

  function bewaren() {
    if (!hoofd) return
    onBewaren(hoofd === 'google' ? GOOGLE_AUTO : hoofd === 'alleen' ? GEEN : agenda, alle, heel)
  }

  const optie = (id: Hoofd, Icoon: typeof RefreshCw, titel: string, uitleg: string, sub?: ReactNode) => (
    <div className={hoofd === id ? 'sync-optie gekozen' : 'sync-optie'}>
      <label className="sync-kop">
        <input type="radio" name="sync" checked={hoofd === id} onChange={() => setHoofd(id)} aria-label={titel} />
        <span>
          <span className="sync-titel">
            <Icoon size={18} strokeWidth={2} aria-hidden />
            {titel}
          </span>
          <span className="sync-uitleg">{uitleg}</span>
        </span>
      </label>
      {hoofd === id && sub}
    </div>
  )

  return (
    <section className="confirm clear-choice agenda-choice sync-keuze" aria-label="Agenda kiezen">
      <strong>{naam} synchroniseren of delen</strong>
      <p>Waar wil je dit lijstje nog meer zien? Alles staat altijd in Lijstjes.</p>
      {optie(
        'google',
        RefreshCw,
        'Google, automatisch',
        'Lijstjes houdt het in Google bij als je iets wijzigt, afvinkt of weggooit.',
        <div className="sync-sub">
          {datum && (
            <>
              <label className="kenmerk">
                <span>Items met een datum</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="herinnering-switch"
                  aria-label="Items met een datum"
                  checked={alle}
                  onChange={(e) => setAlle(e.target.checked)}
                />
              </label>
              <p className="google-uitleg">
                {alle
                  ? 'Dit lijstje zet items met een tijd in jouw Google Agenda, en items zonder tijd in Google Tasks. Per item kan je dit uitzetten.'
                  : 'Uit: je kiest in het kaartje van elk item of het in Google komt.'}
              </p>
            </>
          )}
          <label className="kenmerk">
            <span>Het hele lijstje</span>
            <input
              type="checkbox"
              role="switch"
              className="herinnering-switch"
              aria-label="Het hele lijstje"
              checked={heel}
              onChange={(e) => setHeel(e.target.checked)}
            />
          </label>
          <p className="google-uitleg">
            {`Een eigen lijst "${naam}" in Google Tasks met alle items, ook zonder datum. Afvinken gaat beide kanten op.`}
          </p>
          <p className="google-uitleg">
            {ingelogd ? 'Ingelogd bij Google' : 'Niet ingelogd bij Google'}{' '}
            <button type="button" className="link-button" onClick={ingelogd ? onUitloggen : onInloggen}>
              {ingelogd ? 'Uitloggen' : 'Inloggen'}
            </button>
          </p>
        </div>,
      )}
      {optie(
        'zelf',
        CalendarPlus,
        'Zelf per item in je agenda',
        'In het kaartje van een item tik je op In agenda zetten. Lijstjes past het daarna niet meer aan.',
        <div className="sync-sub">
          <p className="sync-vraag">In welke agenda?</p>
          <div className="sync-agendas">
            {[...AGENDAS, { id: PER_ITEM, label: 'Elke keer vragen' }].map((a) => (
              <button
                key={a.id}
                type="button"
                className={agenda === a.id ? 'confirm-yes' : undefined}
                aria-pressed={agenda === a.id}
                onClick={() => setAgenda(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>,
      )}
      {optie('alleen', Smartphone, 'Alleen in Lijstjes', 'Niets in een agenda of andere app.')}
      <div className="confirm-buttons">
        <button type="button" className="cancel-half" onClick={onAnnuleren}>
          Annuleren
        </button>
        <button type="button" className="confirm-yes" disabled={!hoofd} onClick={bewaren}>
          Bewaren
        </button>
      </div>
    </section>
  )
}

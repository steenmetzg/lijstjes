// Het scherm "… synchroniseren of delen" (F34, F48, F50): drie hoofdkeuzes, met de agenda's onder Zelf per item.

import { useState, type ComponentType, type ReactNode } from 'react'
import { CalendarPlus, RefreshCw } from 'lucide-react'
import { AGENDAS, GEEN, GOOGLE_AUTO, isAgenda, PER_ITEM, type Agenda, type AgendaKeuze } from './agenda'

type Hoofd = 'google' | 'zelf' | 'alleen'

/** Het icoon van Lijstjes, open: een afgeronde rand met het lijstje met vinkjes erin, in lijnen (F51). */
function LijstjesIcoon({
  size = 18,
  strokeWidth = 2,
}: {
  size?: number
  strokeWidth?: number
  'aria-hidden'?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <g transform="translate(5.6 5.6) scale(0.53)" strokeWidth={strokeWidth / 0.53}>
        <path d="M13 5h8M13 12h8M13 19h8m-18-2 2 2 4-4M3 7l2 2 4-4" />
      </g>
    </svg>
  )
}

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

  // Een schakelaar links, met de naam en de uitleg ernaast (F51).
  const schakelaar = (titel: string, aan: boolean, zet: (aan: boolean) => void, uitleg: string) => (
    <label className="sync-schakelaar">
      <span className="sync-schakelaar-kop">
        <input
          type="checkbox"
          role="switch"
          className="herinnering-switch"
          aria-label={titel}
          checked={aan}
          onChange={(e) => zet(e.target.checked)}
        />
        <span className="sync-schakelaar-naam">{titel}</span>
      </span>
      <span className="sync-uitleg">{uitleg}</span>
    </label>
  )

  const optie = (
    id: Hoofd,
    Icoon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>,
    titel: string,
    uitleg: string,
    sub?: ReactNode,
  ) => (
    <div className={hoofd === id ? 'sync-optie gekozen' : 'sync-optie'}>
      <label className="sync-kop">
        <span className="sync-titel">
          <input type="radio" name="sync" checked={hoofd === id} onChange={() => setHoofd(id)} aria-label={titel} />
          <Icoon size={18} strokeWidth={2} aria-hidden />
          {titel}
        </span>
        <span className="sync-uitleg">{uitleg}</span>
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
          {datum &&
            schakelaar(
              'Items met een datum',
              alle,
              setAlle,
              alle
                ? 'Dit lijstje zet items met een tijd in Google Agenda, zonder tijd in Google Tasks, en zonder jaar elk jaar in Google Agenda. Per item kan je dit uitzetten.'
                : 'Uit: je kiest in het kaartje van elk item of het in Google komt.',
            )}
          {schakelaar(
            'Het hele lijstje',
            heel,
            setHeel,
            `Dit lijstje wordt in z'n geheel als "${naam}" in Google Tasks gezet. De lijstjes worden gelijk gehouden.`,
          )}
          <p className="google-uitleg sync-inlog">
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
      {optie('alleen', LijstjesIcoon, 'Alleen in Lijstjes', 'Niets in een agenda of andere app.')}
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

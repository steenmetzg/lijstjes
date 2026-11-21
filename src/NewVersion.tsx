import { CalendarDays, Clock, Mic, SlidersHorizontal, Trash2, X, type LucideIcon } from 'lucide-react'
import { RELEASE_TEKSTEN } from './releaseTekst'

// De iconen die in een releasetekst tussen blokhaken mogen staan (zie releaseTekst.ts).
const ICONEN: Record<string, { Icon: LucideIcon; naam: string }> = {
  schuifjes: { Icon: SlidersHorizontal, naam: 'schuifjes' },
  kalender: { Icon: CalendarDays, naam: 'kalendertje' },
  klok: { Icon: Clock, naam: 'klokje' },
  microfoon: { Icon: Mic, naam: 'microfoon' },
  prullenbak: { Icon: Trash2, naam: 'prullenbakje' },
}

/** Zet "[schuifjes]" in de tekst om in het icoon zelf. */
function metIconen(tekst: string) {
  return tekst.split(/(\[[a-z]+\])/).map((deel, i) => {
    const icoon = ICONEN[deel.slice(1, -1)]
    if (!deel.startsWith('[') || !icoon) return deel
    const { Icon, naam } = icoon
    return (
      <span key={i} className="inline-icon" role="img" aria-label={naam}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
    )
  })
}

/** Melding na het bijwerken van de app (F45): titel met het versienummer en de tekst van die versie. */
export default function NewVersion({ version, onClose }: { version: string; onClose: () => void }) {
  const tekst = RELEASE_TEKSTEN[version]
  return (
    <section className="voice new-version" aria-label="Nieuwe versie">
      <div className="new-version-body">
        <strong>Nieuwe versie geïnstalleerd (v{version})</strong>
        {tekst && <p>{metIconen(tekst)}</p>}
      </div>
      <button type="button" className="voice-close" aria-label="Melding nieuwe versie sluiten" onClick={onClose}>
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </section>
  )
}

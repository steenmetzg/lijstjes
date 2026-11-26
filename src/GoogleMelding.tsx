import { X } from 'lucide-react'

/**
 * Melding onderaan als Google wil dat je (opnieuw) inlogt, zodat Lijstjes je items daar kan bijwerken (F49).
 * Opgemaakt als de melding van een nieuwe versie.
 */
export default function GoogleMelding({
  ingelogd,
  onInloggen,
  onClose,
}: {
  ingelogd: boolean
  onInloggen: () => void
  onClose: () => void
}) {
  return (
    <section className="voice new-version" aria-label="Google bijwerken">
      <div className="new-version-body">
        <strong>Google bijwerken</strong>
        <p>
          {ingelogd
            ? 'Log opnieuw in bij Google, zodat Lijstjes je items daar kan bijwerken.'
            : 'Log in bij Google, zodat Lijstjes je items in Google Agenda en Google Tasks kan zetten.'}{' '}
          <button type="button" className="link-button" onClick={onInloggen}>
            Inloggen
          </button>
        </p>
      </div>
      <button type="button" className="voice-close" aria-label="Melding Google sluiten" onClick={onClose}>
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </section>
  )
}

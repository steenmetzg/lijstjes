// Houdt Google Agenda en Google Tasks gelijk met de lijstjes (F48, F49): kort na elke wijziging, bij het openen en
// als je terugkomt in de app of weer internet hebt.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GOOGLE_AUTO } from './agenda'
import {
  bijwerken,
  doelen,
  googleClientId,
  GoogleFout,
  isIngelogd,
  laadGoogle,
  loadOpslag,
  loadToken,
  plan,
  saveOpslag,
  uitloggen as googleUitloggen,
  vergeetToken,
  vraagToegang,
  type GoogleOpslag,
} from './google'
import type { Lijstje } from './lists'

/** Zo lang na een wijziging wacht de app, zodat snel achter elkaar wijzigen één keer bijwerken is. */
const WACHT_MS = 1500

export interface GoogleStaat {
  /** Is Google, automatisch in deze versie ingesteld (een Client-ID)? */
  beschikbaar: boolean
  ingelogd: boolean
  /** Er staan wijzigingen klaar, maar Google wil dat je (opnieuw) inlogt (F49). */
  inloggenNodig: boolean
  opslag: GoogleOpslag
  /** Inloggen; aanroepen direct bij een tik. `true` als het gelukt is. */
  inloggen: () => Promise<boolean>
  uitloggen: () => void
  /** Bij een tik op een lijstje met Google, automatisch: is de toegang verlopen, dan meteen opnieuw vragen. */
  bijTik: () => void
}

export function useGoogle(lijstjes: readonly Lijstje[]): GoogleStaat {
  const [opslag, setOpslag] = useState<GoogleOpslag>(loadOpslag)
  const [ingelogd, setIngelogd] = useState(isIngelogd)
  const [inloggenNodig, setInloggenNodig] = useState(false)
  const [ronde, setRonde] = useState(0)
  const bezig = useRef(false)
  const opnieuw = useRef(false)
  const actueel = useRef({ lijstjes, opslag })
  useEffect(() => {
    actueel.current = { lijstjes, opslag }
  }, [lijstjes, opslag])
  const gebruikt = lijstjes.some((l) => l.agenda === GOOGLE_AUTO) || Object.keys(opslag).length > 0

  // Het script van Google vooraf laden, zodat inloggen bij een tik meteen het venster kan openen.
  useEffect(() => {
    if (gebruikt && googleClientId()) laadGoogle().catch(() => {})
  }, [gebruikt])

  const verwerk = useCallback(async () => {
    if (bezig.current) {
      opnieuw.current = true
      return
    }
    const { lijstjes: l, opslag: o } = actueel.current
    if (plan(doelen(l), o).length === 0) {
      setInloggenNodig(false)
      return
    }
    const token = loadToken()
    if (!token) {
      setInloggenNodig(true)
      return
    }
    bezig.current = true
    try {
      await bijwerken(token, l, o, (nieuw) => {
        saveOpslag(nieuw)
        actueel.current.opslag = nieuw
        setOpslag(nieuw)
      })
      setInloggenNodig(false)
    } catch (e) {
      if (e instanceof GoogleFout && (e.status === 401 || e.status === 403)) {
        vergeetToken()
        setInloggenNodig(true)
      }
      // Andere fouten (geen internet): de volgende keer opnieuw.
    } finally {
      bezig.current = false
      if (opnieuw.current) {
        opnieuw.current = false
        setRonde((r) => r + 1)
      }
    }
  }, [])

  useEffect(() => {
    if (!gebruikt) return
    const timer = setTimeout(() => void verwerk(), WACHT_MS)
    return () => clearTimeout(timer)
  }, [lijstjes, gebruikt, ronde, verwerk])

  useEffect(() => {
    const nogEens = () => {
      if (document.visibilityState === 'visible') setRonde((r) => r + 1)
    }
    document.addEventListener('visibilitychange', nogEens)
    window.addEventListener('online', nogEens)
    return () => {
      document.removeEventListener('visibilitychange', nogEens)
      window.removeEventListener('online', nogEens)
    }
  }, [])

  const inloggen = useCallback(async () => {
    try {
      await vraagToegang(isIngelogd())
      setIngelogd(true)
      setInloggenNodig(false)
      setRonde((r) => r + 1)
      return true
    } catch {
      return false
    }
  }, [])

  const uitloggen = useCallback(() => {
    googleUitloggen()
    setIngelogd(false)
  }, [])

  const bijTik = useCallback(() => {
    if (ingelogd && googleClientId() && !loadToken()) void inloggen()
  }, [ingelogd, inloggen])

  return {
    beschikbaar: googleClientId() !== '',
    ingelogd,
    inloggenNodig: inloggenNodig && gebruikt,
    opslag,
    inloggen,
    uitloggen,
    bijTik,
  }
}

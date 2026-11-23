import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  deelTekst,
  formatWanneer,
  googleUrl,
  icsBestand,
  isVoorbij,
  leesDatum,
  leesTijd,
  opDatum,
  outlookUrl,
  volgendeKeer,
} from './agenda'
import { createBackup, parseBackup } from './backup'
import {
  HERINNERINGEN_KEY,
  KENMERKEN_KEY,
  LISTS_KEY,
  loadLijstjes,
  parseLijstjes,
  splitAantal,
  type Lijstje,
} from './lists'
import { itemButton, itemTexts, list, storeLists, typeItem } from './test/helpers'

vi.mock('./folderStore', () => ({
  loadStoredFolder: async () => null,
  storeFolder: async () => {},
}))

// "Nu" is zaterdag 7 november 2026, 10:00; alleen de klok, zodat userEvent gewoon werkt.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 7, 10, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

type User = ReturnType<typeof userEvent.setup>

/**
 * Een herinneringslijstje "Afspraken" zoals versie 1.6 het bewaarde: de datums apart onder lijstjes-herinneringen.
 * Versie 1.7 maakt er een lijstje met de kenmerken Datum en Tijd van.
 */
function storeAfspraken(items: Record<string, { wanneer?: string; inAgenda?: string }>, agenda?: string, uit = false) {
  storeLists([list('h', 'Afspraken', ['Tandarts', 'Anne bellen', 'APK']), list('a', 'AH', ['melk'])], 'h')
  const byText: Record<string, string> = { Tandarts: 'h-0', 'Anne bellen': 'h-1', APK: 'h-2' }
  localStorage.setItem(
    HERINNERINGEN_KEY,
    JSON.stringify({
      lijstjes: { h: { ...(agenda && { agenda }), ...(uit && { uit: true }) } },
      items: Object.fromEntries(Object.entries(items).map(([t, v]) => [byText[t], v])),
    }),
  )
}

/** Opent het vak met de kenmerken van een item door op de tekst te tikken. */
async function openDetails(user: User, tekst: string): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: `${tekst} aanpassen` }))
  return screen.getByRole('region', { name: `Details van ${tekst}` })
}

/** Vult datum (en tijd) in het vak van een item in en bewaart. */
async function setDate(user: User, tekst: string, datum: string, tijd?: string) {
  const box = await openDetails(user, tekst)
  // Getypt als dag-maand-jaar.
  const getypt = datum ? datum.split('-').reverse().join('-') : ''
  fireEvent.change(within(box).getByLabelText('Datum'), { target: { value: getypt } })
  if (tijd !== undefined) fireEvent.change(within(box).getByLabelText('Tijd'), { target: { value: tijd } })
  await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
}

/** Opent het vak met naam en kenmerken van het lijstje en zet de genoemde kenmerken aan of uit. */
async function kenmerken(user: User, naam: string, wissel: string[]) {
  await user.click(screen.getByRole('button', { name: `Naam en kenmerken van ${naam}` }))
  const box = screen.getByRole('region', { name: 'Lijstje aanpassen' })
  for (const k of wissel) await user.click(within(box).getByRole('switch', { name: k }))
  await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
}

describe('AC25: kenmerken kiezen', () => {
  it('een nieuw lijstje is gewoon; met de schuifjesknop kies je Datum, Tijd, Notitie en Aantal', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Geen belletje meer bij Nieuw lijstje.
    expect(screen.queryByRole('button', { name: 'Herinneringslijstje' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Naam van het nieuwe lijstje' }), 'Klussen{Enter}')
    await typeItem(user, 'schuur opruimen')
    // Zonder kenmerken: tikken op de tekst past hem aan in de regel zelf (F27).
    await user.click(screen.getByRole('button', { name: 'schuur opruimen aanpassen' }))
    expect(screen.getByRole('textbox', { name: 'Item aanpassen' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Klussen' }))
    const box = screen.getByRole('region', { name: 'Lijstje aanpassen' })
    const switches = within(box).getAllByRole('switch')
    expect(switches.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Aantal',
      'Datum',
      'Zonder jaar',
      'Tijd',
      'Notitie',
    ])
    expect(switches.every((s) => !(s as HTMLInputElement).checked)).toBe(true)
    // Tijd hoort bij een datum.
    expect(within(box).getByRole('switch', { name: 'Tijd' })).toBeDisabled()
    expect(within(box).getByRole('switch', { name: 'Zonder jaar' })).toBeDisabled()
    await user.click(within(box).getByRole('switch', { name: 'Datum' }))
    expect(within(box).getByRole('switch', { name: 'Tijd' })).toBeEnabled()
    expect(within(box).getByRole('switch', { name: 'Zonder jaar' })).toBeEnabled()
    await user.click(within(box).getByRole('switch', { name: 'Notitie' }))
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(screen.queryByRole('region', { name: 'Lijstje aanpassen' })).not.toBeInTheDocument()

    // Met kenmerken: tikken op het item opent het vak met de velden die aan staan.
    const details = await openDetails(user, 'schuur opruimen')
    expect(within(details).getByLabelText('Tekst')).toHaveValue('schuur opruimen')
    expect(within(details).getByLabelText('Datum')).toBeInTheDocument()
    expect(within(details).getByLabelText('Notitie')).toBeInTheDocument()
    expect(within(details).queryByLabelText('Tijd')).not.toBeInTheDocument()
    expect(within(details).queryByLabelText('Aantal')).not.toBeInTheDocument()
    await user.click(within(details).getByRole('button', { name: 'Annuleren' }))

    const saved = JSON.parse(localStorage.getItem(KENMERKEN_KEY)!)
    const id = JSON.parse(localStorage.getItem(LISTS_KEY)!)[1].id
    expect(saved.lijstjes[id]).toEqual({ kenmerken: { datum: true, notitie: true } })
    // Versie 1.6 ziet een lijstje met Datum als herinneringslijstje.
    expect(JSON.parse(localStorage.getItem(HERINNERINGEN_KEY)!).lijstjes[id]).toEqual({})
  })
})

describe('AC26: datum en tijd', () => {
  it('toont de datum onder het item, sorteert op datum en kleurt een voorbije datum rood', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30' } })
    const user = userEvent.setup()
    render(<App />)
    expect(itemTexts()).toEqual(['Tandarts', 'Anne bellen', 'APK'])
    // Op datum: geen greep om te verplaatsen.
    expect(screen.queryByRole('button', { name: 'APK verplaatsen' })).not.toBeInTheDocument()
    await setDate(user, 'APK', '2026-11-08', '14:00')
    expect(screen.getByText('zo 8 nov 14:00')).toBeInTheDocument()
    expect(screen.getByText('do 12 nov 09:30')).toBeInTheDocument()
    expect(itemTexts()).toEqual(['APK', 'Tandarts', 'Anne bellen'])
    await setDate(user, 'Anne bellen', '2026-11-06', '19:00')
    expect(itemTexts()).toEqual(['Anne bellen', 'APK', 'Tandarts'])
    const items = screen.getByRole('list', { name: 'Items op Afspraken' })
    expect(within(items).getByText('vr 6 nov 19:00')).toHaveClass('past')
    expect(screen.getByText('zo 8 nov 14:00')).not.toHaveClass('past')
    // Datum weghalen: geen datumregel meer, onderaan.
    await setDate(user, 'Anne bellen', '')
    expect(itemTexts()).toEqual(['APK', 'Tandarts', 'Anne bellen'])
    expect(screen.queryByText('vr 6 nov 19:00')).not.toBeInTheDocument()
  })

  it('zonder Tijd alleen een datum; vandaag is niet voorbij', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'Klussen', ['schuur', 'heg'])], 'a')
    render(<App />)
    await kenmerken(user, 'Klussen', ['Datum'])
    await setDate(user, 'heg', '2026-11-07')
    await setDate(user, 'schuur', '2026-11-06')
    expect(itemTexts()).toEqual(['schuur', 'heg'])
    const items = screen.getByRole('list', { name: 'Items op Klussen' })
    expect(within(items).getByText('za 7 nov')).not.toHaveClass('past')
    expect(within(items).getByText('vr 6 nov')).toHaveClass('past')
  })

  it('formatteert datum en tijd in het Nederlands, met het jaar als dat anders is', () => {
    const now = new Date(2026, 10, 7)
    expect(formatWanneer('2026-11-08T14:00', now)).toBe('zo 8 nov 14:00')
    expect(formatWanneer('2026-11-08', now)).toBe('zo 8 nov')
    expect(formatWanneer('2027-01-01T09:05', now)).toBe('vr 1 jan 2027 09:05')
    expect(isVoorbij('2026-11-07', new Date(2026, 10, 7, 23, 0))).toBe(false)
  })

  it('het kaartje van het item schuift open in het lijstje zelf, en het lijstje scrolt gewoon (vanaf 1.8)', async () => {
    storeAfspraken({})
    const user = userEvent.setup()
    render(<App />)
    const box = await openDetails(user, 'APK')
    const rij = box.closest('li')
    expect(rij).toHaveClass('item', 'open')
    expect(screen.getByRole('list', { name: 'Items op Afspraken' })).toContainElement(box)
    expect(document.querySelector('.list-header')).not.toContainElement(box)
    expect(document.documentElement).not.toHaveClass('vak-open')
    await user.click(within(box).getByRole('button', { name: 'Annuleren' }))
    expect(box).not.toBeInTheDocument()
    expect(itemTexts()).toContain('APK')
  })

  it('leest een getypte datum en tijd', () => {
    const now = new Date(2026, 10, 7)
    expect(leesDatum('25-11-2026', now)).toBe('2026-11-25')
    expect(leesDatum('25/11/26', now)).toBe('2026-11-25')
    expect(leesDatum('5.1.2027', now)).toBe('2027-01-05')
    expect(leesDatum('25 11', now)).toBe('2026-11-25')
    expect(leesDatum('2511', now)).toBe('2026-11-25')
    expect(leesDatum('25112026', now)).toBe('2026-11-25')
    expect(leesDatum('', now)).toBe('')
    expect(leesDatum('31-02-2026', now)).toBeNull()
    expect(leesDatum('morgen', now)).toBeNull()
    expect(leesTijd('9:30')).toBe('09:30')
    expect(leesTijd('9.30')).toBe('09:30')
    expect(leesTijd('930')).toBe('09:30')
    expect(leesTijd('1415')).toBe('14:15')
    expect(leesTijd('9')).toBe('09:00')
    expect(leesTijd('25:00')).toBeNull()
  })

  it('typen in het datumveld werkt, met een melding bij een onbekende datum', async () => {
    storeAfspraken({})
    const user = userEvent.setup()
    render(<App />)
    const box = await openDetails(user, 'APK')
    expect(within(box).getByRole('button', { name: 'Datum kiezen' })).toBeInTheDocument()
    await user.type(within(box).getByLabelText('Datum'), '2011')
    await user.type(within(box).getByLabelText('Tijd'), '830')
    // Bij het verlaten van het veld wordt het netjes geschreven.
    expect(within(box).getByLabelText('Datum')).toHaveValue('20-11-2026')
    await user.click(within(box).getByLabelText('Tekst'))
    expect(within(box).getByLabelText('Tijd')).toHaveValue('08:30')
    await user.clear(within(box).getByLabelText('Datum'))
    await user.type(within(box).getByLabelText('Datum'), '32-11')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(screen.getByRole('status')).toHaveTextContent('Die datum ken ik niet.')
    expect(screen.getByRole('region', { name: 'Details van APK' })).toBeInTheDocument()
    await user.clear(within(box).getByLabelText('Datum'))
    await user.type(within(box).getByLabelText('Datum'), '20-11{Enter}')
    expect(screen.getByText('vr 20 nov 08:30')).toBeInTheDocument()
  })

  it('zet items met datum op volgorde en items zonder datum onderaan', () => {
    const items = [
      { id: 'a' },
      { id: 'b', wanneer: '2026-12-01T10:00' },
      { id: 'c' },
      { id: 'd', wanneer: '2026-11-20' },
    ]
    expect(opDatum(items).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c'])
  })
})

describe('AC27: in de agenda zetten', () => {
  it('vraagt de eerste keer welke agenda, onthoudt die per lijstje en opent hem daarna meteen', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30' } })
    const user = userEvent.setup()
    render(<App />)
    // Zonder datum kan het item niet in de agenda.
    let box = await openDetails(user, 'APK')
    expect(within(box).getByRole('button', { name: 'In agenda zetten' })).toBeDisabled()
    await user.click(within(box).getByRole('button', { name: 'Annuleren' }))
    expect(screen.queryByRole('region', { name: 'Details van APK' })).not.toBeInTheDocument()

    box = await openDetails(user, 'Tandarts')
    expect(within(box).getByLabelText('Datum')).toHaveValue('12-11-2026')
    expect(within(box).getByLabelText('Tijd')).toHaveValue('09:30')
    await user.click(within(box).getByRole('button', { name: 'In agenda zetten' }))
    const choice = screen.getByRole('region', { name: 'Agenda kiezen' })
    expect(within(choice).getByText('In welke agenda?')).toBeInTheDocument()
    expect(
      within(choice)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Google Agenda', 'Outlook (privé)', 'Outlook (werk)', 'Andere agenda', 'Delen…', 'Annuleren'])
    await user.click(within(choice).getByRole('button', { name: 'Google Agenda' }))
    expect(open).toHaveBeenCalledTimes(1)
    const url = new URL(open.mock.calls[0][0])
    expect(url.hostname).toBe('calendar.google.com')
    expect(url.searchParams.get('text')).toBe('Tandarts')
    expect(url.searchParams.get('dates')).toBe('20261112T093000/20261112T100000')
    // Het item staat nu in de agenda: een vinkje-agenda achter de datum.
    expect(await screen.findByLabelText('staat in je agenda')).toBeInTheDocument()

    // Nog eens: het vak zegt dat het er al in staat, en met dezelfde datum kan het er niet nog eens in.
    box = await openDetails(user, 'Tandarts')
    expect(within(box).getByText('Staat al in je agenda op do 12 nov 09:30.')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'In agenda zetten' })).toBeDisabled()
    await user.click(within(box).getByRole('button', { name: 'Annuleren' }))

    // Volgende item: geen keuze meer, meteen naar Google Agenda.
    box = await openDetails(user, 'APK')
    fireEvent.change(within(box).getByLabelText('Datum'), { target: { value: '20-11-2026' } })
    fireEvent.change(within(box).getByLabelText('Tijd'), { target: { value: '08:00' } })
    await user.click(within(box).getByRole('button', { name: 'In agenda zetten' }))
    expect(screen.queryByRole('region', { name: 'Agenda kiezen' })).not.toBeInTheDocument()
    expect(open).toHaveBeenCalledTimes(2)
    expect(new URL(open.mock.calls[1][0]).searchParams.get('text')).toBe('APK')
    expect(screen.getByText('vr 20 nov 08:00')).toBeInTheDocument()

    // Via de schuifjesknop kies je een andere agenda voor het lijstje.
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    expect(screen.getByText(/Agenda: Google Agenda/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    const change = screen.getByRole('region', { name: 'Agenda kiezen' })
    expect(within(change).getByText('Agenda voor Afspraken')).toBeInTheDocument()
    expect(within(change).getByRole('button', { name: 'Google Agenda' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(change).getByRole('button', { name: 'Outlook (werk)' }))
    expect(open).toHaveBeenCalledTimes(2)
    box = await openDetails(user, 'Anne bellen')
    fireEvent.change(within(box).getByLabelText('Datum'), { target: { value: '21-11-2026' } })
    await user.click(within(box).getByRole('button', { name: 'In agenda zetten' }))
    expect(new URL(open.mock.calls[2][0]).hostname).toBe('outlook.office.com')
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('outlook-werk')
    expect(JSON.parse(localStorage.getItem(HERINNERINGEN_KEY)!).lijstjes.h.agenda).toBe('outlook-werk')
  })

  it('zonder Tijd wordt het een agenda-item voor de hele dag', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const user = userEvent.setup()
    storeLists([list('a', 'Klussen', ['heg knippen'])], 'a')
    render(<App />)
    await kenmerken(user, 'Klussen', ['Datum'])
    const box = await openDetails(user, 'heg knippen')
    fireEvent.change(within(box).getByLabelText('Datum'), { target: { value: '20-11-2026' } })
    await user.click(within(box).getByRole('button', { name: 'In agenda zetten' }))
    await user.click(screen.getByRole('button', { name: 'Google Agenda' }))
    expect(new URL(open.mock.calls[0][0]).searchParams.get('dates')).toBe('20261120/20261121')
    expect(await screen.findByLabelText('staat in je agenda')).toBeInTheDocument()
  })

  it('maakt goede links en een agenda-bestand', () => {
    const a = { id: 'x', titel: 'Tandarts, controle', lijstje: 'Afspraken', wanneer: '2026-11-12T09:30' }
    const google = new URL(googleUrl(a))
    expect(google.searchParams.get('details')).toBe('Uit Lijstjes: Afspraken')
    const prive = new URL(outlookUrl(a, false))
    expect(prive.hostname).toBe('outlook.live.com')
    expect(prive.searchParams.get('subject')).toBe('Tandarts, controle')
    expect(prive.searchParams.get('startdt')).toBe(new Date(2026, 10, 12, 9, 30).toISOString())
    expect(prive.searchParams.get('enddt')).toBe(new Date(2026, 10, 12, 10, 0).toISOString())
    expect(new URL(outlookUrl(a, true)).hostname).toBe('outlook.office.com')
    const ics = icsBestand(a, new Date(Date.UTC(2026, 10, 7, 9, 0)))
    expect(ics).toContain('SUMMARY:Tandarts\\, controle')
    expect(ics).toContain(
      `DTSTART:${new Date(2026, 10, 12, 9, 30).toISOString().replace(/[-:]/g, '').replace('.000', '')}`,
    )
    // Zonder tijd: de hele dag.
    const dag = { ...a, wanneer: '2026-11-12' }
    expect(new URL(outlookUrl(dag, false)).searchParams.get('allday')).toBe('true')
    expect(new URL(outlookUrl(dag, false)).searchParams.get('startdt')).toBe('2026-11-12')
    expect(icsBestand(dag)).toContain('DTSTART;VALUE=DATE:20261112')
    expect(icsBestand(dag)).toContain('DTEND;VALUE=DATE:20261113')
  })
})

describe('AC28: datum wijzigen van een item in de agenda', () => {
  it('waarschuwt dat het oude agenda-item blijft staan', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30', inAgenda: '2026-11-12T09:30' } }, 'google')
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByLabelText('staat in je agenda')).toBeInTheDocument()
    await setDate(user, 'Tandarts', '2026-11-13', '09:30')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tandarts staat nog met de oude datum en tijd in je agenda. Verwijder dat agenda-item zelf.',
    )
    expect(screen.queryByLabelText('staat in je agenda')).not.toBeInTheDocument()
  })

  it('waarschuwt niet bij een item dat niet in de agenda staat, of als alleen de notitie verandert', async () => {
    storeAfspraken({
      Tandarts: { wanneer: '2026-11-12T09:30' },
      APK: { wanneer: '2026-11-20T08:00', inAgenda: '2026-11-20T08:00' },
    })
    const user = userEvent.setup()
    render(<App />)
    await setDate(user, 'Tandarts', '2026-11-13', '09:30')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const box = await openDetails(user, 'APK')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('staat in je agenda')).toBeInTheDocument()
  })
})

describe('AC30: herinneringen in de app', () => {
  it('toont bij het openen de items van vandaag en eerder, niet afgevinkte, de oudste eerst', async () => {
    storeAfspraken({
      Tandarts: { wanneer: '2026-11-07T16:00' },
      'Anne bellen': { wanneer: '2026-11-05T09:00' },
      APK: { wanneer: '2026-11-08T08:00' },
    })
    const user = userEvent.setup()
    render(<App />)
    const box = screen.getByRole('region', { name: 'Herinneringen' })
    const lines = within(box)
      .getAllByRole('button')
      .filter((b) => b.classList.contains('reminder'))
    expect(lines.map((b) => b.textContent)).toEqual([
      'do 5 nov 09:00 Anne bellen (Afspraken)',
      'Vandaag 16:00 Tandarts (Afspraken)',
    ])
    expect(lines[0]).toHaveClass('past')
    expect(lines[1]).not.toHaveClass('past')
    await user.click(within(box).getByRole('button', { name: 'Tandarts afvinken' }))
    expect(within(box).queryByText('Tandarts')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tandarts' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Anne bellen' }))
    expect(screen.queryByRole('region', { name: 'Herinneringen' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anne bellen' }))
    const again = screen.getByRole('region', { name: 'Herinneringen' })
    await user.click(within(again).getByRole('button', { name: 'Herinneringen sluiten' }))
    expect(screen.queryByRole('region', { name: 'Herinneringen' })).not.toBeInTheDocument()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    fireEvent(document, new Event('visibilitychange'))
    expect(await screen.findByRole('region', { name: 'Herinneringen' })).toBeInTheDocument()
  })

  it('zonder Tijd staat er alleen "Vandaag"; een lijstje zonder Datum telt niet mee', async () => {
    storeLists([list('a', 'Klussen', ['heg'])], 'a')
    localStorage.setItem(
      KENMERKEN_KEY,
      JSON.stringify({
        lijstjes: { a: { kenmerken: { datum: true } } },
        items: { 'a-0': { wanneer: '2026-11-07T08:00' } },
      }),
    )
    const { unmount } = render(<App />)
    const lines = within(screen.getByRole('region', { name: 'Herinneringen' }))
      .getAllByRole('button')
      .filter((b) => b.classList.contains('reminder'))
    expect(lines.map((b) => b.textContent)).toEqual(['Vandaag heg (Klussen)'])
    unmount()
    localStorage.setItem(
      KENMERKEN_KEY,
      JSON.stringify({ lijstjes: { a: { kenmerken: {} } }, items: { 'a-0': { wanneer: '2026-11-07' } } }),
    )
    render(<App />)
    expect(screen.queryByRole('region', { name: 'Herinneringen' })).not.toBeInTheDocument()
  })

  it('opent het lijstje als je op een herinnering tikt, ook vanaf Mijn lijstjes', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-07T16:00' } })
    localStorage.removeItem('lijstjes-huidig')
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Mijn lijstjes' })).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('region', { name: 'Herinneringen' })).getByRole('button', { name: /^Vandaag/ }),
    )
    expect(screen.getByRole('heading', { name: 'Afspraken' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Herinneringen' })).not.toBeInTheDocument()
  })

  it('toont niets zonder items van vandaag of eerder', () => {
    storeAfspraken({ APK: { wanneer: '2026-11-08T08:00' } })
    render(<App />)
    expect(screen.queryByRole('region', { name: 'Herinneringen' })).not.toBeInTheDocument()
  })
})

describe('AC31: datum weghalen met het kruisje', () => {
  it('maakt datum en tijd leeg; Bewaren haalt de datum weg', async () => {
    storeAfspraken({ APK: { wanneer: '2026-11-20T08:00' } })
    const user = userEvent.setup()
    render(<App />)
    const box = await openDetails(user, 'APK')
    await user.click(within(box).getByRole('button', { name: 'Datum en tijd weghalen' }))
    expect(within(box).getByLabelText('Datum')).toHaveValue('')
    expect(within(box).getByLabelText('Tijd')).toHaveValue('')
    expect(within(box).getByLabelText('Tijd')).toBeDisabled()
    expect(within(box).getByRole('button', { name: 'Datum en tijd weghalen' })).toBeDisabled()
    expect(within(box).getByRole('button', { name: 'In agenda zetten' })).toBeDisabled()
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(screen.queryByText('vr 20 nov 08:00')).not.toBeInTheDocument()
  })
})

describe('AC29: terug naar een oudere versie kan', () => {
  it('bewaart de lijstjes zoals versie 1.3 ze kent, de herinneringen zoals 1.6 ze kent en de kenmerken apart', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30', inAgenda: '2026-11-12T09:30' } }, 'google')
    const user = userEvent.setup()
    render(<App />)
    await typeItem(user, 'kapper')
    const saved = JSON.parse(localStorage.getItem(LISTS_KEY)!)
    for (const l of saved) {
      expect(Object.keys(l).sort()).toEqual(['id', 'items', 'naam'])
      for (const i of l.items) expect(Object.keys(i).sort()).toEqual(['af', 'id', 'tekst'])
    }
    expect(JSON.parse(localStorage.getItem(HERINNERINGEN_KEY)!)).toEqual({
      lijstjes: { h: { agenda: 'google' } },
      items: { 'h-0': { wanneer: '2026-11-12T09:30', inAgenda: '2026-11-12T09:30' } },
    })
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!)).toEqual({
      lijstjes: { h: { kenmerken: { datum: true, tijd: true }, agenda: 'google' }, a: { kenmerken: {} } },
      items: { 'h-0': { wanneer: '2026-11-12T09:30', inAgenda: '2026-11-12T09:30' } },
    })
  })

  it('zet de datums terug als een oudere versie de lijstjes intussen heeft gewijzigd', () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30' }, APK: { wanneer: '2026-11-20T08:00' } })
    storeLists([
      {
        id: 'h',
        naam: 'Afspraken',
        items: [
          { id: 'h-0', tekst: 'Tandarts', af: false },
          { id: 'n', tekst: 'kapper', af: false },
        ],
      },
    ])
    localStorage.setItem(
      KENMERKEN_KEY,
      JSON.stringify({
        lijstjes: { h: { kenmerken: { datum: true, tijd: true, notitie: true } } },
        items: { 'h-0': { notitie: 'controle' } },
      }),
    )
    expect(loadLijstjes()[0]).toEqual({
      id: 'h',
      naam: 'Afspraken',
      kenmerken: { datum: true, tijd: true, notitie: true },
      items: [
        { id: 'h-0', tekst: 'Tandarts', af: false, wanneer: '2026-11-12T09:30', notitie: 'controle' },
        { id: 'n', tekst: 'kapper', af: false },
      ],
    })
  })

  it('leest lijstjes van versie 1.3 zonder herinneringen gewoon', () => {
    storeLists([list('a', 'AH', ['melk'])])
    expect(loadLijstjes()).toEqual([list('a', 'AH', ['melk'])])
    localStorage.setItem(HERINNERINGEN_KEY, 'kapot')
    localStorage.setItem(KENMERKEN_KEY, 'kapot')
    expect(loadLijstjes()).toEqual([list('a', 'AH', ['melk'])])
  })

  it('maakt een backup die versie 1.3 en 1.6 kunnen terugzetten en die alle kenmerken bewaart', () => {
    const lijstjes: Lijstje[] = [
      {
        id: 'h',
        naam: 'Afspraken',
        kenmerken: { datum: true, tijd: true, aantal: true },
        agenda: 'ics',
        items: [
          { id: 't', tekst: 'Tandarts', af: false, wanneer: '2026-11-12T09:30' },
          { id: 'k', tekst: 'kapper', af: false, wanneer: '2026-11-13', aantal: '2' },
        ],
      },
    ]
    const text = createBackup(lijstjes, 'h', new Date())
    const data = JSON.parse(text)
    expect(data.versie).toBe(1)
    expect(parseLijstjes(data.lijstjes)).toEqual([
      {
        id: 'h',
        naam: 'Afspraken',
        items: [
          { id: 't', tekst: 'Tandarts', af: false },
          { id: 'k', tekst: 'kapper', af: false },
        ],
      },
    ])
    // Versie 1.6 kent alleen datums met tijd.
    expect(data.herinneringen).toEqual({
      lijstjes: { h: { agenda: 'ics' } },
      items: { t: { wanneer: '2026-11-12T09:30' } },
    })
    expect(parseBackup(text).lijstjes).toEqual(lijstjes)
  })
})

describe('AC33: herinneringslijstjes van versie 1.6', () => {
  it('een herinneringslijstje wordt een lijstje met Datum en Tijd, met dezelfde datums en agenda', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30', inAgenda: '2026-11-12T09:30' } }, 'google')
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('do 12 nov 09:30')).toBeInTheDocument()
    expect(screen.getByLabelText('staat in je agenda')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    const box = screen.getByRole('region', { name: 'Lijstje aanpassen' })
    expect(within(box).getByRole('switch', { name: 'Datum' })).toBeChecked()
    expect(within(box).getByRole('switch', { name: 'Tijd' })).toBeChecked()
    expect(within(box).getByRole('switch', { name: 'Notitie' })).not.toBeChecked()
    expect(within(box).getByText(/Agenda: Google Agenda/)).toBeInTheDocument()
  })

  it('een uitgezet herinneringslijstje wordt een gewoon lijstje; met Datum en Tijd komen de datums terug', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-07T16:00' } }, 'google', true)
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByRole('region', { name: 'Herinneringen' })).not.toBeInTheDocument()
    expect(screen.queryByText(/16:00/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tandarts verplaatsen' })).toBeInTheDocument()
    await kenmerken(user, 'Afspraken', ['Datum', 'Tijd'])
    expect(screen.getByText('za 7 nov 16:00')).toBeInTheDocument()
    expect(loadLijstjes()[0].agenda).toBe('google')
  })
})

describe('AC34: per item kiezen', () => {
  it('de agenda-keuze toont zes keuzes; Per item kiezen vraagt bij elk item welke agenda', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30' }, APK: { wanneer: '2026-11-20T08:00' } }, 'google')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    const choice = screen.getByRole('region', { name: 'Agenda kiezen' })
    expect(
      within(choice)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Google Agenda', 'Outlook (privé)', 'Outlook (werk)', 'Andere agenda', 'Delen…', 'Per item kiezen'])
    await user.click(within(choice).getByRole('button', { name: 'Per item kiezen' }))
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('per-item')
    for (const [tekst, agenda, host] of [
      ['Tandarts', 'Google Agenda', 'calendar.google.com'],
      ['APK', 'Outlook (privé)', 'outlook.live.com'],
    ]) {
      const box = await openDetails(user, tekst)
      await user.click(within(box).getByRole('button', { name: 'In agenda zetten' }))
      const vraag = screen.getByRole('region', { name: 'Agenda kiezen' })
      expect(within(vraag).getByText('Kies waar je dit item ook op wilt nemen.')).toBeInTheDocument()
      await user.click(within(vraag).getByRole('button', { name: agenda }))
      expect(new URL(open.mock.lastCall![0]).hostname).toBe(host)
    }
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('per-item')
  })
})

describe('AC47: kaartje met kruisjes', () => {
  it('het rondje in het kaartje vinkt af bij Bewaren, niet bij Annuleren; ook bij een nieuw item', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk'])], 'a')
    render(<App />)
    await kenmerken(user, 'AH', ['Aantal'])
    let box = await openDetails(user, 'melk')
    await user.click(within(box).getByRole('button', { name: 'Afvinken' }))
    expect(within(box).getByRole('button', { name: 'Afvinken' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(box).getByRole('button', { name: 'Annuleren' }))
    expect(itemButton('melk')).toHaveAttribute('aria-pressed', 'false')

    box = await openDetails(user, 'melk')
    await user.click(within(box).getByRole('button', { name: 'Afvinken' }))
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(itemButton('melk')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('textbox', { name: 'Item toevoegen' }))
    box = screen.getByRole('region', { name: 'Nieuw item' })
    await user.type(within(box).getByLabelText('Tekst'), 'brood')
    await user.click(within(box).getByRole('button', { name: 'Afvinken' }))
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(itemButton('brood')).toHaveAttribute('aria-pressed', 'true')
  })

  it('Aantal en Notitie hebben een kruisje dat het veld leegmaakt', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk'])], 'a')
    render(<App />)
    await kenmerken(user, 'AH', ['Aantal', 'Notitie'])
    let box = await openDetails(user, 'melk')
    expect(within(box).getByRole('button', { name: 'Aantal weghalen' })).toBeDisabled()
    expect(within(box).getByRole('button', { name: 'Notitie weghalen' })).toBeDisabled()
    await user.type(within(box).getByLabelText('Aantal'), '2 liter')
    await user.type(within(box).getByLabelText('Notitie'), 'halfvol')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    const rows = screen.getByRole('list', { name: 'Items op AH' })
    expect(within(rows).getByText('2 liter')).toBeInTheDocument()

    box = await openDetails(user, 'melk')
    await user.click(within(box).getByRole('button', { name: 'Aantal weghalen' }))
    await user.click(within(box).getByRole('button', { name: 'Notitie weghalen' }))
    expect(within(box).getByLabelText('Aantal')).toHaveValue('')
    expect(within(box).getByLabelText('Notitie')).toHaveValue('')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(within(rows).queryByText('2 liter')).not.toBeInTheDocument()
    expect(within(rows).queryByText('halfvol')).not.toBeInTheDocument()
  })

  it('het tekstveld van het item heeft ook een kruisje; leeg bewaren laat de tekst zoals hij was', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk'])], 'a')
    render(<App />)
    await kenmerken(user, 'AH', ['Aantal'])
    const box = await openDetails(user, 'melk')
    await user.click(within(box).getByRole('button', { name: 'Tekst weghalen' }))
    expect(within(box).getByLabelText('Tekst')).toHaveValue('')
    expect(within(box).getByRole('button', { name: 'Tekst weghalen' })).toBeDisabled()
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(itemTexts()).toEqual(['melk'])
  })
})

describe('AC45: vak Nieuw item meteen open', () => {
  it('tikken in de invoerregel van een lijstje met kenmerken opent meteen het vak Nieuw item', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk'])], 'a')
    render(<App />)
    await user.click(screen.getByRole('textbox', { name: 'Item toevoegen' }))
    expect(screen.queryByRole('region', { name: 'Nieuw item' })).not.toBeInTheDocument()
    await kenmerken(user, 'AH', ['Notitie'])
    await user.click(screen.getByRole('textbox', { name: 'Item toevoegen' }))
    const box = screen.getByRole('region', { name: 'Nieuw item' })
    expect(within(box).getByLabelText('Tekst')).toHaveValue('')
    expect(within(box).getByLabelText('Tekst')).toHaveFocus()
  })
})

describe('AC43: melding in het vak van een item', () => {
  it('een bestaand item aanpassen naar een tekst die er al op staat: het vak blijft open, melding onder Omschr', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk', 'brood'])], 'a')
    render(<App />)
    await kenmerken(user, 'AH', ['Notitie'])
    const box = await openDetails(user, 'melk')
    await user.clear(within(box).getByLabelText('Tekst'))
    await user.type(within(box).getByLabelText('Tekst'), 'Brood')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    const melding = within(box).getByRole('status')
    expect(melding).toHaveTextContent('Brood staat er al op.')
    expect(melding.previousElementSibling).toContainElement(within(box).getByLabelText('Tekst'))
    // Weer typen haalt de melding weg.
    await user.type(within(box).getByLabelText('Tekst'), 'x')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('AC37: aantal en notitie', () => {
  it('met Aantal wordt "3 appels" aantal 3 en tekst appels; de notitie staat klein onder het item', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk'])], 'a')
    render(<App />)
    // Zonder kenmerken blijft het aantal gewoon deel van de tekst en komt er geen vak.
    await typeItem(user, '2 pakken koffie')
    expect(itemTexts()).toEqual(['melk', '2 pakken koffie'])
    expect(screen.queryByRole('region', { name: 'Nieuw item' })).not.toBeInTheDocument()
    await kenmerken(user, 'AH', ['Aantal', 'Notitie'])

    // Met kenmerken opent typen het vak Nieuw item, waarin je verder typt.
    await user.type(screen.getByRole('textbox', { name: 'Item toevoegen' }), '3 appels')
    let box = screen.getByRole('region', { name: 'Nieuw item' })
    expect(within(box).getByLabelText('Tekst')).toHaveValue('3 appels')
    expect(within(box).getByLabelText('Tekst')).toHaveFocus()
    // De invoerregel zelf is opengeschoven tot het kaartje van het nieuwe item (vanaf 1.8).
    expect(screen.queryByRole('textbox', { name: 'Item toevoegen' })).not.toBeInTheDocument()
    expect(box.closest('li')).toHaveClass('add-row', 'open')
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('region', { name: 'Nieuw item' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item toevoegen' })).toHaveFocus()

    await user.type(screen.getByRole('textbox', { name: 'Item toevoegen' }), 'g')
    box = screen.getByRole('region', { name: 'Nieuw item' })
    await user.type(within(box).getByLabelText('Tekst'), 'ehakt')
    await user.type(within(box).getByLabelText('Aantal'), '500 g')
    await user.type(within(box).getByLabelText('Notitie'), 'half om half')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(itemTexts()).toEqual(['melk', '2 pakken koffie', 'appels', 'gehakt'])
    const rows = screen.getByRole('list', { name: 'Items op AH' })
    expect(within(rows).getByText('3')).toHaveClass('item-aantal')
    expect(within(rows).getByText('500 g')).toHaveClass('item-aantal')
    expect(within(rows).getByText('half om half')).toHaveClass('item-note')

    // Staat het item er al op, dan blijft het vak open met de melding.
    await user.type(screen.getByRole('textbox', { name: 'Item toevoegen' }), 'Melk{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Melk staat er al op.')
    // De melding staat in het vak, direct onder het veld Omschr (AC43).
    const melding = within(screen.getByRole('region', { name: 'Nieuw item' })).getByRole('status')
    expect(melding.previousElementSibling).toContainElement(screen.getByRole('textbox', { name: 'Tekst' }))
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(itemTexts()).toEqual(['melk', '2 pakken koffie', 'appels', 'gehakt'])

    box = await openDetails(user, 'melk')
    await user.type(within(box).getByLabelText('Aantal'), '1')
    await user.type(within(box).getByLabelText('Notitie'), 'volkoren, gesneden')
    await user.clear(within(box).getByLabelText('Tekst'))
    await user.type(within(box).getByLabelText('Tekst'), 'halfvolle melk')
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(itemTexts()).toEqual(['halfvolle melk', '2 pakken koffie', 'appels', 'gehakt'])
    expect(screen.getByText('volkoren, gesneden')).toHaveClass('item-note')
    expect(JSON.parse(localStorage.getItem(LISTS_KEY)!)[0].items[0].tekst).toBe('halfvolle melk')
  })

  it('een nieuw item met datum gaat met In agenda zetten meteen in de agenda', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    storeAfspraken({}, 'google')
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Item toevoegen' }), 'Kapper')
    const box = screen.getByRole('region', { name: 'Nieuw item' })
    // Datum en tijd op één regel.
    const datum = within(box).getByLabelText('Datum')
    expect(datum.closest('.date-field')).toBe(within(box).getByLabelText('Tijd').closest('.date-field'))
    fireEvent.change(datum, { target: { value: '10-11-2026' } })
    fireEvent.change(within(box).getByLabelText('Tijd'), { target: { value: '11:00' } })
    await user.click(within(box).getByRole('button', { name: 'In agenda zetten' }))
    expect(new URL(open.mock.calls[0][0]).searchParams.get('text')).toBe('Kapper')
    expect(screen.getByText('di 10 nov 11:00')).toBeInTheDocument()
    expect(await screen.findByLabelText('staat in je agenda')).toBeInTheDocument()
  })

  it('haalt een aantal uit de tekst, ook ingesproken getallen', () => {
    expect(splitAantal('3 appels')).toEqual({ tekst: 'appels', aantal: '3' })
    expect(splitAantal('twee pakken koffie')).toEqual({ tekst: 'pakken koffie', aantal: '2' })
    expect(splitAantal('1,5 kg aardappels')).toEqual({ tekst: 'aardappels', aantal: '1,5 kg' })
    expect(splitAantal('een brood')).toEqual({ tekst: 'een brood' })
    expect(splitAantal('appels')).toEqual({ tekst: 'appels' })
    expect(splitAantal('7up')).toEqual({ tekst: '7up' })
  })
})

describe('AC38: kenmerk uitzetten', () => {
  it('verbergt de ingevulde waarden zonder ze weg te gooien; weer aanzetten brengt ze terug', async () => {
    const user = userEvent.setup()
    storeLists([list('a', 'AH', ['melk'])], 'a')
    localStorage.setItem(
      KENMERKEN_KEY,
      JSON.stringify({
        lijstjes: { a: { kenmerken: { notitie: true, aantal: true } } },
        items: { 'a-0': { notitie: 'halfvol', aantal: '2' } },
      }),
    )
    render(<App />)
    expect(screen.getByText('halfvol')).toBeInTheDocument()
    await kenmerken(user, 'AH', ['Notitie', 'Aantal'])
    expect(screen.queryByText('halfvol')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('blijft bewaard en komt terug als je ze weer aanzet')
    // Zonder kenmerken: tikken past de tekst weer aan in de regel zelf.
    await user.click(screen.getByRole('button', { name: 'melk aanpassen' }))
    expect(screen.getByRole('textbox', { name: 'Item aanpassen' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).items['a-0']).toEqual({ notitie: 'halfvol', aantal: '2' })
    await kenmerken(user, 'AH', ['Notitie'])
    expect(screen.getByText('halfvol')).toBeInTheDocument()
  })

  it('Tijd uit: de tijd blijft bewaard maar je ziet alleen de datum', async () => {
    storeAfspraken({ Tandarts: { wanneer: '2026-11-12T09:30' } })
    const user = userEvent.setup()
    render(<App />)
    await kenmerken(user, 'Afspraken', ['Tijd'])
    expect(screen.getByText('do 12 nov')).toBeInTheDocument()
    // De datum wijzigen zonder Tijd houdt de verborgen tijd vast.
    await setDate(user, 'Tandarts', '2026-11-13')
    await kenmerken(user, 'Afspraken', ['Tijd'])
    expect(screen.getByText('vr 13 nov 09:30')).toBeInTheDocument()
  })
})

describe('AC39: datum zonder jaar', () => {
  it('dag en maand, elk jaar: op de eerstvolgende keer, herinnering op de dag zelf, elk jaar in de agenda', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const user = userEvent.setup()
    storeLists([list('v', 'Verjaardagen', ['Anne', 'Piet', 'Kees'])], 'v')
    render(<App />)
    await kenmerken(user, 'Verjaardagen', ['Datum', 'Zonder jaar'])
    // "Nu" is 7 november 2026: Anne (3 jan) is pas volgend jaar, Piet (7 nov) is vandaag, Kees (20 nov) daartussen.
    for (const [naam, getypt] of [
      ['Anne', '3-1'],
      ['Piet', '0711'],
      ['Kees', '20-11-1975'],
    ]) {
      const box = await openDetails(user, naam)
      expect(within(box).getByLabelText('Datum')).toHaveAttribute('placeholder', 'dd-mm')
      await user.type(within(box).getByLabelText('Datum'), `${getypt}{Enter}`)
    }
    expect(itemTexts()).toEqual(['Piet', 'Kees', 'Anne'])
    const rows = screen.getByRole('list', { name: 'Items op Verjaardagen' })
    expect(within(rows).getByText('3 jan')).not.toHaveClass('past')
    expect(within(rows).getByText('20 nov')).toBeInTheDocument()
    // Het vak toont dag en maand zonder jaar.
    const box = await openDetails(user, 'Kees')
    expect(within(box).getByLabelText('Datum')).toHaveValue('20-11')
    await user.click(within(box).getByRole('button', { name: 'Annuleren' }))
    // Herinnering alleen op de dag zelf.
    const lines = within(screen.getByRole('region', { name: 'Herinneringen' }))
      .getAllByRole('button')
      .filter((b) => b.classList.contains('reminder'))
    expect(lines.map((b) => b.textContent)).toEqual(['Vandaag Piet (Verjaardagen)'])
    // In de agenda: de eerstvolgende keer, elk jaar terug.
    const anne = await openDetails(user, 'Anne')
    await user.click(within(anne).getByRole('button', { name: 'In agenda zetten' }))
    await user.click(screen.getByRole('button', { name: 'Google Agenda' }))
    const url = new URL(open.mock.calls[0][0])
    expect(url.searchParams.get('dates')).toBe('20270103/20270104')
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=YEARLY')
  })

  it('rekent de eerstvolgende keer uit, ook voor 29 februari', () => {
    const now = new Date(2026, 10, 7)
    expect(volgendeKeer('1975-11-20', now)).toBe('2026-11-20')
    expect(volgendeKeer('2026-11-07T09:00', now)).toBe('2026-11-07T09:00')
    expect(volgendeKeer('1990-01-03', now)).toBe('2027-01-03')
    expect(volgendeKeer('2000-02-29', now)).toBe('2027-02-28')
    expect(formatWanneer('1975-11-20', now, true)).toBe('20 nov')
    expect(isVoorbij('1975-11-20', now, true)).toBe(false)
    expect(
      opDatum(
        [
          { id: 'a', wanneer: '1990-01-03' },
          { id: 'b', wanneer: '1975-11-20' },
        ],
        true,
        now,
      ).map((i) => i.id),
    ).toEqual(['b', 'a'])
    const a = { id: 'x', titel: 'Anne', lijstje: 'Verjaardagen', wanneer: '2027-01-03', jaarlijks: true }
    expect(icsBestand(a)).toContain('RRULE:FREQ=YEARLY')
    expect(deelTekst(a)).toBe('Anne, elk jaar op 3 jan')
  })
})

describe('AC48: verlopen items op Mijn lijstjes', () => {
  it('toont blauw de niet-verlopen en rood de verlopen open items, samen het aantal open items', async () => {
    storeLists(
      [
        list('h', 'Afspraken', ['Tandarts', 'Anne bellen', 'APK', ['Kapper', true], 'Bellen']),
        list('k', 'Klusjes', ['Dakgoot']),
        list('a', 'AH', ['melk', 'brood']),
      ],
      'a',
    )
    localStorage.setItem(
      KENMERKEN_KEY,
      JSON.stringify({
        lijstjes: { h: { kenmerken: { datum: true, tijd: true } }, k: { kenmerken: { datum: true } } },
        items: {
          'h-0': { wanneer: '2026-11-06T09:00' },
          'h-1': { wanneer: '2026-11-07T09:00' },
          'h-2': { wanneer: '2026-11-07T11:00' },
          'h-3': { wanneer: '2026-11-01T09:00' },
          'k-0': { wanneer: '2026-11-02' },
        },
      }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Terug naar Mijn lijstjes' }))
    const afspraken = screen.getByRole('button', { name: 'Afspraken, 2 open, 2 verlopen' })
    expect(afspraken.querySelector('.count')).toHaveTextContent('2')
    expect(afspraken.querySelector('.count-verlopen')).toHaveTextContent('2')
    // Rood links, blauw rechts.
    expect([...afspraken.querySelectorAll('.count, .count-verlopen')].map((e) => e.className)).toEqual([
      'count-verlopen',
      'count',
    ])
    const klusjes = screen.getByRole('button', { name: 'Klusjes, 1 verlopen' })
    // Het blauwe rondje houdt zijn plek rechts vrij, maar is niet te zien.
    expect(klusjes.querySelector('.count')).toHaveClass('leeg')
    expect(klusjes.querySelector('.count-verlopen')).toHaveTextContent('1')
    const ah = screen.getByRole('button', { name: 'AH, 2 open' })
    expect(ah.querySelector('.count-verlopen')).toBeNull()
  })
})

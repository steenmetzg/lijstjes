// Google, automatisch en Geen agenda (F48 t/m F50, AC49 t/m AC53).

import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  agendaBody,
  bijwerken,
  controleer,
  vergelijkTaken,
  doelen,
  GOOGLE_KEY,
  hashDoel,
  plan,
  taakBody,
  TOKEN_KEY,
  INGELOGD_KEY,
  type GoogleOpslag,
} from './google'
import { KENMERKEN_KEY, mergeHerinneringen, naarGoogle, splitKenmerken, zetGoogleUit, type Lijstje } from './lists'
import { list, storeLists } from './test/helpers'

vi.mock('./folderStore', () => ({
  loadStoredFolder: async () => null,
  storeFolder: async () => {},
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 7, 10, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Kiest in Synchroniseren of delen een hoofdkeuze (en een agenda) en tikt op Bewaren. */
async function kies(user: ReturnType<typeof userEvent.setup>, naam: string, agenda?: string) {
  const k = screen.getByRole('region', { name: 'Agenda kiezen' })
  await user.click(within(k).getByRole('radio', { name: naam }))
  if (agenda) await user.click(within(k).getByRole('button', { name: agenda }))
  await user.click(within(k).getByRole('button', { name: 'Bewaren' }))
}

function afspraken(extra: Partial<Lijstje> = {}): Lijstje {
  return {
    id: 'h',
    naam: 'Afspraken',
    kenmerken: { datum: true, tijd: true, notitie: true },
    agenda: 'google-auto',
    items: [
      { id: 't', tekst: 'tandarts', af: false, wanneer: '2026-11-27T09:30', notitie: 'controle' },
      { id: 'p', tekst: 'paspoort ophalen', af: false, wanneer: '2026-11-28' },
      { id: 'c', tekst: 'cadeau voor Anne', af: false },
    ],
    ...extra,
  }
}

/** Bewaart Afspraken zoals de app het doet (kenmerken apart). */
function storeAfspraken(l: Lijstje) {
  storeLists(
    [
      list(
        'h',
        'Afspraken',
        l.items.map((i) => i.tekst),
      ),
      list('a', 'AH', ['melk']),
    ],
    'h',
  )
  const k = splitKenmerken([{ ...l, items: l.items.map((i, n) => ({ ...i, id: `h-${n}` })) }])
  localStorage.setItem(KENMERKEN_KEY, JSON.stringify(k))
}

describe('AC49: met tijd naar Google Agenda, zonder tijd naar Google Tasks', () => {
  it('kiest per item Agenda of Tasks, en alleen items met een datum', () => {
    const d = doelen([afspraken()])
    expect(d.get('t')).toMatchObject({ soort: 'agenda', moment: '2026-11-27T09:30', notitie: 'controle' })
    expect(d.get('p')).toMatchObject({ soort: 'tasks', moment: '2026-11-28' })
    expect(d.has('c')).toBe(false)
    // Met Tijd uit gaat ook tandarts naar Tasks.
    expect(doelen([afspraken({ kenmerken: { datum: true } })]).get('t')?.soort).toBe('tasks')
    // Een andere agenda: niets naar Google.
    expect(doelen([afspraken({ agenda: 'google' })]).size).toBe(0)
  })

  it('maakt een agenda-item van een half uur en een taak op de dag zelf', () => {
    const d = doelen([afspraken()])
    expect(agendaBody(d.get('t')!, 'Europe/Amsterdam')).toEqual({
      summary: 'tandarts',
      description: 'controle\n\nUit Lijstjes: Afspraken',
      start: { dateTime: '2026-11-27T09:30:00', timeZone: 'Europe/Amsterdam', date: null },
      end: { dateTime: '2026-11-27T10:00:00', timeZone: 'Europe/Amsterdam', date: null },
      recurrence: [],
      reminders: { useDefault: true },
    })
    expect(taakBody(d.get('p')!)).toEqual({
      title: 'paspoort ophalen',
      notes: 'Uit Lijstjes: Afspraken',
      due: '2026-11-28T00:00:00.000Z',
      status: 'needsAction',
    })
  })
})

describe('AC49: zonder jaar altijd in Google Agenda, elk jaar', () => {
  it('een verjaardag zonder tijd wordt een agenda-item voor de hele dag dat elk jaar terugkomt', () => {
    const l = afspraken({
      kenmerken: { datum: true, tijd: true, zonderJaar: true },
      items: [{ id: 'v', tekst: 'verjaardag Anne', af: false, wanneer: '2000-03-14' }],
    })
    const d = doelen([l]).get('v')!
    expect(d).toMatchObject({ soort: 'agenda', moment: '2027-03-14', jaarlijks: true })
    expect(agendaBody(d, 'Europe/Amsterdam')).toMatchObject({
      start: { date: '2027-03-14', dateTime: null },
      end: { date: '2027-03-15', dateTime: null },
      recurrence: ['RRULE:FREQ=YEARLY'],
    })
  })
})

describe('AC50: per lijstje of per item', () => {
  it('Alle items met een datum uit: alleen de items die je zelf aanzet', () => {
    const l = afspraken({ googleAlle: false })
    expect(l.items.map((i) => naarGoogle(l, i))).toEqual([false, false, false])
    const met = { ...l, items: l.items.map((i) => (i.id === 't' ? { ...i, google: true } : i)) }
    expect(met.items.map((i) => naarGoogle(met, i))).toEqual([true, false, false])
    // Aan: alles met een datum, behalve wat je uitzet.
    const uit = afspraken({ items: afspraken().items.map((i) => (i.id === 'p' ? { ...i, google: false } : i)) })
    expect(uit.items.map((i) => naarGoogle(uit, i))).toEqual([true, false, false])
  })

  it('bewaart de schakelaars apart, zodat een oudere versie ze negeert', () => {
    const l = afspraken({
      googleAlle: false,
      items: [{ id: 't', tekst: 'tandarts', af: false, wanneer: '2026-11-27', google: true }],
    })
    const k = splitKenmerken([l])
    expect(k.lijstjes.h).toEqual({
      kenmerken: { datum: true, tijd: true, notitie: true },
      agenda: 'google-auto',
      googleAlle: false,
    })
    expect(k.items.t).toEqual({ wanneer: '2026-11-27', google: true })
    const [terug] = mergeHerinneringen(
      [{ id: 'h', naam: 'Afspraken', items: [{ id: 't', tekst: 'tandarts', af: false }] }],
      null,
      k,
    )
    expect(terug.googleAlle).toBe(false)
    expect(terug.items[0].google).toBe(true)
  })
})

describe('AC51: Lijstjes houdt Google bij', () => {
  it('maakt, wijzigt, vinkt af en verwijdert', () => {
    const gewenst = doelen([afspraken()])
    expect(plan(gewenst, {}).map((a) => [a.soort, a.itemId])).toEqual([
      ['maak', 't'],
      ['maak', 'p'],
    ])
    const opslag: GoogleOpslag = {
      t: { soort: 'agenda', id: 'ev1', hash: hashDoel(gewenst.get('t')!) },
      p: { soort: 'tasks', id: 'tk1', hash: hashDoel(gewenst.get('p')!) },
      weg: { soort: 'tasks', id: 'tk2', hash: 'x' },
    }
    // Het weggegooide item gaat weg bij Google; de rest klopt al.
    expect(plan(gewenst, opslag).map((a) => [a.soort, a.itemId])).toEqual([['weg', 'weg']])
    // Afvinken: de taak wordt afgevinkt, het agenda-item blijft staan met een vinkje en zonder melding.
    const af = doelen([afspraken({ items: afspraken().items.map((i) => ({ ...i, af: true })) })])
    expect(agendaBody(af.get('t')!, 'Europe/Amsterdam')).toMatchObject({
      summary: '✓ tandarts',
      reminders: { useDefault: false, overrides: [] },
    })
    expect(plan(af, opslag).map((a) => [a.soort, a.itemId])).toEqual([
      ['wijzig', 't'],
      ['wijzig', 'p'],
      ['weg', 'weg'],
    ])
    // Een tijd erbij: van Tasks naar Agenda.
    const metTijd = doelen([
      afspraken({ items: afspraken().items.map((i) => (i.id === 'p' ? { ...i, wanneer: '2026-11-28T11:00' } : i)) }),
    ])
    expect(plan(metTijd, opslag).map((a) => [a.soort, a.itemId])).toEqual([
      ['weg', 'p'],
      ['maak', 'p'],
      ['weg', 'weg'],
    ])
  })

  it('roept Google aan en onthoudt wat er staat', async () => {
    const calls: { method: string; url: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ method: init.method!, url })
        return new Response(init.method === 'DELETE' ? null : JSON.stringify({ id: `id${calls.length}` }), {
          status: init.method === 'DELETE' ? 204 : 200,
        })
      }),
    )
    const stappen: GoogleOpslag[] = []
    const opslag = await bijwerken('tok', [afspraken()], {}, (o) => stappen.push(o))
    expect(calls).toEqual([
      { method: 'POST', url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events' },
      { method: 'POST', url: 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks' },
    ])
    expect(opslag.t).toMatchObject({ soort: 'agenda', id: 'id1' })
    expect(opslag.p).toMatchObject({ soort: 'tasks', id: 'id2' })
    expect(stappen).toHaveLength(2)
    // Het lijstje weggooien haalt de items ook bij Google weg.
    const leeg = await bijwerken('tok', [], opslag, () => {})
    expect(leeg).toEqual({})
    expect(calls.slice(2).map((c) => c.method)).toEqual(['DELETE', 'DELETE'])
  })
})

describe('AC52: Geen agenda', () => {
  it('in de keuze staat Geen agenda; daarna is er geen In agenda zetten meer', async () => {
    const user = userEvent.setup()
    storeAfspraken(afspraken({ agenda: 'google' }))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    await kies(user, 'Alleen in Lijstjes')
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('geen')
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    expect(
      within(screen.getByRole('region', { name: 'Lijstje aanpassen' })).getByText(
        /Synchroniseren of delen: alleen in Lijstjes/,
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    await user.click(screen.getByRole('button', { name: 'tandarts aanpassen' }))
    const box = screen.getByRole('region', { name: 'Details van tandarts' })
    expect(within(box).queryByRole('button', { name: 'In agenda zetten' })).not.toBeInTheDocument()
    expect(within(box).queryByRole('switch', { name: /In Google/ })).not.toBeInTheDocument()
  })
})

describe('AC53: Google, automatisch kiezen en inloggen', () => {
  it('zonder Client-ID: een melding dat het nog niet is ingesteld', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const user = userEvent.setup()
    storeAfspraken(afspraken({ agenda: 'google' }))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    await kies(user, 'Google, automatisch')
    expect(screen.getByText('Google, automatisch is in deze versie nog niet ingesteld.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('google')
  })

  it('niet ingelogd: eerst de vraag Inloggen bij Google; Annuleren laat de agenda zoals hij was', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id')
    const user = userEvent.setup()
    storeAfspraken(afspraken({ agenda: 'google' }))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    await kies(user, 'Google, automatisch')
    const vraag = screen.getByRole('region', { name: 'Inloggen bij Google' })
    expect(within(vraag).getByText(/Je items gaan dan naar Google, verder nergens heen/)).toBeInTheDocument()
    await user.click(within(vraag).getByRole('button', { name: 'Annuleren' }))
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('google')
  })

  it('ingelogd: schakelaar per lijstje en per item, icoontjes vóór de datum', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id')
    localStorage.setItem(INGELOGD_KEY, '1')
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: 'tok', tot: Date.now() + 3600000 }))
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: `g${++n}` }), { status: 200 })),
    )
    const user = userEvent.setup()
    storeAfspraken(afspraken({ agenda: 'google' }))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    await kies(user, 'Google, automatisch')
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('google-auto')

    // Na even wachten staan tandarts en paspoort in Google, met een icoontje.
    await act(() => new Promise((r) => setTimeout(r, 1700)))
    expect(await screen.findByLabelText('staat in Google Agenda')).toBeInTheDocument()
    expect(screen.getByLabelText('staat in Google Tasks')).toBeInTheDocument()
    expect(Object.keys(JSON.parse(localStorage.getItem(GOOGLE_KEY)!)).sort()).toEqual(['h-0', 'h-1'])

    // In het vak met de schuifjes: Alle items met een datum, en Uitloggen.
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    const vak = screen.getByRole('region', { name: 'Lijstje aanpassen' })
    expect(within(vak).getByText(/Synchroniseren of delen: Google, automatisch/)).toBeInTheDocument()
    await user.click(within(vak).getByRole('button', { name: 'Wijzigen' }))
    const sync = screen.getByRole('region', { name: 'Agenda kiezen' })
    expect(within(sync).getByText('Afspraken synchroniseren of delen')).toBeInTheDocument()
    expect(within(sync).getByRole('radio', { name: 'Google, automatisch' })).toBeChecked()
    expect(within(sync).getByRole('switch', { name: 'Items met een datum' })).toBeChecked()
    expect(within(sync).getByRole('button', { name: 'Uitloggen' })).toBeInTheDocument()
    await user.click(within(sync).getByRole('button', { name: 'Annuleren' }))

    // In het kaartje: In Google Agenda met tijd, In Google Tasks zonder tijd; uitzetten bij paspoort.
    await user.click(screen.getByRole('button', { name: 'tandarts aanpassen' }))
    let box = screen.getByRole('region', { name: 'Details van tandarts' })
    expect(within(box).getByRole('switch', { name: 'In Google Agenda' })).toBeChecked()
    expect(within(box).queryByRole('button', { name: 'In agenda zetten' })).not.toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Annuleren' }))
    await user.click(screen.getByRole('button', { name: 'paspoort ophalen aanpassen' }))
    box = screen.getByRole('region', { name: 'Details van paspoort ophalen' })
    await user.click(within(box).getByRole('switch', { name: 'In Google Tasks' }))
    await user.click(within(box).getByRole('button', { name: 'Bewaren' }))
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).items['h-1'].google).toBe(false)
  })

  it('verlopen toegang: de melding Google bijwerken met Inloggen', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id')
    localStorage.setItem(INGELOGD_KEY, '1')
    storeAfspraken(afspraken())
    render(<App />)
    await act(() => new Promise((r) => setTimeout(r, 1700)))
    const melding = await screen.findByRole('region', { name: 'Google bijwerken' })
    expect(within(melding).getByText(/Log opnieuw in bij Google/)).toBeInTheDocument()
    expect(within(melding).getByRole('button', { name: 'Inloggen' })).toBeInTheDocument()
  })
})

describe('AC54: bij Google zelf verwijderd', () => {
  it('kijkt na of de items nog bij Google staan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/a1')) return new Response('{}', { status: 404 })
        if (url.endsWith('/a2')) return new Response(JSON.stringify({ id: 'a2', status: 'cancelled' }))
        if (url.endsWith('/t1')) return new Response(JSON.stringify({ id: 't1', deleted: true }))
        return new Response(JSON.stringify({ id: 'x', status: 'confirmed' }))
      }),
    )
    const opslag: GoogleOpslag = {
      a: { soort: 'agenda', id: 'a1', hash: '' },
      b: { soort: 'agenda', id: 'a2', hash: '' },
      c: { soort: 'tasks', id: 't1', hash: '' },
      d: { soort: 'tasks', id: 't2', hash: '' },
    }
    expect(await controleer('tok', opslag)).toEqual(['a', 'b', 'c'])
  })

  it('bijwerken van een verwijderd item maakt het niet opnieuw, maar meldt het', async () => {
    const methods: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        methods.push(init.method!)
        return new Response('{}', { status: 404 })
      }),
    )
    const l = afspraken()
    const d = doelen([l]).get('t')!
    const opslag: GoogleOpslag = { t: { soort: 'agenda', id: 'oud', hash: 'anders' } }
    const verdwenen: string[][] = []
    const na = await bijwerken(
      'tok',
      [{ ...l, items: [l.items[0]] }],
      opslag,
      () => {},
      (ids) => verdwenen.push(ids),
    )
    expect(d.soort).toBe('agenda')
    expect(methods).toEqual(['PATCH'])
    expect(na).toEqual({})
    expect(verdwenen).toEqual([['t']])
  })

  it('de schakelaar van zo een item gaat uit', () => {
    const [l] = zetGoogleUit([afspraken()], ['t'])
    expect(l.items[0].google).toBe(false)
    expect(naarGoogle(l, l.items[0])).toBe(false)
    expect(naarGoogle(l, l.items[1])).toBe(true)
    // Met Alle items uit stond het item zelf aan; dat gaat er weer af.
    const [m] = zetGoogleUit(
      [afspraken({ googleAlle: false, items: [{ ...afspraken().items[0], google: true }] })],
      ['t'],
    )
    expect(m.items[0].google).toBeUndefined()
  })
})

describe('AC55: omzetten van Google, automatisch', () => {
  function inGoogle() {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id')
    localStorage.setItem(INGELOGD_KEY, '1')
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: 'tok', tot: Date.now() + 3600000 }))
    const methods: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        methods.push(init.method ?? 'GET')
        return init.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify({ id: 'x' }))
      }),
    )
    storeAfspraken(afspraken())
    localStorage.setItem(
      GOOGLE_KEY,
      JSON.stringify({ 'h-0': { soort: 'agenda', id: 'a', hash: '' }, 'h-1': { soort: 'tasks', id: 'b', hash: '' } }),
    )
    return methods
  }

  async function zetOm(knop: string) {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    await kies(user, 'Zelf per item in je agenda')
    const vraag = screen.getByRole('region', { name: 'Items in Google' })
    expect(
      within(vraag).getByText(/2 items van dit lijstje staan in Google Agenda of Google Tasks/),
    ).toBeInTheDocument()
    await user.click(within(vraag).getByRole('button', { name: knop }))
    await act(() => new Promise((r) => setTimeout(r, 1700)))
  }

  it('Laten staan: de items blijven in Google en staan in je agenda', async () => {
    const methods = inGoogle()
    await zetOm('Laten staan')
    expect(methods).not.toContain('DELETE')
    expect(JSON.parse(localStorage.getItem(GOOGLE_KEY)!)).toEqual({})
    const k = JSON.parse(localStorage.getItem(KENMERKEN_KEY)!)
    expect(k.lijstjes.h.agenda).toBe('per-item')
    expect(k.items['h-0'].inAgenda).toBe('2026-11-27T09:30')
    expect(screen.getAllByLabelText('staat in je agenda')).toHaveLength(2)
  })

  it('Datum uit: dezelfde vraag; Annuleren gaat terug naar het vak, Laten staan bewaart', async () => {
    const methods = inGoogle()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    let vak = screen.getByRole('region', { name: 'Lijstje aanpassen' })
    await user.click(within(vak).getByRole('switch', { name: 'Datum' }))
    await user.click(within(vak).getByRole('button', { name: 'Bewaren' }))
    let vraag = screen.getByRole('region', { name: 'Items in Google' })
    await user.click(within(vraag).getByRole('button', { name: 'Annuleren' }))
    vak = screen.getByRole('region', { name: 'Lijstje aanpassen' })
    expect(within(vak).getByRole('switch', { name: 'Datum' })).not.toBeChecked()
    await user.click(within(vak).getByRole('button', { name: 'Bewaren' }))
    vraag = screen.getByRole('region', { name: 'Items in Google' })
    await user.click(within(vraag).getByRole('button', { name: 'Laten staan' }))
    await act(() => new Promise((r) => setTimeout(r, 1700)))
    expect(methods).not.toContain('DELETE')
    expect(screen.queryByRole('region', { name: 'Lijstje aanpassen' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.kenmerken.datum).toBeFalsy()
  })

  it('Weghalen: de items gaan uit Google', async () => {
    const methods = inGoogle()
    await zetOm('Weghalen')
    expect(methods.filter((m) => m === 'DELETE')).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.agenda).toBe('per-item')
  })
})

describe('AC56: het hele lijstje in Google Tasks', () => {
  const heel = (extra: Partial<Lijstje> = {}) => afspraken({ googleLijst: true, ...extra })
  const metLijst: GoogleOpslag = { 'lijst:h': { soort: 'takenlijst', id: 'L1', hash: 'Afspraken' } }

  it('elk item komt als taak in de eigen lijst; met een tijd ook in Google Agenda', () => {
    const d = doelen([heel()], undefined, metLijst)
    expect(d.get('t#lijst')).toMatchObject({ soort: 'tasks', moment: '2026-11-27', takenlijst: 'L1' })
    expect(d.get('p#lijst')).toMatchObject({ soort: 'tasks', moment: '2026-11-28', takenlijst: 'L1' })
    expect(d.get('c#lijst')).toMatchObject({ soort: 'tasks', moment: '', titel: 'cadeau voor Anne' })
    expect(d.get('t')?.soort).toBe('agenda')
    // Paspoort staat al in de eigen lijst, niet nog eens in je standaardlijst.
    expect(d.has('p')).toBe(false)
    expect(taakBody(d.get('c#lijst')!).due).toBeNull()
    // Zonder takenlijst (nog niet gemaakt): nog geen taken in de eigen lijst.
    expect(doelen([heel()]).has('c#lijst')).toBe(false)
  })

  it('maakt de takenlijst, zet alle items erin, ook afgevinkte, en haalt de lijst weg als je uitzet', async () => {
    const calls: { method: string; url: string; body?: string }[] = []
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ method: init.method!, url, body: init.body as string | undefined })
        if (init.method === 'DELETE') return new Response(null, { status: 204 })
        return new Response(JSON.stringify({ id: url.endsWith('/users/@me/lists') ? 'L1' : `id${++n}` }))
      }),
    )
    const l = heel({ items: [...afspraken().items, { id: 'k', tekst: 'kaartje', af: true }] })
    const opslag = await bijwerken('tok', [l], {}, () => {})
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists' })
    expect(JSON.parse(calls[0].body!)).toEqual({ title: 'Afspraken' })
    const inLijst = calls.filter((c) => c.url === 'https://tasks.googleapis.com/tasks/v1/lists/L1/tasks')
    expect(inLijst).toHaveLength(4)
    expect(calls.filter((c) => c.url.includes('calendar'))).toHaveLength(1)
    expect(opslag['k#lijst']).toMatchObject({ takenlijst: 'L1', af: true })

    // Een andere naam: de takenlijst krijgt die naam ook.
    calls.length = 0
    const hernoemd = await bijwerken('tok', [{ ...l, naam: 'Afspraken 2' }], opslag, () => {})
    expect(calls.map((c) => [c.method, c.url])).toContainEqual([
      'PATCH',
      'https://tasks.googleapis.com/tasks/v1/users/@me/lists/L1',
    ])

    // Uitzetten: de hele takenlijst weg (met de taken erin), het agenda-item blijft.
    calls.length = 0
    const uit = await bijwerken('tok', [{ ...l, naam: 'Afspraken 2', googleLijst: undefined }], hernoemd, () => {})
    expect(calls[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists/L1',
    })
    expect(Object.keys(uit).filter((k) => k.includes('#lijst') || k.startsWith('lijst:'))).toEqual([])
    expect(uit.t?.soort).toBe('agenda')
  })

  it('vanuit Google: afvinken, tekst en notitie, nieuwe taken en verwijderde taken', () => {
    const l = heel({
      kenmerken: { datum: true, tijd: true, notitie: true, aantal: true },
      items: [...afspraken().items, { id: 'm', tekst: 'melk', af: false, aantal: '2' }],
    })
    const d = doelen([l], undefined, metLijst)
    const gezet = (id: string, key: string) => ({
      soort: 'tasks' as const,
      id,
      hash: hashDoel(d.get(key)!),
      takenlijst: 'L1',
      af: false,
    })
    const opslag: GoogleOpslag = {
      ...metLijst,
      't#lijst': gezet('a', 't#lijst'),
      'p#lijst': gezet('b', 'p#lijst'),
      'c#lijst': gezet('c', 'c#lijst'),
      'm#lijst': gezet('d', 'm#lijst'),
    }
    const van = vergelijkTaken(l, opslag, [
      { id: 'a', title: 'tandarts', status: 'completed', notes: 'controle\n\nUit Lijstjes: Afspraken' },
      { id: 'b', title: 'paspoort en rijbewijs ophalen', status: 'needsAction', notes: 'Uit Lijstjes: Afspraken' },
      { id: 'd', title: '3 melk', status: 'needsAction', notes: 'halfvol\n\nUit Lijstjes: Afspraken' },
      { id: 'n', title: 'brood', status: 'needsAction' },
      { id: 'x', title: 'weg', deleted: true },
    ])
    expect(van.wijzig).toEqual([
      { itemId: 't', af: true },
      { itemId: 'p', tekst: 'paspoort en rijbewijs ophalen', aantal: '' },
      // Cadeau is in Google verwijderd: in Lijstjes afgevinkt.
      { itemId: 'c', af: true },
      { itemId: 'm', tekst: 'melk', aantal: '3', notitie: 'halfvol' },
    ])
    expect(van.nieuw.map((t) => t.title)).toEqual(['brood'])
    expect(van.weg).toEqual(['c#lijst'])
    // Een in Google verwijderde taak komt er niet opnieuw in, tot je het item weer open zet.
    const na: GoogleOpslag = { ...opslag, 'c#lijst': { ...opslag['c#lijst'], verwijderd: true } }
    const afgevinkt = { ...l, items: l.items.map((i) => (i.id === 'c' ? { ...i, af: true } : i)) }
    expect(plan(doelen([afgevinkt], undefined, na), na).filter((a) => a.itemId === 'c#lijst')).toEqual([])
    expect(
      plan(doelen([l], undefined, na), na)
        .filter((a) => a.itemId === 'c#lijst')
        .map((a) => a.soort),
    ).toEqual(['maak'])
  })

  it('bij het openen van het lijstje: in Google afgevinkt en nieuw komt in Lijstjes', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id')
    localStorage.setItem(INGELOGD_KEY, '1')
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: 'tok', tot: Date.now() + 3600000 }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if ((init.method ?? 'GET') === 'GET' && url.includes('/lists/L1/tasks?'))
          return new Response(
            JSON.stringify({
              items: [
                { id: 'a', title: 'tandarts', status: 'completed' },
                { id: 'b', title: 'paspoort ophalen', status: 'needsAction' },
                { id: 'c', title: 'cadeau voor Anne', status: 'needsAction' },
                { id: 'n', title: 'brood', status: 'needsAction' },
              ],
            }),
          )
        return new Response(JSON.stringify({ id: 'x' }))
      }),
    )
    storeAfspraken(heel())
    localStorage.setItem(
      GOOGLE_KEY,
      JSON.stringify({
        ...metLijst,
        'h-0#lijst': { soort: 'tasks', id: 'a', hash: '', takenlijst: 'L1', af: false },
        'h-1#lijst': { soort: 'tasks', id: 'b', hash: '', takenlijst: 'L1', af: false },
        'h-2#lijst': { soort: 'tasks', id: 'c', hash: '', takenlijst: 'L1', af: false },
      }),
    )
    render(<App />)
    await act(() => new Promise((r) => setTimeout(r, 1700)))
    expect(await screen.findByText('brood')).toBeInTheDocument()
    const opgeslagen = JSON.parse(localStorage.getItem('lijstjes-data')!)[0].items
    expect(opgeslagen.find((i: { tekst: string }) => i.tekst === 'tandarts').af).toBe(true)
  })

  it('in Synchroniseren of delen staat de schakelaar Het hele lijstje', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-id')
    localStorage.setItem(INGELOGD_KEY, '1')
    const user = userEvent.setup()
    storeAfspraken(afspraken())
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Naam en kenmerken van Afspraken' }))
    await user.click(screen.getByRole('button', { name: 'Wijzigen' }))
    const sync = screen.getByRole('region', { name: 'Agenda kiezen' })
    const schakelaar = within(sync).getByRole('switch', { name: 'Het hele lijstje' })
    expect(schakelaar).not.toBeChecked()
    expect(
      within(sync).getByText(
        /Het hele lijstje komt als "Afspraken" in Google Tasks met alle items, ook zonder datum. De lijstjes worden gelijk gehouden./,
      ),
    ).toBeInTheDocument()
    await user.click(schakelaar)
    await user.click(within(sync).getByRole('button', { name: 'Bewaren' }))
    expect(JSON.parse(localStorage.getItem(KENMERKEN_KEY)!).lijstjes.h.googleLijst).toBe(true)
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { LISTS_KEY } from './lists'
import { LAATSTE_VERSIE_KEY } from './newVersion'
import { RELEASE_TEKSTEN } from './releaseTekst'
import { list, rememberFirstList, storeLists } from './test/helpers'
import pkg from '../package.json'

vi.mock('./folderStore', () => ({
  loadStoredFolder: async () => null,
  storeFolder: async () => {},
}))

const VERSIE = pkg.version

function melding() {
  return screen.queryByRole('region', { name: 'Nieuwe versie' })
}

describe('AC40: melding na een nieuwe versie', () => {
  it('toont titel met versienummer en de tekst met het icoon, en blijft weg na sluiten', () => {
    localStorage.setItem(LAATSTE_VERSIE_KEY, '1.6.2')
    const { unmount } = render(<App />)
    expect(melding()).toHaveTextContent(`Nieuwe versie geïnstalleerd (v${VERSIE})`)
    if (RELEASE_TEKSTEN[VERSIE]?.includes('[schuifjes]')) {
      expect(screen.getByRole('img', { name: 'schuifjes' })).toBeInTheDocument()
    }
    expect(melding()).not.toHaveTextContent('[')
    fireEvent.click(screen.getByRole('button', { name: 'Melding nieuwe versie sluiten' }))
    expect(melding()).toBeNull()
    expect(localStorage.getItem(LAATSTE_VERSIE_KEY)).toBe(VERSIE)
    unmount()
    render(<App />)
    expect(melding()).toBeNull()
  })

  it('komt terug als je de app sluit zonder de melding te sluiten, ook op een lijstje', () => {
    localStorage.setItem(LAATSTE_VERSIE_KEY, '1.6.2')
    rememberFirstList()
    const { unmount } = render(<App />)
    expect(melding()).not.toBeNull()
    unmount()
    render(<App />)
    expect(melding()).not.toBeNull()
  })

  it('verschijnt ook bij wie de app al gebruikte voordat er een melding was', () => {
    storeLists([list('l1', 'AH', ['melk'])])
    render(<App />)
    expect(melding()).not.toBeNull()
  })
})

describe('AC41: geen melding bij een nieuwe installatie', () => {
  it('toont niets de eerste keer en ook niet daarna', () => {
    const { unmount } = render(<App />)
    expect(melding()).toBeNull()
    expect(localStorage.getItem(LAATSTE_VERSIE_KEY)).toBe(VERSIE)
    unmount()
    // Ook nadat de app intussen lijstjes heeft bewaard.
    expect(localStorage.getItem(LISTS_KEY)).not.toBeNull()
    render(<App />)
    expect(melding()).toBeNull()
  })
})

describe('AC42: releasetekst per versie', () => {
  it('heeft een (eventueel lege) tekst voor de huidige versie', () => {
    expect(RELEASE_TEKSTEN).toHaveProperty([VERSIE])
  })

  it('toont alleen de titel als er geen tekst is', () => {
    localStorage.setItem(LAATSTE_VERSIE_KEY, '1.6.2')
    const oud = RELEASE_TEKSTEN[VERSIE]
    RELEASE_TEKSTEN[VERSIE] = ''
    render(<App />)
    expect(melding()).toHaveTextContent(/^Nieuwe versie geïnstalleerd \(v[\d.]+\)$/)
    RELEASE_TEKSTEN[VERSIE] = oud
  })
})

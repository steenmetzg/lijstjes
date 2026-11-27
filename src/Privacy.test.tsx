import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { GOOGLE_SCOPES } from './google'

const lees = (naam: string) => readFileSync(resolve(process.cwd(), 'public', naam), 'utf8')

describe('AC58: Over Lijstjes en privacy op het web (F21, F53)', () => {
  it('Over Lijstjes heeft een link naar de privacyverklaring', () => {
    localStorage.clear()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Informatie' }))
    const link = screen.getByRole('link', { name: 'privacyverklaring' })
    expect(link).toHaveAttribute('href', './privacy.html')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('de privacyverklaring noemt elk recht dat Lijstjes vraagt en Limited Use', () => {
    const privacy = lees('privacy.html')
    for (const scope of GOOGLE_SCOPES.split(' ')) expect(privacy).toContain(scope)
    expect(privacy).toContain('Limited Use')
    expect(privacy).toContain('href="./over.html"')
  })

  it('de homepage linkt naar de privacyverklaring en de app', () => {
    const over = lees('over.html')
    expect(over).toContain('href="./privacy.html"')
    expect(over).toContain('href="./"')
  })
})

import { describe, expect, it } from 'vitest'
import { gesprokenMoment } from './spraakDatum'

// Zondag 22 november 2026.
const NU = new Date(2026, 10, 22, 16, 0)

describe('gesprokenMoment (F46)', () => {
  it('herkent dag en maand, met of zonder jaar; een voorbije dag zonder jaar is volgend jaar', () => {
    expect(gesprokenMoment('25 november', false, NU)).toEqual({ datum: '2026-11-25', tijd: null })
    expect(gesprokenMoment('3 januari 2027', false, NU)).toEqual({ datum: '2027-01-03', tijd: null })
    expect(gesprokenMoment('1 maart', false, NU)).toEqual({ datum: '2027-03-01', tijd: null })
    expect(gesprokenMoment('25-11', false, NU)).toEqual({ datum: '2026-11-25', tijd: null })
    expect(gesprokenMoment('31 februari', false, NU)).toBeNull()
  })

  it('herkent vandaag, morgen, overmorgen en dagen van de week', () => {
    expect(gesprokenMoment('vandaag', false, NU)?.datum).toBe('2026-11-22')
    expect(gesprokenMoment('Morgen', false, NU)?.datum).toBe('2026-11-23')
    expect(gesprokenMoment('overmorgen', false, NU)?.datum).toBe('2026-11-24')
    expect(gesprokenMoment('vrijdag', false, NU)?.datum).toBe('2026-11-27')
    expect(gesprokenMoment('zondag', false, NU)?.datum).toBe('2026-11-29')
    expect(gesprokenMoment('volgende week dinsdag', false, NU)?.datum).toBe('2026-12-01')
  })

  it('herkent een tijd', () => {
    expect(gesprokenMoment('25 november om 14:30', false, NU)).toEqual({ datum: '2026-11-25', tijd: '14:30' })
    expect(gesprokenMoment('morgen om 9.15 uur', false, NU)?.tijd).toBe('09:15')
    expect(gesprokenMoment('morgen 10 uur', false, NU)?.tijd).toBe('10:00')
    expect(gesprokenMoment('morgen om half drie', false, NU)?.tijd).toBe('02:30')
    expect(gesprokenMoment("morgen om half 3 's middags", false, NU)?.tijd).toBe('14:30')
    expect(gesprokenMoment('vrijdag kwart over 8', false, NU)?.tijd).toBe('08:15')
    expect(gesprokenMoment("vrijdag om 8 uur 's avonds", false, NU)?.tijd).toBe('20:00')
  })

  it('zonder jaar alleen dag en maand, en geen datum zonder datum', () => {
    expect(gesprokenMoment('29 februari', true, NU)?.datum).toBe('2000-02-29')
    expect(gesprokenMoment('om 14:30', false, NU)).toEqual({ datum: null, tijd: '14:30' })
    expect(gesprokenMoment('ergens', false, NU)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  formatWeight,
  fromDisplayDistance,
  fromDisplayWeight,
  kgToLb,
  lbToKg,
  metresToKm,
  metresToMiles,
  round,
  toDisplayWeight,
} from './units'

describe('conversions', () => {
  it('matches known reference values', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3)
    expect(lbToKg(45)).toBeCloseTo(20.4117, 3)
    expect(metresToKm(5000)).toBe(5)
    expect(metresToMiles(1609.344)).toBeCloseTo(1, 9)
  })

  it('round-trips kg -> lb -> kg without drift', () => {
    for (const kg of [0.5, 20, 42.5, 82.5, 137.75, 250]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 10)
    }
  })

  it('round-trips distance through the display unit', () => {
    for (const metres of [400, 1609.344, 5000, 21097.5]) {
      expect(fromDisplayDistance(metresToMiles(metres), 'mi')).toBeCloseTo(metres, 6)
      expect(fromDisplayDistance(metresToKm(metres), 'km')).toBeCloseTo(metres, 9)
    }
  })

  it('round-trips a weight the user typed in lb', () => {
    const stored = fromDisplayWeight(225, 'lb')
    expect(toDisplayWeight(stored, 'lb')).toBeCloseTo(225, 9)
    expect(stored).toBeCloseTo(102.058, 3)
  })
})

describe('round', () => {
  it('kills float noise instead of propagating it', () => {
    expect(round(82.50000000001, 1)).toBe(82.5)
    expect(round(0.1 + 0.2, 1)).toBe(0.3)
  })

  it('rounds half away from zero at the displayed decimal', () => {
    expect(round(2.25, 1)).toBe(2.3)
    expect(round(-1.5, 0)).toBe(-2)
  })

  it('returns NaN for non-finite input rather than throwing', () => {
    expect(round(NaN)).toBeNaN()
    expect(round(Infinity)).toBeNaN()
  })
})

describe('formatWeight', () => {
  it('never leaks float noise into the display string', () => {
    expect(formatWeight(82.50000000001, 'kg')).toBe('82.5 kg')
  })

  it('drops a trailing zero decimal', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg')
  })

  it('converts to lb with one decimal', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })

  it('shows a placeholder for non-finite weights (e.g. an out-of-range 1RM)', () => {
    expect(formatWeight(NaN, 'kg')).toBe('—')
  })
})

describe('formatDistance', () => {
  it('formats both units', () => {
    expect(formatDistance(5000, 'km')).toBe('5 km')
    expect(formatDistance(5000, 'mi')).toBe('3.11 mi')
  })
})

describe('formatDuration', () => {
  it('omits the hours field under an hour', () => {
    expect(formatDuration(330)).toBe('5:30')
    expect(formatDuration(59)).toBe('0:59')
    expect(formatDuration(0)).toBe('0:00')
  })

  it('pads minutes once hours are shown', () => {
    expect(formatDuration(3930)).toBe('1:05:30')
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('handles the exact boundary at one hour', () => {
    expect(formatDuration(3599)).toBe('59:59')
  })

  it('rolls fractional seconds up correctly instead of printing :60', () => {
    expect(formatDuration(59.6)).toBe('1:00')
    expect(formatDuration(3599.7)).toBe('1:00:00')
  })

  it('clamps nonsense input', () => {
    expect(formatDuration(-5)).toBe('0:00')
    expect(formatDuration(NaN)).toBe('0:00')
  })
})

describe('formatPace', () => {
  it('reports minutes per kilometre', () => {
    // 6 km in 29:12 → 4:52 /km
    expect(formatPace(1752, 6000, 'km')).toBe('4:52 /km')
  })

  it('reports minutes per mile', () => {
    expect(formatPace(1752, 6000, 'mi')).toBe('7:50 /mi')
  })

  it('refuses to divide by no distance', () => {
    expect(formatPace(1800, 0, 'km')).toBe('—')
    expect(formatPace(0, 5000, 'km')).toBe('—')
  })
})

describe('formatSpeed', () => {
  it('reports distance per hour', () => {
    expect(formatSpeed(3600, 30000, 'km')).toBe('30 km/h')
    expect(formatSpeed(1800, 15000, 'km')).toBe('30 km/h')
  })

  it('guards against a zero duration', () => {
    expect(formatSpeed(0, 5000, 'km')).toBe('—')
  })
})

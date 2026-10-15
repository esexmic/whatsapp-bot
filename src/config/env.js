import dotenv from 'dotenv'
dotenv.config()

export const isProd = process.env.NODE_ENV === 'production'

export function env(key, fallback = '') {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : v
}

export function envBool(key, fallback = false) {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  return /^(1|true|yes|on)$/i.test(String(v).trim())
}

export function envInt(key, fallback) {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}
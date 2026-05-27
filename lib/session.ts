import fs from 'fs'
import path from 'path'
import os from 'os'

const SESSION_ROOT = path.join(os.tmpdir(), 'video-editor-sessions')

export function getSessionDir(sessionId: string): string {
  return path.join(SESSION_ROOT, sessionId)
}

export function ensureSessionDir(sessionId: string): string {
  const dir = getSessionDir(sessionId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getInputPath(sessionId: string): string {
  const dir = getSessionDir(sessionId)
  const files = fs.readdirSync(dir).filter(f => f.startsWith('input.'))
  if (files.length === 0) throw new Error('Input file not found')
  return path.join(dir, files[0])
}

export function cleanSession(sessionId: string): void {
  const dir = getSessionDir(sessionId)
  fs.rmSync(dir, { recursive: true, force: true })
}

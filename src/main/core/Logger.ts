// ============================================================
// Merkezi Loglama Sistemi - Singleton Pattern
// Neden Singleton: Uygulama genelinde tek bir log dosyasına
// tutarlı formatta yazılmasını garanti eder.
// ============================================================

import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, appendFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export class Logger {
  private static instance: Logger | null = null
  private logPath: string

  private constructor() {
    this.logPath = this.getLogPath()
    this.ensureDirectory()
  }

  /** Singleton instance döndürür */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /** Log dosyası yolunu belirler */
  private getLogPath(): string {
    const today = format(new Date(), 'yyyy-MM-dd', { locale: tr })
    const logFileName = `evrak-kayit-${today}.log`

    if (is.dev) {
      return join(app.getAppPath(), 'data', 'logs', logFileName)
    }
    return join(dirname(app.getPath('exe')), 'data', 'logs', logFileName)
  }

  /** Log dizinini oluşturur */
  private ensureDirectory(): void {
    const dir = dirname(this.logPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  /** Log satırını formatlar ve dosyaya yazar */
  private writeLog(level: LogLevel, message: string, context?: string, error?: Error): void {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss', { locale: tr })
    const contextStr = context ? `[${context}]` : ''
    const logLine = `[${timestamp}] [${level}] ${contextStr} ${message}`
    const errorLine = error?.stack ? `\n  Stack: ${error.stack}` : ''
    const fullLine = `${logLine}${errorLine}\n`

    // Konsola yaz (geliştirme modunda)
    if (is.dev) {
      switch (level) {
        case 'ERROR':
          console.error(fullLine)
          break
        case 'WARN':
          console.warn(fullLine)
          break
        case 'DEBUG':
          console.debug(fullLine)
          break
        default:
          console.log(fullLine)
      }
    }

    // Dosyaya yaz
    try {
      appendFileSync(this.logPath, fullLine, 'utf-8')
    } catch {
      console.error(`Log dosyasına yazılamadı: ${this.logPath}`)
    }
  }

  info(message: string, context?: string): void {
    this.writeLog('INFO', message, context)
  }

  warn(message: string, context?: string): void {
    this.writeLog('WARN', message, context)
  }

  error(message: string, error?: Error, context?: string): void {
    this.writeLog('ERROR', message, context, error)
  }

  debug(message: string, context?: string): void {
    this.writeLog('DEBUG', message, context)
  }
}

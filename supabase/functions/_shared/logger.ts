type LogContext = Record<string, unknown>

const formatArgs = (message: string, context?: LogContext) => {
  if (context && Object.keys(context).length > 0) {
    return [message, context] as const
  }
  return [message] as const
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.info(...formatArgs(message, context))
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(...formatArgs(message, context))
  },
  error: (message: string, context?: LogContext) => {
    console.error(...formatArgs(message, context))
  },
  debug: (message: string, context?: LogContext) => {
    if (Deno.env.get('LOG_LEVEL') === 'debug') {
      console.debug(...formatArgs(message, context))
    }
  },
}

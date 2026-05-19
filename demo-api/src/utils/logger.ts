import util from 'node:util';

export interface LogContext {
  [key: string]: unknown;
}

interface LoggerStream {
  write: (message: string) => void;
}

interface LogPayload extends LogContext {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

const LEVEL_PRIORITY: Record<LogPayload['level'], number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeError(error: Error): LogContext {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function serializePayload(payload: LogPayload): string {
  return JSON.stringify(payload, (_key, value: unknown) => {
    if (value instanceof Error) {
      return normalizeError(value);
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    return value;
  });
}

function resolveMinimumLevel(): LogPayload['level'] {
  const rawLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (rawLevel === 'debug' || rawLevel === 'info' || rawLevel === 'warn' || rawLevel === 'error') {
    return rawLevel;
  }

  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

/**
 * 轻量级结构化日志器。
 */
export class Logger {
  private readonly minimumLevel: LogPayload['level'];

  public readonly stream: LoggerStream;

  public constructor(private readonly defaultContext: LogContext = {}) {
    this.minimumLevel = resolveMinimumLevel();
    this.stream = {
      write: (message: string) => {
        const trimmedMessage = message.trim();
        if (trimmedMessage.length > 0) {
          this.info(trimmedMessage, { scope: 'http' });
        }
      },
    };
  }

  public child(context: LogContext): Logger {
    return new Logger({
      ...this.defaultContext,
      ...context,
    });
  }

  public debug(message: string, context: LogContext = {}): void {
    this.emit('debug', message, context);
  }

  public info(message: string, context: LogContext = {}): void {
    this.emit('info', message, context);
  }

  public warn(message: string, context: LogContext = {}): void {
    this.emit('warn', message, context);
  }

  public error(message: string, context: LogContext = {}): void {
    this.emit('error', message, context);
  }

  private emit(level: LogPayload['level'], message: string, context: LogContext): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minimumLevel]) {
      return;
    }

    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaultContext,
      ...context,
    };

    const serialized = serializePayload(payload);

    switch (level) {
      case 'debug':
        console.debug(serialized);
        break;
      case 'info':
        console.info(serialized);
        break;
      case 'warn':
        console.warn(serialized);
        break;
      case 'error':
        console.error(serialized);
        break;
      default:
        console.log(util.inspect(payload, { depth: null, colors: false }));
        break;
    }
  }
}

export const logger = new Logger({ service: 'demo-api' });
export const requestLoggerStream = logger.stream;

import { existsSync } from 'fs';

export function getEnvFilePath() {
  if (process.env.NODE_ENV === 'production') {
    return existsSync('.env.prod') ? ['.env.prod', '.env'] : ['.env'];
  }

  return ['.env'];
}

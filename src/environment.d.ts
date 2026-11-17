declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      HOST?: string;
      NODE_ENV?: string;
      /** Enables HTTP Basic auth when set */
      AUTH_PASSWORD?: string;
      AUTH_USER?: string;
      /** Escape hatch for the Broccoli2Shell runtime check - do not use in production */
      ALLOW_VULNERABLE_NODE?: string;
      /** SQLite file, defaults to <project>/data/db.sqlite3 */
      DB_PATH?: string;
    }
  }
}

export {};

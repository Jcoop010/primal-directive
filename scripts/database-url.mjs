/** Validate PostgreSQL connection syntax without ever echoing credentials. */
export function validateDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid database URL; expected a PostgreSQL connection string.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Database URL must use postgresql:// or postgres://.");
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    throw new Error("Database URL hostname is invalid; check the provider connection string.");
  }
  if (!url.username || !url.password) {
    throw new Error("Database URL must include a username and password.");
  }
  let password;
  try {
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error("Database URL password is not correctly percent-encoded.");
  }
  if (/^(?:your[_ -]?password|\[.*\]|placeholder|password)$/i.test(password)) {
    throw new Error("Database URL contains a placeholder instead of a database password.");
  }
  if (url.pathname === "/" || !url.pathname) {
    throw new Error("Database URL must specify a database name.");
  }
  return value;
}

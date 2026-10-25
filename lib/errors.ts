/** Errors we raise on purpose, with an HTTP status the route can use. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}
export const configError = (what: string) =>
  new AppError(`${what} is not configured. Check your .env.local file (see .env.example).`, 500);

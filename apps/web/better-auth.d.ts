/**
 * Глобальное расширение типов Better-Auth
 */

declare module "better-auth/types" {
  interface User {
    role: string;
  }

  interface Session {
    user: User;
  }
}

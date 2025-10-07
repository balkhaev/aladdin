/**
 * Расширение типов Better-Auth для добавления роли пользователя
 */

declare module "better-auth/types" {
  interface User {
    role: string;
  }
}

export {};

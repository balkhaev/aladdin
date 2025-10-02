import crypto from "node:crypto";

/**
 * Криптографический модуль для безопасного хранения sensitive данных
 * Использует AES-256-GCM для authenticated encryption
 */

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Получить encryption key из переменной окружения
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. Generate one using: openssl rand -hex 32"
    );
  }

  // Проверка длины ключа
  if (key.length !== KEY_LENGTH * 2) {
    // hex = 2 chars per byte
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Результат шифрования
 */
export interface EncryptedData {
  encrypted: string; // Зашифрованные данные (hex)
  iv: string; // Initialization vector (hex)
  authTag: string; // Authentication tag (hex)
}

/**
 * Зашифровать текст
 *
 * @param plaintext - Исходный текст для шифрования
 * @returns Зашифрованные данные с IV и auth tag
 *
 * @example
 * ```typescript
 * const encrypted = encrypt("my-secret-api-key");
 * // Сохранить в БД: encrypted.encrypted, encrypted.iv, encrypted.authTag
 * ```
 */
export function encrypt(plaintext: string): EncryptedData {
  if (!plaintext) {
    throw new Error("Plaintext cannot be empty");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Расшифровать текст
 *
 * @param encrypted - Зашифрованные данные (hex)
 * @param iv - Initialization vector (hex)
 * @param authTag - Authentication tag (hex)
 * @returns Расшифрованный текст
 *
 * @throws Error если данные повреждены или auth tag невалиден
 *
 * @example
 * ```typescript
 * const plaintext = decrypt(
 *   encrypted.encrypted,
 *   encrypted.iv,
 *   encrypted.authTag
 * );
 * ```
 */
export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string
): string {
  if (!(encrypted && iv && authTag)) {
    throw new Error("Encrypted data, IV, and auth tag are required");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Сгенерировать случайный encryption key
 * Используется для генерации ENCRYPTION_KEY
 *
 * @returns Hex string длиной 64 символа (32 байта)
 *
 * @example
 * ```bash
 * # В терминале
 * bun run -e "import { generateKey } from '@aladdin/shared/crypto'; console.log(generateKey())"
 * ```
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

/**
 * Hash пароля используя scrypt (безопасный KDF)
 *
 * @param password - Пароль для хеширования
 * @param salt - Salt (опционально, будет сгенерирован если не указан)
 * @returns Объект с hash и salt
 *
 * @example
 * ```typescript
 * const { hash, salt } = await hashPassword("user-password");
 * // Сохранить hash и salt в БД
 * ```
 */
export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ hash: string; salt: string }> {
  const saltBuffer = salt ? Buffer.from(salt, "hex") : crypto.randomBytes(16);

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, saltBuffer, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        hash: derivedKey.toString("hex"),
        salt: saltBuffer.toString("hex"),
      });
    });
  });
}

/**
 * Verify пароль
 *
 * @param password - Пароль для проверки
 * @param hash - Сохраненный hash
 * @param salt - Сохраненный salt
 * @returns true если пароль верный
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword(
 *   "user-password",
 *   savedHash,
 *   savedSalt
 * );
 * ```
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const { hash: derivedHash } = await hashPassword(password, salt);
  return derivedHash === hash;
}

/**
 * Генерировать cryptographically secure random token
 *
 * @param length - Длина токена в байтах (по умолчанию 32)
 * @returns Hex string
 *
 * @example
 * ```typescript
 * const apiToken = generateToken(32); // 64 hex chars
 * ```
 */
export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Безопасное сравнение строк (защита от timing attacks)
 *
 * @param a - Первая строка
 * @param b - Вторая строка
 * @returns true если строки равны
 *
 * @example
 * ```typescript
 * const isValid = safeCompare(userToken, storedToken);
 * ```
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return crypto.timingSafeEqual(bufferA, bufferB);
}

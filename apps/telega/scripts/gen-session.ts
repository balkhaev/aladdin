import dotenv from "dotenv";
import input from "input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

dotenv.config({ path: ".env" });

const apiId = Number(process.env.TELEGRAM_API_ID); // вставьте число или используйте env
const apiHash = process.env.TELEGRAM_API_HASH as string; // вставьте строку или используйте env
const stringSession = new StringSession(""); // пустая строка => создаём новую сессию

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Номер телефона (вместе с +): "),
    password: async () => await input.text("2FA пароль (если есть): "),
    phoneCode: async () => await input.text("Код из Telegram: "),
    onError: (err) => console.error(err),
    // Для бота вместо phoneNumber/phoneCode можно:
    // botAuthToken: async () => await input.text("Bot token (1234:ABC...): "),
  });

  console.log("\n=== TELEGRAM_SESSION_STRING ===\n");
  console.log(client.session.save()); // <-- скопируйте это значение
  console.log(
    "\nСессию можно сохранить в переменной окружения TELEGRAM_SESSION_STRING."
  );
  await client.disconnect();
})();

import { createAuthClient } from "better-auth/react";
import "./auth-types";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL,
  fetchOptions: {
    credentials: "include",
  },
});

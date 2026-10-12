import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "./constants";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("emailInvalid"));
const newPassword = z.string().min(PASSWORD_MIN, "passwordShort").max(PASSWORD_MAX, "passwordLong");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
  email: emailSchema,
  password: newPassword,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "invalidCredentials"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: newPassword });

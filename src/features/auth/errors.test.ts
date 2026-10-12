import { describe, expect, it } from "vitest";
import { authErrorKey, fieldForAuthError } from "./errors";

describe("authErrorKey", () => {
  it.each([
    [{ code: "USER_ALREADY_EXISTS" }, "emailTaken"],
    [{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }, "emailTaken"],
    [{ code: "INVALID_EMAIL_OR_PASSWORD" }, "invalidCredentials"],
    [{ code: "EMAIL_NOT_VERIFIED" }, "notVerified"],
    [{ code: "PASSWORD_TOO_SHORT" }, "passwordShort"],
    [{ code: "PASSWORD_TOO_LONG" }, "passwordLong"],
    [{ code: "PASSWORD_TOO_COMMON" }, "passwordCommon"],
    [{ code: "INVALID_TOKEN" }, "invalidToken"],
    [{ code: "TOKEN_EXPIRED" }, "invalidToken"],
    [{ status: 429 }, "tooMany"],
    [{ code: "SOMETHING_NEW" }, "generic"],
    [null, "generic"],
  ] as const)("%j → %s", (input, expected) => {
    expect(authErrorKey(input)).toBe(expected);
  });
});

describe("fieldForAuthError", () => {
  it("routes errors to the field they belong to", () => {
    expect(fieldForAuthError("passwordCommon")).toBe("password");
    expect(fieldForAuthError("emailTaken")).toBe("email");
    expect(fieldForAuthError("nameTooLong")).toBe("name");
    expect(fieldForAuthError("tooMany")).toBe("form");
  });
});

// Lowercased. Only entries of 8+ characters matter (shorter ones fail the length rule).
// Extend with local terms as abuse patterns appear.
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "mypassword", "changeme",
  "12345678", "123456789", "1234567890", "123123123", "987654321", "12341234", "11223344",
  "11111111", "00000000", "22222222", "33333333", "44444444", "55555555", "66666666",
  "77777777", "88888888", "99999999", "999999999", "12121212", "11112222",
  "qwertyuiop", "qwerty123", "qwerty12", "qwertyui", "1q2w3e4r", "q1w2e3r4", "1qaz2wsx",
  "zaq12wsx", "asdfghjk", "asdf1234", "zxcvbnm1", "1234qwer", "123qweasd", "aa123456",
  "a1234567", "abc12345", "iloveyou", "iloveyou1", "loveyou1", "sunshine", "princess",
  "football", "football1", "baseball", "welcome1", "welcome123", "admin123", "letmein1",
  "trustno1", "superman", "michael1", "computer", "computer1", "whatever", "starwars",
  "dragon12", "master12", "monkey123", "shadow12", "jesus123", "hello123", "test1234",
  "pass1234", "internet", "samsung1", "google123", "facebook", "nokia123", "manchester",
  "liverpool", "arsenal1", "chelsea1", "barcelona", "realmadrid",
  "rwanda123", "rwanda2024", "rwanda2025", "rwanda2026", "kigali123", "kigali2026",
  "spacerental", "space123",
]);

/**
 * Credential encryption tests.
 *
 * Run with:  npm run test:crypto
 */

process.env.APP_SECRET = "test-secret-that-is-at-least-32-chars-long";

import {
  encryptSecret, decryptSecret, maskSecret, secretsMatch,
  generateAppSecret, hasAppSecret, MissingAppSecretError,
} from "../secret-crypto";

let passed = 0, failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected ${e}\n      actual   ${a}`); }
}

// -----------------------------------------------------------------------------
console.log("\n1. Round trip");
{
  const secret = "demo_key_51H8xQpLmNqRsTuVwXyZ0123456789";
  const encrypted = encryptSecret(secret);

  check("decrypts back to the original", decryptSecret(encrypted), secret);
  check("ciphertext does not contain the plaintext", encrypted.includes(secret), false);
  check("ciphertext does not leak the tail",
    encrypted.includes(secret.slice(-8)), false);
  check("payload has all four parts", encrypted.split(".").length, 4);

  const long = "x".repeat(4000);
  check("handles a long value", decryptSecret(encryptSecret(long)), long);

  const unicode = "কী-গোপন-১২৩";
  check("handles non-ASCII", decryptSecret(encryptSecret(unicode)), unicode);
}

// -----------------------------------------------------------------------------
console.log("\n2. Same input never produces the same ciphertext");
{
  const secret = "AIzaSyDummyKeyForTesting123456";
  const a = encryptSecret(secret);
  const b = encryptSecret(secret);

  check("two encryptions differ", a === b, false);
  check("but both decrypt correctly",
    [decryptSecret(a), decryptSecret(b)], [secret, secret]);
}

// -----------------------------------------------------------------------------
console.log("\n3. Tampering is detected, not silently decrypted");
{
  const encrypted = encryptSecret("demo_key_realkey1234");
  const [salt, iv, tag, ct] = encrypted.split(".");

  const flipLast = (s: string) => {
    const buf = Buffer.from(s, "base64url");
    buf[buf.length - 1] ^= 0x01;
    return buf.toString("base64url");
  };

  let threw = false;
  try { decryptSecret([salt, iv, tag, flipLast(ct)].join(".")); } catch { threw = true; }
  check("altered ciphertext throws", threw, true);

  threw = false;
  try { decryptSecret([salt, iv, flipLast(tag), ct].join(".")); } catch { threw = true; }
  check("altered auth tag throws", threw, true);

  threw = false;
  try { decryptSecret([flipLast(salt), iv, tag, ct].join(".")); } catch { threw = true; }
  check("altered salt throws", threw, true);

  threw = false;
  try { decryptSecret("not-a-valid-payload"); } catch { threw = true; }
  check("malformed payload throws", threw, true);
}

// -----------------------------------------------------------------------------
console.log("\n4. A different master key cannot decrypt");
{
  const encrypted = encryptSecret("demo_key_secret_value_here");
  const original = process.env.APP_SECRET;
  process.env.APP_SECRET = "a-completely-different-secret-32-chars";

  let threw = false;
  try { decryptSecret(encrypted); } catch { threw = true; }
  check("wrong APP_SECRET cannot decrypt", threw, true);

  process.env.APP_SECRET = original;
  check("restoring the key restores access",
    decryptSecret(encrypted), "demo_key_secret_value_here");
}

// -----------------------------------------------------------------------------
console.log("\n5. Refuses to operate without APP_SECRET");
{
  const original = process.env.APP_SECRET;

  delete process.env.APP_SECRET;
  check("reports missing secret", hasAppSecret(), false);
  let err: unknown = null;
  try { encryptSecret("anything"); } catch (e) { err = e; }
  check("encrypting throws rather than storing plaintext",
    err instanceof MissingAppSecretError, true);

  process.env.APP_SECRET = "too-short";
  check("a short secret is rejected", hasAppSecret(), false);

  process.env.APP_SECRET = original;
  check("a proper secret is accepted", hasAppSecret(), true);
}

// -----------------------------------------------------------------------------
console.log("\n6. Masking shows enough to recognise, never enough to use");
{
  const key = "demo_key_51H8xQpLmNqRsTuVwXyZ9876";
  const masked = maskSecret(key);

  check("keeps the recognisable prefix", masked.startsWith("demo_key_"), true);
  check("keeps the last four", masked.endsWith("9876"), true);
  check("hides the middle", masked.includes("51H8xQpLmNqRsTuVwXyZ"), false);
  check("is not the original", masked === key, false);

  check("a short value is fully hidden", maskSecret("abc123"), "••••••");
  check("empty stays empty", maskSecret(""), "");

  const noPrefix = maskSecret("9f8e7d6c5b4a3210fedc");
  check("works without a prefix", noPrefix.endsWith("fedc"), true);
  check("and hides the rest", noPrefix.includes("9f8e7d6c"), false);
}

// -----------------------------------------------------------------------------
console.log("\n7. Comparison and secret generation");
{
  check("identical values match", secretsMatch("abc123", "abc123"), true);
  check("different values do not", secretsMatch("abc123", "abc124"), false);
  check("different lengths do not", secretsMatch("abc", "abcd"), false);

  const s1 = generateAppSecret();
  const s2 = generateAppSecret();
  check("generated secret is long enough", s1.length >= 32, true);
  check("two generated secrets differ", s1 === s2, false);
  check("url-safe characters only", /^[A-Za-z0-9_-]+$/.test(s1), true);
}

// -----------------------------------------------------------------------------
console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

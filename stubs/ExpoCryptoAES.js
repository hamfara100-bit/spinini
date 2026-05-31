/**
 * Expo Go stub for ExpoCryptoAES native module.
 *
 * expo-crypto/build/aes/index.js does:
 *   class AESEncryptionKey extends AesCryptoModule.EncryptionKey {}
 *   class AESSealedData   extends AesCryptoModule.SealedData {}
 *
 * So the default export MUST be an object whose .EncryptionKey and .SealedData
 * are proper classes (constructor functions). expo-auth-session only calls
 * digestStringAsync (SHA-256) — never the AES functions — so these stubs are safe.
 */

class EncryptionKey {}

class SealedData {
  static fromParts()    { throw new Error("AES unavailable in Expo Go — use EAS Build"); }
  static fromCombined() { throw new Error("AES unavailable in Expo Go — use EAS Build"); }
}

const AESModule = {
  EncryptionKey,
  SealedData,
  encryptAsync:      () => Promise.reject(new Error("AES unavailable in Expo Go")),
  decryptAsync:      () => Promise.reject(new Error("AES unavailable in Expo Go")),
  generateKeyAsync:  () => Promise.reject(new Error("AES unavailable in Expo Go")),
  importKeyAsync:    () => Promise.reject(new Error("AES unavailable in Expo Go")),
  exportKeyAsync:    () => Promise.reject(new Error("AES unavailable in Expo Go")),
};

// Support both ESM default import and CommonJS require()
module.exports = AESModule;
module.exports.default = AESModule;

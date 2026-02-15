/**
 * eIDAS AES tanúsítvány-generáló utility
 *
 * Önalírt X.509 tanúsítvány + PKCS#12 (.p12) generálása aláíróként.
 * Az ephemeral tanúsítvány tartalmazza az aláíró identitását (név, email, cég)
 * és kielégíti az eIDAS AES követelményeket:
 *   - Egyedileg az aláíróhoz kötött (egyedi serial number + kulcspár)
 *   - Az aláíró azonosítására alkalmas (CN, emailAddress, O a Subject DN-ben)
 */

import forge from 'node-forge';
import crypto from 'crypto';

export interface SignerP12Result {
  /** PKCS#12 (.p12) buffer — a @signpdf/signer-p12 P12Signer-nek adható */
  p12Buffer: Buffer;
  /** PEM formátumú tanúsítvány */
  certPem: string;
  /** SHA-256 tanúsítvány ujjlenyomat (hex, kettőspont nélkül) */
  fingerprint: string;
}

export interface GenerateSignerP12Options {
  /** Aláíró teljes neve (pl. "Kovács János") */
  signerName: string;
  /** Aláíró email címe (pl. "kovacs@example.com") */
  signerEmail: string;
  /** Cég neve (opcionális, pl. "ABC Szigetelés Kft.") */
  companyName?: string;
}

/**
 * Önalírt X.509 tanúsítvány + PKCS#12 (.p12) generálása az aláíró adataival.
 *
 * - RSA 2048-bit kulcspár
 * - Subject: CN=signerName, emailAddress=signerEmail, O=companyName
 * - Érvényesség: 1 év (a keletkezés pillanatától)
 * - Serial number: egyedi (timestamp + random)
 * - P12 jelszó: üres string (ephemeral, azonnal használjuk és eldobjuk)
 */
export function generateSignerP12(opts: GenerateSignerP12Options): SignerP12Result {
  const { signerName, signerEmail, companyName } = opts;

  // --- RSA 2048-bit kulcspár generálás ---
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 });

  // --- X.509 tanúsítvány létrehozása ---
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;

  // Egyedi serial number: timestamp (ms) + 8 random byte → BigInteger
  const serialHex =
    Date.now().toString(16) + crypto.randomBytes(8).toString('hex');
  cert.serialNumber = serialHex;

  // Érvényesség: most-tól 1 évig
  const now = new Date();
  cert.validity.notBefore = now;
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  cert.validity.notAfter = oneYearLater;

  // Subject Distinguished Name
  // UTF8 kódolás az ékezetes magyar nevek/cégnevek miatt (PrintableString csak ASCII!)
  const subjectAttrs: forge.pki.CertificateField[] = [
    { name: 'commonName', value: signerName, valueTagClass: forge.asn1.Type.UTF8 },
    { name: 'emailAddress', value: signerEmail },
  ];
  if (companyName) {
    subjectAttrs.push({ name: 'organizationName', value: companyName, valueTagClass: forge.asn1.Type.UTF8 });
  }
  subjectAttrs.push({ name: 'countryName', value: 'HU' });

  cert.setSubject(subjectAttrs);

  // Issuer = Subject (önalírt)
  cert.setIssuer(subjectAttrs);

  // Extensions
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false,
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
    },
    {
      name: 'extKeyUsage',
      // emailProtection OID: az eIDAS kontextusban releváns
      emailProtection: true,
    },
    {
      name: 'subjectAltName',
      altNames: [
        {
          type: 1, // rfc822Name (email)
          value: signerEmail,
        },
      ],
    },
  ]);

  // Aláírás SHA-256-tal
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // --- PKCS#12 (.p12) export ---
  // Üres jelszóval, mert ephemeral: azonnal felhasználjuk az aláíráshoz
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    '', // password: üres
    {
      algorithm: '3des', // kompatibilitás a legtöbb PDF olvasóval
      friendlyName: signerName,
    }
  );
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, 'binary');

  // PEM export
  const certPem = forge.pki.certificateToPem(cert);

  // SHA-256 ujjlenyomat
  const fingerprint = getCertificateFingerprint(certPem);

  return {
    p12Buffer,
    certPem,
    fingerprint,
  };
}

/**
 * Tanúsítvány ujjlenyomat (SHA-256) kiszámítása PEM stringből.
 * Visszatérés: lowercase hex string (64 karakter, kettőspont nélkül).
 */
export function getCertificateFingerprint(certPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha256.create();
  md.update(derBytes);
  return md.digest().toHex();
}

/**
 * PDF buffer SHA-256 hash-jének kiszámítása.
 * Az aláírás előtti dokumentum integritásának rögzítéséhez.
 */
export function computeDocumentHash(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
}

/**
 * Template lifecycle hooks.
 *
 * Sablon létrehozásakor/frissítésekor:
 * - Ha van template_file (DOCX), kiolvassuk, mely aláírás tokenek ({%signature1}, {%signature2}) szerepelnek.
 * - Automatikusan beállítjuk a require_signature1 / require_signature2 mezőket.
 * Így nem kell kézzel állítgatni a Strapi adminban.
 */

import PizZip from 'pizzip';

function detectSignatureTokens(docxBuffer: Buffer): { has1: boolean; has2: boolean } {
  try {
    const zip = new PizZip(docxBuffer);
    const xmlFiles = [
      'word/document.xml',
      'word/header1.xml', 'word/header2.xml',
      'word/footer1.xml', 'word/footer2.xml',
    ];
    let plainText = '';
    for (const fileName of xmlFiles) {
      const file = zip.file(fileName);
      if (file) {
        plainText += file.asText().replace(/<[^>]+>/g, '') + ' ';
      }
    }
    return {
      has1: /signature1/.test(plainText),
      has2: /signature2/.test(plainText),
    };
  } catch {
    return { has1: true, has2: true };
  }
}

async function updateRequireFlags(event: any) {
  const { result } = event;
  if (!result) return;

  // Template file-ból detect
  let templateFile = result.template_file;

  // Ha a populate nem hozta vissza a fájlt, kézzel lekérjük
  if (!templateFile || !templateFile.url) {
    try {
      const full = await strapi.entityService.findOne(
        'api::template.template',
        result.id,
        { populate: ['template_file'] }
      );
      templateFile = full?.template_file;
    } catch {
      return;
    }
  }

  if (!templateFile || !templateFile.url) return;

  try {
    const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
    const fullUrl = templateFile.url.startsWith('http')
      ? templateFile.url
      : `${serverUrl}${templateFile.url}`;

    const response = await fetch(fullUrl);
    if (!response.ok) return;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { has1, has2 } = detectSignatureTokens(buffer);

    // Csak frissítjük, ha eltér a jelenlegi értéktől (elkerüljük a végtelen ciklust)
    if (result.require_signature1 !== has1 || result.require_signature2 !== has2) {
      await strapi.entityService.update('api::template.template', result.id, {
        data: {
          require_signature1: has1,
          require_signature2: has2,
        },
      });
      strapi.log.info(
        `Template "${result.name}" signature flags auto-set: sig1=${has1}, sig2=${has2}`
      );
    }
  } catch (err: any) {
    strapi.log.warn(`Template lifecycle: could not detect signature tokens: ${err.message}`);
  }
}

export default {
  afterCreate: updateRequireFlags,
  afterUpdate: updateRequireFlags,
};

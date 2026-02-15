/**
 * document service
 */

import { factories } from '@strapi/strapi';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';

// Feltételes import - csak akkor töltjük be, ha telepítve van
let ImageModule: any = null;
try {
  // @ts-ignore
  ImageModule = require('docxtemplater-image-module-free');
} catch (e) {
  // Ha nincs telepítve, akkor null marad
  // Ez csak a szerveren lesz telepítve
}
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { writeFile, unlink } from 'fs/promises';
import crypto from 'crypto';

// PAdES digitális aláírás csomagok - feltételes import (szerveren telepítve)
let signpdf: any = null;
let P12Signer: any = null;
let plainAddPlaceholder: any = null;
let certificateUtils: any = null;

try {
  signpdf = require('@signpdf/signpdf').default;
  P12Signer = require('@signpdf/signer-p12').P12Signer;
  plainAddPlaceholder = require('@signpdf/placeholder-plain').plainAddPlaceholder;
  certificateUtils = require('./certificate-utils');
} catch (e) {
  // PAdES csomagok nem telepítettek — a signDocumentPades() metódus hibát dob
}

const execAsync = promisify(exec);

import { calculateSignaturePosition, type SignatureAnchor } from './signature-position';

/** PNG buffer IHDR-ból kiolvassa a szélességet és magasságot (px). */
function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

/** Kép mérete arányosan a maxW x maxH dobozba (teljes kép látszik, nem vágja le). */
function fitSize(
  imgW: number,
  imgH: number,
  maxW: number,
  maxH: number,
): [number, number] {
  if (imgW <= 0 || imgH <= 0) return [maxW, maxH];
  const r = Math.min(maxW / imgW, maxH / imgH, 1);
  return [Math.round(imgW * r), Math.round(imgH * r)];
}

/** Aláírás kép max mérete (nagyobb érték = élesebb, kevésbé pixeles beágyazás). */
/** Aláírás overlay mérete PDF-ben (pt). Kisebb = jobban illeszkedik a sablonhoz. */
const SIGNATURE_MAX_WIDTH = 180;
const SIGNATURE_MAX_HEIGHT = 60;

/** Minimális 1x1 átlátszó PNG buffer — ha a {%signature} token üres, ezt adja az ImageModule (nem crash-el). */
const TRANSPARENT_1PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
  'Nl7BcQAAAABJRU5ErkJggg==',
  'base64'
);

// --- pdfjs-dist (text pozíció keresés PDF-ben) ---
let pdfjsLib: any = null;
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  // Node.js-ben nincs web worker — letiltjuk
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
} catch {
  // Ha nincs telepítve, fallback az overlay megoldásra
}

// --- Marker-alapú aláírás pozíció detektálás segédfüggvények ---

/** Egyedi marker szövegek – ezek kerülnek a DOCX-ba a {%signatureN} tokenek helyére */
/** Marker szövegek – NEM használhatunk { } jelet, mert a Docxtemplater tokennek értelmezné → Multi error */
const SIG_MARKERS: Record<string, string> = {
  '{%signature1}': '__SIG1__',
  '{%signature2}': '__SIG2__',
  '{%signature}': '__SIG0__',
};

/** Pozíció leírás (PDF user space: y=0 a lap alján, x=0 bal szélen) */
interface MarkerPosition {
  page: number;   // 1-based oldalszám
  x: number;      // PDF pt – bal széltől
  y: number;      // PDF pt – lap aljától
  width: number;  // marker szöveg szélessége
  height: number; // marker szöveg magassága
}

/**
 * DOCX XML-ben kicseréli a {%signatureN} tokeneket marker szövegre.
 * Kezeli a Word XML run-szétbontását (a token több <w:t> elemre bomolhat).
 */
function replaceSignatureTokensInDocx(
  docxBuffer: Buffer,
  markers: Record<string, string>,
): Buffer {
  const zip = new PizZip(docxBuffer);

  // PizZip file list
  const xmlPaths = Object.keys((zip as any).files || {}).filter(
    (p: string) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(p)
  );

  for (const relativePath of xmlPaths) {
    const file = zip.file(relativePath);
    if (!file) continue;

    let xml = file.asText();
    let changed = false;

    for (const [token, marker] of Object.entries(markers)) {
      const newXml = replaceTokenAcrossRuns(xml, token, marker);
      if (newXml !== xml) { xml = newXml; changed = true; }
    }

    if (changed) zip.file(relativePath, xml);
  }

  return zip.generate({ type: 'nodebuffer' });
}

/**
 * Egy token-t kicserél az XML-ben, akkor is ha a token több <w:t> elemre van bontva.
 * Bekezdésenként dolgozik (<w:p>…</w:p>).
 */
function replaceTokenAcrossRuns(xml: string, token: string, replacement: string): string {
  // Ha a token egyszerű string-ként megtalálható, gyors csere
  if (xml.includes(token)) {
    // Globális csere az összes előfordulásra
    return xml.split(token).join(replacement);
  }

  // Ha nem → a token több <w:t> elemre bomolhat (Word XML run-szétbontás).
  // Bekezdésenként vizsgáljuk.
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  return xml.replace(pRegex, (paragraph) => {
    // Összegyűjtjük a <w:t> elemek szövegét
    const wtRegex = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;
    interface Seg { open: string; text: string; close: string; idx: number; len: number; }
    const segs: Seg[] = [];
    let concat = '';
    let m: RegExpExecArray | null;

    while ((m = wtRegex.exec(paragraph)) !== null) {
      segs.push({ open: m[1], text: m[2], close: m[3], idx: m.index, len: m[0].length });
      concat += m[2];
    }

    if (!concat.includes(token)) return paragraph;

    // Minden előfordulás cseréje
    let tIdx = concat.indexOf(token);
    while (tIdx !== -1) {
      const tEnd = tIdx + token.length;
      let repDone = false;
      let charPos = 0;

      for (const seg of segs) {
        const segStart = charPos;
        const segEnd = charPos + seg.text.length;
        charPos = segEnd;

        if (segEnd <= tIdx || segStart >= tEnd) continue;

        const oStart = Math.max(0, tIdx - segStart);
        const oEnd = Math.min(seg.text.length, tEnd - segStart);
        const before = seg.text.substring(0, oStart);
        const after = seg.text.substring(oEnd);

        seg.text = repDone ? before + after : before + replacement + after;
        repDone = true;
      }

      concat = segs.map(s => s.text).join('');
      tIdx = concat.indexOf(token, tIdx + replacement.length);
    }

    // Paragraph újraépítése módosított szövegekkel
    let result = paragraph;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      result = result.substring(0, s.idx) + s.open + s.text + s.close + result.substring(s.idx + s.len);
    }
    return result;
  });
}

/**
 * PDF-ben megkeresi az összes előfordulását a marker szövegnek pdfjs-dist segítségével.
 * Visszaadja az összes talált pozíciót (oldal, x, y, méret).
 */
async function findMarkerPositionsInPdf(
  pdfBuffer: Buffer,
  markerText: string,
): Promise<MarkerPosition[]> {
  if (!pdfjsLib) {
    strapi?.log?.debug?.('findMarkerPositionsInPdf: pdfjs-dist not loaded, returning []');
    return [];
  }
  try {
    const positions: MarkerPosition[] = [];
    const data = new Uint8Array(pdfBuffer);
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        if (!item.str) continue;
        if (item.str.includes(markerText)) {
          positions.push({
            page: pageNum,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width || 50,
            height: item.height || 12,
          });
        }
      }
    }

    await doc.destroy();
    return positions;
  } catch (err: any) {
    strapi?.log?.warn?.('findMarkerPositionsInPdf failed:', err?.message ?? String(err));
    return [];
  }
}

/**
 * DOCX sablonból kiolvassa, hogy melyik aláírás tokenek ({%signature1}, {%signature2}) szerepelnek.
 * Generáláskor hívjuk, és az eredményt a dokumentumra mentjük (requires_signature1/2).
 *
 * FONTOS: A Word XML-ben a szöveg `<w:t>` tagekre bomlik (pl. `{%` + `signature1` + `}`
 * különböző XML run-okban). Ezért a raw XML tageket stripeljük, és a kapott folyamatos
 * szöveges tartalomban keressük a `signature1` / `signature2` kifejezéseket.
 */
function parseDocxForSignatureTokens(docxBuffer: Buffer): { hasSignature1: boolean; hasSignature2: boolean } {
  try {
    const zip = new PizZip(docxBuffer);
    // Nézzük meg a fő dokumentumot és a header/footer fájlokat is
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];
    let plainText = '';
    for (const fileName of xmlFiles) {
      const file = zip.file(fileName);
      if (file) {
        const xml = file.asText();
        // XML tagek eltávolítása → tiszta szöveges tartalom (a <w:t>...</w:t> közötti szövegek összeolvadnak)
        plainText += xml.replace(/<[^>]+>/g, '') + ' ';
      }
    }
    return {
      hasSignature1: /signature1/.test(plainText),
      hasSignature2: /signature2/.test(plainText),
    };
  } catch {
    // Ha nem sikerül a parse, biztonságosabb mindkettőt kérni
    return { hasSignature1: true, hasSignature2: true };
  }
}

export default factories.createCoreService('api::document.document', ({ strapi }) => ({
  /**
   * Ékezetes karakterek eltávolítása és fájlnév barát verzió készítése
   */
  removeAccents(str: string) {
    const accents = {
      'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ö': 'o', 'ő': 'o', 'ú': 'u', 'ü': 'u', 'ű': 'u',
      'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ö': 'O', 'Ő': 'O', 'Ú': 'U', 'Ü': 'U', 'Ű': 'U'
    };
    return str.split('').map(char => accents[char as keyof typeof accents] || char).join('');
  },

  /**
   * Projekt mappa nevének létrehozása
   */
  getProjectFolderName(project: any): string {
    const projectTitle = project.title || 'unknown';
    const sanitized = this.removeAccents(projectTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `project_${sanitized}`;
  },

  /**
   * Generál egy dokumentumot template-ből és projekt adatokból
   * @param signatureData - Opcionális aláírás base64 string (ha van, beillesztjük a PDF-be)
   */
  async generateDocument({ templateId, projectId, userId, signatureData }: { templateId: string; projectId: string; userId?: number; signatureData?: string }) {
    try {
      strapi.log.info(`Generating document - templateId: ${templateId}, projectId: ${projectId}`);

      // Template betöltése - Strapi v5 documentId vagy numerikus ID támogatás
      let template: any;
      
      // Először próbáljuk documentId-val (Strapi v5 string ID) - documents API használata
      try {
        // @ts-ignore - documents API nem teljesen típusos
        template = await strapi.documents('api::template.template').findOne({
          documentId: templateId,
          populate: ['template_file'],
        });
        strapi.log.info(`Template found by documentId: ${templateId}`, { 
          templateName: template?.name, 
          hasFile: !!template?.template_file 
        });
      } catch (err: any) {
        strapi.log.warn('Error finding template by documentId, trying numeric ID:', err.message);
        // Ha nem sikerült documentId-val, próbáljuk numerikus ID-val
        if (!isNaN(Number(templateId))) {
          try {
            template = await strapi.entityService.findOne('api::template.template', Number(templateId), {
              populate: ['template_file'],
            });
            strapi.log.info(`Template found by numeric ID: ${templateId}`, { 
              templateName: template?.name, 
              hasFile: !!template?.template_file 
            });
          } catch (err2: any) {
            strapi.log.error('Error finding template by numeric ID:', err2.message);
          }
        }
      }

      if (!template) {
        strapi.log.error(`Template not found - templateId: ${templateId}, isNumeric: ${!isNaN(Number(templateId))}`);
        throw new Error(`Template nem található (ID: ${templateId})`);
      }

      strapi.log.info(`Template loaded: ${template.name}`, {
        id: template.id,
        documentId: template.documentId,
        hasTemplateFile: !!template.template_file,
        templateFileUrl: template.template_file?.url
      });

      if (!template.template_file || !template.template_file.url) {
        strapi.log.error('Template file missing', {
          templateId,
          templateName: template.name,
          hasTemplateFile: !!template.template_file,
          templateFile: template.template_file
        });
        throw new Error('Template fájl nem található. Kérlek, ellenőrizd, hogy a template-hez van-e feltöltve template_file a Strapi adminban.');
      }

      strapi.log.info(`Template found: ${template.name} (ID: ${template.id}, documentId: ${template.documentId})`);

      // Projekt betöltése - Strapi v5 documentId vagy numerikus ID támogatás
      let project: any;
      
      // Először próbáljuk documentId-val (Strapi v5 string ID) - documents API használata
      try {
        // @ts-ignore - documents API nem teljesen típusos
        project = await strapi.documents('api::project.project').findOne({
          documentId: projectId,
          populate: '*',
        });
      } catch (err: any) {
        strapi.log.warn('Error finding project by documentId, trying numeric ID:', err.message);
        // Ha nem sikerült documentId-val, próbáljuk numerikus ID-val
        if (!isNaN(Number(projectId))) {
          try {
            project = await strapi.entityService.findOne('api::project.project', Number(projectId), {
              populate: '*',
            });
          } catch (err2: any) {
            strapi.log.error('Error finding project by numeric ID:', err2.message);
          }
        }
      }

      if (!project) {
        throw new Error(`Projekt nem található (ID: ${projectId})`);
      }

      strapi.log.info(`Project found: ${project.title} (ID: ${project.id}, documentId: ${project.documentId})`);

      // Template fájl letöltése
      const templateUrl = template.template_file.url;
      let templateBuffer: Buffer;
      
      const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
      const fullUrl = templateUrl.startsWith('http') 
        ? templateUrl 
        : `${serverUrl}${templateUrl}`;
      
      // Node.js 18+ has built-in fetch, no need for node-fetch
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Nem sikerült letölteni a template fájlt: ${fullUrl} (${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      templateBuffer = Buffer.from(arrayBuffer);

      // Sablonból automatikusan: mely aláírás tokenek vannak a DOCX-ban ({%signature1}, {%signature2})
      const { hasSignature1, hasSignature2 } = parseDocxForSignatureTokens(templateBuffer);

      // --- MARKER MEGKÖZELÍTÉS ---
      // 1. DOCX XML pre-process: {%signatureN} → marker szöveg (nem ImageModule!)
      let markerDocx: Buffer;
      try {
        markerDocx = replaceSignatureTokensInDocx(templateBuffer, SIG_MARKERS);
      } catch (replaceErr: any) {
        strapi.log.error('replaceSignatureTokensInDocx failed:', replaceErr?.message ?? String(replaceErr));
        throw new Error(`Sablon feldolgozási hiba: ${replaceErr?.message ?? 'ismeretlen'}`);
      }

      // 2. Docxtemplater NEM használ ImageModule-t – a % tokenek el vannak távolítva
      const zip = new PizZip(markerDocx);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      // @ts-ignore
      const tokens: any = this.createTokensFromProject(project);
      // Nem állítunk signature tokeneket – a markerek szövegként vannak az XML-ben
      doc.setData(tokens);

      try {
        doc.render();
      } catch (error: any) {
        strapi.log.error('Docxtemplater render error:', { message: error.message, name: error.name, properties: error.properties });
        if (error.properties?.errors instanceof Array) {
          const details = error.properties.errors
            .map((e: any) => e.properties ? `${e.properties.explanation || e.properties.id}: ${e.properties.context || e.properties.xtag || e.properties.id}` : '')
            .filter(Boolean);
          if (details.length) throw new Error(`Sablon hiba(k): ${details.join(' | ')}. Kérlek ellenőrizd a sablon fájlt!`);
        }
        throw new Error(`Hiba a dokumentum generálása során: ${error.message}`);
      }

      const generatedDocxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      strapi.log.info('DOCX generated, converting to PDF...');

      // 3. PDF konverzió + markerek kitakarása fehér téglalappal
      let pdfBuffer: Buffer = await this.convertDocxToPdf(generatedDocxBuffer);

      // Markerek white-out (ha bármi hibázik, a PDF-et így is visszaadjuk)
      try {
        const markerPositions = [
          ...(await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature1}'])),
          ...(await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature2}'])),
          ...(await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature}'])),
        ];
        if (markerPositions.length > 0) {
          const { PDFDocument: PDFDocGen, rgb: rgbGen } = require('pdf-lib');
          const pdfDoc = await PDFDocGen.load(pdfBuffer, { ignoreEncryption: true });
          for (const pos of markerPositions) {
            const pg = pdfDoc.getPages()[pos.page - 1];
            if (pg) pg.drawRectangle({ x: pos.x - 2, y: pos.y - 2, width: pos.width + 4, height: pos.height + 4, color: rgbGen(1, 1, 1) });
          }
          pdfBuffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
        }
      } catch (whiteOutErr: any) {
        strapi.log.warn('Marker white-out skipped (PDF unchanged):', whiteOutErr?.message ?? String(whiteOutErr));
      }

      // Fájlnév és mentés (PDF formátumban)
      // @ts-ignore
      const rawFileName = `${template.name}_${project.title || 'dokumentum'}_${new Date().toISOString().split('T')[0]}`;
      // @ts-ignore
      const noAccentsFileName = this.removeAccents(rawFileName);
      const sanitizedBaseName = noAccentsFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pdfFileName = `${sanitizedBaseName}.pdf`;
      
      // Projekt mappa nevének létrehozása
      const projectFolderName = this.getProjectFolderName(project);
      const uploadsDir = path.join(strapi.dirs.static.public, 'uploads', projectFolderName);
      
      // Projekt mappa létrehozása, ha nem létezik
      try {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        strapi.log.info(`Project folder created/verified: ${uploadsDir}`);
      } catch (err: any) {
        strapi.log.warn(`Error creating project folder: ${err.message}`);
      }

      // Ideiglenes fájl létrehozása a feltöltéshez
      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, pdfFileName);
      await writeFile(tempPdfPath, pdfBuffer);
      
      // Cél fájl path a projekt mappában
      const targetPdfPath = path.join(uploadsDir, pdfFileName);
      
      let fileEntity: any;
      try {
        // Fájl másolása a projekt mappába
        await fs.promises.copyFile(tempPdfPath, targetPdfPath);
        strapi.log.info(`File copied to project folder: ${targetPdfPath}`);
        
        // @ts-ignore
        const uploadService = strapi.plugin('upload').service('upload');
        
        // Strapi v5 upload service - a path mező kötelező és string típusú kell legyen
        if (typeof targetPdfPath !== 'string' || !targetPdfPath) {
          throw new Error(`PDF fájl path nem érvényes: ${targetPdfPath}`);
        }

        const fileInfo = {
          name: pdfFileName,
          alternativeText: `${template.name} - ${project.title || ''}`,
          caption: `${template.name} generálva (PDF)`,
        };
        
        // Relatív path az uploads mappához képest
        const relativePath = path.join(projectFolderName, pdfFileName).replace(/\\/g, '/');
        
        // Strapi v5 / formidable kompatibilitás: path és filepath is megadva
        const fileObject = {
          path: targetPdfPath,
          filepath: targetPdfPath,
          name: pdfFileName,
          originalFilename: pdfFileName,
          type: 'application/pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        };
        
        strapi.log.info(`Uploading PDF file: ${pdfFileName}, path: ${targetPdfPath}, relative: ${relativePath}`);
        
        // Strapi v5 upload service hívás
        // A data mezőben a fileInfo kulcs alatt várja az adatokat
        const uploadedFiles = await uploadService.upload({
          data: { fileInfo, path: relativePath },
          files: fileObject,
        });
        
        fileEntity = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
        
        if (!fileEntity) {
          throw new Error('A feltöltés nem tért vissza érvényes fájl entitással');
        }
        
        strapi.log.info(`File uploaded successfully, file entity ID: ${fileEntity.id || fileEntity.documentId}`);
        
        // Ideiglenes fájl törlése
        await unlink(tempPdfPath).catch(() => {});
      } catch (uploadError: any) {
        // Tisztítás hiba esetén is
        if (tempPdfPath) {
          await unlink(tempPdfPath).catch(() => {});
        }
        strapi.log.error('Error uploading PDF file:', uploadError.message);
        throw new Error(`PDF fájl feltöltése sikertelen: ${uploadError.message}`);
      }

      // Type mapping - engedjük át a (régi + új) dokumentumtípusokat, különben 'other'
      // Fontos: a Strapi sémában a Document.type enum értékeit ehhez igazítottuk.
      const serverAllowedTypes = [
        // új típusok
        'felmerolap',
        'vallalkozasi_szerzodes',
        'megallapodas',
        'szerzodes_energiahatékonysag',
        'adatkezelesi_hozzajarulas',
        'teljesitesi_igazolo',
        'munkaterul_atadas',
        // régi típusok (kompatibilitás)
        'contract',
        'worksheet',
        'invoice',
        'completion_certificate',
        // fallback
        'other',
      ];
      const documentType = serverAllowedTypes.includes(template.type) ? template.type : 'other';

      strapi.log.info(`Creating document record. Type: ${documentType} (template original type: ${template.type})`);

      // Generáló user company-ja (ha van)
      let userCompanyId = null;
      if (userId) {
        try {
          const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
            populate: ['company'],
          });
          userCompanyId = user?.company?.id || null;
          if (userCompanyId) {
            strapi.log.info(`Document will be associated with user's company: ${userCompanyId}`);
          }
        } catch (err: any) {
          strapi.log.warn(`Could not fetch user company: ${err.message}`);
        }
      }

      // Dokumentum létrehozása entityService-szel (requires_signature1/2 a sablon DOCX alapján)
      const document = await strapi.entityService.create('api::document.document', {
        data: {
          type: documentType,
          project: project.id,
          company: userCompanyId, // Automatikus csatolás a generáló user company-jához
          uploaded_by: userId,
          signed: false,
          requires_signature: true,
          requires_signature1: hasSignature1,
          requires_signature2: hasSignature2,
          file_name: pdfFileName,
          file: fileEntity.id,
        },
      });

      strapi.log.info(`Document created successfully: ${document.documentId || document.id}`);

      return document;
    } catch (error: any) {
      strapi.log.error('Error generating document:', error);
      strapi.log.error('Error stack:', error.stack);
      strapi.log.error('Template ID:', templateId);
      strapi.log.error('Project ID:', projectId);
      throw error;
    }
  },

  /**
   * Újragenerálja egy meglévő dokumentumot az aláírással
   * Megkeresi a dokumentum template-jét és projektjét, majd újragenerálja a PDF-et az aláírással
   */
  async regenerateDocumentWithSignature(documentId: string, signatureData: string) {
    try {
      strapi.log.info(`Regenerating document with signature - documentId: ${documentId}`);

      // Dokumentum betöltése
      let document: any;
      try {
        // @ts-ignore
        document = await strapi.documents('api::document.document').findOne({
          documentId: documentId,
          populate: ['project', 'file'],
        });
      } catch (err: any) {
        if (!isNaN(Number(documentId))) {
          document = await strapi.entityService.findOne('api::document.document', Number(documentId), {
            populate: ['project', 'file'],
          });
        } else {
          throw new Error(`Dokumentum nem található (ID: ${documentId})`);
        }
      }

      if (!document) {
        throw new Error(`Dokumentum nem található (ID: ${documentId})`);
      }

      if (!document.project) {
        throw new Error('Dokumentumhoz nincs társított projekt');
      }

      const project = document.project;
      const documentType = document.type;

      // Template keresése típus alapján
      let templates = await strapi.entityService.findMany('api::template.template', {
        filters: { type: documentType },
        populate: ['template_file'],
      });

      // Ha nincs template a típushoz (pl. "other"), próbáljuk meg bármilyen template-et
      if (!templates || templates.length === 0) {
        strapi.log.warn(`Nem található template a típushoz: ${documentType}, keresünk bármilyen template-et`);
        templates = await strapi.entityService.findMany('api::template.template', {
          populate: ['template_file'],
        });
      }

      if (!templates || templates.length === 0) {
        throw new Error(`Nem található elérhető template`);
      }

      const template: any = templates[0];

      if (!template.template_file || !template.template_file.url) {
        throw new Error('Template fájl nem található');
      }

      const projectId = project.documentId || project.id;
      const templateId = template.documentId || template.id;

      strapi.log.info(`Regenerating document - templateId: ${templateId}, projectId: ${projectId}`);

      // Template fájl letöltése
      const templateUrl = template.template_file.url;
      const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
      const fullUrl = templateUrl.startsWith('http') ? templateUrl : `${serverUrl}${templateUrl}`;
      
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Nem sikerült letölteni a template fájlt: ${fullUrl} (${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const templateBuffer = Buffer.from(arrayBuffer);

      // --- MARKER MEGKÖZELÍTÉS (ugyanaz mint generatePdfWithVisualSignature) ---
      // 1. DOCX XML pre-process: {%signatureN} → marker szöveg
      const markerDocx = replaceSignatureTokensInDocx(templateBuffer, SIG_MARKERS);

      // 2. Docxtemplater NEM használ ImageModule-t (a % tokenek már el vannak távolítva)
      const zip = new PizZip(markerDocx);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      // @ts-ignore
      const tokens: any = this.createTokensFromProject(project);
      doc.setData(tokens);
      
      try {
        doc.render();
      } catch (error: any) {
        strapi.log.error('Docxtemplater render error:', {
          message: error.message,
          name: error.name,
          properties: error.properties,
        });
        
        if (error.properties && error.properties.errors instanceof Array) {
          const errorDetails: string[] = [];
          error.properties.errors.forEach((err: any) => {
            if (err.properties) {
              const explanation = err.properties.explanation;
              const id = err.properties.id;
              const context = err.properties.context || err.properties.xtag || id;
              errorDetails.push(`${explanation || id}: ${context}`);
            }
          });
          if (errorDetails.length > 0) {
            throw new Error(`Sablon hiba(k): ${errorDetails.join(' | ')}. Kérlek ellenőrizd a sablon fájlt!`);
          }
        }
        
        throw new Error(`Hiba a dokumentum újragenerálása során: ${error.message}`);
      }

      const generatedDocxBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      const useQpdf = await this.isQpdfAvailable();
      let pdfBuffer: Buffer = await this.convertDocxToPdf(generatedDocxBuffer, {
        usePdfA: !useQpdf,
        protectPdf: true,
      });

      // 3. Marker pozíciók keresése + overlay (ha van aláírás adat)
      if (signatureData) {
        const sig1Positions = await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature1}']);
        const sig2Positions = await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature2}']);
        const sig0Positions = await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature}']);

        const { PDFDocument: PDFDoc2, rgb: rgb2 } = require('pdf-lib');
        const pdfDoc = await PDFDoc2.load(pdfBuffer, { ignoreEncryption: true });

        // White-out markerek
        const allMarkers = [...sig1Positions, ...sig2Positions, ...sig0Positions];
        for (const pos of allMarkers) {
          const pg = pdfDoc.getPages()[pos.page - 1];
          if (!pg) continue;
          pg.drawRectangle({ x: pos.x - 2, y: pos.y - 2, width: pos.width + 4, height: pos.height + 4, color: rgb2(1, 1, 1) });
        }

        // Aláírás overlay
        const payload = typeof signatureData === 'object' && signatureData !== null
          ? signatureData as { signature1?: string; signature2?: string }
          : { signature1: signatureData as string };

        if (payload.signature1) {
          const b64 = (payload.signature1 as string).replace(/^data:image\/\w+;base64,/, '');
          const pngImg = await pdfDoc.embedPng(Buffer.from(b64, 'base64'));
          const [drawW, drawH] = fitSize(pngImg.scale(1).width, pngImg.scale(1).height, SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);
          for (const pos of [...sig1Positions, ...sig0Positions]) {
            const pg = pdfDoc.getPages()[pos.page - 1];
            if (pg) pg.drawImage(pngImg, {
              x: pos.x + pos.width / 2 - drawW / 2,
              y: pos.y + pos.height / 2 - drawH / 2,
              width: drawW, height: drawH,
            });
          }
        }
        if (payload.signature2) {
          const b64 = (payload.signature2 as string).replace(/^data:image\/\w+;base64,/, '');
          const pngImg = await pdfDoc.embedPng(Buffer.from(b64, 'base64'));
          const [drawW, drawH] = fitSize(pngImg.scale(1).width, pngImg.scale(1).height, SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);
          for (const pos of sig2Positions) {
            const pg = pdfDoc.getPages()[pos.page - 1];
            if (pg) pg.drawImage(pngImg, {
              x: pos.x + pos.width / 2 - drawW / 2,
              y: pos.y + pos.height / 2 - drawH / 2,
              width: drawW, height: drawH,
            });
          }
        }

        // Fallback ha nincs marker pozíció
        if (allMarkers.length === 0) {
          strapi.log.warn('regenerate: No marker positions found – anchor fallback');
          const fb = await pdfDoc.save({ useObjectStreams: false });
          pdfBuffer = Buffer.from(fb);
          if (payload.signature1) pdfBuffer = await this.overlayVisualSignatureOnPdf(pdfBuffer, payload.signature1, 1, template);
          if (payload.signature2) pdfBuffer = await this.overlayVisualSignatureOnPdf(pdfBuffer, payload.signature2, 2, template);
        } else {
          pdfBuffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
        }
      } else {
        // Nincs aláírás — markereket is ki kell takarni
        const allPos = [
          ...(await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature1}'])),
          ...(await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature2}'])),
          ...(await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature}'])),
        ];
        if (allPos.length > 0) {
          const { PDFDocument: PDFDoc3, rgb: rgb3 } = require('pdf-lib');
          const pdfDoc = await PDFDoc3.load(pdfBuffer, { ignoreEncryption: true });
          for (const pos of allPos) {
            const pg = pdfDoc.getPages()[pos.page - 1];
            if (pg) pg.drawRectangle({ x: pos.x - 2, y: pos.y - 2, width: pos.width + 4, height: pos.height + 4, color: rgb3(1, 1, 1) });
          }
          pdfBuffer = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
        }
      }

      // Fájlnév
      // @ts-ignore
      const rawFileName = `${template.name}_${project.title || 'dokumentum'}_${new Date().toISOString().split('T')[0]}`;
      // @ts-ignore
      const noAccentsFileName = this.removeAccents(rawFileName);
      const sanitizedBaseName = noAccentsFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pdfFileName = `${sanitizedBaseName}.pdf`;

      // Projekt mappa nevének létrehozása
      const projectFolderName = this.getProjectFolderName(project);
      const uploadsDir = path.join(strapi.dirs.static.public, 'uploads', projectFolderName);
      
      // Projekt mappa létrehozása, ha nem létezik
      try {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        strapi.log.info(`Project folder created/verified: ${uploadsDir}`);
      } catch (err: any) {
        strapi.log.warn(`Error creating project folder: ${err.message}`);
      }

      // Ideiglenes fájl
      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, pdfFileName);
      await writeFile(tempPdfPath, pdfBuffer);

      // Cél fájl path a projekt mappában
      const targetPdfPath = path.join(uploadsDir, pdfFileName);
      
      // Fájl másolása a projekt mappába
      await fs.promises.copyFile(tempPdfPath, targetPdfPath);
      strapi.log.info(`File copied to project folder: ${targetPdfPath}`);

      // Régi fájl törlése
      if (document.file && document.file.id) {
        try {
          // @ts-ignore
          await strapi.plugin('upload').service('upload').remove(document.file.id);
        } catch (err: any) {
          strapi.log.warn('Error removing old file:', err?.message ?? String(err));
        }
      }

      // Új fájl feltöltése
      // @ts-ignore
      const uploadService = strapi.plugin('upload').service('upload');
      const fileInfo = {
        name: pdfFileName,
        alternativeText: `${template.name} - ${project.title || ''} (Aláírva)`,
        caption: `${template.name} generálva és aláírva (PDF)`,
      };

      // Relatív path az uploads mappához képest
      const relativePath = path.join(projectFolderName, pdfFileName).replace(/\\/g, '/');

      const fileObject = {
        path: targetPdfPath,
        filepath: targetPdfPath,
        name: pdfFileName,
        originalFilename: pdfFileName,
        type: 'application/pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };

      const uploadedFiles = await uploadService.upload({
        data: { fileInfo, path: relativePath },
        files: fileObject,
      });

      const fileEntity = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;

      // Dokumentum frissítése
      const updatedDocument = await strapi.entityService.update('api::document.document', document.id, {
        data: {
          file: fileEntity.id,
          file_name: pdfFileName,
          signed: true,
          signature_data: {
            image: signatureData,
            timestamp: new Date().toISOString(),
          },
          signed_at: new Date().toISOString(),
        },
      });

      await unlink(tempPdfPath).catch(() => {});

      strapi.log.info(`Document regenerated with signature successfully: ${updatedDocument.documentId || updatedDocument.id}`);

      return updatedDocument;
    } catch (error: any) {
      strapi.log.error('Error regenerating document with signature:', error);
      throw error;
    }
  },

  /**
   * Projekt adataiból készít token objektumot
   */
  createTokensFromProject(project: any) {
    const parseHungarianAddress = (address: string): { zip: string; city: string; street: string } => {
      const value = (address || '').toString().trim();
      if (!value) return { zip: '', city: '', street: '' };

      // Common format: "1234 Város, Utca 1."
      const m1 = value.match(/^(\d{4})\s+([^,]+),\s*(.+)$/);
      if (m1) {
        return { zip: m1[1] || '', city: (m1[2] || '').trim(), street: (m1[3] || '').trim() };
      }

      // Legacy-like format: "Utca 1., Város, 1234"
      const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 3 && /^\d{4}$/.test(parts[2])) {
        return { street: parts[0] || '', city: parts[1] || '', zip: parts[2] || '' };
      }

      // Fallback: keep address as street
      return { zip: '', city: '', street: value };
    };

    const clientAddress = project.client_zip && project.client_city && project.client_street
      ? `${project.client_zip} ${project.client_city}, ${project.client_street}`
      : project.client_address || '';

    const propertyAddress = project.property_address_same === true
      ? clientAddress
      : (project.property_zip && project.property_city && project.property_street
          ? `${project.property_zip} ${project.property_city}, ${project.property_street}`
          : clientAddress);

    const floorMaterialLabels: Record<string, string> = {
      wood: 'Fa',
      prefab_rc: 'Előre gyártott vb. (betongerendás)',
      monolithic_rc: 'Monolit v.b.',
      rc_slab: 'Vasbeton tálcás',
      hollow_block: 'Horcsik',
      other: project.floor_material_extra || 'Egyéb',
    };

    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const company = (project.company && typeof project.company === 'object') ? project.company : null;
    const companyAddressParsed = company?.address ? parseHungarianAddress(company.address) : { zip: '', city: '', street: '' };

    const floorMaterialValue = project.floor_material
      ? (floorMaterialLabels[project.floor_material] || project.floor_material)
      : '';

    // Legacy tokens (existing templates)
    const legacyTokens = {
      client_name: project.client_name || '',
      client_address: clientAddress,
      client_street: project.client_street || '',
      client_city: project.client_city || '',
      client_zip: project.client_zip || '',
      client_phone: project.client_phone || '',
      client_email: project.client_email || '',
      client_birth_place: project.client_birth_place || '',
      client_birth_date: project.client_birth_date ? formatDate(project.client_birth_date) : '',
      client_mother_name: project.client_mother_name || '',
      client_tax_id: project.client_tax_id || '',
      property_address: propertyAddress,
      property_street: project.property_street || '',
      property_city: project.property_city || '',
      property_zip: project.property_zip || '',
      project_title: project.title || '',
      area_sqm: project.area_sqm || 0,
      floor_material: floorMaterialValue,
      date: new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    // New tokens (requested list)
    const newTokens = {
      nev1: project.client_name || '',
      irsz1: project.client_zip || '',
      telepules1: project.client_city || '',
      cim1: project.client_street || '',
      szhely: project.client_birth_place || '',
      szido1: project.client_birth_date ? formatDate(project.client_birth_date) : '',
      anyjaneve1: project.client_mother_name || '',
      adoazonosito1: project.client_tax_id || '',
      telefon: project.client_phone || '',
      email1: project.client_email || '',

      projektirsz: project.property_zip || '',
      projekttelepules: project.property_city || '',
      projektcim: project.property_street || '',

      nev2: company?.name || '',
      irsz2: companyAddressParsed.zip || '',
      telepules2: companyAddressParsed.city || '',
      cim2: companyAddressParsed.street || company?.address || '',
      szido2: '',
      anyjaneve2: '',
      adoazonosito2: '',

      hrsz: project.property_hrsz || '',
      negyzetmeter: project.area_sqm ? String(project.area_sqm) : '',
      szerzodesdatum: project.createdAt ? formatDate(project.createdAt) : '',
      kivdatum: project.scheduled_date ? formatDate(project.scheduled_date) : '',
      hem: project.hem_value || '',
      fodem_anyaga: floorMaterialValue,
      adoszam: company?.tax_number || '',
      kivdatum_real: project.completed_at ? formatDate(project.completed_at) : '',
    };

    return {
      ...legacyTokens,
      ...newTokens,
    };
    },

  /**
   * qpdf elérhető-e (node-qpdf csomag + qpdf bináris). Ha igen, ezt használjuk titkosításra (nem kell PDF/A).
   */
  async isQpdfAvailable(): Promise<boolean> {
    try {
      require.resolve('node-qpdf');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * PDF védelem: megnyitás jelszó nélkül, szerkesztés/másolás tiltva (owner jelszó).
   * Ha elérhető a node-qpdf és a qpdf bináris, azzal titkosít. Különben visszaadja az eredeti buffer-t.
   */
  async protectPdf(pdfBuffer: Buffer): Promise<Buffer> {
    let qpdf: any = null;
    try {
      qpdf = require('node-qpdf');
    } catch {
      strapi.log.debug('node-qpdf not installed, skipping PDF encryption');
      return pdfBuffer;
    }

    const tempDir = tmpdir();
    const baseName = `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inputPath = path.join(tempDir, `${baseName}.pdf`);
    const outputPath = path.join(tempDir, `${baseName}_enc.pdf`);

    try {
      await writeFile(inputPath, pdfBuffer);
      const ownerPassword = process.env.PDF_OWNER_PASSWORD || 'strapi_internal_2026';
      const options = {
        keyLength: 256,
        password: { user: '', owner: ownerPassword },
        outputFile: outputPath,
        restrictions: {
          modify: 'none',
          extract: 'n',
          print: 'full',
        },
      };
      await new Promise<void>((resolve, reject) => {
        qpdf.encrypt(inputPath, options, (err: Error | null) => (err ? reject(err) : resolve()));
      });
      const out = await fs.promises.readFile(outputPath);
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      strapi.log.info('PDF encrypted with qpdf (owner password, no user password)');
      return out;
    } catch (error: any) {
      strapi.log.warn('qpdf encryption failed, returning unencrypted PDF:', error?.message);
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      return pdfBuffer;
    }
  },

  /**
   * eIDAS AES PAdES digitális aláírás alkalmazása PDF dokumentumra.
   *
   * Szekvenciális aláírás:
   *   1. Fővállalkozó aláír → PAdES aláírás #1
   *   2. Ügyfél aláír → PAdES aláírás #2 (incremental update, #1 megmarad)
   *
   * A vizuális aláírás (canvas kép) is bekerül a PDF-be:
   *   - Első aláírásnál: DOCX újragenerálás a vizuális aláírással, majd PAdES
   *   - Második aláírásnál: pdf-lib overlay a vizuális aláírással (nem generál újra!), majd PAdES
   */
  async signDocumentPades({
    documentId,
    signerRole,
    signerName,
    signerEmail,
    companyName,
    visualSignature,
  }: {
    documentId: string;
    signerRole: 'contractor' | 'client';
    signerName: string;
    signerEmail: string;
    companyName?: string;
    visualSignature?: string;
  }) {
    try {
      // Ellenőrizzük, hogy a PAdES csomagok elérhetők-e
      if (!signpdf || !P12Signer || !plainAddPlaceholder || !certificateUtils) {
        throw new Error(
          'PAdES aláírás csomagok nem telepítettek a szerveren. ' +
          'Telepítsd: npm install @signpdf/signpdf @signpdf/signer-p12 @signpdf/placeholder-plain node-forge'
        );
      }

      strapi.log.info(`PAdES signing - documentId: ${documentId}, role: ${signerRole}, signer: ${signerName}`);

      // --- 1. Dokumentum betöltése ---
      let document: any;
      try {
        // @ts-ignore
        document = await strapi.documents('api::document.document').findOne({
          documentId: documentId,
          populate: ['project', 'file', 'company'],
        });
      } catch (err: any) {
        if (!isNaN(Number(documentId))) {
          document = await strapi.entityService.findOne('api::document.document', Number(documentId), {
            populate: ['project', 'file', 'company'],
          });
        } else {
          throw new Error(`Dokumentum nem található (ID: ${documentId})`);
        }
      }

      if (!document) {
        throw new Error(`Dokumentum nem található (ID: ${documentId})`);
      }

      const template = await this.getTemplateForDocumentType(document.type);
      // Dokumentumra generáláskor mentettük a sablon tokenek alapján; ha nincs (régi doc), template alapján
      const requireSig1 = document.requires_signature1 != null ? document.requires_signature1 : (template?.require_signature1 !== false);
      const requireSig2 = document.requires_signature2 != null ? document.requires_signature2 : (template?.require_signature2 !== false);
      if (!requireSig1 && !requireSig2) {
        throw new Error('A dokumentum típusa nem igényel aláírást.');
      }
      if (signerRole === 'contractor' && !requireSig1) {
        throw new Error('Ez a dokumentum típus csak ügyfél aláírást igényel.');
      }
      if (signerRole === 'client' && !requireSig2) {
        throw new Error('Ez a dokumentum típus csak fővállalkozó aláírást igényel.');
      }

      // Ellenőrizzük, hogy ez a szerep még nem írta-e alá
      const existingSignatures: any[] = document.digital_signatures || [];
      const alreadySigned = existingSignatures.some(
        (sig: any) => sig.signer_role === signerRole
      );
      if (alreadySigned) {
        throw new Error(
          `Ez a dokumentum már alá van írva a(z) ${signerRole === 'contractor' ? 'fővállalkozó' : 'ügyfél'} által`
        );
      }

      // --- 2. PDF buffer beszerzése ---
      // MINDIG a DOCX sablonból generálunk, így az aláírás kép PONTOSAN a {%signature1}/{%signature2}
      // token helyére kerül (minden előfordulás). A docxtemplater ImageModule kezeli a több tokent is.
      let pdfBuffer: Buffer;

      // Korábban mentett vizuális aláírások lekérdezése (ha a másik fél már aláírta)
      const storedVisuals: Record<string, string> = (document.signature_data as any)?.visual_signatures || {};

      if (visualSignature) {
        // Összeállítjuk a payload-ot: saját + a másik fél korábban mentett aláírása
        const signaturePayload = {
          signature1: signerRole === 'contractor' ? visualSignature : (storedVisuals.signature1 || ''),
          signature2: signerRole === 'client' ? visualSignature : (storedVisuals.signature2 || ''),
        };

        strapi.log.info(`Generating PDF from DOCX with signatures: sig1=${!!signaturePayload.signature1}, sig2=${!!signaturePayload.signature2}`);

        // @ts-ignore
        pdfBuffer = await this.generatePdfWithVisualSignature(documentId, signaturePayload);
      } else {
        // Vizuális aláírás nélkül — a meglévő PDF-et használjuk
        pdfBuffer = await this.downloadDocumentPdf(document);
      }

      // --- 3. Dokumentum hash rögzítése aláírás előtt ---
      const documentHashBeforeSign = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // --- 4. Tanúsítvány generálás ---
      strapi.log.info(`Generating certificate for: ${signerName} <${signerEmail}>`);
      const { p12Buffer, certPem, fingerprint } = certificateUtils.generateSignerP12({
        signerName,
        signerEmail,
        companyName,
      });

      // --- 5. PDF-be signature placeholder beillesztése ---
      strapi.log.info('Adding PAdES signature placeholder to PDF');
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: `Aláírta: ${signerName} (${signerRole === 'contractor' ? 'Fővállalkozó' : 'Ügyfél'})`,
        contactInfo: signerEmail,
        name: signerName,
        location: 'HU',
        signatureLength: 8192, // Bőven elég a legtöbb tanúsítványhoz
      });

      // --- 6. PAdES aláírás alkalmazása ---
      strapi.log.info('Applying PAdES digital signature');
      const signer = new P12Signer(p12Buffer, { passphrase: '' });
      const signedPdfBuffer = await signpdf.sign(pdfWithPlaceholder, signer);

      strapi.log.info(`PAdES signature applied, signed PDF size: ${signedPdfBuffer.length} bytes`);

      // --- 7. Aláírt PDF feltöltése ---
      const project = document.project;
      const projectFolderName = this.getProjectFolderName(project);
      const uploadsDir = path.join(strapi.dirs.static.public, 'uploads', projectFolderName);

      try {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
      } catch (err: any) {
        strapi.log.warn(`Error creating project folder: ${err.message}`);
      }

      // Fájlnév: megtartjuk az eredetit, de jelezzük az aláírt státuszt
      const baseName = (document.file_name || 'document').replace(/\.pdf$/i, '');
      const signedSuffix = existingSignatures.length === 0 ? '_signed_1' : '_signed_2';
      const pdfFileName = `${baseName}${signedSuffix}.pdf`;

      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, pdfFileName);
      await writeFile(tempPdfPath, signedPdfBuffer);

      const targetPdfPath = path.join(uploadsDir, pdfFileName);
      await fs.promises.copyFile(tempPdfPath, targetPdfPath);

      // Régi fájl törlése
      if (document.file && document.file.id) {
        try {
          // @ts-ignore
          await strapi.plugin('upload').service('upload').remove(document.file.id);
        } catch (err: any) {
          strapi.log.warn('Error removing old file:', err?.message ?? String(err));
        }
      }

      // Új fájl feltöltése
      // @ts-ignore
      const uploadService = strapi.plugin('upload').service('upload');
      const fileInfo = {
        name: pdfFileName,
        alternativeText: `${baseName} - Digitálisan aláírva (PAdES/AES)`,
        caption: `PAdES/AES digitális aláírás - ${signerName}`,
      };
      const relativePath = path.join(projectFolderName, pdfFileName).replace(/\\/g, '/');
      const fileObject = {
        path: targetPdfPath,
        filepath: targetPdfPath,
        name: pdfFileName,
        originalFilename: pdfFileName,
        type: 'application/pdf',
        mimetype: 'application/pdf',
        size: signedPdfBuffer.length,
      };

      const uploadedFiles = await uploadService.upload({
        data: { fileInfo, path: relativePath },
        files: fileObject,
      });

      const fileEntity = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;

      // --- 8. digital_signatures tömb bővítése ---
      const newSignatureRecord = {
        signer_role: signerRole,
        signer_name: signerName,
        signer_email: signerEmail,
        signed_at: new Date().toISOString(),
        certificate_fingerprint: fingerprint,
        certificate_pem: certPem,
        document_hash_before_sign: documentHashBeforeSign,
        visual_signature_included: !!visualSignature,
      };

      const updatedSignatures = [...existingSignatures, newSignatureRecord];
      // Teljesen aláírt, ha MINDEN szükséges aláírás megvan (1 vagy 2 attól függően, mit igényel)
      const hasContractorSig = updatedSignatures.some(s => s.signer_role === 'contractor');
      const hasClientSig = updatedSignatures.some(s => s.signer_role === 'client');
      const allSigned =
        (!requireSig1 || hasContractorSig) &&
        (!requireSig2 || hasClientSig);

      // --- 9. Dokumentum frissítése ---
      // Vizuális aláírás képet elmentjük, hogy a következő aláíró is DOCX-ból tudjon generálni mindkettővel
      const prevVisuals: Record<string, string> = (document.signature_data as any)?.visual_signatures || {};
      const updatedVisuals: Record<string, string> = { ...prevVisuals };
      if (visualSignature) {
        if (signerRole === 'contractor') {
          updatedVisuals.signature1 = visualSignature;
        } else {
          updatedVisuals.signature2 = visualSignature;
        }
      }

      const updatedDocument = await strapi.entityService.update('api::document.document', document.id, {
        data: {
          file: fileEntity.id,
          file_name: pdfFileName,
          signed: allSigned,
          signed_at: allSigned ? new Date().toISOString() : document.signed_at,
          signature_version: 'pades_aes',
          digital_signatures: updatedSignatures,
          signature_data: {
            ...(document.signature_data || {}),
            visual_signatures: updatedVisuals,
            [`${signerRole}_visual`]: visualSignature ? 'included' : 'none',
            [`${signerRole}_cert_fingerprint`]: fingerprint,
            pades_version: 'PAdES-B',
          },
        },
      });

      await unlink(tempPdfPath).catch(() => {});

      strapi.log.info(
        `PAdES signature completed: ${signerRole} signed document ${updatedDocument.documentId || updatedDocument.id}` +
        ` (${allSigned ? 'fully signed' : 'partially signed'})`
      );

      return updatedDocument;
    } catch (error: any) {
      strapi.log.error('Error in signDocumentPades:', error);
      throw error;
    }
  },

  /**
   * Dokumentum PDF fájljának letöltése Buffer-ként.
   */
  async downloadDocumentPdf(document: any): Promise<Buffer> {
    if (!document.file || !document.file.url) {
      throw new Error('Dokumentumhoz nincs PDF fájl csatolva');
    }

    const fileUrl = document.file.url;
    const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${serverUrl}${fileUrl}`;

    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Nem sikerült letölteni a PDF fájlt: ${fullUrl} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },

  /**
   * PDF generálás vizuális aláírás képpel.
   *
   * MARKER MEGKÖZELÍTÉS (pdfjs-dist kell):
   * 1. DOCX XML pre-process: {%signature1} → {{SIG1}}, {%signature2} → {{SIG2}}
   * 2. Docxtemplater NEM használ ImageModule-t (a % tokenek el lettek távolítva)
   * 3. DOCX → PDF konverzió (a markerek látható szövegként benne vannak)
   * 4. pdfjs-dist: markerek pozíciójának megkeresése
   * 5. pdf-lib: fehér téglalap a markerekre + aláírás kép overlay az ÖSSZES talált pozícióra
   */
  async generatePdfWithVisualSignature(documentId: string, signaturePayload: { signature1: string; signature2: string }): Promise<Buffer> {
    // Dokumentum betöltése
    let document: any;
    try {
      // @ts-ignore
      document = await strapi.documents('api::document.document').findOne({
        documentId: documentId,
        populate: ['project', 'file'],
      });
    } catch (err: any) {
      if (!isNaN(Number(documentId))) {
        document = await strapi.entityService.findOne('api::document.document', Number(documentId), {
          populate: ['project', 'file'],
        });
      } else {
        throw new Error(`Dokumentum nem található (ID: ${documentId})`);
      }
    }

    if (!document || !document.project) {
      throw new Error('Dokumentum vagy projekt nem található');
    }

    const project = document.project;
    const documentType = document.type;

    // Template keresése
    let templates = await strapi.entityService.findMany('api::template.template', {
      filters: { type: documentType },
      populate: ['template_file'],
    });
    if (!templates || templates.length === 0) {
      templates = await strapi.entityService.findMany('api::template.template', {
        populate: ['template_file'],
      });
    }
    if (!templates || templates.length === 0) {
      throw new Error('Nem található elérhető template');
    }

    const template: any = templates[0];
    if (!template.template_file || !template.template_file.url) {
      throw new Error('Template fájl nem található');
    }

    // Template fájl letöltése
    const templateUrl = template.template_file.url;
    const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
    const fullUrl = templateUrl.startsWith('http') ? templateUrl : `${serverUrl}${templateUrl}`;

    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Nem sikerült letölteni a template fájlt: ${fullUrl} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const templateBuffer = Buffer.from(arrayBuffer);

    // --- MARKER MEGKÖZELÍTÉS ---
    // 1. DOCX XML pre-process: kicseréljük a signature tokeneket marker szövegre
    const markerDocx = replaceSignatureTokensInDocx(templateBuffer, SIG_MARKERS);

    // 2. Docxtemplater NEM használ ImageModule-t (a % tokenek már el vannak távolítva)
    const zip = new PizZip(markerDocx);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // @ts-ignore
    const tokens: any = this.createTokensFromProject(project);
    // Nincs szükség signature tokenekre – a markerek szövegként benne vannak az XML-ben
    doc.setData(tokens);
    doc.render();

    const generatedDocxBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // 3. DOCX → PDF (markerek látható szövegként vannak a PDF-ben)
    // @ts-ignore
    let pdfBuffer: Buffer = await this.convertDocxToPdf(generatedDocxBuffer, {
      usePdfA: false,
      protectPdf: false,
    });

    // 4. Marker pozíciók keresése pdfjs-dist-tel
    const sig1Positions = await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature1}']);
    const sig2Positions = await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature2}']);
    const sig0Positions = await findMarkerPositionsInPdf(pdfBuffer, SIG_MARKERS['{%signature}']);

    strapi.log.info(
      `Marker positions found: sig1=${sig1Positions.length}, sig2=${sig2Positions.length}, sig0=${sig0Positions.length}`
    );

    // 5. Fehér téglalap a markerekre + aláírás overlay az ÖSSZES pozícióra
    const { PDFDocument, rgb } = require('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    // White-out: minden marker szöveget kitakarjuk fehér téglalappal
    const allMarkers = [...sig1Positions, ...sig2Positions, ...sig0Positions];
    for (const pos of allMarkers) {
      const page = pdfDoc.getPages()[pos.page - 1];
      if (!page) continue;
      page.drawRectangle({
        x: pos.x - 2,
        y: pos.y - 2,
        width: pos.width + 4,
        height: pos.height + 4,
        color: rgb(1, 1, 1), // fehér
      });
    }

    // Signature1 overlay az összes sig1 + sig0 pozícióra
    if (signaturePayload.signature1) {
      const b64 = signaturePayload.signature1.replace(/^data:image\/\w+;base64,/, '');
      const imgBuf = Buffer.from(b64, 'base64');
      const pngImg = await pdfDoc.embedPng(imgBuf);
      const imgDims = pngImg.scale(1);
      const [drawW, drawH] = fitSize(imgDims.width, imgDims.height, SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);

      const positions = [...sig1Positions, ...sig0Positions];
      for (const pos of positions) {
        const page = pdfDoc.getPages()[pos.page - 1];
        if (!page) continue;
        // Kép középre igazítva a marker pozícióhoz
        page.drawImage(pngImg, {
          x: pos.x + pos.width / 2 - drawW / 2,
          y: pos.y + pos.height / 2 - drawH / 2,
          width: drawW,
          height: drawH,
        });
      }
    }

    // Signature2 overlay az összes sig2 pozícióra
    if (signaturePayload.signature2) {
      const b64 = signaturePayload.signature2.replace(/^data:image\/\w+;base64,/, '');
      const imgBuf = Buffer.from(b64, 'base64');
      const pngImg = await pdfDoc.embedPng(imgBuf);
      const imgDims = pngImg.scale(1);
      const [drawW, drawH] = fitSize(imgDims.width, imgDims.height, SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);

      for (const pos of sig2Positions) {
        const page = pdfDoc.getPages()[pos.page - 1];
        if (!page) continue;
        page.drawImage(pngImg, {
          x: pos.x + pos.width / 2 - drawW / 2,
          y: pos.y + pos.height / 2 - drawH / 2,
          width: drawW,
          height: drawH,
        });
      }
    }

    // Ha NINCS pdfjs-dist (marker pozíciók üresek): fallback a régi anchor-alapú overlay-re
    if (sig1Positions.length === 0 && sig2Positions.length === 0 && sig0Positions.length === 0) {
      strapi.log.warn('No marker positions found – falling back to anchor-based overlay');
      const fallbackPdf = await pdfDoc.save({ useObjectStreams: false });
      let fallbackBuffer = Buffer.from(fallbackPdf);
      if (signaturePayload.signature1) {
        fallbackBuffer = await this.overlayVisualSignatureOnPdf(fallbackBuffer, signaturePayload.signature1, 1, template);
      }
      if (signaturePayload.signature2) {
        fallbackBuffer = await this.overlayVisualSignatureOnPdf(fallbackBuffer, signaturePayload.signature2, 2, template);
      }
      return fallbackBuffer;
    }

    const finalPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(finalPdfBytes);
  },

  /**
   * Template betöltése dokumentum típus alapján (aláírás pozíció config-hoz).
   */
  async getTemplateForDocumentType(documentType: string): Promise<any | null> {
    let templates = await strapi.entityService.findMany('api::template.template', {
      filters: { type: documentType },
    });
    if (!templates?.length) {
      templates = await strapi.entityService.findMany('api::template.template', { limit: 1 });
    }
    return templates?.[0] ?? null;
  },

  /**
   * Meglévő PDF-re vizuális aláírás kép rárajzolása pdf-lib segítségével.
   * Pozíció a template config alapján. Alapértelmezett: mindkettő jobb alsó, egymás alatt (1=fent y=140, 2=lent y=80).
   */
  async overlayVisualSignatureOnPdf(
    pdfBuffer: Buffer,
    signatureBase64: string,
    signatureNumber: 1 | 2,
    template?: any
  ): Promise<Buffer> {
    const { PDFDocument } = require('pdf-lib');

    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('A PDF-nek nincs oldala');
    }

    // Céloldal: -1 = utolsó, egyébként 1-alapú sorszám → 0-alapú index
    const pageNum = template?.[`signature${signatureNumber}_page`];
    const pageIndex =
      pageNum === undefined || pageNum === -1
        ? pages.length - 1
        : Math.max(0, Math.min(Number(pageNum) - 1, pages.length - 1));
    const targetPage = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = targetPage.getSize();

    const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');
    const pngImage = await pdfDoc.embedPng(imgBuffer);

    const imgDims = pngImage.scale(1);
    // Méret: template-ben opcionális max (pl. signature2 nagyobb), különben alap
    const maxW = template?.[`signature${signatureNumber}_max_width`] ?? SIGNATURE_MAX_WIDTH;
    const maxH = template?.[`signature${signatureNumber}_max_height`] ?? SIGNATURE_MAX_HEIGHT;
    const [drawW, drawH] = fitSize(imgDims.width, imgDims.height, maxW, maxH);

    // Alapértelmezett: mindkét aláírás jobb oldalon, egymás alatt (Kivitelezős fent, Beruházó lent)
    const anchor: SignatureAnchor =
      template?.[`signature${signatureNumber}_anchor`] ?? 'bottom-right';
    const customX = template?.[`signature${signatureNumber}_x`];
    const defaultY = signatureNumber === 1 ? 140 : 80;
    const customY = template?.[`signature${signatureNumber}_y`] ?? defaultY;

    const { x, y } = calculateSignaturePosition({
      pageWidth,
      pageHeight,
      anchor,
      customX,
      customY,
      signatureWidth: drawW,
      signatureHeight: drawH,
      margin: 50,
    });

    targetPage.drawImage(pngImage, {
      x,
      y,
      width: drawW,
      height: drawH,
    });

    const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(modifiedPdfBytes);
  },

  /**
   * Dokumentum digitális aláírásainak ellenőrzése.
   * Ellenőrzi a tárolt aláírási rekordokat és a tanúsítvány érvényességet.
   */
  async verifyDocumentSignatures(documentId: string): Promise<{
    valid: boolean;
    signatures: Array<{
      signer_name: string;
      signer_email: string;
      signer_role: string;
      signed_at: string;
      certificate_valid: boolean;
      certificate_fingerprint: string;
      document_integrity: boolean;
      visual_signature_included: boolean;
    }>;
    document_status: string;
    verification_date: string;
  }> {
    // Dokumentum betöltése
    let document: any;
    try {
      // @ts-ignore
      document = await strapi.documents('api::document.document').findOne({
        documentId: documentId,
        populate: ['file'],
      });
    } catch (err: any) {
      if (!isNaN(Number(documentId))) {
        document = await strapi.entityService.findOne('api::document.document', Number(documentId), {
          populate: ['file'],
        });
      } else {
        throw new Error(`Dokumentum nem található (ID: ${documentId})`);
      }
    }

    if (!document) {
      throw new Error(`Dokumentum nem található (ID: ${documentId})`);
    }

    const digitalSignatures: any[] = document.digital_signatures || [];

    if (digitalSignatures.length === 0) {
      return {
        valid: false,
        signatures: [],
        document_status: 'unsigned',
        verification_date: new Date().toISOString(),
      };
    }

    // Verifikáció: ellenőrizzük minden tárolt aláírási rekordot
    const verifiedSignatures = digitalSignatures.map((sig: any) => {
      // Tanúsítvány érvényesség ellenőrzése
      let certificateValid = false;
      try {
        if (sig.certificate_pem) {
          const forge = require('node-forge');
          const cert = forge.pki.certificateFromPem(sig.certificate_pem);
          const now = new Date();
          certificateValid =
            now >= cert.validity.notBefore &&
            now <= cert.validity.notAfter;
        } else {
          // Ha nincs PEM tárolva, de van fingerprint, feltételezzük érvényes (frissen generált)
          certificateValid = !!sig.certificate_fingerprint;
        }
      } catch (certErr: any) {
        strapi.log.warn(`Certificate validation failed for ${sig.signer_name}:`, certErr.message);
        certificateValid = false;
      }

      // Dokumentum integritás: ellenőrizzük, hogy van-e tárolt hash
      const documentIntegrity = !!sig.document_hash_before_sign;

      return {
        signer_name: sig.signer_name || 'Ismeretlen',
        signer_email: sig.signer_email || '',
        signer_role: sig.signer_role || 'unknown',
        signed_at: sig.signed_at || '',
        certificate_valid: certificateValid,
        certificate_fingerprint: sig.certificate_fingerprint || '',
        document_integrity: documentIntegrity,
        visual_signature_included: !!sig.visual_signature_included,
      };
    });

    // Összesített érvényesség
    const allValid = verifiedSignatures.every(
      (s: any) => s.certificate_valid && s.document_integrity
    );

    // Dokumentum állapot
    const hasBothSignatures =
      verifiedSignatures.some((s: any) => s.signer_role === 'client') &&
      verifiedSignatures.some((s: any) => s.signer_role === 'contractor');

    let documentStatus: string;
    if (hasBothSignatures && allValid) {
      documentStatus = 'fully_signed_valid';
    } else if (hasBothSignatures && !allValid) {
      documentStatus = 'fully_signed_issues';
    } else if (verifiedSignatures.length > 0) {
      documentStatus = 'partially_signed';
    } else {
      documentStatus = 'unsigned';
    }

    return {
      valid: allValid,
      signatures: verifiedSignatures,
      document_status: documentStatus,
      verification_date: new Date().toISOString(),
    };
  },

  /**
   * DOCX fájlt PDF-re konvertál LibreOffice-szal
   */
  async convertDocxToPdf(docxBuffer: Buffer, options?: { usePdfA?: boolean; protectPdf?: boolean }): Promise<Buffer> {
    const tempDir = tmpdir();
    // Ugyanazt a base nevet használjuk, hogy a LibreOffice ugyanazzal a névvel hozza létre a PDF-et
    const baseName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempDocxPath = path.join(tempDir, `${baseName}.docx`);
    // A LibreOffice ugyanazzal a base névvel hozza létre a PDF-et, csak .pdf kiterjesztéssel
    const tempPdfPath = path.join(tempDir, `${baseName}.pdf`);

    try {
      // Ideiglenes DOCX fájl létrehozása
      await writeFile(tempDocxPath, docxBuffer);

      // LibreOffice konverzió
      // Próbáljuk meg a soffice parancsot (Linux/Mac)
      let sofficeCommand = 'soffice';
      
      // Windows esetén próbáljuk meg a teljes elérési utat
      if (process.platform === 'win32') {
        // Windows-on általában a Program Files-ben van
        const possiblePaths = [
          'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
          'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        ];
        
        let found = false;
        for (const possiblePath of possiblePaths) {
          try {
            await execAsync(`"${possiblePath}" --version`);
            sofficeCommand = `"${possiblePath}"`;
            found = true;
            break;
          } catch {
            // Folytatjuk a következő útvonallal
          }
        }
        
        if (!found) {
          // Ha nem találjuk, próbáljuk a PATH-ból
          sofficeCommand = 'soffice';
        }
      }

      // LibreOffice konverzió opciók a jobb formázásért
      // --infilter: Word dokumentumok jobb kezelése
      // PDF/A-1a formátum aláírt dokumentumokhoz (archívum-barát, módosítás-érzékeny)
      let convertCommand: string;
      
      if (options?.usePdfA) {
        // PDF/A-1a export tagged PDF-fel és PDF/UA compliance-szal
        const pdfAFilter = 'pdf:writer_pdf_Export:{"SelectPdfVersion":{"type":"long","value":"1"},"UseTaggedPDF":{"type":"boolean","value":"true"},"PDFUACompliance":{"type":"boolean","value":"true"}}';
        convertCommand = `${sofficeCommand} --headless --infilter="MS Word 2007 XML" --convert-to "${pdfAFilter}" --outdir "${tempDir}" "${tempDocxPath}"`;
      } else {
        // Standard PDF
        convertCommand = `${sofficeCommand} --headless --infilter="MS Word 2007 XML" --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;
      }
      
      strapi.log.info(`Converting DOCX to PDF${options?.usePdfA ? ' (PDF/A-1a)' : ''}: ${convertCommand}`);
      
      try {
        await execAsync(convertCommand, { timeout: 30000 }); // 30 másodperces timeout
      } catch (error: any) {
        // Ha a soffice nem található, próbáljuk meg a libreoffice parancsot (PDF/A-t is, ha kérték)
        if (error.message.includes('soffice') || error.message.includes('not found')) {
          strapi.log.warn('soffice not found, trying libreoffice command');
          const libreofficeCommand = process.platform === 'win32' ? 'libreoffice' : 'libreoffice';
          const altFilter = options?.usePdfA
            ? 'pdf:writer_pdf_Export:{"SelectPdfVersion":{"type":"long","value":"1"},"UseTaggedPDF":{"type":"boolean","value":"true"},"PDFUACompliance":{"type":"boolean","value":"true"}}'
            : 'pdf';
          const altConvertCommand = `${libreofficeCommand} --headless --infilter="MS Word 2007 XML" --convert-to "${altFilter}" --outdir "${tempDir}" "${tempDocxPath}"`;
          await execAsync(altConvertCommand, { timeout: 30000 });
        } else {
          throw error;
        }
      }

      // Várunk egy kicsit, hogy a LibreOffice biztosan befejezze a fájl írását
      await new Promise(resolve => setTimeout(resolve, 500));

      // Ellenőrizzük, hogy a PDF fájl létezik-e
      try {
        await fs.promises.access(tempPdfPath);
      } catch {
        // Ha nem található a várt helyen, keressük meg a tempDir-ben
        strapi.log.warn(`PDF not found at expected path: ${tempPdfPath}, searching in tempDir...`);
        const files = await fs.promises.readdir(tempDir);
        const pdfFiles = files.filter(f => f.startsWith(baseName) && f.endsWith('.pdf'));
        
        if (pdfFiles.length > 0) {
          const foundPdfPath = path.join(tempDir, pdfFiles[0]);
          strapi.log.info(`Found PDF at: ${foundPdfPath}`);
          let pdfBuffer = await fs.promises.readFile(foundPdfPath);
          
          // Tisztítás
          await unlink(tempDocxPath).catch(() => {});
          await unlink(foundPdfPath).catch(() => {});
          
          strapi.log.info(`PDF conversion successful, size: ${pdfBuffer.length} bytes`);
          
          // Ha kért PDF protection, alkalmazzuk
          if (options?.protectPdf) {
            strapi.log.info('Applying PDF protection...');
            pdfBuffer = await this.protectPdf(pdfBuffer);
          }
          
          return pdfBuffer;
        } else {
          throw new Error(`PDF fájl nem található a várt helyen: ${tempPdfPath}`);
        }
      }

      // PDF fájl beolvasása
      let pdfBuffer = await fs.promises.readFile(tempPdfPath);

      // Tisztítás
      await unlink(tempDocxPath).catch(() => {});
      await unlink(tempPdfPath).catch(() => {});

      strapi.log.info(`PDF conversion successful, size: ${pdfBuffer.length} bytes`);
      
      // Ha kért PDF protection, alkalmazzuk
      if (options?.protectPdf) {
        strapi.log.info('Applying PDF protection...');
        pdfBuffer = await this.protectPdf(pdfBuffer);
      }
      
      return pdfBuffer;
    } catch (error: any) {
      // Tisztítás hiba esetén is
      await unlink(tempDocxPath).catch(() => {});
      await unlink(tempPdfPath).catch(() => {});

      strapi.log.error('Error converting DOCX to PDF:', error);
      throw new Error(`PDF konverzió sikertelen: ${error.message}. Ellenőrizd, hogy LibreOffice telepítve van-e a szerveren.`);
    }
  },
}));

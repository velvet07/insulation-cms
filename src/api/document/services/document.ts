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

const execAsync = promisify(exec);

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

      // Docxtemplater inicializálása kép modullal (ha elérhető)
      const zip = new PizZip(templateBuffer);
      
      const docOptions: any = {
        paragraphLoop: true,
        linebreaks: true,
      };

      // Ha az ImageModule elérhető, adjuk hozzá
      if (ImageModule) {
        const imageOptions = {
          centered: false,
          getImage: (tagValue: string) => {
            // A tagValue itt a base64 string lesz
            const base64Data = tagValue.replace(/^data:image\/\w+;base64,/, '');
            return Buffer.from(base64Data, 'base64');
          },
          getSize: () => {
            // Az aláírás mérete a dokumentumban (pixelben)
            return [150, 50];
          },
        };
        docOptions.modules = [new ImageModule(imageOptions)];
      }

      const doc = new Docxtemplater(zip, docOptions);

      // Tokenek létrehozása a projekt adataiból
      // @ts-ignore
      const tokens: any = this.createTokensFromProject(project);
      
      // Ha van aláírás, adjuk hozzá a tokenekhez (a sablonban {%signature} token kell legyen)
      if (signatureData) {
        strapi.log.info('Adding signature to document tokens');
        tokens.signature = signatureData;
      }

      doc.setData(tokens);

      // Dokumentum generálása
      doc.render();

      const generatedDocxBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      strapi.log.info('DOCX generated, converting to PDF...');

      // PDF konverzió LibreOffice-szal
      const pdfBuffer = await this.convertDocxToPdf(generatedDocxBuffer);

      // Fájlnév és mentés (PDF formátumban)
      // @ts-ignore
      const rawFileName = `${template.name}_${project.title || 'dokumentum'}_${new Date().toISOString().split('T')[0]}`;
      // @ts-ignore
      const noAccentsFileName = this.removeAccents(rawFileName);
      const sanitizedBaseName = noAccentsFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pdfFileName = `${sanitizedBaseName}.pdf`;
      
      // Ideiglenes fájl létrehozása a feltöltéshez
      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, pdfFileName);
      await writeFile(tempPdfPath, pdfBuffer);
      
      let fileEntity: any;
      try {
        // @ts-ignore
        const uploadService = strapi.plugin('upload').service('upload');
        
        // Strapi v5 upload service - a path mező kötelező és string típusú kell legyen
        if (typeof tempPdfPath !== 'string' || !tempPdfPath) {
          throw new Error(`PDF fájl path nem érvényes: ${tempPdfPath}`);
        }

        const fileInfo = {
          name: pdfFileName,
          alternativeText: `${template.name} - ${project.title || ''}`,
          caption: `${template.name} generálva (PDF)`,
        };
        
        // Strapi v5 / formidable kompatibilitás: path és filepath is megadva
        const fileObject = {
          path: tempPdfPath,
          filepath: tempPdfPath,
          name: pdfFileName,
          originalFilename: pdfFileName,
          type: 'application/pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        };
        
        strapi.log.info(`Uploading PDF file: ${pdfFileName}, path: ${tempPdfPath}`);
        
        // Strapi v5 upload service hívás
        // A data mezőben a fileInfo kulcs alatt várja az adatokat
        const uploadedFiles = await uploadService.upload({
          data: { fileInfo },
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

      // Type mapping - CSAK azokat engedjük át, amik a szerver sémájában is szerepelnek
      // Amíg a szerveren nem frissíted a Document content type "type" mezőjét, 
      // addig itt csak a régi értékek maradhatnak, vagy marad az 'other'
      const serverAllowedTypes = ['contract', 'worksheet', 'invoice', 'completion_certificate', 'other'];
      const documentType = serverAllowedTypes.includes(template.type) ? template.type : 'other';

      strapi.log.info(`Creating document record. Type: ${documentType} (template original type: ${template.type})`);

      // Dokumentum létrehozása entityService-szel
      const document = await strapi.entityService.create('api::document.document', {
        data: {
          type: documentType,
          project: project.id,
          uploaded_by: userId,
          signed: false,
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

      // Docxtemplater inicializálása
      const zip = new PizZip(templateBuffer);
      const docOptions: any = {
        paragraphLoop: true,
        linebreaks: true,
      };

      if (ImageModule) {
        const imageOptions = {
          centered: false,
          getImage: (tagValue: string) => {
            const base64Data = tagValue.replace(/^data:image\/\w+;base64,/, '');
            return Buffer.from(base64Data, 'base64');
          },
          getSize: () => [150, 50],
        };
        docOptions.modules = [new ImageModule(imageOptions)];
      }

      const doc = new Docxtemplater(zip, docOptions);

      // Tokenek létrehozása az aláírással
      // @ts-ignore
      const tokens: any = this.createTokensFromProject(project);
      tokens.signature = signatureData;

      doc.setData(tokens);
      doc.render();

      const generatedDocxBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      // PDF konverzió
      const pdfBuffer = await this.convertDocxToPdf(generatedDocxBuffer);

      // Fájlnév
      // @ts-ignore
      const rawFileName = `${template.name}_${project.title || 'dokumentum'}_${new Date().toISOString().split('T')[0]}`;
      // @ts-ignore
      const noAccentsFileName = this.removeAccents(rawFileName);
      const sanitizedBaseName = noAccentsFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pdfFileName = `${sanitizedBaseName}.pdf`;

      // Ideiglenes fájl
      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, pdfFileName);
      await writeFile(tempPdfPath, pdfBuffer);

      // Régi fájl törlése
      if (document.file && document.file.id) {
        try {
          // @ts-ignore
          await strapi.plugin('upload').service('upload').remove(document.file.id);
        } catch (err: any) {
          strapi.log.warn('Error removing old file:', err.message);
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

      const fileObject = {
        path: tempPdfPath,
        filepath: tempPdfPath,
        name: pdfFileName,
        originalFilename: pdfFileName,
        type: 'application/pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };

      const uploadedFiles = await uploadService.upload({
        data: { fileInfo },
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

      return {
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
        floor_material: project.floor_material ? (floorMaterialLabels[project.floor_material] || project.floor_material) : '',
        date: new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }),
      };
    },

  /**
   * DOCX fájlt PDF-re konvertál LibreOffice-szal
   */
  async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
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

      const convertCommand = `${sofficeCommand} --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;
      
      strapi.log.info(`Converting DOCX to PDF: ${convertCommand}`);
      
      try {
        await execAsync(convertCommand, { timeout: 30000 }); // 30 másodperces timeout
      } catch (error: any) {
        // Ha a soffice nem található, próbáljuk meg a libreoffice parancsot
        if (error.message.includes('soffice') || error.message.includes('not found')) {
          strapi.log.warn('soffice not found, trying libreoffice command');
          const libreofficeCommand = process.platform === 'win32' 
            ? 'libreoffice' 
            : 'libreoffice';
          
          const altConvertCommand = `${libreofficeCommand} --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;
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
          const pdfBuffer = await fs.promises.readFile(foundPdfPath);
          
          // Tisztítás
          await unlink(tempDocxPath).catch(() => {});
          await unlink(foundPdfPath).catch(() => {});
          
          strapi.log.info(`PDF conversion successful, size: ${pdfBuffer.length} bytes`);
          return pdfBuffer;
        } else {
          throw new Error(`PDF fájl nem található a várt helyen: ${tempPdfPath}`);
        }
      }

      // PDF fájl beolvasása
      const pdfBuffer = await fs.promises.readFile(tempPdfPath);

      // Tisztítás
      await unlink(tempDocxPath).catch(() => {});
      await unlink(tempPdfPath).catch(() => {});

      strapi.log.info(`PDF conversion successful, size: ${pdfBuffer.length} bytes`);
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

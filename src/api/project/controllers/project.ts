import { factories } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Use require() to avoid TS type-resolution issues on servers
// where `archiver` is installed without type declarations.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');

function safeString(value: any) {
  return (value ?? '').toString();
}

function removeAccents(str: any) {
  // Simple diacritic removal (works for HU accents too)
  return safeString(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sanitizeWindowsNameKeepAccents(input: any) {
  // Keep accents, just remove characters invalid on Windows and path separators.
  return (
    safeString(input)
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown'
  );
}

function formatTimestampForFile(date: any) {
  const d = date instanceof Date ? date : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}_${hh}${mi}`;
}

export default factories.createCoreController('api::project.project', ({ strapi }) => ({
  /**
   * Bulk export: több projekt dokumentumai + fotói ZIP-ben, könyvtárstruktúrában.
   *
   * Body:
   *  - { data: { projectIds: string[] } }
   */
  async bulkExport(ctx: any) {
    const body = ctx.request.body?.data || ctx.request.body || {};
    const projectIds = body.projectIds || body.project_ids || body.projects || [];

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return ctx.badRequest('projectIds kötelező (tömb)');
    }

    const exportStamp = formatTimestampForFile(new Date());
    const zipFileName = `export_${exportStamp}.zip`;
    // Per requirement: top-level folder must be the project name (no extra root folder).

    ctx.set('Content-Type', 'application/zip');
    ctx.set('Content-Disposition', `attachment; filename="${zipFileName}"`);
    ctx.set('Cache-Control', 'no-store');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('warning', (err: any) => {
      // warnings (e.g. stat failures) - log, but keep running
      strapi.log.warn(`[bulkExport] ZIP warning: ${err?.message || err}`);
    });

    archive.on('error', (err: any) => {
      strapi.log.error(`[bulkExport] ZIP error: ${err?.message || err}`, err);
      try {
        ctx.res.destroy(err);
      } catch {
        // ignore
      }
    });

    // Koa/Strapi response streaming
    ctx.status = 200;
    ctx.respond = false;
    archive.pipe(ctx.res);

    const getFileStream = async (fileEntity: any) => {
      const fileUrl = fileEntity?.url;
      if (!fileUrl) return null;

      // 1) Try local filesystem (local upload provider)
      const rel = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
      const localPath = path.join((strapi as any).dirs.static.public, rel);
      try {
        if (fs.existsSync(localPath)) {
          return fs.createReadStream(localPath);
        }
      } catch {
        // ignore and fallback to fetch
      }

      // 2) Fallback: fetch from public URL (works with S3 provider or reverse proxy)
      const serverUrl = strapi.config.get('server.url') || 'https://cms.emermedia.eu';
      const fullUrl = fileUrl.startsWith('http')
        ? fileUrl
        : `${serverUrl}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;

      // Node 18+ has built-in fetch
      const res = await fetch(fullUrl);
      if (!res.ok || !res.body) {
        throw new Error(`Nem sikerült letölteni a fájlt: ${fullUrl} (${res.status})`);
      }
      // Node 20+: convert Web ReadableStream to Node stream
      return Readable.fromWeb(res.body as any);
    };

    const findProject = async (id: any) => {
      const idStr = safeString(id);
      // Try documentId first (Strapi v5)
      try {
        // @ts-ignore
        const doc = await (strapi as any).documents('api::project.project').findOne({
          documentId: idStr,
          populate: ['company', 'subcontractor', 'assigned_to'],
        });
        if (doc) return doc;
      } catch {
        // ignore
      }

      // Fallback numeric
      if (!isNaN(Number(idStr))) {
        return await (strapi as any).entityService.findOne('api::project.project', Number(idStr), {
          populate: ['company', 'subcontractor', 'assigned_to'],
        });
      }

      return null;
    };

    const ensureFolders = (projectBase: string) => {
      const dirs = [
        `${projectBase}01_Adminisztratív_dokumentumok/`,
        `${projectBase}01_Adminisztratív_dokumentumok/011_Intézkedés_kezdete/`,
        `${projectBase}01_Adminisztratív_dokumentumok/011_Intézkedés_kezdete/Kezdő dátumot alátámasztó dokumentum(ok)/`,
        `${projectBase}01_Adminisztratív_dokumentumok/012_Intézkedés_zárása/`,
        `${projectBase}01_Adminisztratív_dokumentumok/012_Intézkedés_zárása/Záró dátumot alátámasztó dokumentum(ok)/`,
        `${projectBase}01_Adminisztratív_dokumentumok/012_Intézkedés_zárása/Számviteli bizonylat(ok)/`,
        `${projectBase}01_Adminisztratív_dokumentumok/013_Egyéb_adminisztratív_dokumentumok_nyilatkozatok/`,

        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/`,
        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/021_Fényképek/`,
        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/022_Mérés_oldali_validáció_Energetikai_Tanúsítvány/`,
        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/023_Műszaki_alátámasztó_dokumentumok/`,

        `${projectBase}03_Auditor_számítások/`,
        `${projectBase}03_Auditor_számítások/A végfelhasználási energiamegtakarítás [GJ/év] számítása/`,

        `${projectBase}04_Hitelesítési_dokumentációk/`,
        `${projectBase}04_Hitelesítési_dokumentációk/Tanúsítvány hitelesített energiamegtakarításról/`,
        `${projectBase}04_Hitelesítési_dokumentációk/Hitelesítési jegyzőkönyv, vagy a hitelesítés menetét leíró dokumentum/`,
      ];

      // Add empty directory entries so structure is visible even if empty.
      for (const d of dirs) {
        archive.append('', { name: d });
      }
    };

    const pickDocumentTargetFolder = (doc: any) => {
      const t = safeString(doc?.type || 'other');

      // Mapping (adjustable)
      if (t === 'invoice') {
        return '01_Adminisztratív_dokumentumok/012_Intézkedés_zárása/Számviteli bizonylat(ok)';
      }
      if (t === 'completion_certificate' || t === 'teljesitesi_igazolo') {
        return '01_Adminisztratív_dokumentumok/012_Intézkedés_zárása/Záró dátumot alátámasztó dokumentum(ok)';
      }
      if (t === 'contract' || t === 'vallalkozasi_szerzodes' || t === 'megallapodas') {
        return '01_Adminisztratív_dokumentumok/011_Intézkedés_kezdete/Kezdő dátumot alátámasztó dokumentum(ok)';
      }
      if (t === 'felmerolap') {
        return '02_Végső_felhasználói_adatszolgáltatás/022_Mérés_oldali_validáció_Energetikai_Tanúsítvány';
      }
      if (t === 'munkaterul_atadas') {
        return '02_Végső_felhasználói_adatszolgáltatás/023_Műszaki_alátámasztó_dokumentumok';
      }

      return '01_Adminisztratív_dokumentumok/013_Egyéb_adminisztratív_dokumentumok_nyilatkozatok';
    };

    const usedProjectFolderNames = new Set<string>();

    for (const pid of projectIds) {
      const project = await findProject(pid);
      if (!project) {
        strapi.log.warn(`[bulkExport] Project not found: ${pid}`);
        continue;
      }

      // Root folder must be the project name
      const projectFolderBase = sanitizeWindowsNameKeepAccents(
        project.title || `Projekt_${project.id || project.documentId || 'unknown'}`
      );
      let projectFolder = projectFolderBase;
      if (usedProjectFolderNames.has(projectFolder)) {
        projectFolder = `${projectFolder}_${project.id || project.documentId || 'id'}`;
      }
      usedProjectFolderNames.add(projectFolder);

      const base = `${projectFolder}/`;

      // Create the required directory structure (even if empty)
      ensureFolders(base);

      // Documents
      const documents = await (strapi as any).entityService.findMany('api::document.document', {
        filters: { project: project.id },
        populate: ['file'],
        sort: ['createdAt:asc'],
      });

      for (const doc of documents || []) {
        const fileEntity = doc.file;
        const stream = await getFileStream(fileEntity);
        if (!stream) continue;

        const targetFolder = pickDocumentTargetFolder(doc);
        const safeName = sanitizeWindowsNameKeepAccents(doc.file_name || fileEntity?.name || `Dokumentum_${doc.id || 'unknown'}`);
        const ext =
          path.extname(safeString(doc.file_name || fileEntity?.name)) || path.extname(safeString(fileEntity?.name));
        const finalName = ext ? (safeName.endsWith(ext) ? safeName : `${safeName}${ext}`) : safeName;

        const zipPath = `${base}${targetFolder}/${finalName}`;
        archive.append(stream as any, { name: zipPath });
      }

      // Photos
      const photos = await (strapi as any).entityService.findMany('api::photo.photo', {
        filters: { project: project.id },
        populate: ['file', 'category'],
        sort: ['createdAt:asc'],
      });

      for (const photo of photos || []) {
        const fileEntity = photo.file;
        const stream = await getFileStream(fileEntity);
        if (!stream) continue;

        const categoryName = photo.category?.name || 'uncategorized';
        const categoryFolder = sanitizeWindowsNameKeepAccents(categoryName);
        const safeName = sanitizeWindowsNameKeepAccents(fileEntity?.name || photo.name || `Foto_${photo.id || 'unknown'}`);
        const ext = path.extname(safeString(fileEntity?.name)) || '.jpg';
        const finalName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;

        const zipPath = `${base}02_Végső_felhasználói_adatszolgáltatás/021_Fényképek/${categoryFolder}/${finalName}`;
        archive.append(stream as any, { name: zipPath });
      }
    }

    await archive.finalize();
  },

  /**
   * Billing helper: return projects whose FIRST activity (document create OR photo create)
   * falls within the given date range.
   *
   * Query params:
   * - from: YYYY-MM-DD
   * - to:   YYYY-MM-DD
   * - company: optional company id/documentId filter (project.company)
   */
  async startedForBilling(ctx: any) {
    const fromRaw = safeString(ctx.query?.from);
    const toRaw = safeString(ctx.query?.to);
    const companyRaw = safeString(ctx.query?.company);

    const hasFrom = !!fromRaw;
    const hasTo = !!toRaw;

    const fromDate = hasFrom ? new Date(`${fromRaw}T00:00:00.000Z`) : null;
    const toDate = hasTo ? new Date(`${toRaw}T23:59:59.999Z`) : null;

    if ((hasFrom && isNaN(fromDate!.getTime())) || (hasTo && isNaN(toDate!.getTime()))) {
      return ctx.badRequest('Érvénytelen dátum paraméter (from/to). Formátum: YYYY-MM-DD');
    }

    let companyFilter: any = null;
    if (companyRaw) {
      const looksNumeric = !isNaN(Number(companyRaw)) && String(Number(companyRaw)) === companyRaw;
      companyFilter = looksNumeric ? { company: { id: Number(companyRaw) } } : { company: { documentId: companyRaw } };
    }

    const createdAtRange: any = {};
    if (fromDate) createdAtRange.$gte = fromDate.toISOString();
    if (toDate) createdAtRange.$lte = toDate.toISOString();

    // 1) Candidates: projects that have ANY activity within the range
    const candidateProjectIds = new Set<number>();

    const documentsInRange = await (strapi as any).entityService.findMany('api::document.document', {
      filters: Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {},
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const d of documentsInRange || []) {
      const p = d.project;
      const pid = typeof p === 'object' ? p?.id : p;
      if (pid) candidateProjectIds.add(pid);
    }

    const photosInRange = await (strapi as any).entityService.findMany('api::photo.photo', {
      filters: Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {},
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const ph of photosInRange || []) {
      const p = ph.project;
      const pid = typeof p === 'object' ? p?.id : p;
      if (pid) candidateProjectIds.add(pid);
    }

    if (candidateProjectIds.size === 0) {
      return { data: [] };
    }

    // 2) Load all activity for candidate projects and compute FIRST activity per project
    const candidateIds = Array.from(candidateProjectIds);
    const firstActivityByProject = new Map<number, string>(); // projectId -> ISO string

    const allDocs = await (strapi as any).entityService.findMany('api::document.document', {
      filters: { project: { id: { $in: candidateIds } } },
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const d of allDocs || []) {
      const p = d.project;
      const pid = typeof p === 'object' ? p?.id : p;
      if (!pid) continue;
      const createdAt = safeString(d.createdAt);
      const prev = firstActivityByProject.get(pid);
      if (!prev || createdAt < prev) firstActivityByProject.set(pid, createdAt);
    }

    const allPhotos = await (strapi as any).entityService.findMany('api::photo.photo', {
      filters: { project: { id: { $in: candidateIds } } },
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const ph of allPhotos || []) {
      const p = ph.project;
      const pid = typeof p === 'object' ? p?.id : p;
      if (!pid) continue;
      const createdAt = safeString(ph.createdAt);
      const prev = firstActivityByProject.get(pid);
      if (!prev || createdAt < prev) firstActivityByProject.set(pid, createdAt);
    }

    // 3) Keep only those whose FIRST activity is within the requested range
    const startedProjectIds: number[] = [];
    for (const [pid, firstIso] of firstActivityByProject.entries()) {
      const first = new Date(firstIso);
      if (isNaN(first.getTime())) continue;
      if (fromDate && first < fromDate) continue;
      if (toDate && first > toDate) continue;
      startedProjectIds.push(pid);
    }

    if (startedProjectIds.length === 0) {
      return { data: [] };
    }

    // 4) Load projects + apply optional company filter + backfill started_at
    //
    // IMPORTANT: billing is per Main Contractor. Legacy data may have:
    // - project.company set to a subcontractor company (type=subcontractor)
    // In that case, we must be able to resolve company.parent_company on the frontend.
    const projectFilters: any = {
      id: { $in: startedProjectIds },
      ...(companyFilter || {}),
    };

    const projects = await (strapi as any).entityService.findMany('api::project.project', {
      filters: projectFilters,
      // Include parent_company so frontend can attribute subcontractor projects to their main contractor.
      populate: [
        'company',
        'company.parent_company',
        'subcontractor',
        'subcontractor.parent_company',
        'assigned_to',
      ],
      sort: ['createdAt:desc'],
      limit: 10000,
    });

    // Backfill started_at if missing
    for (const p of projects || []) {
      const pid = p.id;
      const firstIso = firstActivityByProject.get(pid);
      if (!firstIso) continue;
      if (!p.started_at) {
        try {
          await (strapi as any).entityService.update('api::project.project', pid, {
            data: { started_at: firstIso },
          });
          p.started_at = firstIso;
        } catch {
          // ignore update errors; still return computed list
        }
      }
    }

    return { data: projects };
  },
}));


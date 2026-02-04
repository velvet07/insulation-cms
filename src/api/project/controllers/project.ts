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

const PROJECT_LIST_POPULATE = {
  company: { populate: '*' },
  subcontractor: { 
    populate: {
      parent_company: { populate: '*' }
    }
  },
  assigned_to: { populate: '*' },
  approved_by: { populate: '*' },
  sent_back_by: { populate: '*' },
  tenant: { populate: '*' },
  documents: { populate: '*' },
  photos: { populate: '*' }
};

export default factories.createCoreController('api::project.project', ({ strapi }) => ({
  /**
   * Override find so the list always includes essential relations.
   */
  async find(ctx: any) {
    const query = { ...(ctx.query || {}) };
    const pagination = query.pagination || {};
    const page = Number(pagination.page) || 1;
    const pageSize = Number(pagination.pageSize) || 25;
    const start = (page - 1) * pageSize;

    const filters = query.filters || undefined;
    const sort = query.sort || undefined;

    const data = await (strapi as any).entityService.findMany('api::project.project', {
      filters,
      sort,
      populate: PROJECT_LIST_POPULATE,
      start,
      limit: pageSize,
    });

    let total = Array.isArray(data) ? data.length : 0;
    try {
      if (typeof (strapi as any).entityService.count === 'function') {
        total = await (strapi as any).entityService.count('api::project.project', { filters });
      } else if ((strapi as any).db?.query) {
        total = await (strapi as any).db.query('api::project.project').count({ where: filters });
      }
    } catch {
      // Keep fallback total based on current page size
    }

    const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

    ctx.body = {
      data: data || [],
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount,
          total,
        },
      },
    };
  },

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

    const findProject = async (id: any) => {
      const idStr = safeString(id);
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
      if (!isNaN(Number(idStr))) {
        return await (strapi as any).entityService.findOne('api::project.project', Number(idStr), {
          populate: ['company', 'subcontractor', 'assigned_to'],
        });
      }
      return null;
    };

    const firstProject = await findProject(projectIds[0]);
    const companyName = firstProject?.company && typeof firstProject.company === 'object' && firstProject.company !== null
      ? (firstProject.company as any).name
      : 'Ceg';
    const projectTitle = firstProject?.title || 'Projekt';
    const projectPart = projectIds.length === 1
      ? projectTitle
      : 'Tobb_projekt';
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePart = `${yyyy}_${mm}_${dd}`;
    const safeCompany = sanitizeWindowsNameKeepAccents(companyName);
    const safeProject = sanitizeWindowsNameKeepAccents(projectPart);
    const zipFileNameAscii = `${removeAccents(safeCompany) || 'Ceg'}_${removeAccents(safeProject) || 'Projekt'}_export_${datePart}.zip`;

    ctx.set('Content-Type', 'application/zip');
    ctx.set('Content-Disposition', `attachment; filename="${zipFileNameAscii}"`);
    ctx.set('X-Export-Filename', zipFileNameAscii);
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

    // Csak ezen mappák; több nem. 011=kezdő szerződések, 012=záró TIG/átadás, 013=nyilatkozatok, 021=fotók, 023=felmérőlap.
    const ensureFolders = (projectBase: string) => {
      const dirs = [
        `${projectBase}01_Adminisztratív_dokumentumok/`,
        `${projectBase}01_Adminisztratív_dokumentumok/011_Intézkedés_kezdete/`,
        `${projectBase}01_Adminisztratív_dokumentumok/012_Intézkedés_zárása/`,
        `${projectBase}01_Adminisztratív_dokumentumok/013_Egyéb_adminisztratív_dokumentumok_nyilatkozatok/`,
        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/`,
        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/021_Fényképek/`,
        `${projectBase}02_Végső_felhasználói_adatszolgáltatás/023_Műszaki_alátámasztó_dokumentumok/`,
      ];

      // Add empty directory entries so structure is visible even if empty.
      for (const d of dirs) {
        archive.append('', { name: d });
      }
    };

    const pickDocumentTargetFolder = (doc: any) => {
      const t = safeString(doc?.type || 'other');

      // 011: Vállalkozási szerződés, Szerződés energiahatékonyság-javító intézkedési munkálatokra, Megállapodás
      if (
        t === 'vallalkozasi_szerzodes' ||
        t === 'szerzodes_energiahatékonysag' ||
        t === 'megallapodas' ||
        t === 'contract'
      ) {
        return '01_Adminisztratív_dokumentumok/011_Intézkedés_kezdete';
      }
      // 012: Teljesítést igazoló jegyzőkönyv (TIG), Munkaterül átadás-átvételi jegyzőkönyv
      if (
        t === 'teljesitesi_igazolo' ||
        t === 'munkaterul_atadas' ||
        t === 'completion_certificate' ||
        t === 'invoice'
      ) {
        return '01_Adminisztratív_dokumentumok/012_Intézkedés_zárása';
      }
      // 013: Adatkezelési hozzájárulás nyilatkozat
      if (t === 'adatkezelesi_hozzajarulas') {
        return '01_Adminisztratív_dokumentumok/013_Egyéb_adminisztratív_dokumentumok_nyilatkozatok';
      }
      // 023: Felmérőlap (kivitelezői felmérés, szigetelt terület meghatározása)
      if (t === 'felmerolap') {
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

      let photoIndex = 0;
      for (const photo of photos || []) {
        const fileEntity = photo.file;
        const stream = await getFileStream(fileEntity);
        if (!stream) continue;

        photoIndex += 1;
        const baseName = sanitizeWindowsNameKeepAccents(fileEntity?.name || photo.name || `Foto`);
        const ext = path.extname(safeString(fileEntity?.name)) || '.jpg';
        const nameWithoutExt = baseName.endsWith(ext) ? baseName.slice(0, -ext.length) : baseName;
        const finalName = `${nameWithoutExt}_${photoIndex}${ext}`;

        const zipPath = `${base}02_Végső_felhasználói_adatszolgáltatás/021_Fényképek/${finalName}`;
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

    const extractProjectRef = (rel: any): { id?: number; documentId?: string } => {
      if (!rel) return {};
      if (typeof rel === 'number') return { id: rel };
      if (typeof rel === 'string') {
        const n = Number(rel);
        if (!isNaN(n) && String(n) === rel) return { id: n };
        return { documentId: rel };
      }
      if (typeof rel === 'object') {
        // EntityService populated relation usually comes as { id, documentId, ... }
        if (rel.id) return { id: Number(rel.id) };
        if (rel.documentId) return { documentId: safeString(rel.documentId) };
        // Sometimes relations can come as { data: { id, attributes } }
        if (rel.data?.id) return { id: Number(rel.data.id) };
        if (rel.data?.documentId) return { documentId: safeString(rel.data.documentId) };
      }
      return {};
    };

    const resolveProjectDocumentIdsToNumeric = async (docIds: string[]) => {
      const resolved = new Map<string, number>();
      for (const docId of docIds) {
        try {
          // @ts-ignore
          const p = await (strapi as any).documents('api::project.project').findOne({ documentId: docId });
          if (p?.id) resolved.set(docId, Number(p.id));
        } catch {
          // ignore
        }
      }
      return resolved;
    };

    // 1) Candidates: projects that have ANY activity within the range
    const candidateProjectIds = new Set<number>();
    const candidateProjectDocumentIds = new Set<string>();

    const documentsInRange = await (strapi as any).entityService.findMany('api::document.document', {
      filters: Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {},
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const d of documentsInRange || []) {
      const ref = extractProjectRef(d.project);
      if (ref.id) candidateProjectIds.add(ref.id);
      else if (ref.documentId) candidateProjectDocumentIds.add(ref.documentId);
    }

    const photosInRange = await (strapi as any).entityService.findMany('api::photo.photo', {
      filters: Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {},
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const ph of photosInRange || []) {
      const ref = extractProjectRef(ph.project);
      if (ref.id) candidateProjectIds.add(ref.id);
      else if (ref.documentId) candidateProjectDocumentIds.add(ref.documentId);
    }

    // Resolve documentIds -> numeric ids (Strapi v5 sometimes uses documentId in relations)
    if (candidateProjectDocumentIds.size > 0) {
      const mapping = await resolveProjectDocumentIdsToNumeric(Array.from(candidateProjectDocumentIds));
      for (const id of mapping.values()) candidateProjectIds.add(id);
    }

    if (candidateProjectIds.size === 0) {
      // Fallback: if started_at is already maintained, use it directly.
      const startedAtRange: any = {};
      if (fromDate) startedAtRange.$gte = fromDate.toISOString();
      if (toDate) startedAtRange.$lte = toDate.toISOString();

      const projects = await (strapi as any).entityService.findMany('api::project.project', {
        filters: {
          ...(companyFilter || {}),
          ...(Object.keys(startedAtRange).length ? { started_at: startedAtRange } : {}),
        },
        populate: [
          'company',
          'company.parent_company',
          'subcontractor',
          'subcontractor.parent_company',
          'assigned_to',
        ],
        sort: ['started_at:desc'],
        limit: 10000,
      });

      return { data: projects || [] };
    }

    // 2) Load all activity for candidate projects and compute FIRST activity per project
    const candidateIds = Array.from(candidateProjectIds);
    const firstActivityByProject = new Map<number, number>(); // projectId -> epoch ms

    const allDocs = await (strapi as any).entityService.findMany('api::document.document', {
      filters: { project: { id: { $in: candidateIds } } },
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const d of allDocs || []) {
      const ref = extractProjectRef(d.project);
      const pid = ref.id;
      if (!pid) continue;
      const ts = Date.parse(safeString(d.createdAt));
      if (isNaN(ts)) continue;
      const prev = firstActivityByProject.get(pid);
      if (prev === undefined || ts < prev) firstActivityByProject.set(pid, ts);
    }

    const allPhotos = await (strapi as any).entityService.findMany('api::photo.photo', {
      filters: { project: { id: { $in: candidateIds } } },
      populate: ['project'],
      fields: ['createdAt'],
      sort: ['createdAt:asc'],
      limit: 10000,
    });

    for (const ph of allPhotos || []) {
      const ref = extractProjectRef(ph.project);
      const pid = ref.id;
      if (!pid) continue;
      const ts = Date.parse(safeString(ph.createdAt));
      if (isNaN(ts)) continue;
      const prev = firstActivityByProject.get(pid);
      if (prev === undefined || ts < prev) firstActivityByProject.set(pid, ts);
    }

    // 3) Keep only those whose FIRST activity is within the requested range
    const startedProjectIds: number[] = [];
    for (const [pid, firstTs] of firstActivityByProject.entries()) {
      const first = new Date(firstTs);
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
      const firstTs = firstActivityByProject.get(pid);
      if (firstTs === undefined) continue;
      const firstIso = new Date(firstTs).toISOString();
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


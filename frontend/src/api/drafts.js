import { api } from './client.js';
import { computeWordDiff } from '../utils/wordDiff.js';

export const getDrafts = async (status) =>
  (
    await api.get('/api/drafts', {
      params: status ? { status } : {},
    })
  ).data;

export const getDraft = async (id) =>
  (await api.get(`/api/drafts/${encodeURIComponent(id)}`)).data;

export const getDemoDrafts = async () =>
  (await api.get('/api/demo/drafts')).data;

export const getMockDraft = async () => {
  const data = (await api.get('/api/mock/draft')).data;
  if (!data.mask_summary) {
    data.mask_summary = {
      count: 2,
      by_kind: {
        confidential: 1,
        email: 1,
      },
      items: [
        {
          token: '[CONFIDENTIAL_1]',
          kind: 'confidential',
          preview: 'Proj***',
        },
        {
          token: '[EMAIL_1]',
          kind: 'email',
          preview: 'a***@company.com',
        },
      ],
      ai_used: true,
    };
  }
  return data;
};

export async function createDraft({
  text,
  file,
  title,
  author = 'creator',
  useAi = true,
}) {
  const body = new FormData();

  if (file) {
    body.append('file', file);
  } else {
    body.append('text', text || '');
  }

  if (title) {
    body.append('title', title);
  }

  body.append('author', author);
  body.append('use_ai', String(useAi));

  return (await api.post('/api/drafts', body)).data;
}

export const updateDraft = async (id, text, title) =>
  uploadRevision(id, {
    text,
    note: title ? `Updated: ${title}` : 'Draft text updated',
  });

export const recheckDraft = async (id) =>
  (
    await api.post(
      `/api/drafts/${encodeURIComponent(id)}/recheck`,
    )
  ).data;

export const submitDraft = async (id) =>
  (
    await api.post(
      `/api/drafts/${encodeURIComponent(id)}/submit`,
    )
  ).data;

export const addComment = async (id, text, issueId, parentId = null) =>
  (
    await api.post(
      `/api/drafts/${encodeURIComponent(id)}/comments`,
      {
        text,
        ...(issueId ? { issue_id: issueId } : {}),
        ...(parentId ? { parent_id: parentId } : {}),
      },
    )
  ).data;

export const decideDraft = async (
  id,
  decision,
  comment = '',
) =>
  (
    await api.post(
      `/api/drafts/${encodeURIComponent(id)}/decision`,
      {
        decision,
        comment,
      },
    )
  ).data;

/**
 * Patch issue status/fix/exception.
 * In contract_v2, payload should include `revision` to guard against concurrent edits (409 STALE_REVISION).
 */
export const actOnIssue = async (
  draftId,
  issueId,
  payload,
  revision = undefined,
) => {
  const body = {
    ...payload,
    ...(revision !== undefined && payload.revision === undefined
      ? { revision }
      : {}),
  };

  return (
    await api.patch(
      `/api/drafts/${encodeURIComponent(draftId)}/issues/${encodeURIComponent(issueId)}`,
      body,
    )
  ).data;
};

/* --- Round 3: Versions and Diff Endpoints (P2 / contract_v2) --- */

/**
 * Get list of versions for a draft: [{ n, author, role, at, note, counts, chars }]
 */
export const getVersions = async (id) => {
  try {
    const res = await api.get(`/api/drafts/${encodeURIComponent(id)}/versions`);
    return res.data;
  } catch (err) {
    if (err.response && [404, 405].includes(err.response.status)) {
      return null;
    }
    throw err;
  }
};

/**
 * Get full text of a specific version number.
 */
export const getVersionText = async (id, n) => {
  const res = await api.get(
    `/api/drafts/${encodeURIComponent(id)}/versions/${encodeURIComponent(n)}`,
  );
  return res.data;
};

/**
 * Get word-level diff ops between two versions.
 * Falls back to client-side computeWordDiff if server endpoint returns 404/405.
 */
export const getDiff = async (id, from, to, fallbackOldText = '', fallbackNewText = '') => {
  try {
    const res = await api.get(
      `/api/drafts/${encodeURIComponent(id)}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    return res.data;
  } catch (err) {
    // If server diff endpoint is not yet mounted (404/405), compute word diff client-side
    if (err.response && [404, 405].includes(err.response.status)) {
      const clientDiff = computeWordDiff(fallbackOldText, fallbackNewText);
      return {
        from,
        to,
        ops: clientDiff.ops,
        stats: clientDiff.stats,
        _clientFallback: true,
      };
    }
    throw err;
  }
};

/**
 * Upload a new revision (replaces text, adds a version, re-checks).
 * POST /api/drafts/{id}/revisions
 */
export async function uploadRevision(id, { text, file, note }) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else if (text !== undefined) {
    formData.append('text', text);
  }
  if (note) {
    formData.append('note', note);
  }

  return (
    await api.post(
      `/api/drafts/${encodeURIComponent(id)}/revisions`,
      formData,
    )
  ).data;
};

/* --- Round 3: Image Draft Endpoints (P4 / contract_v2 §8) --- */

const mockImageBlobs = new Map();

/**
 * Check an image banner:
 * POST /api/drafts/image
 * Multipart: file (PNG/JPG), title, use_ai
 * Returns draft with kind: "image"
 */
export async function createImageDraft({ file, title, useAi = true }) {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  formData.append('use_ai', String(useAi));

  try {
    const res = await api.post('/api/drafts/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  } catch (err) {
    if (err.response && [404, 405, 501].includes(err.response.status)) {
      const mockId = 'dr_img_' + Date.now().toString(36);
      const objectUrl = URL.createObjectURL(file);
      mockImageBlobs.set(mockId, objectUrl);

      return {
        id: mockId,
        title: title || file.name,
        kind: 'image',
        status: 'DRAFT',
        revision: 1,
        author: localStorage.getItem('loomguard-user') || 'creator',
        created_at: new Date().toISOString(),
        text: `[image ${file.name} 1200x630 sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855]`,
        image: {
          filename: file.name,
          format: file.type.includes('png') ? 'PNG' : 'JPG',
          width: 1200,
          height: 630,
          original_width: 1200,
          original_height: 630,
          downscaled: false,
          bytes: file.size,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        palette: [
          { hex: '#4F46E5', share: 0.42, chroma: 70, region: 'background', on_brand: true, nearest_brand: '#4F46E5', delta_e: 0.0 },
          { hex: '#F3F4F6', share: 0.35, chroma: 4, region: 'content', on_brand: true, nearest_brand: '#FFFFFF', delta_e: 1.2 },
          { hex: '#E11D48', share: 0.15, chroma: 65, region: 'accent', on_brand: false, nearest_brand: '#4F46E5', delta_e: 14.8 },
        ],
        elements: [
          { type: 'text', text: 'Get Started Today', region: { x: 0.35, y: 0.65, w: 0.30, h: 0.15 } },
          { type: 'logo', label: 'Aurora Icon', region: { x: 0.05, y: 0.05, w: 0.25, h: 0.20 } },
        ],
        issues: [
          {
            id: 'iss_img_01',
            category: 'ACCESSIBILITY',
            priority: 'mandatory',
            status: 'open',
            reason: 'Low contrast text on CTA button: measured 2.8:1, requires 4.5:1 under WCAG 2.1 AA.',
            quote: 'Get Started Today',
            start: 0,
            end: 0,
            region: { x: 0.35, y: 0.65, w: 0.30, h: 0.15 },
            measurement: {
              kind: 'contrast',
              text: 'Get Started Today',
              foreground: '#A5B4FC',
              background: '#4F46E5',
              ratio: 2.8,
              required: 4.5,
              standard: 'WCAG 2.1 AA',
              basis: 'luminance',
            },
            citation: { doc: 'Brand Style Guide v2.4', ref: 'Section 4.1 Contrast' },
            suggested_fixes: ['#FFFFFF'],
          },
          {
            id: 'iss_img_02',
            category: 'COLOUR',
            priority: 'advisory',
            status: 'open',
            reason: 'Accent banner ribbon (#E11D48) deviates from Aurora indigo palette (Delta-E 14.8).',
            quote: 'Ribbon Accent #E11D48',
            start: 0,
            end: 0,
            region: { x: 0.05, y: 0.05, w: 0.25, h: 0.20 },
            measurement: {
              kind: 'palette',
              colour: '#E11D48',
              share: 0.15,
              nearest_brand: '#4F46E5',
              delta_e00: 14.8,
              match_threshold: 5.0,
            },
            citation: { doc: 'Brand Kit 2026', ref: 'Color System - Secondary Accents' },
            suggested_fixes: ['#6366F1'],
          },
        ],
        versions: [
          {
            n: 1,
            author: localStorage.getItem('loomguard-user') || 'creator',
            role: 'creator',
            at: new Date().toISOString(),
            note: 'Initial graphic banner',
            counts: { total: 2, open_mandatory: 1 },
            chars: 0,
          },
        ],
        mask_summary: {
          count: 0,
          by_kind: {},
          items: [],
          ai_used: useAi,
        },
        comments: [],
        audit: [
          {
            id: 'aud_img_1',
            at: new Date().toISOString(),
            event: 'created',
            actor: localStorage.getItem('loomguard-user') || 'creator',
            detail: { kind: 'image' },
          },
        ],
      };
    }
    throw err;
  }
}

/**
 * Fetch authenticated image bytes as an object URL blob:
 * GET /api/drafts/{id}/image?version=n&annotate=true
 */
export async function getDraftImageBlobUrl(id, version = null, annotate = false) {
  try {
    const params = {};
    if (version !== null) params.version = version;
    if (annotate) params.annotate = 'true';

    const res = await api.get(`/api/drafts/${encodeURIComponent(id)}/image`, {
      params,
      responseType: 'blob',
    });

    return URL.createObjectURL(res.data);
  } catch (err) {
    if (err.response && [404, 405].includes(err.response.status)) {
      if (mockImageBlobs.has(id)) {
        return mockImageBlobs.get(id);
      }
      return null;
    }
    throw err;
  }
}

/* --- Round 3: Waivers and Audit Endpoints (P3 / contract_v2) --- */

/**
 * Grant or deny a waiver for an issue:
 * POST /api/drafts/{id}/issues/{iid}/waiver
 * Body: { decision: "grant" | "deny", reason: string (3+ chars) }
 * Returns: Updated Draft
 */
export const grantOrDenyWaiver = async (draftId, issueId, decision, reason) => {
  return (
    await api.post(
      `/api/drafts/${encodeURIComponent(draftId)}/issues/${encodeURIComponent(issueId)}/waiver`,
      { decision, reason },
    )
  ).data;
};

/**
 * Get draft audit trail:
 * GET /api/drafts/{id}/audit
 */
export const getDraftAudit = async (draftId) => {
  try {
    const res = await api.get(`/api/drafts/${encodeURIComponent(draftId)}/audit`);
    return res.data;
  } catch (err) {
    if (err.response && [404, 405].includes(err.response.status)) {
      return null;
    }
    throw err;
  }
};

/**
 * Get global audit trail (manager only):
 * GET /api/audit?limit=100
 */
export const getGlobalAudit = async (limit = 100) => {
  return (await api.get('/api/audit', { params: { limit } })).data;
};

export const getInsights = async () =>
  (await api.get('/api/insights')).data;

export const getHealth = async () =>
  (await api.get('/api/health')).data;

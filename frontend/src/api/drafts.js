
import { api } from './client.js';

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

export const getMockDraft = async () =>
  (await api.get('/api/mock/draft')).data;

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
  (
    await api.put(`/api/drafts/${encodeURIComponent(id)}`, {
      text,
      ...(title ? { title } : {}),
    })
  ).data;

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

export const addComment = async (id, text, issueId) =>
  (
    await api.post(
      `/api/drafts/${encodeURIComponent(id)}/comments`,
      {
        text,
        ...(issueId ? { issue_id: issueId } : {}),
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

export const actOnIssue = async (
  draftId,
  issueId,
  payload,
) =>
  (
    await api.patch(
      `/api/drafts/${encodeURIComponent(draftId)}/issues/${encodeURIComponent(issueId)}`,
      payload,
    )
  ).data;

export const getInsights = async () =>
  (await api.get('/api/insights')).data;

export const getHealth = async () =>
  (await api.get('/api/health')).data;


import { api } from './client.js';

export const getBrand = async () =>
  (await api.get('/api/brand')).data;

export const loadDemoKit = async () =>
  (await api.post('/api/brand/load-demo')).data;

export const uploadBrandKit = async (guide, facts) => {
  const body = new FormData();

  body.append('guide', guide);
  body.append('facts', facts);

  return (await api.post('/api/brand/upload', body)).data;
};

export const updateTerms = async (terms) =>
  (await api.put('/api/brand/terms', terms)).data;

export const searchBrand = async (q, source = 'guide', k = 3) =>
  (
    await api.get('/api/brand/search', {
      params: { q, source, k },
    })
  ).data;

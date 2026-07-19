// Cliente central da API — injeta o token JWT em todas as requisições.
const TOKEN_KEY = 'approva_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: formData ? formData : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  if (res.status === 401) {
    setToken(null);
    // Sessão expirada: envia para o login preservando a mensagem.
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Algo deu errado. Tente novamente.');
  return data;
}

// Download autenticado (modelo de importação .xlsx).
export async function apiDownload(path, filename) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao baixar o arquivo.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

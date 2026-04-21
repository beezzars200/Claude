const API = (() => {
  function getConfig() {
    return {
      url: (localStorage.getItem('serverUrl') || '').replace(/\/$/, ''),
      key: localStorage.getItem('apiKey') || ''
    };
  }

  async function request(method, path, body = null) {
    const { url, key } = getConfig();
    if (!url || !key) throw new Error('Server URL and API key not configured. Go to Settings.');
    const res = await fetch(`${url}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    getConfig,
    getOrganisations: () => request('GET', '/organisations'),
    createOrganisation: (data) => request('POST', '/organisations', data),
    deleteOrganisation: (id) => request('DELETE', `/organisations/${id}`),
    getEvents: () => request('GET', '/events'),
    createEvent: (data) => request('POST', '/events', data),
    deleteEvent: (id) => request('DELETE', `/events/${id}`),
    importAttendees: (eventId, attendees) => request('POST', `/events/${eventId}/import`, { attendees }),
    clearTickets: (eventId) => request('DELETE', `/events/${eventId}/tickets`),
    getTickets: (eventId) => request('GET', `/events/${eventId}/tickets`),
    getStats: (eventId) => request('GET', `/events/${eventId}/stats`),
    getAdminUsers: () => request('GET', '/admin-users'),
    createAdminUser: (data) => request('POST', '/admin-users', data),
    deleteAdminUser: (id) => request('DELETE', `/admin-users/${id}`),
    testConnection: async () => {
      const { url, key } = getConfig();
      if (!url || !key) return false;
      const res = await fetch(`${url}/api/organisations`, { headers: { 'x-api-key': key } });
      return res.ok;
    }
  };
})();

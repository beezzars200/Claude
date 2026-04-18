const API = (() => {
  function getConfig() {
    return {
      url: localStorage.getItem('serverUrl') || '',
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
    getEvents: () => request('GET', '/events'),
    createEvent: (data) => request('POST', '/events', data),
    importAttendees: (eventId, attendees) => request('POST', `/events/${eventId}/import`, { attendees }),
    getTickets: (eventId) => request('GET', `/events/${eventId}/tickets`),
    getStats: (eventId) => request('GET', `/events/${eventId}/stats`),
    testConnection: async () => {
      const { url, key } = getConfig();
      const res = await fetch(`${url}/api/events`, { headers: { 'x-api-key': key } });
      return res.ok;
    }
  };
})();

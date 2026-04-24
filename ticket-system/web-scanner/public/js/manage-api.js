const API = (() => {
  async function request(method, path, body = null) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  return {
    getOrganisations: () => request('GET', '/organisations'),
    createOrganisation: (data) => request('POST', '/organisations', data),
    deleteOrganisation: (id) => request('DELETE', `/organisations/${id}`),
    getEvents: () => request('GET', '/events'),
    createEvent: (data) => request('POST', '/events', data),
    deleteEvent: (id) => request('DELETE', `/events/${id}`),
    importAttendees: (eventId, attendees) => request('POST', `/events/${eventId}/import`, { attendees }),
    getTickets: (eventId) => request('GET', `/events/${eventId}/tickets`),
    getStats: (eventId) => request('GET', `/events/${eventId}/stats`),
    getAdminUsers: () => request('GET', '/admin-users'),
    createAdminUser: (data) => request('POST', '/admin-users', data),
    deleteAdminUser: (id) => request('DELETE', `/admin-users/${id}`)
  };
})();

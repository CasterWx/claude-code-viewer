const API_BASE = "http://localhost:8000/api";

export const api = {
    getProjects: async () => {
        const res = await fetch(`${API_BASE}/projects`);
        return res.json();
    },
    getSessions: async (projectName: string) => {
        const res = await fetch(`${API_BASE}/projects/${projectName}/sessions`);
        return res.json();
    },
    getSession: async (sessionId: string) => {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
        return res.json();
    },
    getSessionChanges: async (sessionId: string) => {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/changes`);
        return res.json();
    },
    search: async (query: string) => {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        return res.json();
    },
    getAnalytics: async () => {
        const res = await fetch(`${API_BASE}/analytics`);
        return res.json();
    },
    getTags: async () => {
        const res = await fetch(`${API_BASE}/tags`);
        return res.json();
    },
    addTag: async (sessionId: string, name: string, color: string = 'blue') => {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        });
        return res.json();
    },
    removeTag: async (sessionId: string, tagName: string) => {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/tags/${tagName}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    getDashboard: async () => {
        const res = await fetch(`${API_BASE}/dashboard`);
        return res.json();
    },
    getConfigs: async () => {
        const res = await fetch(`${API_BASE}/configs`);
        return res.json();
    },
    getConfig: async (path: string) => {
        const res = await fetch(`${API_BASE}/configs/${path}`);
        return res.json();
    },
    updateConfig: async (path: string, content: string) => {
        const res = await fetch(`${API_BASE}/configs/${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        return res.json();
    },
    deleteConfig: async (path: string) => {
        const res = await fetch(`${API_BASE}/configs/${path}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    getProjectDetails: async (projectName: string) => {
        const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/details`);
        if (!res.ok) {
            throw new Error('Failed to fetch project details');
        }
        return res.json();
    }
};

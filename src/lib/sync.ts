// No special import needed for standard fetch in Tauri v2 if not using proxying characteristics.

export type SyncProfile = {
  id: string;
  name: string;
  content: any;
};

export type SyncResult = {
  success: boolean;
  error?: string;
};

export class SyncService {
  private baseUrl: string;
  private host: string;
  private token: string;

  constructor(baseUrl: string, host: string, token: string) {
    this.baseUrl = baseUrl;
    this.host = host;
    this.token = token;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'X-Backlog-Host': this.host,
      'Content-Type': 'application/json'
    };
  }

  async getProfiles(): Promise<any[]> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles`, {
      method: 'GET',
      headers: this.headers
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async upsertProfile(profile: SyncProfile): Promise<SyncResult> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(profile)
    });
    if (!res.ok) return { success: false, error: await res.text() };
    return { success: true };
  }

  async deleteProfile(id: string): Promise<SyncResult> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles/${id}`, {
      method: 'DELETE',
      headers: this.headers
    });
    if (!res.ok) return { success: false, error: await res.text() };
    return { success: true };
  }

  async shareProfile(id: string, targetUserId: string, role: 'editor' | 'viewer' | 'remove'): Promise<SyncResult> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles/${id}/share`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ targetUserId, role })
    });
    if (!res.ok) return { success: false, error: await res.text() };
    return { success: true };
  }
}

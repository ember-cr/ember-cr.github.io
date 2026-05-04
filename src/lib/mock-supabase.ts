/**
 * MockSupabase - A purely client-side implementation of the Supabase client.
 * Stores data in LocalStorage and uses BroadcastChannel for real-time updates.
 * This allows the app to run without any backend (Standalone Mode).
 */

const STORAGE_KEY = "ember.mock_db";
const AUTH_KEY = "ember.mock_auth";
const BROADCAST_NAME = "ember.mock_realtime";

interface MockData {
  rooms: any[];
  messages: any[];
  profiles: any[];
  room_members: any[];
  email_invites: any[];
}

const DEFAULT_DATA: MockData = {
  rooms: [],
  messages: [],
  profiles: [],
  room_members: [],
  email_invites: [],
};

// Helper to manage LocalStorage data
const db = {
  get(): MockData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { ...DEFAULT_DATA };
    } catch {
      return { ...DEFAULT_DATA };
    }
  },
  save(data: MockData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};

// Real-time broadcast channel
const channel = new BroadcastChannel(BROADCAST_NAME);

export const mockSupabase = {
  auth: {
    async getUser() {
      const user = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      return { data: { user }, error: null };
    },
    async signInWithPassword({ email }: { email: string }) {
      const existingUser = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      const user = existingUser?.email === email 
        ? existingUser 
        : { id: email, email, user_metadata: { display_name: email.split("@")[0] } };
      
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      
      // Auto-create profile if missing
      const data = db.get();
      if (!data.profiles.find(p => p.id === user.id)) {
        data.profiles.push({ 
          id: user.id, 
          display_name: user.user_metadata.display_name, 
          created_at: new Date().toISOString() 
        });
        db.save(data);
      }
      
      return { data: { user }, error: null };
    },
    async signUp({ email, options }: { email: string, options?: any }) {
      const displayName = options?.data?.display_name || email.split("@")[0];
      const user = { id: email, email, user_metadata: { display_name: displayName } };
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      
      const data = db.get();
      if (!data.profiles.find(p => p.id === user.id)) {
        data.profiles.push({ 
          id: user.id, 
          display_name: displayName, 
          created_at: new Date().toISOString() 
        });
        db.save(data);
      }
      
      return { data: { user }, error: null };
    },
    async signOut() {
      localStorage.removeItem(AUTH_KEY);
      return { error: null };
    },
    async updateUser({ data: metadata }: { data: any }) {
      const user = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (user) {
        user.user_metadata = { ...user.user_metadata, ...metadata };
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      }
      return { data: { user }, error: null };
    },
    onAuthStateChange(callback: any) {
      // Basic mock of auth listener
      window.addEventListener("storage", (e) => {
        if (e.key === AUTH_KEY) {
          const user = JSON.parse(e.newValue || "null");
          callback(user ? "SIGNED_IN" : "SIGNED_OUT", { user });
        }
      });
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  },

  from(table: keyof MockData) {
    let data = db.get()[table] || [];
    let filters: ((item: any) => boolean)[] = [];
    let orderBy: { col: string; asc: boolean } | null = null;
    let limitCount: number | null = null;

    const query = {
      select(cols: string = "*") { return this; },
      eq(col: string, val: any) {
        filters.push((item) => item[col] === val);
        return this;
      },
      neq(col: string, val: any) {
        filters.push((item) => item[col] !== val);
        return this;
      },
      in(col: string, vals: any[]) {
        filters.push((item) => vals.includes(item[col]));
        return this;
      },
      gt(col: string, val: any) {
        filters.push((item) => item[col] > val);
        return this;
      },
      order(col: string, { ascending = true } = {}) {
        orderBy = { col, asc: ascending };
        return this;
      },
      limit(n: number) {
        limitCount = n;
        return this;
      },
      async maybeSingle() {
        const result = await this.then((r: any) => r);
        return { data: result.data?.[0] || null, error: null };
      },
      async single() {
        const result = await this.then((r: any) => r);
        return { data: result.data?.[0] || null, error: result.data?.[0] ? null : { message: "Not found" } };
      },

      // Execution
      async then(resolve: any) {
        let filtered = [...data];
        filters.forEach(f => filtered = filtered.filter(f));
        if (orderBy) {
          filtered.sort((a, b) => {
            if (a[orderBy!.col] < b[orderBy!.col]) return orderBy!.asc ? -1 : 1;
            if (a[orderBy!.col] > b[orderBy!.col]) return orderBy!.asc ? 1 : -1;
            return 0;
          });
        }
        if (limitCount !== null) filtered = filtered.slice(0, limitCount);
        return resolve({ data: filtered, error: null });
      },

      async insert(row: any) {
        const rows = Array.isArray(row) ? row : [row];
        const fullRows = rows.map(r => ({
          id: Math.random().toString(36).slice(2, 11),
          created_at: new Date().toISOString(),
          ...r
        }));
        
        const allData = db.get();
        allData[table].push(...fullRows);
        db.save(allData);

        // Notify real-time
        fullRows.forEach(r => {
          channel.postMessage({ table, event: "INSERT", new: r });
        });

        return { data: fullRows.length === 1 ? fullRows[0] : fullRows, error: null };
      },

      async update(updates: any) {
        const allData = db.get();
        let affected: any[] = [];
        allData[table] = allData[table].map(item => {
          let match = true;
          filters.forEach(f => { if (!f(item)) match = false; });
          if (match) {
            const updated = { ...item, ...updates, updated_at: new Date().toISOString() };
            affected.push(updated);
            return updated;
          }
          return item;
        });
        db.save(allData);
        
        affected.forEach(r => {
          channel.postMessage({ table, event: "UPDATE", new: r });
        });

        return { data: affected, error: null };
      },

      async delete() {
        const allData = db.get();
        let affected: any[] = [];
        allData[table] = allData[table].filter(item => {
          let match = true;
          filters.forEach(f => { if (!f(item)) match = false; });
          if (match) {
            affected.push(item);
            return false;
          }
          return true;
        });
        db.save(allData);

        affected.forEach(r => {
          channel.postMessage({ table, event: "DELETE", old: r });
        });

        return { data: affected, error: null };
      }
    };

    return query;
  },

  rpc(name: string, args: any) {
    // Mock specific RPC calls used in the app
    const data = db.get();
    
    if (name === "join_room_by_code") {
      const room = data.rooms.find(r => r.short_code === args._code || r.invite_code === args._code);
      if (!room) return Promise.resolve({ data: null, error: { message: "Room not found" } });
      
      const user = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (!user) return Promise.resolve({ data: null, error: { message: "Not authenticated" } });

      if (!data.room_members.find(m => m.room_id === room.id && m.user_id === user.id)) {
        data.room_members.push({ room_id: room.id, user_id: user.id, joined_at: new Date().toISOString() });
        db.save(data);
      }
      return Promise.resolve({ data: room.id, error: null });
    }

    if (name === "set_room_password") {
      const room = data.rooms.find(r => r.id === args._room_id);
      if (room) {
        room.password_hash = args._new_password ? "mock_hashed" : null;
        db.save(data);
      }
      return Promise.resolve({ data: null, error: null });
    }

    return Promise.resolve({ data: null, error: { message: "RPC not implemented" } });
  },

  channel(name: string) {
    const listeners: any[] = [];
    
    const onMessage = (e: MessageEvent) => {
      listeners.forEach(l => {
        // Simple filter matching
        if (l.table === e.data.table && (l.event === "*" || l.event === e.data.event)) {
          l.callback(e.data);
        }
      });
    };
    channel.addEventListener("message", onMessage);

    return {
      on(type: string, filter: any, callback: any) {
        listeners.push({ ...filter, callback });
        return this;
      },
      subscribe() { return this; },
      unsubscribe() {
        channel.removeEventListener("message", onMessage);
      }
    };
  },

  removeChannel(ch: any) {
    if (ch && ch.unsubscribe) ch.unsubscribe();
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File) {
          // Mock upload by storing as base64 in LocalStorage (caution: size limits!)
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const data = db.get();
              // In a real app we'd store the file separately, but for mock we'll just log it
              console.log(`Mock Upload to ${bucket}/${path}:`, reader.result?.toString().slice(0, 50) + "...");
              resolve({ data: { path }, error: null });
            };
            reader.readAsDataURL(file);
          });
        },
        getPublicUrl(path: string) {
          // Just return a placeholder or the same path
          return { data: { publicUrl: "https://placehold.co/400x400?text=Mock+Upload" } };
        }
      };
    }
  }
};

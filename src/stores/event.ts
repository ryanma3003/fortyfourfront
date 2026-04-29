import { defineStore } from 'pinia';

export interface AppEvent {
  id: string;
  judul: string;
  kategori: string;
  status: 'upcoming' | 'ongoing' | 'past';
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  lokasi?: string;
  deskripsi: string;
  konten: string;
  thumbnail?: string;
  createdAt?: string;
}

export const useEventStore = defineStore('event', {
  state: () => ({
    events: [] as AppEvent[],
    isLoaded: false,
  }),
  getters: {
    totalEvents: (state) => state.events.length,
    getEventById: (state) => (id: string) => state.events.find(e => String(e.id) === String(id)),
  },
  actions: {
    async fetchEvents() {
      if (this.isLoaded) return this.events;
      const stored = localStorage.getItem('events_mock');
      if (stored) {
        this.events = JSON.parse(stored);
      }
      this.isLoaded = true;
      return this.events;
    },
    async createEvent(payload: Omit<AppEvent, 'id'>) {
      const newEvent: AppEvent = {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      this.events.unshift(newEvent);
      this.saveToStorage();
      return newEvent;
    },
    async updateEvent(id: string, payload: Partial<AppEvent>) {
      const idx = this.events.findIndex(e => String(e.id) === String(id));
      if (idx !== -1) {
        this.events[idx] = { ...this.events[idx], ...payload };
        this.saveToStorage();
        return this.events[idx];
      }
      throw new Error("Event not found");
    },
    async deleteEvent(id: string) {
      this.events = this.events.filter(e => String(e.id) !== String(id));
      this.saveToStorage();
    },
    saveToStorage() {
      localStorage.setItem('events_mock', JSON.stringify(this.events));
    }
  }
});

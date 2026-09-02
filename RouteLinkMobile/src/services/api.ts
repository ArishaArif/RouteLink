import { Platform } from 'react-native';
import { TripItinerary, Trip, Booking, ChatMessage, Guide, HazardAlert } from '../types';

// Android Emulator uses 10.0.2.2 to point to host's localhost:5000
const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

let userToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  userToken = token;
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
});

export const api = {
  // --- Trips & Itineraries ---
  async createTrip(tripData: { title: string; destination: string; startDate: string; endDate: string; budget?: number }): Promise<Trip> {
    const res = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(tripData),
    });
    if (!res.ok) throw new Error(`Failed to create trip: ${res.statusText}`);
    return res.json();
  },

  async getItinerary(tripId: string): Promise<TripItinerary> {
    const res = await fetch(`${BASE_URL}/api/trips/${tripId}/itinerary`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch itinerary: ${res.statusText}`);
    return res.json();
  },

  async updateItinerary(tripId: string, payload: { modelVersion?: string; days: any[] }): Promise<TripItinerary> {
    const res = await fetch(`${BASE_URL}/api/trips/${tripId}/itinerary`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to write itinerary: ${res.statusText}`);
    return res.json();
  },

  // --- Bookings & Chat ---
  async createBooking(booking: { tripId: string; guideId: string; startDate: string; endDate: string }): Promise<Booking> {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(booking),
    });
    if (!res.ok) throw new Error(`Failed to create booking: ${res.statusText}`);
    return res.json();
  },

  async sendMessage(bookingId: string, text: string): Promise<ChatMessage> {
    const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
    return res.json();
  },

  // --- Marketplace & Hazards ---
  async getGuides(region?: string): Promise<Guide[]> {
    const url = region ? `${BASE_URL}/api/guides?region=${encodeURIComponent(region)}` : `${BASE_URL}/api/guides`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch guides: ${res.statusText}`);
    return res.json();
  },

  async getHazards(region?: string): Promise<HazardAlert[]> {
    const url = region ? `${BASE_URL}/api/hazards?region=${encodeURIComponent(region)}` : `${BASE_URL}/api/hazards`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch hazards: ${res.statusText}`);
    return res.json();
  },

  // --- Exclusion / Recommendation Refinement ---
  async markSpotVisited(spotId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/users/visited-spots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ spotId }),
    });
    if (!res.ok) throw new Error(`Failed to mark spot as visited: ${res.statusText}`);
    return res.json();
  },
};
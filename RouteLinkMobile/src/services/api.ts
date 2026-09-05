import { Platform } from 'react-native';
import {
  TripItinerary,
  Trip,
  Booking,
  Guide,
  HazardAlert,
  User,
  DestinationState,
  AttractionSpot,
} from '../types';
import { normalizeSeverity, parseNumber } from '../utils/display';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

let userToken: string | null = null;
export const setAuthToken = (token: string | null) => {
  userToken = token;
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
});

export class ApiError extends Error {
  status: number;
  details: any[];
  data: any;

  constructor(message: string, status: number, details: any[] = [], data: any = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.data = data;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let details: any[] = [];
    let message = res.statusText;
    let data: any = null;
    try {
      data = await res.json();
      details = data.details || [];
      message = data.message || data.error || res.statusText;
    } catch {}
    throw new ApiError(message, res.status, details, data);
  }

  return res.json() as Promise<T>;
}

function normalizeGuide(guide: any): Guide {
  return {
    ...guide,
    pricePerDay: parseNumber(guide.pricePerDay) ?? 0,
    rating: parseNumber(guide.rating) ?? 0,
  };
}

function normalizeHazard(alert: any): HazardAlert {
  return {
    ...alert,
    severity: normalizeSeverity(alert.severity),
    latitude: parseNumber(alert.latitude),
    longitude: parseNumber(alert.longitude),
  };
}

function normalizeBooking(booking: any): Booking {
  return {
    ...booking,
    totalPrice: parseNumber(booking.totalPrice) ?? 0,
    trip: booking.trip ? normalizeTrip(booking.trip) : undefined,
    guide: booking.guide ? normalizeGuide(booking.guide) : undefined,
  };
}

function normalizeTrip(trip: any): Trip {
  return {
    ...trip,
    budget: parseNumber(trip.budget) ?? undefined,
  };
}

function normalizeSpot(spot: any): AttractionSpot {
  return {
    ...spot,
    latitude: parseNumber(spot.latitude),
    longitude: parseNumber(spot.longitude),
  };
}

export const api = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    return request<{ user: User; token: string }>(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  async signup(payload: { name: string; email: string; password: string; role?: string }): Promise<{ user: User; token: string }> {
    return request<{ user: User; token: string }>(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listTrips(): Promise<Trip[]> {
    const data = await request<{ trips: any[] }>(`${BASE_URL}/api/trips`);
    return (data.trips || []).map(normalizeTrip);
  },
  async getTrip(id: string): Promise<Trip> {
    const data = await request<{ trip: any }>(`${BASE_URL}/api/trips/${encodeURIComponent(id)}`);
    return normalizeTrip(data.trip);
  },
  async createTrip(tripData: { title: string; destination: string; startDate: string; endDate: string; budget?: number }): Promise<Trip> {
    const data = await request<{ trip: any }>(`${BASE_URL}/api/trips`, {
      method: 'POST',
      body: JSON.stringify(tripData),
    });
    return normalizeTrip(data.trip);
  },
  async updateTrip(id: string, patch: Partial<Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate' | 'status' | 'budget'>>): Promise<Trip> {
    const data = await request<{ trip: any }>(`${BASE_URL}/api/trips/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return normalizeTrip(data.trip);
  },
  async deleteTrip(id: string): Promise<void> {
    await request(`${BASE_URL}/api/trips/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async getItinerary(tripId: string): Promise<TripItinerary> {
    return request<TripItinerary>(`${BASE_URL}/api/trips/${tripId}/itinerary`);
  },
  async updateItinerary(tripId: string, payload: { modelVersion?: string; days: any[] }): Promise<TripItinerary> {
    return request<TripItinerary>(`${BASE_URL}/api/trips/${tripId}/itinerary`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async listBookings(): Promise<Booking[]> {
    const data = await request<{ bookings: any[] }>(`${BASE_URL}/api/bookings`);
    return (data.bookings || []).map(normalizeBooking);
  },
  async createBooking(booking: { tripId: string; guideId: string; startDate: string; endDate: string }): Promise<Booking> {
    const data = await request<{ booking: any }>(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      body: JSON.stringify(booking),
    });
    return normalizeBooking(data.booking);
  },

  async getRecommendations(destination: string): Promise<AttractionSpot[]> {
    const data = await request<{ recommendations: any[] }>(
      `${BASE_URL}/api/recommendations?destination=${encodeURIComponent(destination)}`
    );
    return (data.recommendations || []).map(normalizeSpot);
  },
  async getGuides(region?: string, language?: string): Promise<Guide[]> {
    const params = new URLSearchParams();
    if (region) params.append('region', region);
    if (language) params.append('language', language);
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await request<{ guides: any[] }>(`${BASE_URL}/api/guides${query}`);
    return (data.guides || []).map(normalizeGuide);
  },
  async getGuide(id: string): Promise<Guide> {
    const data = await request<{ guide: any }>(`${BASE_URL}/api/guides/${encodeURIComponent(id)}`);
    return normalizeGuide(data.guide);
  },
  async getHazards(region?: string): Promise<HazardAlert[]> {
    const query = region ? `?region=${encodeURIComponent(region)}` : '';
    const data = await request<{ alerts: any[] }>(`${BASE_URL}/api/hazards${query}`);
    return (data.alerts || []).map(normalizeHazard);
  },

  async getDestinationState(): Promise<DestinationState> {
    return request<DestinationState>(`${BASE_URL}/api/users/me/destination-state`);
  },
  async markDestinationState(destinationName: string, status: 'visited' | 'dismissed'): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${BASE_URL}/api/users/me/destination-state`, {
      method: 'POST',
      body: JSON.stringify({ destinationName, status }),
    });
  },

  async triggerSOS(latitude: number, longitude: number, radiusMeters?: number): Promise<{
    sos: { triggeredAt: string; persisted: boolean };
    nearest: {
      mocked: boolean;
      services: { name: string; category: string; phone: string; distanceKm: number; latitude: number; longitude: number }[];
      emergencyNumbers: { label: string; number: string }[];
    };
  }> {
    return request(`${BASE_URL}/api/sos`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, radiusMeters }),
    });
  },
  async getNearestServices(latitude: number, longitude: number, radius?: number): Promise<{
    mocked: boolean;
    services: { name: string; category: string; phone: string; distanceKm: number; latitude: number; longitude: number }[];
    emergencyNumbers: { label: string; number: string }[];
  }> {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
    if (radius) params.append('radiusMeters', String(radius));
    const data = await request<{ nearest: any }>(`${BASE_URL}/api/sos/nearest?${params.toString()}`);
    return {
      ...data.nearest,
      services: (data.nearest.services || []).map((s: any) => ({
        ...s,
        distanceKm: parseNumber(s.distanceKm) ?? 0,
        latitude: parseNumber(s.latitude) ?? 0,
        longitude: parseNumber(s.longitude) ?? 0,
      })),
    };
  },
};

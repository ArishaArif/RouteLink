export type RootTabParamList = {
  Home: undefined;
  TripPlanner: undefined;
  SOS: undefined;
  Marketplace: undefined;
  Profile: undefined;
};
// --- Auth & User ---
export interface User {
  id: string; // UUID v4
  name: string;
  email: string;
  role?: 'traveler' | 'guide' | 'admin';
}

export interface AuthResponse {
  user: User;
  token: string;
}

// --- Vocabularies ---
export type HeatTier = 'cool' | 'mild' | 'warm' | 'hot' | 'extreme';
export type SlotType = 'outdoor_active' | 'outdoor_light' | 'indoor_rest' | 'travel' | 'mixed';
export type HazardType = 'weather' | 'health' | 'safety' | 'political' | 'natural_disaster' | 'other';
export type HazardSeverity = 'low' | 'medium' | 'high' | 'critical';

// --- Marketplace & Guide ---
export interface Guide {
  id: string; // UUID v4
  userId?: string;
  name: string;
  region: string;
  bio?: string;
  languages?: string[];
  pricePerDay: number; // Coerced JSON number
  rating: number; // Coerced JSON number
  isAvailable?: boolean;
  phone?: string; // Omitted unless owner/admin
  createdAt?: string;
  updatedAt?: string;
}

export interface DayMarketplace {
  region: string;
  guides: Guide[];
  lodging: any[]; // Always [] for now
  dining: any[];  // Always [] for now
}

// --- Itinerary & Activity ---
export interface Activity {
  time: string;
  title: string;
  location?: string;
  notes?: string;
  slotType?: SlotType;
  heatTier?: HeatTier;
}

export interface TripDay {
  id?: string | null; // UUID v4, null on placeholder
  tripId?: string;
  dayNumber: number;
  date: string; // YYYY-MM-DD
  slotType?: SlotType | null;
  heatTier?: HeatTier | null;
  needsMarketplaceData?: boolean;
  fallbackMessage?: string | null;
  weatherContext?: Record<string, any> | null;
  hazardContext?: Record<string, any> | null;
  activities: Activity[];
  marketplace?: DayMarketplace;
  source?: 'stored' | 'placeholder';
}

export interface TripItinerary {
  tripId: string;
  days: number; // Number of days count (renamed from durationDays to match backend)
  itinerary: TripDay[]; // Array of day objects (was previously named 'days')
  source: 'stored' | 'placeholder';
  modelVersion?: string;
  generatedAt?: string;
}

// --- Hazards ---
export interface HazardAlert {
  id: string;
  sourceType: string;
  rawText: string;
  hazardType: HazardType;
  region: string;
  latitude: number | null;
  longitude: number | null;
  severity: HazardSeverity;
  description: string | null;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

// --- Trips & Bookings ---
export interface Trip {
  id: string; // UUID v4
  title: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  budget?: number;
  status?: string;
}

export interface Booking {
  id: string; // UUID v4
  tripId: string;
  guideId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: 'requested' | 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  text: string;
  sender: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface IntradayForecast {
  time: string; // e.g., "12:00 PM"
  temperatureC: number;
  condition: string;
  slotType: 'outdoor_ok' | 'limited_outdoor' | 'indoor_rest';
  recommendationSummary: string; // Short summary
  inDepthAnalysis: string;       // Detailed weather-based breakdown
}

export interface AttractionSpot {
  id: string; // UUID v4
  name: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;      // Supplied by Backend/Maps team
  forecasts?: IntradayForecast[]; // 3-hour intraday breakdown
}
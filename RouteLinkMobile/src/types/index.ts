export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'traveler' | 'guide' | 'admin';
}

export interface AuthResponse {
  user: User;
  token: string;
}

export type RootTabParamList = {
  Explore: undefined;
  Routes: undefined;
  Guides: undefined;
  Alerts: undefined;
  SOS: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: { screen: keyof RootTabParamList; params?: any } | undefined;
  GuideDetail: { guideId: string };
  Bookings: undefined;
  Trips: undefined;
};

export type HeatTier = 'cool' | 'mild' | 'warm' | 'hot' | 'extreme';

export type SlotType = 'outdoor_active' | 'outdoor_light' | 'indoor_rest' | 'travel' | 'mixed';

export type HazardType = 'weather' | 'health' | 'safety' | 'political' | 'natural_disaster' | 'other';

export type HazardSeverity = 'low' | 'medium' | 'high';

export type BookingStatus = 'requested' | 'confirmed' | 'cancelled' | 'completed';

export interface Guide {
  id: string;
  userId?: string;
  name: string;
  region: string;
  bio?: string;
  languages?: string[];
  pricePerDay: number;
  rating: number;
  isAvailable?: boolean;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DayMarketplace {
  region: string;
  guides: Guide[];
  lodging: any[];
  dining: any[];
}

export interface Activity {
  time: string;
  title: string;
  location?: string;
  notes?: string;
  slotType?: SlotType;
  heatTier?: HeatTier;
}

export interface TripDay {
  id?: string | null;
  tripId?: string;
  dayNumber: number;
  date: string;
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
  days: number;
  itinerary: TripDay[];
  source: 'stored' | 'placeholder';
  modelVersion?: string;
  generatedAt?: string;
}

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

export interface Trip {
  id: string;
  userId?: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget?: number;
  status?: string;
  createdAt?: string;
}

export interface Booking {
  id: string;
  tripId: string;
  guideId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: BookingStatus;
  viewerRole?: 'traveler' | 'guide';
  trip?: Trip;
  guide?: Guide;
}

export interface DestinationStateRow {
  destinationName: string;
  status: 'visited' | 'dismissed';
  createdAt?: string;
  updatedAt?: string;
}

export interface DestinationState {
  userId?: string;
  count?: number;
  excludeList: string[];
  destinationState: DestinationStateRow[];
}

export interface AttractionSpot {
  id: string;
  name: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  heatTier?: HeatTier;
}

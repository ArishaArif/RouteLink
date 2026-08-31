export type RootTabParamList = {
  Home: undefined;
  TripPlanner: undefined;
  SOS: undefined;
  Marketplace: undefined;
  Profile: undefined;
};

export interface HazardAlert {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  locationName: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  description: string;
  timestamp: string;
}

export interface TripDay {
  dayNumber: number;
  title: string;
  activities: string[];
  weatherForecast: string;
}

export interface TripItinerary {
  id: string;
  destination: string;
  durationDays: number;
  startDate: string;
  days: TripDay[];
}

export interface Guide {
  id: string;
  name: string;
  region: string;
  rating: number;
  pricePerDay: number;
  phone: string;
}
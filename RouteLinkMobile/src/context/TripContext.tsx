import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TripItinerary, Trip } from '../types';
import { api } from '../services/api';

const DESTINATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Hunza': { lat: 36.3167, lng: 74.6500 },
  'Hunza Valley': { lat: 36.3167, lng: 74.6500 },
  'Skardu': { lat: 35.2971, lng: 75.6333 },
  'Gilgit': { lat: 35.9221, lng: 74.3087 },
  'Naran': { lat: 34.9042, lng: 73.6500 },
  'Chilas': { lat: 35.4227, lng: 74.1015 },
  'Fairy Meadows': { lat: 35.3833, lng: 74.5833 },
};

interface TripContextType {
  destination: string;
  duration: string;
  trip: Trip | null;
  trips: Trip[];
  itinerary: TripItinerary | null;
  coords: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
  setDestination: (val: string) => void;
  setDuration: (val: string) => void;
  loadTrips: () => Promise<void>;
  selectTrip: (trip: Trip) => Promise<void>;
  generateItinerary: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider = ({ children }: { children: ReactNode }) => {
  const [destination, setDestination] = useState('Hunza');
  const [duration, setDuration] = useState('3');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coords = destination && DESTINATION_COORDS[destination]
    ? DESTINATION_COORDS[destination]
    : null;

  const loadItineraryForTrip = useCallback(async (selectedTrip: Trip) => {
    try {
      const data = await api.getItinerary(selectedTrip.id);
      setItinerary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load itinerary');
      setItinerary(null);
    }
  }, []);

  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listTrips();
      setTrips(data);
      if (data.length > 0 && !trip) {
        const newest = data[data.length - 1];
        setTrip(newest);
        setDestination(newest.destination);
        await loadItineraryForTrip(newest);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load trips');
    } finally {
      setIsLoading(false);
    }
  }, [trip, loadItineraryForTrip]);

  useEffect(() => {
    loadTrips();
  }, []);

  const selectTrip = useCallback(async (selectedTrip: Trip) => {
    setTrip(selectedTrip);
    setDestination(selectedTrip.destination);
    setIsLoading(true);
    await loadItineraryForTrip(selectedTrip);
    setIsLoading(false);
  }, [loadItineraryForTrip]);

  const generateItinerary = useCallback(async () => {
    if (!destination.trim() || !duration.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const daysCount = parseInt(duration, 10) || 1;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + daysCount - 1);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const createdTrip = await api.createTrip({
        title: `${destination} Trip`,
        destination,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });
      setTrip(createdTrip);
      setTrips((prev) => [...prev, createdTrip]);

      const realItinerary = await api.getItinerary(createdTrip.id);
      setItinerary(realItinerary);
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setIsLoading(false);
    }
  }, [destination, duration]);

  return (
    <TripContext.Provider
      value={{
        destination,
        duration,
        trip,
        trips,
        itinerary,
        coords,
        isLoading,
        error,
        setDestination,
        setDuration,
        loadTrips,
        selectTrip,
        generateItinerary,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => {
  const context = useContext(TripContext);
  if (!context) throw new Error('useTrip must be used within a TripProvider');
  return context;
};

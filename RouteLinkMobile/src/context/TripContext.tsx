import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TripItinerary, Trip } from '../types';
import { api } from '../services/api';

// Known Northern Pakistan destinations -> coordinates. Same pattern as
// weather_scheduler.py's CITY_COORDS, kept in sync manually for now since
// there's no shared config between the Python and TypeScript sides yet.
const DESTINATION_COORDS: Record<string, { lat: number; lng: number }> = {
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
  startDate: string;
  trip: Trip | null;
  itinerary: TripItinerary | null;
  coords: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
  setDestination: (val: string) => void;
  setDuration: (val: string) => void;
  setStartDate: (val: string) => void;
  generateItinerary: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

const todayISO = () => new Date().toISOString().split('T')[0];

export const TripProvider = ({ children }: { children: ReactNode }) => {
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coords = destination && DESTINATION_COORDS[destination]
    ? DESTINATION_COORDS[destination]
    : null;

  const generateItinerary = async () => {
    if (!destination.trim() || !duration.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const daysCount = Math.max(1, parseInt(duration, 10) || 1);

      // A user-entered start date, defaulting to today but editable --
      // previously this silently assumed "starting right now" with no
      // way to say otherwise.
      const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? new Date(`${startDate}T00:00:00`)
        : new Date();

      // Off-by-one fix: the backend counts days INCLUSIVELY
      // ((end - start) + 1), so a 3-day trip must span start .. start+2,
      // not start .. start+3 (which is actually 4 days).
      const end = new Date(start);
      end.setDate(start.getDate() + daysCount - 1);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      // Create the real trip on the backend instead of faking a local object
      const createdTrip = await api.createTrip({
        title: `${destination} Trip`,
        destination,
        startDate: formatDate(start),
        endDate: formatDate(end),
      });
      setTrip(createdTrip);

      // Read back whatever the backend has for this trip's itinerary --
      // will be a placeholder until AI/ML's real service is wired in (see
      // API_CONTRACT.md §17), but it's REAL placeholder data from the
      // server, not invented client-side.
      const realItinerary = await api.getItinerary(createdTrip.id);
      setItinerary(realItinerary);
    } catch (err: any) {
      const raw = err?.message || '';
      const friendly = raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('network')
        ? "Can't reach the server right now. Check your connection and try again."
        : raw || 'Could not create your trip. Please try again.';
      setError(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TripContext.Provider
      value={{
        destination,
        duration,
        startDate,
        trip,
        itinerary,
        coords,
        isLoading,
        error,
        setDestination,
        setDuration,
        setStartDate,
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
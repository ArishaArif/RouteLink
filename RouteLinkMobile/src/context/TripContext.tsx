import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TripItinerary, TripDay, SlotType, HeatTier } from '../types';

interface TripContextType {
  destination: string;
  duration: string;
  itinerary: TripItinerary | null;
  isLoading: boolean;
  error: string | null;
  setDestination: (val: string) => void;
  setDuration: (val: string) => void;
  generateItinerary: () => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider = ({ children }: { children: ReactNode }) => {
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('');
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateItinerary = () => {
    if (!destination.trim() || !duration.trim()) return;

    const daysCount = parseInt(duration, 10) || 1;
    const generatedDays: TripDay[] = [];

    for (let i = 1; i <= daysCount; i++) {
      const isRestDay = i % 2 === 0;
      const currentSlotType: SlotType = isRestDay ? 'indoor_rest' : 'outdoor_active';
      const currentHeatTier: HeatTier = isRestDay ? 'extreme' : 'mild';

      generatedDays.push({
        id: `04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e0${i}`,
        dayNumber: i,
        date: `2026-10-${i < 10 ? '0' + i : i}`,
        slotType: currentSlotType,
        heatTier: currentHeatTier,
        needsMarketplaceData: isRestDay,
        fallbackMessage: isRestDay
          ? 'Outdoor activity is unsafe at this heat tier. See the Guide Marketplace for verified options.'
          : null,
        activities: [
          {
            time: '09:00 AM',
            title: isRestDay ? 'Rest and Refuel' : `Explore ${destination}`,
            location: destination,
            slotType: currentSlotType,
            heatTier: currentHeatTier,
          },
        ],
      });
    }

    setItinerary({
      tripId: '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e40',
      days: daysCount,
      itinerary: generatedDays,
      source: 'placeholder',
    });
  };

  return (
    <TripContext.Provider
      value={{
        destination,
        duration,
        itinerary,
        isLoading,
        error,
        setDestination,
        setDuration,
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
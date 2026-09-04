import { TripItinerary } from '../types';

export const MOCK_ITINERARY: TripItinerary = {
  tripId: 'mock-trip-uuid',
  days: 3, // Set 'days' as a number (count of days)
  source: 'stored',
  itinerary: [ // Put your array of day objects under 'itinerary'
    {
      dayNumber: 1,
      date: '2026-10-05',
      activities: [
        { time: '09:00 AM', title: 'Arrival in Karimabad' },
        { time: '02:00 PM', title: 'Baltit Fort Tour' },
      ],
    },
    {
      dayNumber: 2,
      date: '2026-10-06',
      activities: [
        { time: '10:00 AM', title: 'Attabad Lake Boating' },
        { time: '03:00 PM', title: 'Passu Cones Viewpoint' },
      ],
    },
    {
      dayNumber: 3,
      date: '2026-10-07',
      activities: [
        { time: '11:00 AM', title: 'Altit Fort & Royal Garden' },
        { time: '04:00 PM', title: 'Departure Prep' },
      ],
    },
  ],
};
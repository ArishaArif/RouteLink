/**
 * destinationPhotos.ts
 * --------------------
 * Maps well-known Pakistani tourist destination names to public Unsplash
 * photo URLs.  Used by TripPlannerScreen to show a thumbnail next to each
 * activity recommendation, and by HomeScreen's ExploreCard.
 *
 * Keys are lower-cased destination names.  Lookup is case-insensitive and
 * also tries stripping common suffixes ("Valley", "Lake", etc.) so that
 * minor naming variations from the ML pipeline still match.
 */

const PHOTOS: Record<string, string> = {
  // ── Gilgit-Baltistan ──────────────────────────────────────────────────
  'hunza valley':
    'https://images.unsplash.com/photo-1542259659-4e0c4038b04b?auto=format&w=400&q=80',
  'hunza':
    'https://images.unsplash.com/photo-1542259659-4e0c4038b04b?auto=format&w=400&q=80',
  'skardu':
    'https://images.unsplash.com/photo-1565035010268-a3816f98589a?auto=format&w=400&q=80',
  'gilgit':
    'https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?auto=format&w=400&q=80',
  'attabad lake':
    'https://images.unsplash.com/photo-1562696271-0580045c26b3?auto=format&w=400&q=80',
  'naltar valley':
    'https://images.unsplash.com/photo-1508109742312-c7d531211d11?auto=format&w=400&q=80',
  'deosai national park':
    'https://images.unsplash.com/photo-1534068590799-09895a701e3e?auto=format&w=400&q=80',
  'deosai':
    'https://images.unsplash.com/photo-1534068590799-09895a701e3e?auto=format&w=400&q=80',
  'khunjerab pass':
    'https://images.unsplash.com/photo-1486915306303-438399bdd2c5?auto=format&w=400&q=80',
  'fairy meadows':
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&w=400&q=80',
  'passu cones':
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&w=400&q=80',
  'borith lake':
    'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&w=400&q=80',
  'baltit fort':
    'https://images.unsplash.com/photo-1585468274952-66591eb14165?auto=format&w=400&q=80',
  'altit fort':
    'https://images.unsplash.com/photo-1585468274952-66591eb14165?auto=format&w=400&q=80',
  'shangrila resort':
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&w=400&q=80',
  'rakaposhi view point':
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&w=400&q=80',
  'hopar glacier':
    'https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&w=400&q=80',
  'nagar valley':
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&w=400&q=80',

  // ── Kaghan / Naran ────────────────────────────────────────────────────
  'naran':
    'https://images.unsplash.com/photo-1626010448982-5d629e925539?auto=format&w=400&q=80',
  'kaghan':
    'https://images.unsplash.com/photo-1626010448982-5d629e925539?auto=format&w=400&q=80',
  'kaghan valley':
    'https://images.unsplash.com/photo-1626010448982-5d629e925539?auto=format&w=400&q=80',
  'saif ul malook':
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&w=400&q=80',
  'lake saif ul malook':
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&w=400&q=80',
  'babusar pass':
    'https://images.unsplash.com/photo-1486915306303-438399bdd2c5?auto=format&w=400&q=80',
  'lalazar plateau':
    'https://images.unsplash.com/photo-1470071459604-3b5ec7566383?auto=format&w=400&q=80',

  // ── Azad Kashmir ──────────────────────────────────────────────────────
  'neelum valley':
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&w=400&q=80',
  'ratti gali lake':
    'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&w=400&q=80',
  'arango kel':
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&w=400&q=80',
  'keran valley':
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&w=400&q=80',

  // ── Khyber Pakhtunkhwa ────────────────────────────────────────────────
  'swat valley':
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&w=400&q=80',
  'swat':
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&w=400&q=80',
  'kalash valleys':
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&w=400&q=80',
  'kalash':
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&w=400&q=80',
  'chilas':
    'https://images.unsplash.com/photo-1486915306303-438399bdd2c5?auto=format&w=400&q=80',

  // ── Punjab / Islamabad ────────────────────────────────────────────────
  'lahore':
    'https://images.unsplash.com/photo-1562696271-0580045c26b3?auto=format&w=400&q=80',
  'islamabad':
    'https://images.unsplash.com/photo-1585468274952-66591eb14165?auto=format&w=400&q=80',
  'taxila museum':
    'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&w=400&q=80',
  'mohatta palace':
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&w=400&q=80',
  'faisal mosque':
    'https://images.unsplash.com/photo-1585468274952-66591eb14165?auto=format&w=400&q=80',
  'badshahi mosque':
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&w=400&q=80',
  'pakistan air force museum':
    'https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&w=400&q=80',

  // ── Sindh / Balochistan ───────────────────────────────────────────────
  'mohenjo-daro':
    'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&w=400&q=80',
  'makran coast':
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&w=400&q=80',
  'haleji lake':
    'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&w=400&q=80',
  'keenjhar lake':
    'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&w=400&q=80',
};

/**
 * Look up a destination photo URL by name.
 * Tries exact match first (case-insensitive), then progressively strips
 * trailing words ("Lake", "Valley", "Pass", etc.) to find a match.
 */
export function destinationPhoto(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (PHOTOS[key]) return PHOTOS[key];

  // Try stripping common suffixes: "Deosai National Park" → "deosai"
  const suffixes = [
    ' national park', ' valley', ' lake', ' pass', ' fort',
    ' glacier', ' resort', ' museum', ' mosque', ' viewpoint',
    ' view point', ' meadows', ' plateau',
  ];
  for (const suffix of suffixes) {
    if (key.endsWith(suffix)) {
      const stripped = key.slice(0, -suffix.length).trim();
      if (PHOTOS[stripped]) return PHOTOS[stripped];
    }
  }

  return null;
}

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

// Mapbox Directions API supports excluding up to a handful of individual
// points from the route (in addition to road-class excludes like 'toll').
// We cap it defensively in case a screen passes a large hazard list.
const MAX_EXCLUDED_POINTS = 3;

type HazardPoint = {
  latitude: number;
  longitude: number;
  label?: string;
};

type Props = {
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  // Active hazards to route around. When present and the route passes
  // near one, the Directions request excludes that point and the map
  // shows a banner + hazard marker so it's visible this happened.
  hazardPoints?: HazardPoint[];
};

export default function MapView({
  originLat = 36.3167,
  originLng = 74.6500,
  destLat = 35.9208,
  destLng = 74.3144,
  hazardPoints = [],
}: Props) {
  const excludedPoints = hazardPoints.slice(0, MAX_EXCLUDED_POINTS);
  const excludeParam = excludedPoints
    .map((h) => `point(${h.longitude},${h.latitude})`)
    .join(',');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
      <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
      <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
      <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        #reroute-banner {
          position: absolute; top: 8px; left: 8px; right: 8px; z-index: 10;
          background: #DC2626; color: #fff; font: 600 12px sans-serif;
          padding: 6px 10px; border-radius: 6px; display: none;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div id="reroute-banner"></div>
      <script>
        mapboxgl.accessToken = '${MAPBOX_TOKEN}';

        const origin = [${originLng}, ${originLat}];
        const destination = [${destLng}, ${destLat}];
        const hazards = ${JSON.stringify(excludedPoints)};
        const excludeParam = ${JSON.stringify(excludeParam)};

        const map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/streets-v12',
          center: origin,
          zoom: 9
        });

        new mapboxgl.Marker({ color: '#2b8a3e' }).setLngLat(origin).addTo(map);
        new mapboxgl.Marker({ color: '#e03131' }).setLngLat(destination).addTo(map);

        hazards.forEach((h) => {
          const el = document.createElement('div');
          el.style.width = '22px';
          el.style.height = '22px';
          el.style.borderRadius = '50%';
          el.style.background = '#F59E0B';
          el.style.border = '2px solid #fff';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.fontSize = '13px';
          el.textContent = '⚠️';
          new mapboxgl.Marker({ element: el })
            .setLngLat([h.longitude, h.latitude])
            .setPopup(new mapboxgl.Popup().setText(h.label || 'Active hazard'))
            .addTo(map);
        });

        function showRerouteBanner(count) {
          const banner = document.getElementById('reroute-banner');
          banner.style.display = 'block';
          banner.textContent = '⚠️ Rerouted to avoid ' + count + ' active hazard' + (count > 1 ? 's' : '') + ' on the direct path';
        }

        async function drawRoute() {
          const base = 'https://api.mapbox.com/directions/v5/mapbox/driving/'
            + origin[0] + ',' + origin[1] + ';' + destination[0] + ',' + destination[1]
            + '?geometries=geojson&access_token=' + mapboxgl.accessToken
            + (excludeParam ? '&exclude=' + encodeURIComponent(excludeParam) : '');

          const query = await fetch(base);
          const json = await query.json();

          if (!json.routes || json.routes.length === 0) {
            // Mapbox couldn't find a route honoring the exclusion (e.g. hazard
            // sits directly on the only road) — fall back to the unexcluded
            // route rather than showing nothing, and say so.
            if (excludeParam) {
              const fallback = await fetch(base.replace(/&exclude=[^&]*/, ''));
              const fallbackJson = await fallback.json();
              if (fallbackJson.routes && fallbackJson.routes.length > 0) {
                renderRoute(fallbackJson.routes[0]);
                const banner = document.getElementById('reroute-banner');
                banner.style.display = 'block';
                banner.style.background = '#B45309';
                banner.textContent = '⚠️ No detour available — route passes near ' + hazards.length + ' active hazard(s)';
              }
            }
            return;
          }

          renderRoute(json.routes[0]);
          if (excludeParam) showRerouteBanner(hazards.length);
        }

        function renderRoute(route) {
          const routeGeoJSON = {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          };

          map.on('load', () => {
            map.addSource('route', { type: 'geojson', data: routeGeoJSON });
            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#1971c2', 'line-width': 5 }
            });

            const bounds = new mapboxgl.LngLatBounds();
            routeGeoJSON.geometry.coordinates.forEach(coord => bounds.extend(coord));
            hazards.forEach(h => bounds.extend([h.longitude, h.latitude]));
            map.fitBounds(bounds, { padding: 40 });
          });
        }

        drawRoute();
      </script>
    </body>
    </html>
  `;

  // react-native-webview doesn't support the web platform at all (it throws
  // "React Native WebView does not support this platform"). On web we can
  // render the exact same Mapbox HTML directly in an <iframe> instead --
  // no native module needed there.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {/* @ts-ignore -- react-native-web passes iframe props straight through */}
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 0 }}
          title="RouteLink map"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
});

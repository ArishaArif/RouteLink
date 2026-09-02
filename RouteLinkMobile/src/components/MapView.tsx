import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

type Props = {
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
};

export default function MapView({
  originLat = 36.3167,
  originLng = 74.6500,
  destLat = 35.9208,
  destLng = 74.3144,
}: Props) {
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        mapboxgl.accessToken = '${MAPBOX_TOKEN}';

        const origin = [${originLng}, ${originLat}];
        const destination = [${destLng}, ${destLat}];

        const map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/streets-v12',
          center: origin,
          zoom: 9
        });

        new mapboxgl.Marker({ color: '#2b8a3e' }).setLngLat(origin).addTo(map);
        new mapboxgl.Marker({ color: '#e03131' }).setLngLat(destination).addTo(map);

        async function drawRoute() {
          const query = await fetch(
            \`https://api.mapbox.com/directions/v5/mapbox/driving/\${origin[0]},\${origin[1]};\${destination[0]},\${destination[1]}?geometries=geojson&access_token=\${mapboxgl.accessToken}\`
          );
          const json = await query.json();

          if (!json.routes || json.routes.length === 0) {
            console.log('No route found');
            return;
          }

          const routeGeoJSON = {
            type: 'Feature',
            properties: {},
            geometry: json.routes[0].geometry
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
            map.fitBounds(bounds, { padding: 40 });
          });
        }

        drawRoute();
      </script>
    </body>
    </html>
  `;

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
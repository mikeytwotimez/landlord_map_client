import { useEffect } from 'react';
import { useHookstate } from '@hookstate/core';
import styles from './App.module.css';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4'; // Import Proj4js

const epsg2229 = '+proj=lcc +lat_1=35.46666666666667 +lat_2=34.03333333333333 +lat_0=33.5 +lon_0=-118 +x_0=2000000.0001016 +y_0=500000.0001016001 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs';

// Function to convert a single coordinate pair
const convertCoords = (coord: any) => {
  return proj4(epsg2229, 'WGS84', coord);
};

// Function to recursively convert coordinates in a GeoJSON object
const convertGeoJSONCoords = (geojson: any) => {
  const type = geojson.type;

  const convertCoordinates = (coords: any) => {
    if (typeof coords[0] === 'number') {
      return convertCoords(coords);
    }
    return coords.map(convertCoordinates);
  };

  if (type === 'FeatureCollection') {
    return {
      ...geojson,
      features: geojson.features.map((feature: any) => ({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: convertCoordinates(feature.geometry.coordinates)
        }
      }))
    };
  } else if (type === 'Feature') {
    return {
      ...geojson,
      geometry: {
        ...geojson.geometry,
        coordinates: convertCoordinates(geojson.geometry.coordinates)
      }
    };
  } else {
    // Assuming geojson is a geometry object
    return {
      ...geojson,
      coordinates: convertCoordinates(geojson.coordinates)
    };
  }
};

function convertToGeoJSONFeature(inputObject: any) {
  const { geometry, ...properties } = inputObject

  // Create a GeoJSON feature object
  const geoJSONFeature = {
    type: 'Feature',
    properties,
    geometry,
  };

  return geoJSONFeature;
}

// Function to fetch parcels data
async function getParcels() {
  const response = await fetch("http://localhost:3000/property");
  const data = await response.json();
  return data;
}

function App() {
  const count = useHookstate(0);
  const map = useHookstate(null as L.Map | null)
  // Initialize the map
  useEffect(() => {
    // Initialize map only if it hasn't been initialized yet
    if (!map.value) {
      const initialMap = L.map('map').setView([34.0522, -118.2437], 10) // Coordinates for Los Angeles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(initialMap)
      map.set(initialMap)
    }
  }, [map]); // Add map to dependency array to ensure effect only runs when map changes

  // Function to add parcels to the map
// Function to add parcels to the map and zoom to their bounds
async function addParcelsToMap() {
  if (!map.value) return;
  const currentMap = map.get({ noproxy: true }) as L.Map;
  const parcels = await getParcels();

  const parcelsLayer = L.featureGroup();

  const parcelStyle = {
    color: 'blue',
    fillColor: 'cyan',
    fillOpacity: 0.5,
    weight: 2,
  };

  parcels.forEach((parcel: any) => {
    if (map.value && parcel.geometry) {
      const convertedGeoJSON = convertGeoJSONCoords(convertToGeoJSONFeature(parcel)) as GeoJSON.Feature;
      L.geoJSON(convertedGeoJSON, { 
        style: parcelStyle,
        onEachFeature: function(feature, layer) {
          layer.on('click', function() {
            // Displaying a popup with feature's properties
            let popupString = ""
            for (const [key, value] of Object.entries(feature.properties)) {
              popupString += `${key}: ${value}<br>`
            }
            // Adjust the content as per the structure of your parcel's properties
            layer.bindPopup(popupString).openPopup();
          });
        }
      }).addTo(parcelsLayer);
    }
  });

  parcelsLayer.addTo(currentMap);

  if (parcelsLayer.getLayers().length > 0) {
    currentMap.fitBounds(parcelsLayer.getBounds());
  }
}


  return (
    <div className={styles['App']}>
      <h1 className={styles['app-heading']}>Vite + React + TS + Tailwind</h1>
      <div>
        <button className={styles['button']} onClick={() => count.set(count.value + 1)}>
          count is {count.value}
        </button>
        <button className={styles['button']} onClick={addParcelsToMap}>
          Get Parcels
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
        <div id="map" style={{ height: '500px', width: '100%' }}></div>
      </div>
    </div>
  );
}

export default App;

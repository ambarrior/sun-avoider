// Map setup
let map = L.map('map').setView([1.3521, 103.8198], 12); 

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let startMarker = null;
let endMarker = null;
let routeLine = null;

// AM/PM setup
let isPM = false
const hourSelect = document.getElementById('hour');

// Populate hour dropdown
for (let i = 1; i <= 12; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.textContent = i;
  hourSelect.appendChild(option);
}

// Update AM/PM buttons based on selected hour
function updateAmPmButtons() {
  const val = parseInt(hourSelect.value);
  const amButton = document.getElementById('am-button');
  const pmButton = document.getElementById('pm-button');

  if (isNaN(val)) {
    amButton.disabled = false;
    pmButton.disabled = false;
    return;
  }

  const validForAM = val >= 6 && val <= 11;
  const validForPM = val === 12 || (val >= 1 && val <= 8);

  amButton.disabled = !validForAM;
  pmButton.disabled = !validForPM;

  if (!validForAM && !amButton.classList.contains('disabled') && !isPM) {
    pmButton.click();
  }

  if (!validForPM && !pmButton.classList.contains('disabled') && isPM) {
    amButton.click();
  }
}

hourSelect.addEventListener('change', updateAmPmButtons);
updateAmPmButtons();

document.getElementById('am-button').addEventListener('click', () => {
  isPM = false;
  document.getElementById('am-button').classList.add('active');
  document.getElementById('pm-button').classList.remove('active');
});

document.getElementById('pm-button').addEventListener('click', () => {
  isPM = true;
  document.getElementById('pm-button').classList.add('active');
  document.getElementById('am-button').classList.remove('active');
});

// Geolocation
async function getCoordinates(placeName) {
  try {
    const mapAPI = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}`;
    const response = await fetch(mapAPI)

    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Unexpected response for "${placeName}". Please try a more specific location.`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error(`Location not found: ${placeName}`);
    }

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    };
  } catch (error) {
    throw new Error(`Could not find "${placeName}". Try selecting a match from the list or be more specific.`);
  }
}

// Sun direction
function getSunDirection(hour24) {
  return hour24 < 12 ? 'EastToWest' : 'WestToEast';
}

function getBearing(start, end) {
  const toRad = deg => deg * Math.PI / 180;
  const dLon = toRad(end.lon - start.lon);
  const lat1 = toRad(start.lat);
  const lat2 = toRad(end.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function getTravelDirection(bearing) {
  const directions = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

function getSeatAdvice(bearing, hour) {
  const sun = getSunDirection(hour);

  if (bearing >= 80 && bearing < 100) {
    return sun === 'EastToWest' ? 'Back' : 'Front';
  }

  if (bearing >= 260 && bearing < 280) {
    return sun === 'EastToWest' ? 'Front' : 'Back';
  }

  if (bearing >= 100 && bearing < 260) {
    return sun === 'EastToWest' ? 'Right' : 'Left';
  }

  return sun === 'EastToWest' ? 'Left' : 'Right';
}

// Main advice function
document.getElementById('bus-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const startInput = document.getElementById('start').value.trim();
  const endInput = document.getElementById('end').value.trim();
  const selectedHour = parseInt(hourSelect.value);

  if (!startInput || !endInput || isNaN(selectedHour)) {
    alert("Please enter valid locations and select a time.");
    return;
  }

  const result = document.getElementById('result');
  result.textContent = "Calculating...";

  const hour24 = 
    isPM && selectedHour !== 12 ? selectedHour + 12 :
    !isPM && selectedHour === 12 ? 0 :
    selectedHour;

  try {
    const startCoords = await getCoordinates(startInput);
    const endCoords = await getCoordinates(endInput);
    const bearing = getBearing(startCoords, endCoords);
    const direction = getTravelDirection(bearing);
    const sun = getSunDirection(hour24);
    const advice = getSeatAdvice(bearing, hour24);
    const sundirectionText = sun === 'EastToWest' ? 'East' : 'West';

    result.innerHTML = `Sit on the <span class = "tooltip" title="You are travelling ${direction}, and the sun is shining from the ${sundirectionText}">` + `<strong>${advice.toUpperCase()}</strong></span> of the bus to avoid the sun :)`;

    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLine) map.removeLayer(routeLine);

    const flagIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/985/985802.png',
      iconSize: [30,30],
      iconAnchor: [7,30],
    });

    startMarker = L.marker([startCoords.lat, startCoords.lon]).addTo(map);
    endMarker = L.marker([endCoords.lat, endCoords.lon], { icon: flagIcon }).addTo(map);
    routeLine = L.polyline([[startCoords.lat, startCoords.lon], [endCoords.lat, endCoords.lon]], { color: 'blue' }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

  } catch (err) {
    document.getElementById('result').textContent = err.message;
  }
});
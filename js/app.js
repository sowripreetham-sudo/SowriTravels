// ===================================================================
// CityCompass / YatraWise - Application Logic
// Features: Geolocation & Distance Matrix, Fair-Fare Scam Shield,
// Greedy Nearest-Neighbor Route Optimizer, Leaflet Map, & LocalStorage Reviews.
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    cityId: 'jaipur',
    currentHub: null, // { id, name, coords }
    selectedCategory: 'all',
    searchQuery: '',
    sortBy: 'priority',
    itineraryIds: JSON.parse(localStorage.getItem('citycompass_itinerary') || '[]'),
    userReviews: JSON.parse(localStorage.getItem('citycompass_reviews') || '{}'),
    theme: localStorage.getItem('citycompass_theme') || 'dark',
    map: null,
    mapMarkers: [],
    routePolyline: null,
    activeRideRoute: null,
    ridePolyline: null
  };

  // DOM Elements
  const citySelector = document.getElementById('city-selector');
  const heroCityName = document.getElementById('hero-city-name');
  const heroCityTagline = document.getElementById('hero-city-tagline');
  const arrivalChipsContainer = document.getElementById('arrival-hub-chips');
  const useGpsBtn = document.getElementById('use-gps-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const categoryFilters = document.getElementById('category-filters');
  const searchInput = document.getElementById('search-input');
  const sortSelector = document.getElementById('sort-selector');
  const placesGrid = document.getElementById('places-grid');
  const itineraryCountBadge = document.getElementById('itinerary-count-badge');
  const tabItineraryBadge = document.getElementById('tab-itinerary-badge');
  const navItineraryBtn = document.getElementById('nav-itinerary-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabViews = document.querySelectorAll('.tab-view');

  // Fair-fare elements
  const farePickupSelect = document.getElementById('fare-pickup-select');
  const fareDropSelect = document.getElementById('fare-drop-select');
  const fareNightToggle = document.getElementById('fare-night-toggle');
  const calcFareBtn = document.getElementById('calc-fare-btn');
  const calcDistVal = document.getElementById('calc-dist-val');
  const calcTimeVal = document.getElementById('calc-time-val');
  const calcWalkVal = document.getElementById('calc-walk-val');
  const calcAutoFare = document.getElementById('calc-auto-fare');
  const calcCabFare = document.getElementById('calc-cab-fare');
  const calcBikeFare = document.getElementById('calc-bike-fare');
  const calcScamText = document.getElementById('calc-scam-text');
  const openRouteMapBtn = document.getElementById('open-route-map-btn');
  const addToRouteFromFareBtn = document.getElementById('add-to-route-from-fare-btn');

  // Itinerary elements
  const itineraryStepsContainer = document.getElementById('itinerary-steps-container');
  const reorderRouteBtn = document.getElementById('reorder-route-btn');
  const clearItineraryBtn = document.getElementById('clear-itinerary-btn');
  const viewItineraryMapBtn = document.getElementById('view-itinerary-map-btn');
  const printItineraryBtn = document.getElementById('print-itinerary-btn');
  const itinStartName = document.getElementById('itin-start-name');
  const itinStopsCount = document.getElementById('itin-stops-count');
  const itinTotalDist = document.getElementById('itin-total-dist');
  const itinTravelTime = document.getElementById('itin-travel-time');
  const itinEstBudget = document.getElementById('itin-est-budget');

  // Modal elements
  const placeDetailModal = document.getElementById('place-detail-modal');
  const modalContentInner = document.getElementById('modal-content-inner');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // -------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------
  function init() {
    applyTheme(state.theme);
    loadCity(state.cityId);
    setupEventListeners();
    updateItineraryBadges();
  }

  // -------------------------------------------------------------------
  // Theme Management
  // -------------------------------------------------------------------
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('citycompass_theme', theme);
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  // -------------------------------------------------------------------
  // Distance Calculation Utilities (Haversine + City Winding Road Factor)
  // -------------------------------------------------------------------
  function calculateDistanceKm(coords1, coords2) {
    if (!coords1 || !coords2) return 0;
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDist = R * c;
    // Urban road factor (roads are rarely straight lines in cities)
    return parseFloat((straightDist * 1.25).toFixed(1));
  }

  // -------------------------------------------------------------------
  // City Loading & Arrival Hub Setup
  // -------------------------------------------------------------------
  function loadCity(cityKey) {
    const city = CITIES_DATA[cityKey];
    if (!city) return;

    state.cityId = cityKey;
    state.activeRideRoute = null;
    heroCityName.textContent = city.name.split(' ')[0];
    heroCityTagline.textContent = city.tagline;

    // Default arrival hub is the primary railway station
    state.currentHub = city.arrivalHubs[0];

    // Render Hub Chips
    renderHubChips(city.arrivalHubs);

    // Populate Fair-Fare Dropdowns
    populateFareSelectors(city);

    // Render Places
    renderPlaces();

    // Synchronize itinerary badges and view for selected city
    updateItineraryBadges();
    renderItinerary();

    // If map already active, update view
    if (state.map) {
      updateMapView();
    }
  }

  function renderHubChips(hubs) {
    arrivalChipsContainer.innerHTML = '';
    hubs.forEach((hub) => {
      const chip = document.createElement('button');
      chip.className = `hub-chip ${hub.id === state.currentHub.id ? 'active' : ''}`;
      chip.dataset.hubId = hub.id;

      let icon = '🚉';
      if (hub.type === 'bus') icon = '🚌';
      if (hub.type === 'airport') icon = '✈️';

      chip.innerHTML = `<span>${icon}</span> ${hub.name.split(' (')[0]}`;
      chip.addEventListener('click', () => {
        state.currentHub = hub;
        document.querySelectorAll('.hub-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        showToast(`📍 Arrival point set to ${hub.name}`);
        renderPlaces();
        populateFareSelectors(CITIES_DATA[state.cityId]);
        calculateFairFare();
        renderItinerary();
        if (state.map) updateMapView();
      });
      arrivalChipsContainer.appendChild(chip);
    });
  }

  // -------------------------------------------------------------------
  // GPS Geolocation Handler
  // -------------------------------------------------------------------
  function detectGPSLocation() {
    if (!navigator.geolocation) {
      showToast('❌ Geolocation is not supported by your browser.', 'error');
      return;
    }

    showToast('📡 Detecting your current GPS position...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = [pos.coords.latitude, pos.coords.longitude];
        state.currentHub = {
          id: 'user_gps',
          name: 'My Live GPS Location',
          coords: userCoords,
          type: 'gps'
        };

        // Update hub chip UI
        document.querySelectorAll('.hub-chip').forEach(c => c.classList.remove('active'));
        useGpsBtn.classList.add('active');
        useGpsBtn.innerHTML = `<span>📍</span> GPS Active`;

        showToast('✅ Live location detected! Distances recalculated.');
        renderPlaces();
        populateFareSelectors(CITIES_DATA[state.cityId]);
        calculateFairFare();
        renderItinerary();
        if (state.map) updateMapView();
      },
      (err) => {
        showToast('⚠️ Could not obtain GPS lock. Using primary railway station instead.');
      },
      { timeout: 7000 }
    );
  }

  // -------------------------------------------------------------------
  // Places Feed & Dynamic Filtering
  // -------------------------------------------------------------------
  function renderPlaces() {
    const city = CITIES_DATA[state.cityId];
    if (!city) return;

    let places = [...city.places];

    // Compute distance for each place from currentHub
    places.forEach((p) => {
      p.currentDistance = calculateDistanceKm(state.currentHub.coords, p.coords);
    });

    // Filter by Category
    if (state.selectedCategory !== 'all') {
      places = places.filter(p => p.category === state.selectedCategory);
    }

    // Filter by Search Query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      places = places.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tips.toLowerCase().includes(q)
      );
    }

    // Sort Places
    if (state.sortBy === 'nearest') {
      places.sort((a, b) => a.currentDistance - b.currentDistance);
    } else if (state.sortBy === 'rating') {
      places.sort((a, b) => b.rating - a.rating);
    } else {
      // Default: Priority recommendation order
      places.sort((a, b) => a.visitPriorityRank - b.visitPriorityRank);
    }

    // Render HTML Cards
    placesGrid.innerHTML = '';
    if (places.length === 0) {
      placesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
          <h3>No matching places found</h3>
          <p>Try searching with another keyword or select a different category filter.</p>
        </div>
      `;
      return;
    }

    places.forEach((place) => {
      const isSaved = state.itineraryIds.includes(place.id);
      const card = document.createElement('article');
      card.className = 'place-card';

      let catIcon = '🏛️';
      if (place.category === 'temple') catIcon = '🛕';
      if (place.category === 'food') catIcon = '🍲';
      if (place.category === 'lodge') catIcon = '🏨';

      card.innerHTML = `
        <div class="card-media">
          <img src="${place.image}" alt="${place.name}" loading="lazy" />
          <div class="card-badge-top">
            <span class="category-tag ${place.category}">
              ${catIcon} ${place.category}
            </span>
            <span class="priority-badge">#${place.visitPriorityRank} Recommended</span>
          </div>
          <div class="distance-chip">
            <span>📍</span> ${place.currentDistance} km away
          </div>
        </div>

        <div class="card-body">
          <div class="card-rating-row">
            <div class="rating-badge">
              <span>★</span> ${place.rating}
              <span class="reviews-meta">(${place.reviewsCount.toLocaleString()} reviews)</span>
            </div>
          </div>

          <h3 class="place-name">${place.name}</h3>
          <p class="place-description">${place.description}</p>

          <div class="specs-list">
            <div class="spec-item">
              <span>⏰</span> <span><strong>Hours:</strong> ${place.timings}</span>
            </div>
            <div class="spec-item">
              <span>🎟️</span> <span><strong>Fee:</strong> ${place.entryFee}</span>
            </div>
            <div class="spec-item">
              <span>⏳</span> <span><strong>Duration:</strong> ${place.timeToSpend}</span>
            </div>
            <div class="spec-item">
              <span>🌅</span> <span><strong>Best Hour:</strong> ${place.bestTime.split('(')[0]}</span>
            </div>
          </div>

          <div class="card-scam-alert">
            <span>🛡️</span>
            <div><strong>Scam Guard:</strong> ${place.scamAlert}</div>
          </div>

          <div class="card-actions">
            <button class="btn-primary view-details-btn" data-id="${place.id}">
              <span>👁️</span> Traveler POV &amp; Tips
            </button>
            <button class="btn-secondary add-route-btn ${isSaved ? 'added' : ''}" data-id="${place.id}">
              <span>${isSaved ? '✓ Added' : '➕ Route'}</span>
            </button>
            <button class="btn-secondary check-fare-btn" data-id="${place.id}" title="Calculate fair auto/cab fare from station">
              <span>🚖 Fare</span>
            </button>
          </div>
        </div>
      `;

      placesGrid.appendChild(card);
    });

    // Attach button listeners
    document.querySelectorAll('.view-details-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openPlaceModal(id);
      });
    });

    document.querySelectorAll('.add-route-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        toggleItineraryItem(id);
      });
    });

    document.querySelectorAll('.check-fare-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        switchTab('tab-fair-fare');
        fareDropSelect.value = id;
        calculateFairFare();
      });
    });
  }

  // -------------------------------------------------------------------
  // Fair-Fare Shield Calculation Engine
  // -------------------------------------------------------------------
  function populateFareSelectors(city) {
    farePickupSelect.innerHTML = '';
    // Pickup options: current arrival hubs + GPS
    const defaultHubOption = document.createElement('option');
    defaultHubOption.value = state.currentHub.id;
    defaultHubOption.textContent = `📍 Selected Hub: ${state.currentHub.name}`;
    farePickupSelect.appendChild(defaultHubOption);

    city.arrivalHubs.forEach((hub) => {
      if (hub.id !== state.currentHub.id) {
        const opt = document.createElement('option');
        opt.value = hub.id;
        opt.textContent = `🚉 ${hub.name}`;
        farePickupSelect.appendChild(opt);
      }
    });

    // Destination options: all city places
    fareDropSelect.innerHTML = '';
    city.places.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.category === 'temple' ? '🛕' : p.category === 'food' ? '🍲' : p.category === 'lodge' ? '🏨' : '🏛️'} ${p.name}`;
      fareDropSelect.appendChild(opt);
    });

    // Trigger initial calculation
    calculateFairFare();
  }

  function calculateFairFare() {
    const city = CITIES_DATA[state.cityId];
    if (!city) return;

    const pickupId = farePickupSelect.value;
    const dropId = fareDropSelect.value;

    let pickupCoords = state.currentHub.coords;
    if (pickupId !== state.currentHub.id) {
      const foundHub = city.arrivalHubs.find(h => h.id === pickupId);
      if (foundHub) pickupCoords = foundHub.coords;
    }

    const dropPlace = city.places.find(p => p.id === dropId) || city.places[0];
    if (!dropPlace) return;

    const dist = calculateDistanceKm(pickupCoords, dropPlace.coords);
    const driveTimeMinutes = Math.max(5, Math.round(dist * 2.8 + 4));
    const walkTimeMinutes = Math.round(dist * 12);

    calcDistVal.textContent = `${dist} km`;
    calcTimeVal.textContent = `${driveTimeMinutes} mins`;
    calcWalkVal.textContent = `${walkTimeMinutes} mins`;

    // Fare Rules
    const isNight = fareNightToggle.checked;
    const nightFactor = isNight ? 1.15 : 1.0;

    // Auto Rickshaw standard metered calculation
    let autoCost = city.fareConfig.autoBaseFare;
    if (dist > 1.5) {
      autoCost += (dist - 1.5) * city.fareConfig.autoPerKm;
    }
    autoCost = Math.round(autoCost * nightFactor);

    // Cab / Taxi calculation
    let cabCost = city.fareConfig.cabBaseFare;
    if (dist > 2.0) {
      cabCost += (dist - 2.0) * city.fareConfig.cabPerKm;
    }
    cabCost = Math.round(cabCost * nightFactor);

    // Bike Taxi calculation (approx 55% of auto)
    let bikeCost = Math.round(Math.max(25, autoCost * 0.55));

    calcAutoFare.textContent = `₹${autoCost}`;
    calcCabFare.textContent = `₹${cabCost} - ₹${cabCost + 30}`;
    calcBikeFare.textContent = `₹${bikeCost}`;

    // Scam Radar Analysis
    const typicalGougedAsk = Math.round(autoCost * city.fareConfig.commonScamMarkup);
    let adviceText = `Station-gate touts often ask <strong>₹${typicalGougedAsk} - ₹${typicalGougedAsk + 50}</strong> for this ${dist} km trip! `;

    if (dist <= 1.2) {
      adviceText += `<strong>💡 Walk Feasibility:</strong> This destination is only a <strong>${walkTimeMinutes}-minute walk (${dist} km)</strong>! You don't even need a cab or auto — save your money and walk straight.`;
    } else {
      adviceText += `<strong>Recommended Action:</strong> Do NOT accept quotes over <strong>₹${autoCost + 20}</strong>. Insist on the meter or take the official Prepaid Auto stand receipt from platform exit.`;
    }

    calcScamText.innerHTML = adviceText;

    // Update 'Add to Route' button
    addToRouteFromFareBtn.onclick = () => {
      toggleItineraryItem(dropPlace.id);
    };
  }

  // -------------------------------------------------------------------
  // "Places to Visit First" Smart Route Optimizer (Greedy Nearest Neighbor)
  // -------------------------------------------------------------------
  function toggleItineraryItem(placeId) {
    const idx = state.itineraryIds.indexOf(placeId);
    if (idx > -1) {
      state.itineraryIds.splice(idx, 1);
      showToast('Removed from your route');
    } else {
      state.itineraryIds.push(placeId);
      showToast('✅ Added to your day route!');
    }
    localStorage.setItem('citycompass_itinerary', JSON.stringify(state.itineraryIds));
    updateItineraryBadges();
    renderPlaces();
    renderItinerary();
    if (state.map) updateMapView();
  }

  function updateItineraryBadges() {
    const city = CITIES_DATA[state.cityId];
    const currentCityStops = city ? city.places.filter(p => state.itineraryIds.includes(p.id)).length : 0;
    itineraryCountBadge.textContent = currentCityStops;
    tabItineraryBadge.textContent = currentCityStops;
  }

  function getOptimizedRoute() {
    const city = CITIES_DATA[state.cityId];
    if (!city || state.itineraryIds.length === 0) return [];

    const unvisited = city.places.filter(p => state.itineraryIds.includes(p.id));
    if (unvisited.length === 0) return [];

    const optimized = [];
    let currentPoint = state.currentHub.coords;

    // Greedy Nearest-Neighbor sequencing
    while (unvisited.length > 0) {
      let nearestIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = calculateDistanceKm(currentPoint, unvisited[i].coords);
        if (d < minDistance) {
          minDistance = d;
          nearestIndex = i;
        }
      }

      if (nearestIndex !== -1) {
        const place = unvisited.splice(nearestIndex, 1)[0];
        const nextPlace = { ...place, legDistance: minDistance };
        optimized.push(nextPlace);
        currentPoint = nextPlace.coords;
      }
    }

    return optimized;
  }

  function renderItinerary() {
    const city = CITIES_DATA[state.cityId];
    itinStartName.textContent = state.currentHub.name.split(' (')[0];

    const orderedStops = getOptimizedRoute();
    itinStopsCount.textContent = orderedStops.length;

    if (orderedStops.length === 0) {
      itineraryStepsContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🗺️</div>
          <h3>Your Route is Currently Empty</h3>
          <p>Browse the <strong>Discover &amp; Curate</strong> tab and click "➕ Route" on spots you want to visit.</p>
          <button class="btn-primary" style="margin: 1.5rem auto 0; display: inline-flex;" id="itin-explore-btn">
            Explore ${city.name.split(' ')[0]} Places
          </button>
        </div>
      `;
      const btn = document.getElementById('itin-explore-btn');
      if (btn) btn.onclick = () => switchTab('tab-explore');

      itinTotalDist.textContent = '0 km';
      itinTravelTime.textContent = '0 mins';
      itinEstBudget.textContent = '₹0';
      return;
    }

    let totalDist = 0;
    itineraryStepsContainer.innerHTML = '';

    orderedStops.forEach((stop, index) => {
      totalDist += stop.legDistance;
      const stepCard = document.createElement('div');
      stepCard.className = 'itinerary-step-card';

      const isFirst = index === 0;
      const whyLabel = isFirst
        ? `⭐ Visit First: Closest to your arrival point (${stop.legDistance} km)`
        : `➡️ Stop #${index + 1}: Just ${stop.legDistance} km from Stop #${index}`;

      stepCard.innerHTML = `
        <div class="step-rank-badge">
          ${index + 1}
          <small>${isFirst ? 'First' : 'Next'}</small>
        </div>

        <div class="step-details">
          <div class="step-tag-row">
            <span class="category-tag ${stop.category}" style="padding: 0.15rem 0.6rem; font-size: 0.7rem;">
              ${stop.category}
            </span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">⏳ Duration: ${stop.timeToSpend}</span>
          </div>
          <h4 class="step-name">${stop.name}</h4>
          <div class="step-why-first">${whyLabel}</div>
        </div>

        <button class="step-remove-btn" data-id="${stop.id}" title="Remove this stop">&times;</button>
      `;

      itineraryStepsContainer.appendChild(stepCard);

      // Add dashed connector between consecutive stops
      if (index < orderedStops.length - 1) {
        const connector = document.createElement('div');
        connector.className = 'step-transit-connector';
        const nextDist = orderedStops[index + 1]?.legDistance || 1.2;
        connector.innerHTML = `<span>🚗 Commute to next stop: ~${nextDist} km (${Math.round(nextDist * 3)} mins drive)</span>`;
        itineraryStepsContainer.appendChild(connector);
      }
    });

    totalDist = parseFloat(totalDist.toFixed(1));
    const totalTravelTime = Math.round(totalDist * 3.2);
    const estAutoBudget = Math.round(city.fareConfig.autoBaseFare * orderedStops.length + totalDist * city.fareConfig.autoPerKm * 0.7);

    itinTotalDist.textContent = `${totalDist} km`;
    itinTravelTime.textContent = `${totalTravelTime} mins`;
    itinEstBudget.textContent = `₹${estAutoBudget} (Fair Transit)`;

    // Attach remove handlers
    document.querySelectorAll('.step-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        toggleItineraryItem(id);
      });
    });
  }

  // -------------------------------------------------------------------
  // Leaflet Interactive Map Engine
  // -------------------------------------------------------------------
  function initMap() {
    if (state.map) return;

    const city = CITIES_DATA[state.cityId];
    const mapContainer = document.getElementById('leaflet-map');
    if (!mapContainer) return;

    state.map = L.map('leaflet-map').setView(city.center, city.zoom);

    // OpenStreetMap high quality tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    updateMapView();
  }

  function updateMapView() {
    if (!state.map) return;

    const city = CITIES_DATA[state.cityId];

    // Clear existing markers and lines
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];
    if (state.routePolyline) {
      state.map.removeLayer(state.routePolyline);
      state.routePolyline = null;
    }
    if (state.ridePolyline) {
      state.map.removeLayer(state.ridePolyline);
      state.ridePolyline = null;
    }

    state.map.setView(city.center, city.zoom);

    // 1. Plot Arrival Hub / User Start Point Marker
    const startIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background: #10b981; color: #000; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 0 16px #10b981; border: 2px solid #fff;">🚉</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const startMarker = L.marker(state.currentHub.coords, { icon: startIcon }).addTo(state.map);
    startMarker.bindPopup(`
      <div class="map-popup-inner">
        <div class="map-popup-title">🏁 Your Starting Point</div>
        <div>${state.currentHub.name}</div>
      </div>
    `);
    state.mapMarkers.push(startMarker);

    // 2. Plot All Places in the City
    city.places.forEach((place) => {
      const isSaved = state.itineraryIds.includes(place.id);
      let bg = '#8b5cf6';
      let icon = '🏛️';
      if (place.category === 'temple') { bg = '#f59e0b'; icon = '🛕'; }
      if (place.category === 'food') { bg = '#ef4444'; icon = '🍲'; }
      if (place.category === 'lodge') { bg = '#06b6d4'; icon = '🏨'; }

      const placeIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `<div style="background: ${bg}; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: ${isSaved ? 'scale(1.2)' : 'scale(1)'};">
          ${icon}
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const dist = calculateDistanceKm(state.currentHub.coords, place.coords);
      const marker = L.marker(place.coords, { icon: placeIcon }).addTo(state.map);

      marker.bindPopup(`
        <div class="map-popup-inner">
          <div class="map-popup-title">${place.name}</div>
          <div class="map-popup-dist">📍 ${dist} km from arrival station</div>
          <div style="font-size: 0.8rem; margin-bottom: 0.4rem; color: var(--text-secondary);">${place.description.substring(0, 85)}...</div>
          <div class="map-popup-actions">
            <button class="btn-primary" onclick="window.viewPlaceDetails('${place.id}')">
              👁️ Tips
            </button>
            <button class="btn-secondary" onclick="window.toggleRouteFromMap('${place.id}')">
              ${isSaved ? '✓ Added' : '➕ Route'}
            </button>
            <button class="btn-secondary" onclick="window.checkFareFromMap('${place.id}')">
              🚖 Fare
            </button>
          </div>
        </div>
      `);
      state.mapMarkers.push(marker);
    });

    // 3. Draw Route Polyline if itinerary has items
    const orderedStops = getOptimizedRoute();
    if (orderedStops.length > 0) {
      const pathCoords = [state.currentHub.coords, ...orderedStops.map(s => s.coords)];
      state.routePolyline = L.polyline(pathCoords, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(state.map);

      // Fit map bounds to encompass all points in the route
      if (!state.activeRideRoute) {
        state.map.fitBounds(state.routePolyline.getBounds(), { padding: [40, 40] });
      }
    }

    // 4. Draw Direct Fair-Fare Ride Route if triggered from Fair-Fare Shield
    if (state.activeRideRoute) {
      const ride = state.activeRideRoute;
      state.ridePolyline = L.polyline([ride.pickupCoords, ride.dropCoords], {
        color: '#06b6d4',
        weight: 5,
        opacity: 0.95,
        dashArray: '6, 8',
        lineCap: 'round'
      }).addTo(state.map);

      state.map.fitBounds(state.ridePolyline.getBounds(), { padding: [60, 60] });

      const targetMarker = state.mapMarkers.find(m => {
        const pos = m.getLatLng();
        return Math.abs(pos.lat - ride.dropCoords[0]) < 0.0001 && Math.abs(pos.lng - ride.dropCoords[1]) < 0.0001;
      });
      if (targetMarker) {
        setTimeout(() => targetMarker.openPopup(), 250);
      }
    }
  }

  // Expose global helpers for Leaflet popups
  window.viewPlaceDetails = (id) => {
    openPlaceModal(id);
  };

  window.toggleRouteFromMap = (id) => {
    toggleItineraryItem(id);
  };

  window.checkFareFromMap = (id) => {
    switchTab('tab-fair-fare');
    fareDropSelect.value = id;
    calculateFairFare();
  };

  // -------------------------------------------------------------------
  // Place Detail & Traveler POV Modal
  // -------------------------------------------------------------------
  function openPlaceModal(placeId) {
    const city = CITIES_DATA[state.cityId];
    const place = city.places.find(p => p.id === placeId);
    if (!place) return;

    const dist = calculateDistanceKm(state.currentHub.coords, place.coords);
    const existingReviews = state.userReviews[place.id] || [];

    modalContentInner.innerHTML = `
      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
        <img src="${place.image}" alt="${place.name}" style="width: 100%; max-height: 240px; object-fit: cover; border-radius: var(--radius-md);" />
      </div>

      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
        <div>
          <span class="category-tag ${place.category}" style="display: inline-flex; margin-bottom: 0.5rem;">${place.category}</span>
          <h2 style="font-size: 1.6rem; font-weight: 800;">${place.name}</h2>
          <div style="color: var(--accent-cyan); font-weight: 700; font-size: 0.9rem;">📍 ${dist} km from ${state.currentHub.name}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.3rem; color: #fbbf24; font-weight: 800;">★ ${place.rating}</div>
          <small style="color: var(--text-muted);">${place.reviewsCount} reviews</small>
        </div>
      </div>

      <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">
        ${place.description}
      </p>

      <!-- Key Insights -->
      <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: var(--accent-gold);">💡 Insider Tips &amp; Rules</h4>
        <div style="font-size: 0.88rem; margin-bottom: 0.5rem;"><strong>Best Time:</strong> ${place.bestTime}</div>
        <div style="font-size: 0.88rem; margin-bottom: 0.5rem;"><strong>Hours &amp; Tickets:</strong> ${place.timings} | ${place.entryFee}</div>
        <div style="font-size: 0.88rem;"><strong>Visitor Tip:</strong> ${place.tips}</div>
      </div>

      <!-- Scam Guard Alert Box -->
      <div class="card-scam-alert" style="margin-bottom: 1.5rem;">
        <span>🛡️</span>
        <div>
          <strong style="display: block; margin-bottom: 0.2rem;">Local Transport &amp; Overcharging Alert:</strong>
          ${place.scamAlert}
        </div>
      </div>

      <!-- Community Traveler Voice Section -->
      <div style="border-top: 1px solid var(--border-subtle); padding-top: 1.5rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">💬 Traveler Experiences &amp; POV</h3>

        <div id="reviews-list" style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-surface-elevated); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
              <strong>Rohan M. (Solo Explorer)</strong>
              <span style="color: #fbbf24;">★★★★★</span>
            </div>
            <p style="color: var(--text-secondary);">"Visited right after arriving at the station. Followed the advice to not take the ₹200 auto and took an electric rickshaw for ₹40. Amazing experience!"</p>
          </div>

          ${existingReviews.map(r => `
            <div style="background: var(--bg-surface-elevated); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <strong>${escapeHtml(r.author)}</strong>
                <span style="color: #fbbf24;">${'★'.repeat(r.rating)}</span>
              </div>
              <p style="color: var(--text-secondary);">${escapeHtml(r.comment)}</p>
            </div>
          `).join('')}
        </div>

        <!-- Add Review Form -->
        <div style="background: var(--bg-surface-elevated); padding: 1.25rem; border-radius: var(--radius-md);">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">✍️ Add Your Experience / Tip</h4>
          <form id="add-review-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
              <input type="text" id="review-name" class="form-control" placeholder="Your Name" required />
              <select id="review-rating" class="form-control">
                <option value="5">★★★★★ (5 Stars)</option>
                <option value="4">★★★★☆ (4 Stars)</option>
                <option value="3">★★★☆☆ (3 Stars)</option>
              </select>
            </div>
            <textarea id="review-comment" class="form-control" rows="3" placeholder="Share your experience, fair fare paid, or tip for fellow travelers..." style="margin-bottom: 0.75rem; resize: vertical;" required></textarea>
            <button type="submit" class="btn-primary" style="width: 100%;">
              <span>📨</span> Post Review &amp; Travel Tip
            </button>
          </form>
        </div>
      </div>
    `;

    placeDetailModal.classList.add('active');

    // Handle review submission
    const form = document.getElementById('add-review-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const author = document.getElementById('review-name').value.trim();
      const rating = parseInt(document.getElementById('review-rating').value, 10);
      const comment = document.getElementById('review-comment').value.trim();

      if (!author || !comment) return;

      if (!state.userReviews[place.id]) {
        state.userReviews[place.id] = [];
      }

      state.userReviews[place.id].unshift({ author, rating, comment, timestamp: Date.now() });
      localStorage.setItem('citycompass_reviews', JSON.stringify(state.userReviews));
      showToast('🎉 Review added to community feed!');
      openPlaceModal(place.id); // Refresh modal view
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // -------------------------------------------------------------------
  // Tab Switching
  // -------------------------------------------------------------------
  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    tabViews.forEach(view => {
      view.classList.toggle('active', view.id === tabId);
    });

    if (tabId === 'tab-map') {
      setTimeout(() => {
        initMap();
        if (state.map) {
          state.map.invalidateSize();
          updateMapView();
        }
      }, 100);
    }

    if (tabId === 'tab-itinerary') {
      renderItinerary();
    }
  }

  // -------------------------------------------------------------------
  // Toast Notifications
  // -------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✨'}</span> <span>${message}</span>`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // -------------------------------------------------------------------
  // Setup Global Event Listeners
  // -------------------------------------------------------------------
  function setupEventListeners() {
    // City Selector
    citySelector.addEventListener('change', (e) => {
      loadCity(e.target.value);
      showToast(`Switched city to ${CITIES_DATA[e.target.value].name}`);
    });

    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Tab Navigation
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Brand Logo click resets to Explore tab
    document.getElementById('brand-logo').addEventListener('click', () => {
      switchTab('tab-explore');
    });

    // Quick Itinerary Button in Navbar
    navItineraryBtn.addEventListener('click', () => switchTab('tab-itinerary'));

    // Category Filter Pills
    categoryFilters.addEventListener('click', (e) => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedCategory = pill.dataset.category;
      renderPlaces();
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderPlaces();
    });

    // Sort Dropdown
    sortSelector.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderPlaces();
    });

    // GPS Button
    useGpsBtn.addEventListener('click', detectGPSLocation);

    // Fair-Fare inputs
    farePickupSelect.addEventListener('change', calculateFairFare);
    fareDropSelect.addEventListener('change', calculateFairFare);
    fareNightToggle.addEventListener('change', calculateFairFare);
    calcFareBtn.addEventListener('click', calculateFairFare);

    openRouteMapBtn.addEventListener('click', () => {
      const city = CITIES_DATA[state.cityId];
      if (!city) return;
      const pickupId = farePickupSelect.value;
      const dropId = fareDropSelect.value;

      let pickupCoords = state.currentHub.coords;
      let pickupName = state.currentHub.name;
      if (pickupId !== state.currentHub.id) {
        const foundHub = city.arrivalHubs.find(h => h.id === pickupId);
        if (foundHub) {
          pickupCoords = foundHub.coords;
          pickupName = foundHub.name;
        }
      }

      const dropPlace = city.places.find(p => p.id === dropId) || city.places[0];
      if (!dropPlace) return;

      state.activeRideRoute = {
        pickupCoords,
        pickupName,
        dropCoords: dropPlace.coords,
        dropName: dropPlace.name,
        dropId: dropPlace.id
      };

      switchTab('tab-map');
    });

    // Itinerary actions
    reorderRouteBtn.addEventListener('click', () => {
      renderItinerary();
      showToast('⚡ Route re-optimized for shortest distance!');
    });

    clearItineraryBtn.addEventListener('click', () => {
      const city = CITIES_DATA[state.cityId];
      const cityPlaceIds = new Set((city?.places || []).map(p => p.id));
      const hasStopsInCity = state.itineraryIds.some(id => cityPlaceIds.has(id));
      if (!hasStopsInCity) {
        showToast(`No stops saved for ${city.name.split(' ')[0]}`);
        return;
      }
      if (confirm(`Clear all stops from your ${city.name.split(' ')[0]} route?`)) {
        state.itineraryIds = state.itineraryIds.filter(id => !cityPlaceIds.has(id));
        localStorage.setItem('citycompass_itinerary', JSON.stringify(state.itineraryIds));
        updateItineraryBadges();
        renderPlaces();
        renderItinerary();
        if (state.map) updateMapView();
        showToast(`Itinerary cleared for ${city.name.split(' ')[0]}`);
      }
    });

    viewItineraryMapBtn.addEventListener('click', () => {
      state.activeRideRoute = null;
      switchTab('tab-map');
    });

    printItineraryBtn.addEventListener('click', () => {
      window.print();
    });

    // Modal Close
    modalCloseBtn.addEventListener('click', () => {
      placeDetailModal.classList.remove('active');
    });

    placeDetailModal.addEventListener('click', (e) => {
      if (e.target === placeDetailModal) {
        placeDetailModal.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && placeDetailModal.classList.contains('active')) {
        placeDetailModal.classList.remove('active');
      }
    });
  }

  // Run on start
  init();
});

// Initialize the map, centered around NYC
const map = L.map('map', {
    zoomControl: false // We will move zoom control to a better position
}).setView([40.725, -73.975], 13);

// Move zoom control to bottom left so sidebar doesn't overlap it
L.control.zoom({
    position: 'bottomleft'
}).addTo(map);

// Use CartoDB Positron for a clean, sleek base map (works well with our css filter trick)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Custom Marker Icon
const coffeeIcon = L.divIcon({
    html: '<div style="background-color: var(--bg-dark); color: var(--accent); border: 2px solid var(--accent); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); transition: transform 0.2s;"><i class="ph-fill ph-coffee" style="font-size: 20px;"></i></div>',
    className: 'custom-leaflet-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

// DOM Elements
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const cafeImage = document.getElementById('cafeImage');
const cafeName = document.getElementById('cafeName');
const cafeRating = document.getElementById('cafeRating');
const cafeDesc = document.getElementById('cafeDesc');
const reviewsList = document.getElementById('reviewsList');

// Add Cafe DOM Elements
const hamburgerMenu = document.getElementById('hamburgerMenu');
const addCafeSidebar = document.getElementById('addCafeSidebar');
const closeAddSidebarBtn = document.getElementById('closeAddSidebar');
const submitNewCafeBtn = document.getElementById('submitNewCafe');
const searchAddressInput = document.getElementById('searchAddressInput');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');

let selectedLocation = null;
let searchTimeout = null;

// Search Address Autocomplete
searchAddressInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length < 3) {
        autocompleteDropdown.classList.add('hidden');
        selectedLocation = null; // Reset if they alter query
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            // Constrain search mainly to NYC region
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&bounded=1&viewbox=-74.25909,40.915256,-73.700181,40.496044`);
            const data = await res.json();
            
            autocompleteDropdown.innerHTML = '';
            if (data.length === 0) {
                autocompleteDropdown.innerHTML = '<div class="autocomplete-item">No results found.</div>';
                autocompleteDropdown.classList.remove('hidden');
                return;
            }

            data.forEach(item => {
                const el = document.createElement('div');
                el.className = 'autocomplete-item';
                const name = item.display_name.split(',')[0];
                const rest = item.display_name.split(',').slice(1).join(',').substring(0, 50) + (item.display_name.length > 50 ? '...' : '');
                el.innerHTML = `<strong>${name}</strong>${rest}`;
                
                el.addEventListener('click', () => {
                    selectedLocation = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
                    searchAddressInput.value = name;
                    autocompleteDropdown.classList.add('hidden');
                });
                
                autocompleteDropdown.appendChild(el);
            });
            autocompleteDropdown.classList.remove('hidden');
        } catch (err) {
            console.error("Geocoding failed", err);
        }
    }, 500);
});

// Close autocomplete dropdown on outside click
document.addEventListener('click', (e) => {
    if (!searchAddressInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
        autocompleteDropdown.classList.add('hidden');
    }
});

// Pre-load markers and add to map
const markers = {};
let cafes = [];

async function loadCafes() {
    try {
        const res = await fetch('/api/cafes');
        cafes = await res.json();
        
        // Render markers
        cafes.forEach(cafe => {
            addMapMarker(cafe);
        });
    } catch (err) {
        console.error("Failed to load cafes from DB", err);
    }
}

// Call on startup
loadCafes();

function addMapMarker(cafe) {
    const marker = L.marker([cafe.lat, cafe.lng], { icon: coffeeIcon }).addTo(map);
    
    // Add simple tooltip on hover
    marker.bindTooltip(`<b>${cafe.name}</b>`, {
        direction: 'top',
        offset: [0, -20],
        className: 'custom-tooltip'
    });

    marker.on('click', () => {
        // Dynamically fetch the latest state from memory
        const currentCafe = cafes.find(c => c.id === cafe.id) || cafe;
        openSidebar(currentCafe);
        map.flyTo([currentCafe.lat, currentCafe.lng], 15, {
            animate: true,
            duration: 1.5
        });
    });

    markers[cafe.id] = marker;
}

// Sidebar Logic
function openSidebar(cafe) {
    // Populate data
    cafeImage.src = cafe.image;
    cafeName.textContent = cafe.name;
    
    cafeRating.innerHTML = `
        <span id="displayRatingStr">${cafe.rating.toFixed(1)}</span> 
        <button id="editRatingBtn" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-left:4px;" title="Edit Rating"><i class="ph ph-pencil-simple"></i></button>
        <div id="editRatingForm" style="display:none; margin-top:10px; background:rgba(255,255,255,0.05); padding:12px; border:radius:8px; width:100%; border:1px solid var(--glass-border);">
            <label style="font-size:0.85rem; color:var(--text-secondary); display:block; margin-bottom:4px;">New Rating (1-5)</label>
            <input type="number" id="inlineEditRating" step="0.1" min="1" max="5" value="${cafe.rating}" style="width:100px; padding:6px; margin-bottom:12px; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); color:white; border-radius:4px;" />
            <label style="font-size:0.85rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Review Update (optional)</label>
            <input type="text" id="inlineEditReview" placeholder="Leave a quick thought..." autocomplete="off" style="width:100%; padding:8px; margin-bottom:12px; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); color:white; border-radius:4px;" />
            <div style="display:flex; gap:8px;">
                <button id="saveRatingBtn" class="primary-btn" style="flex:1; padding:8px; font-size:0.9rem; margin-top:0;">Save</button>
                <button id="cancelRatingBtn" style="background:transparent; border:1px solid var(--glass-border); color:white; padding:8px 12px; border-radius:8px; cursor:pointer;">Cancel</button>
            </div>
        </div>
    `;
    
    cafeDesc.textContent = cafe.description;

    const deleteBtn = document.getElementById('deleteCafeBtn');
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = () => {
        if(confirm(`Are you sure you want to delete ${cafe.name}?`)) {
            deleteCafe(cafe.id);
        }
    };

    document.getElementById('editRatingBtn').addEventListener('click', () => {
        document.getElementById('editRatingForm').style.display = 'block';
        document.getElementById('editRatingBtn').style.display = 'none';
        document.getElementById('displayRatingStr').style.display = 'none';
    });
    
    document.getElementById('cancelRatingBtn').addEventListener('click', () => {
        document.getElementById('editRatingForm').style.display = 'none';
        document.getElementById('editRatingBtn').style.display = 'inline-block';
        document.getElementById('displayRatingStr').style.display = 'inline-block';
    });

    document.getElementById('saveRatingBtn').addEventListener('click', () => {
        const parsed = parseFloat(document.getElementById('inlineEditRating').value);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
            const reviewText = document.getElementById('inlineEditReview').value.trim();
            updateCafeRating(cafe.id, parsed, reviewText);
        } else {
            alert("Invalid rating. Must be between 1 and 5.");
        }
    });

    // Build Reviews
    reviewsList.innerHTML = '';
    cafe.reviews.forEach(review => {
        const reviewEl = document.createElement('div');
        reviewEl.className = 'review-card';
        
        let starsHtml = '';
        for(let i = 0; i < 5; i++) {
            if(i < review.rating) {
                starsHtml += '<i class="ph-fill ph-star"></i>';
            } else {
                starsHtml += '<i class="ph ph-star"></i>';
            }
        }

        reviewEl.innerHTML = `
            <div class="review-header">
                <span class="reviewer-name">${review.name}</span>
                <span class="review-stars">${starsHtml}</span>
            </div>
            <p class="review-text">"${review.text}"</p>
        `;
        reviewsList.appendChild(reviewEl);
    });

    // Show Sidebar
    sidebar.classList.remove('hidden');
}

closeSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('hidden');
    // Zoom back out to show all
    map.flyTo([40.725, -73.975], 13, {
        animate: true,
        duration: 1.5
    });
});

// Hide sidebars if clicking on map background
map.on('click', () => {
    sidebar.classList.add('hidden');
    addCafeSidebar.classList.add('hidden');
});

// Update Database Rating logic
async function updateCafeRating(id, newRating, reviewText) {
    try {
        const payload = { rating: newRating, reviewText: reviewText || "" };
        const res = await fetch(`/api/cafes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const updated = await res.json();
            // Update local memory
            const idx = cafes.findIndex(c => c.id === id);
            if (idx > -1) {
                cafes[idx] = updated.cafe;
                openSidebar(cafes[idx]); // Refresh sidebar
            }
        } else {
            alert("Failed to update rating.");
        }
    } catch (err) {
        console.error(err);
    }
}

// Delete Cafe logic
async function deleteCafe(id) {
    try {
        const res = await fetch(`/api/cafes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            // Update local memory
            cafes = cafes.filter(c => c.id !== id);
            // Remove from map
            if (markers[id]) {
                map.removeLayer(markers[id]);
                delete markers[id];
            }
            // Close sidebar
            sidebar.classList.add('hidden');
        } else {
            alert("Failed to delete cafe.");
        }
    } catch (err) {
        console.error(err);
    }
}

// Add Cafe Sidebar Logic
hamburgerMenu.addEventListener('click', () => {
    addCafeSidebar.classList.remove('hidden');
    sidebar.classList.add('hidden'); // Close details sidebar if open
});

closeAddSidebarBtn.addEventListener('click', () => {
    addCafeSidebar.classList.add('hidden');
});

// Handle form submission
submitNewCafeBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('newCafeName').value.trim();
    const ratingInput = parseFloat(document.getElementById('newCafeRating').value);
    const descInput = document.getElementById('newCafeDesc').value.trim();

    if (!nameInput || !selectedLocation || isNaN(ratingInput) || !descInput) {
        alert("Please fill out all fields and select a valid address from the search.");
        return;
    }

    const newCafe = {
        id: nameInput.toLowerCase().replace(/\s+/g, '-'),
        name: nameInput,
        nav: "Custom Location",
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        rating: ratingInput,
        image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800", // Default image
        description: descInput,
        reviews: [
            { name: "You", rating: ratingInput, text: "Newly added cafe to the map!" }
        ]
    };

    // Save to Database
    fetch('/api/cafes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCafe)
    }).then(res => res.json()).then(data => {
        if(data.success) {
            // Add to global data source
            cafes.push(data.cafe);
        
            // Render Marker
            addMapMarker(data.cafe);
        
            // Reset Form
            document.getElementById('newCafeName').value = '';
            searchAddressInput.value = '';
            selectedLocation = null;
            document.getElementById('newCafeRating').value = '';
            document.getElementById('newCafeDesc').value = '';
        
            // Close sidebar and view new marker
            addCafeSidebar.classList.add('hidden');
            map.flyTo([data.cafe.lat, data.cafe.lng], 15, {
                animate: true,
                duration: 1.5
            });
            
            // Automatically open its details
            openSidebar(data.cafe);
        }
    }).catch(err => {
        console.error("Failed to post cafe", err);
        alert("Failed to save cafe to DB.");
    });
});

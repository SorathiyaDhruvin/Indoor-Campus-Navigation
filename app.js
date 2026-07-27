// app.js

const buildings = [
    {
        id: "admin",
        name: "Administration Block",
        description: "Main administrative offices, admission cell, and student affairs.",
        image: "assets/admin.jpg",
        tags: ["office", "admin", "admission"]
    },
    {
        id: "ai-lab",
        name: "AI Laboratory",
        description: "State-of-the-art artificial intelligence and machine learning lab.",
        image: "assets/ai-lab.jpg",
        tags: ["laboratory", "ai", "computer", "lab"]
    },
    {
        id: "cv-raman",
        name: "CV Raman Center",
        description: "Extended Reality Lab and Network Architecture Lab. Click Explore to enter the 360° virtual tour.",
        image: "assets/ground floor/photo1_result.jpeg",
        tags: ["laboratory", "xr", "network", "lab", "classroom"]
    },
    {
        id: "library",
        name: "Central Library",
        description: "Extensive collection of books, journals, and quiet reading areas.",
        image: "assets/library.jpg",
        tags: ["library", "books", "reading", "study"]
    },
    {
        id: "computer-dept",
        name: "Computer Department",
        description: "Classrooms and faculty rooms for the Computer Science department.",
        image: "assets/computer-dept.jpg",
        tags: ["classroom", "faculty room", "computer science", "department"]
    },
    {
        id: "mechanical-block",
        name: "Mechanical Block",
        description: "Workshops and laboratories for mechanical engineering students.",
        image: "assets/mechanical-block.jpg",
        tags: ["classroom", "laboratory", "workshop", "mechanical"]
    },
    {
        id: "cafeteria",
        name: "Main Cafeteria",
        description: "Student dining area serving a variety of meals and snacks.",
        image: "assets/cafeteria.jpg",
        tags: ["cafeteria", "food", "dining", "snacks"]
    },
    {
        id: "parking",
        name: "Central Parking",
        description: "Spacious parking facility for students and faculty.",
        image: "assets/parking.jpg",
        tags: ["parking", "vehicles"]
    }
];

const buildingsGrid = document.getElementById('buildingsGrid');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');

function getFallbackImage(name) {
    // Generate a professional gradient SVG placeholder if image is missing
    const text = name.charAt(0).toUpperCase();
    return `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%231F4E79;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%232E7D32;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='300' fill='url(%23grad)'/%3E%3Ctext x='200' y='150' fill='white' font-family='sans-serif' font-weight='bold' font-size='100' text-anchor='middle' dominant-baseline='middle'%3E${text}%3C/text%3E%3Ctext x='200' y='220' fill='rgba(255,255,255,0.7)' font-family='sans-serif' font-size='20' text-anchor='middle'%3EImage Not Available%3C/text%3E%3C/svg%3E`;
}

function renderBuildings(filterText = "") {
    buildingsGrid.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();

    const filtered = buildings.filter(b => {
        if (!filterText) return true;
        const matchName = b.name.toLowerCase().includes(lowerFilter);
        const matchDesc = b.description.toLowerCase().includes(lowerFilter);
        const matchTags = b.tags.some(tag => tag.toLowerCase().includes(lowerFilter));
        return matchName || matchDesc || matchTags;
    });

    if (filtered.length === 0) {
        noResults.style.display = 'block';
    } else {
        noResults.style.display = 'none';
        filtered.forEach(b => {
            const card = document.createElement('div');
            card.className = 'building-card';
            
            // Using onerror to fallback to generated SVG if image doesn't exist
            card.innerHTML = `
                <div class="building-img">
                    <img src="${b.image}" alt="${b.name}" onerror="this.src='${getFallbackImage(b.name)}'">
                </div>
                <div class="building-content">
                    <h3>${b.name}</h3>
                    <p>${b.description}</p>
                    ${b.id === 'cv-raman' 
                        ? `<a href="viewer.html" class="btn btn-primary">Explore 360° Tour</a>` 
                        : `<a href="#" class="btn btn-secondary" onclick="alert('Virtual tour for this building is coming soon!'); return false;">Coming Soon</a>`}
                </div>
            `;
            buildingsGrid.appendChild(card);
        });
    }
}

// Initial render
renderBuildings();

// Search event listener
searchInput.addEventListener('input', (e) => {
    renderBuildings(e.target.value);
});


// Active navigation menu highlight on scroll
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-menu a');
window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (pageYOffset >= sectionTop - 80) {
            current = section.getAttribute('id');
        }
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });
});

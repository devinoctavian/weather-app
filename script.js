// Initialize Lucide Icons
lucide.createIcons();

        // Constants & Configuration
        const API_KEY = '90d6efb4feb8d66347f941d8ed26688a';
        const BASE_URL = 'https://api.openweathermap.org/data/2.5';
        const DEFAULT_CITY = 'London,uk'; // Default fallback

        // State Management
        let currentUnit = 'C'; // 'C' or 'F'
        let currentWeatherData = null;
        let forecastDataArray = [];

        // DOM Elements
        const form = document.getElementById('search-form');
        const searchInput = document.getElementById('city-input');
        const unitBtns = document.querySelectorAll('.unit-btn');
        const statusPanel = document.getElementById('status-panel');
        const loader = document.getElementById('loader');
        const statusText = document.getElementById('status-text');
        const errorBox = document.getElementById('error-box');
        const mainContent = document.getElementById('main-content');
        const forecastGrid = document.getElementById('forecast-grid');
        const dayDetailPanel = document.getElementById('day-detail-panel');
        const closeDetailBtn = document.getElementById('close-detail-btn');

        // Helper: Convert Celsius to target unit
        const formatTemp = (tempC) => {
            if (currentUnit === 'F') {
                return Math.round((tempC * 9/5) + 32);
            }
            return Math.round(tempC);
        };

        // Helper: Format Date string
        const formatDate = (dateString) => {
            const options = { weekday: 'long', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('en-US', options);
        };

        const getShortDay = (dateString) => {
            return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short' });
        };

        // Helper: Format wind speed (m/s to km/h)
        const formatWind = (ms) => Math.round(ms * 3.6);

        // Core Fetch Function
        async function fetchWeather(city) {
            // UI State: Loading
            mainContent.classList.remove('active');
            statusPanel.classList.add('active');
            loader.style.display = 'block';
            errorBox.style.display = 'none';
            statusText.innerText = 'Fetching weather data...';

            try {
                // Fetch Current Weather & Forecast simultaneously
                const [currentRes, forecastRes] = await Promise.all([
                    fetch(`${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric`),
                    fetch(`${BASE_URL}/forecast?q=${city}&appid=${API_KEY}&units=metric`)
                ]);

                if (!currentRes.ok || !forecastRes.ok) {
                    if (currentRes.status === 404) throw new Error('City not found. Please try again.');
                    throw new Error('Failed to fetch weather data.');
                }

                currentWeatherData = await currentRes.json();
                const forecastRaw = await forecastRes.json();
                
                // Process Data
                processForecastData(forecastRaw.list);
                
                // Update UI
                updateBackground(currentWeatherData.weather[0].main);
                renderCurrentWeather();
                renderForecast();
                
                // UI State: Success
                statusPanel.classList.remove('active');
                mainContent.classList.add('active');
                
            } catch (error) {
                // UI State: Error
                loader.style.display = 'none';
                statusText.innerText = 'Oops! Something went wrong.';
                errorBox.style.display = 'block';
                errorBox.innerText = error.message;
            }
        }

        // Process 3-hour interval forecast into Daily Averages/Min-Max
        function processForecastData(list) {
            const dailyData = {};

            list.forEach(item => {
                const date = item.dt_txt.split(' ')[0]; // Extract YYYY-MM-DD
                
                if (!dailyData[date]) {
                    dailyData[date] = {
                        date: date,
                        minTemp: item.main.temp_min,
                        maxTemp: item.main.temp_max,
                        icon: item.weather[0].icon,
                        description: item.weather[0].description,
                        humidity: item.main.humidity,
                        windSpeed: item.wind.speed,
                        count: 1
                    };
                } else {
                    dailyData[date].minTemp = Math.min(dailyData[date].minTemp, item.main.temp_min);
                    dailyData[date].maxTemp = Math.max(dailyData[date].maxTemp, item.main.temp_max);
                    // Update icon to the midday icon ideally, but simply replacing is fine for a general trend
                    if (item.dt_txt.includes("12:00:00")) {
                        dailyData[date].icon = item.weather[0].icon;
                        dailyData[date].description = item.weather[0].description;
                        dailyData[date].humidity = item.main.humidity;
                        dailyData[date].windSpeed = item.wind.speed;
                    }
                }
            });

            // Convert object to array and get next 5 days
            const todayStr = new Date().toISOString().split('T')[0];
            forecastDataArray = Object.values(dailyData)
                .filter(day => day.date !== todayStr) // Exclude current day
                .slice(0, 5); // Take exactly 5 days
        }

        // Dynamic Backgrounds Logic
        function updateBackground(condition) {
            document.body.className = ''; // reset
            const conditionLower = condition.toLowerCase();
            
            if (conditionLower.includes('clear')) document.body.classList.add('bg-clear');
            else if (conditionLower.includes('cloud')) document.body.classList.add('bg-clouds');
            else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) document.body.classList.add('bg-rain');
            else if (conditionLower.includes('snow')) document.body.classList.add('bg-snow');
            else if (conditionLower.includes('thunderstorm')) document.body.classList.add('bg-thunderstorm');
            else document.body.classList.add('bg-default');
        }

        // Render Current Weather UI
        function renderCurrentWeather() {
            if (!currentWeatherData) return;
            
            document.getElementById('current-city').innerText = `${currentWeatherData.name}, ${currentWeatherData.sys.country}`;
            document.getElementById('current-date').innerText = formatDate(new Date());
            
            const iconUrl = `https://openweathermap.org/img/wn/${currentWeatherData.weather[0].icon}@4x.png`;
            const iconImg = document.getElementById('current-icon');
            iconImg.src = iconUrl;
            iconImg.style.display = 'block';
            
            document.getElementById('current-desc').innerText = currentWeatherData.weather[0].description;
            document.getElementById('current-temp').innerText = formatTemp(currentWeatherData.main.temp);
            document.getElementById('current-unit').innerText = `°${currentUnit}`;
            
            document.getElementById('current-humidity').innerText = `${currentWeatherData.main.humidity}%`;
            document.getElementById('current-wind').innerText = `${formatWind(currentWeatherData.wind.speed)} km/h`;
            document.getElementById('current-feels').innerText = `${formatTemp(currentWeatherData.main.feels_like)}°${currentUnit}`;
            document.getElementById('current-vis').innerText = `${(currentWeatherData.visibility / 1000).toFixed(1)} km`;
        }

        // Render Forecast Grid UI
        function renderForecast() {
            forecastGrid.innerHTML = '';
            dayDetailPanel.classList.remove('active'); // Hide detail panel on new search

            forecastDataArray.forEach((day, index) => {
                const card = document.createElement('div');
                card.className = 'forecast-card';
                card.innerHTML = `
                    <div class="forecast-day">${getShortDay(day.date)}</div>
                    <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="icon" class="forecast-icon">
                    <div class="forecast-temps">
                        <span class="max">${formatTemp(day.maxTemp)}°</span>
                        <span class="min">${formatTemp(day.minTemp)}°</span>
                    </div>
                `;
                // Add click listener for Detail View
                card.addEventListener('click', () => showDayDetails(index));
                forecastGrid.appendChild(card);
            });
        }

        // Show Expandable Day Detail
        function showDayDetails(index) {
            const day = forecastDataArray[index];
            document.getElementById('detail-date').innerText = formatDate(day.date);
            document.getElementById('detail-desc').innerText = day.description.charAt(0).toUpperCase() + day.description.slice(1);
            document.getElementById('detail-max').innerText = `${formatTemp(day.maxTemp)}°${currentUnit}`;
            document.getElementById('detail-min').innerText = `${formatTemp(day.minTemp)}°${currentUnit}`;
            document.getElementById('detail-humidity').innerText = `${day.humidity}%`;
            document.getElementById('detail-wind').innerText = `${formatWind(day.windSpeed)} km/h`;
            
            dayDetailPanel.classList.add('active');
            lucide.createIcons(); // Re-initialize icons inside the dynamically shown panel if needed
        }

        // Event Listeners
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const city = searchInput.value.trim();
            if (city) {
                fetchWeather(city);
                searchInput.blur();
            }
        });

        unitBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) return;
                
                // Toggle active class
                unitBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update State and UI
                currentUnit = btn.dataset.unit;
                renderCurrentWeather();
                renderForecast();
                
                // Update open detail panel if exists
                if (dayDetailPanel.classList.contains('active')) {
                    const activeDate = document.getElementById('detail-date').innerText;
                    const activeIndex = forecastDataArray.findIndex(d => formatDate(d.date) === activeDate);
                    if(activeIndex !== -1) showDayDetails(activeIndex);
                }
            });
        });

        closeDetailBtn.addEventListener('click', () => {
            dayDetailPanel.classList.remove('active');
        });

        // Init App with default city
        fetchWeather(DEFAULT_CITY);
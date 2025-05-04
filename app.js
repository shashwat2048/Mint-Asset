const API_KEY = 'cvcr051r01qodeub228gcvcr051r01qodeub2290';
const newsContainer = document.getElementById('news-container');
const loader = document.getElementById('loader');
const Batchloader = document.getElementById('loader-2');
const sentinel = document.getElementById('sentinel');
const homeBtn = document.getElementById('home-btn');
let allNews = [];
let currentIndex = 0;
const batchSize = getBatchSize();

function getBatchSize() {
  const width = window.innerWidth;
  if (width <= 768) {     
    return 10;
  } else if (width <= 1024) {  
    return 14;
  } else {                 
    return 18;
  }
}

async function fetchNews() {
  loader.style.display = 'flex';
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('News data:', data);
    allNews = data;
    // displayNews(data);
    newsContainer.innerHTML = '';
    loadNextBatch();
    const currentTheme = localStorage.getItem('selected-theme') || 'default';
    applyTheme(currentTheme);
  } catch (error) {
    console.error('Error fetching news:', error);
    newsContainer.innerHTML = '<p>Error loading news. Please try again later.</p>';
  }
  finally {
    loader.style.display = 'none';
  }
}

function loadNextBatch(){
  if(currentIndex >= allNews.length){
    return;
  }
  if(currentIndex === 0){
    const nextBatch = allNews.slice(currentIndex, currentIndex + batchSize);
    displayNews(nextBatch);
    currentIndex += batchSize;
  }
  else{
    Batchloader.style.display = 'flex';
    setTimeout(() => {
      const nextBatch = allNews.slice(currentIndex, currentIndex + batchSize);
      displayNews(nextBatch);
      currentIndex += batchSize;
      const currentTheme = localStorage.getItem('selected-theme') || 'default';
      applyTheme(currentTheme);
      Batchloader.style.display = 'none';
    }, 1000); 
  }
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadNextBatch();
      const currentTheme = localStorage.getItem('selected-theme') || 'default';
      applyTheme(currentTheme);
    }
  });
}, { threshold: 1.0 });
observer.observe(sentinel);

function displayNews(articles) {
  articles.forEach(article => {
    if (article.image.includes("market_watch_logo.png") ||article.image.includes("logobbg-wht.png")|| article.image === "") {
      article.image = "./mint_asset_pic.png";
    }
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';

    newsItem.innerHTML = `
      ${article.image ? `<img src="${article.image}" alt="Article image">` : ''}
      <h2>${article.headline}</h2>
      <p>${article.summary || ''}</p>
      <div class="card-footer">
        <button onclick="window.open('${article.url}', '_blank')">Read more</button>
        <small>Published at: ${new Date(article.datetime * 1000).toLocaleString()}</small>
      </div>
    `;
    newsContainer.appendChild(newsItem);
  });
}

fetchNews();
setInterval(fetchNews, 5 * 60 * 1000);

const themeSelect = document.getElementById("theme-toggle");
const storedTheme = localStorage.getItem('selected-theme') || 'default';
themeSelect.value = storedTheme;

themeSelect.addEventListener('change', () => {
  const selectedTheme = themeSelect.value;
  console.log("Selected theme:", selectedTheme);
  applyTheme(selectedTheme);
});

function applyTheme(theme) {
  switch(theme) {
    case 'dark':
      darkTheme();
      break;
    case 'light':
      lightTheme();
      break;
    default:
      defaultTheme();
  }
}

let header = document.querySelector('header');
let footer = document.querySelector('footer');
let body = document.querySelector('body');
let logo = document.querySelector('.brand-link span');
let weatherContainer = document.getElementById('weatherContainer');

function darkTheme(){
  updateBgTheme("#000000", "#e0e0e0", "#1f2a2d", "#e0e0e0", "#1f2a2d", "#e0e0e0", "#e0e0e0", "inherit");
  updateNewsCardTheme("#0080aa", "#ffffff", "ivory", "#ffd027", "#000000", "#dce6e8");
  localStorage.setItem('selected-theme', 'dark');
  console.log('Dark theme applied');
}

function lightTheme(){
  updateBgTheme("#ccedfd", "#072235", "#f5f2f9", "#072235", "#f5f2f9", "#072235", "#072235", "#f9f0ff");
  updateNewsCardTheme("#f9f0ff", "#013c4a", "#016179", "#9857ff", "#f9f0ff", "#8ea4d2");
  localStorage.setItem('selected-theme', 'light');
  console.log('Light theme applied');
}

function defaultTheme(){
  updateBgTheme("#4b4949", "ivory", "#333", "ivory", "#333", "ivory", "ivory", "inherit");
  updateNewsCardTheme("ivory", "#333", "#555", "#38b6ff", "#fff", "#747272");
  localStorage.setItem('selected-theme', 'default');
  console.log('Default theme applied');
}

function updateNewsCardTheme(cardBg, headlineColor, summaryColor, btnBg, btnColor, timeColor) {
  const newsCards = document.querySelectorAll('.news-item');
  newsCards.forEach(card => {
    card.style.backgroundColor = cardBg;
    const headline = card.querySelector('h2');
    headline.style.color = headlineColor;
    const summary = card.querySelector('p');
    summary.style.color = summaryColor;
    const btn = card.querySelector('button');
    btn.style.backgroundColor = btnBg;
    btn.style.color = btnColor;
    const time = card.querySelector('small');
    time.style.color = timeColor;
  });
}

function updateBgTheme(bgColor, bgTextColor, headerColor, headerTextColor, footerColor, footerTextColor, logoColor, weatherColor) {
  body.style.backgroundColor = bgColor;
  body.style.color = bgTextColor;
  header.style.backgroundColor = headerColor;
  header.style.color = headerTextColor;
  footer.style.backgroundColor = footerColor;
  footer.style.color = footerTextColor;
  logo.style.color = logoColor;
  weatherContainer.style.color = weatherColor;
}

applyTheme(storedTheme);


if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
} else {
  console.error("Geolocation is not supported by this browser.");
}

function successCallback(position) {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  fetchWeather(latitude, longitude);
}

function errorCallback(error) {
  console.error("Error retrieving location:", error);
}

function fetchWeather(lat, lon) {
  const apiKey = 'ed85e75c7e07ca579b80f3e1fa9f5a9b';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log("Weather data:", data);
      displayWeather(data);
    })
    .catch(error => console.error("Error fetching weather data:", error));
}

function displayWeather(data) {
  const temperature = data.main.feels_like;
  const description = data.weather[0].description;
  const city = data.name;
  const region = data.sys.country;
  const iconCode = data.weather[0].icon;  
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;  

  weatherContainer.innerHTML = `
    <img src="${iconUrl}" alt="Weather icon" id="weather-icon">
    <span>${temperature}°C</span>
    <span>${description},</span>
    <span>${city}</span>
    <span>${region}</span>
  `;
}

homeBtn.addEventListener('click', function() {
  header.scrollIntoView({behavior: 'smooth'});
});

let isDragging = false;
let offsetX, offsetY;

homeBtn.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - homeBtn.getBoundingClientRect().left;
  offsetY = e.clientY - homeBtn.getBoundingClientRect().top;
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const posX = e.clientX - offsetX;
  const posY = e.clientY - offsetY;
  setBtnPosition(posX, posY);
});

function setBtnPosition(x, y) {
  homeBtn.style.left = x + 'px';
  homeBtn.style.top = y + 'px';
  homeBtn.style.right = 'auto';
  homeBtn.style.bottom = 'auto';
}


document.addEventListener('mouseup', () => {
  isDragging = false;
});

homeBtn.addEventListener('touchstart', (e) => {
  isDragging = true;
  const touch = e.touches[0];
  offsetX = touch.clientX - homeBtn.getBoundingClientRect().left;
  offsetY = touch.clientY - homeBtn.getBoundingClientRect().top;
});

document.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const touch = e.touches[0];
  const posX = touch.clientX - offsetX;
  const posY = touch.clientY - offsetY;
  setBtnPosition(posX,posY);
});

document.addEventListener('touchend', () => {
  isDragging = false;
});

function setBtnPosition(x,y){
  homeBtn.style.left = x + 'px';
  homeBtn.style.top = y + 'px';
  homeBtn.style.right = 'auto';
  homeBtn.style.bottom = 'auto';
}

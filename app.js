const API_KEY = 'cvcr051r01qodeub228gcvcr051r01qodeub2290';
const newsContainer = document.getElementById('news-container');

async function fetchNews() {
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('News data:', data);
    displayNews(data);
    const currentTheme = localStorage.getItem('selected-theme') || 'default';
    applyTheme(currentTheme);
  } catch (error) {
    console.error('Error fetching news:', error);
    newsContainer.innerHTML = '<p>Error loading news. Please try again later.</p>';
  }
}

function displayNews(articles) {
  newsContainer.innerHTML = '';
  articles.forEach(article => {
    if (article.image.includes("market_watch_logo.png") || article.image === "") {
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

function darkTheme(){
  updateBgTheme("#000000", "#e0e0e0", "#1f2a2d", "#e0e0e0", "#1f2a2d", "#e0e0e0", "#e0e0e0");
  updateNewsCardTheme("#0080aa", "#ffffff", "ivory", "#ffd027", "#000000", "#dce6e8");
  localStorage.setItem('selected-theme', 'dark');
  console.log('Dark theme applied');
}

function lightTheme(){
  updateBgTheme("#ccedfd", "#072235", "#f5f2f9", "#072235", "#f5f2f9", "#072235", "#072235");
  updateNewsCardTheme("#f9f0ff", "#013c4a", "#016179", "#9857ff", "#f9f0ff", "#8ea4d2");
  localStorage.setItem('selected-theme', 'light');
  console.log('Light theme applied');
}

function defaultTheme(){
  updateBgTheme("#4b4949", "ivory", "#333", "ivory", "#333", "ivory", "ivory");
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

function updateBgTheme(bgColor, bgTextColor, headerColor, headerTextColor, footerColor, footerTextColor, logoColor) {
  body.style.backgroundColor = bgColor;
  body.style.color = bgTextColor;
  header.style.backgroundColor = headerColor;
  header.style.color = headerTextColor;
  footer.style.backgroundColor = footerColor;
  footer.style.color = footerTextColor;
  logo.style.color = logoColor;
}

applyTheme(storedTheme);

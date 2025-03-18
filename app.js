const API_KEY = 'cvcr051r01qodeub228gcvcr051r01qodeub2290';
const newsContainer = document.getElementById('news-container');

async function fetchNews() {
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('News data:', data);
    displayNews(data);
  } catch (error) {
    console.error('Error fetching news:', error);
    newsContainer.innerHTML = '<p>Error loading news. Please try again later.</p>';
  }
}

function displayNews(articles) {
  newsContainer.innerHTML = '';
  articles.forEach(article => {
    if (article.image === "https://static2.finnhub.io/file/publicdatany/finnhubimage/market_watch_logo.png") {
      return;
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

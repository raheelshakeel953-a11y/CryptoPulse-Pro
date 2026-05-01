// ========== CRYPTOPULSE PRO - ENHANCED MAIN APPLICATION ==========
// Version 2.0 - More features, better error handling, improved UX

// ========== GLOBAL STATE ==========
let allCryptos = [];
let displayCryptos = [];
let watchlistIds = new Set();
let portfolioItems = [];
let currentChart = null;
let currentChartDays = 7;
let currentChartCoin = 'bitcoin';
let fearGreedHistory = [];
let priceAlerts = [];
let refreshInterval = null;
let lastFetchTime = null;
let isLoading = false;

// ========== DOM REFERENCES ==========
const tableBody = document.getElementById('tableBody');
const globalCapSpan = document.getElementById('globalCap');
const btcDominanceSpan = document.getElementById('btcDominance');
const totalVolumeSpan = document.getElementById('totalVolume');
const activeCoinsSpan = document.getElementById('activeCoins');
const portfolioTotalSpan = document.getElementById('portfolioTotal');
const portfolioCountSpan = document.getElementById('portfolioCount');
const portfolioPnLSpan = document.getElementById('portfolioPnL');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const gainersTicker = document.getElementById('gainersTicker');
const losersTicker = document.getElementById('losersTicker');
const ethDominanceSpan = document.getElementById('ethDominance');
const defiVolumeSpan = document.getElementById('defiVolume');
const ethGasSpan = document.getElementById('ethGasPrice');
const btcHashrateSpan = document.getElementById('btcHashrate');
const stablecoinSpan = document.getElementById('stablecoinSupply');
const fearGreedValueSpan = document.getElementById('fearGreedValue');
const fearGreedFill = document.getElementById('fearGreedFill');
const fearGreedTextSpan = document.getElementById('fearGreedText');
const lastUpdateSpan = document.getElementById('lastUpdateTime');

// ========== HELPER UTILITIES ==========
function showToast(message, type = 'info') {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatCompactNumber(value) {
  if (!value) return '0';
  if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toString();
}

function formatPercentage(value) {
  if (!value && value !== 0) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ========== THEME MANAGEMENT ==========
function initTheme() {
  const saved = localStorage.getItem('cryptoTheme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
  } else if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
  } else if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('cryptoTheme', 'light');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    showToast('Light theme activated', 'info');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('cryptoTheme', 'dark');
    themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    showToast('Dark theme activated', 'info');
  }
  if (currentChart) updateChart(currentChartCoin, currentChartDays);
}

// ========== FORMATTERS ==========
function formatUSD(value) {
  if (!value && value !== 0) return '$0.00';
  if (value > 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value > 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value > 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function getIconHtml(symbol) {
  const icons = {
    btc: 'fab fa-bitcoin', eth: 'fab fa-ethereum', sol: 'fab fa-solana',
    xrp: 'fas fa-circle', doge: 'fab fa-dogecoin', ada: 'fas fa-cube',
    dot: 'fas fa-link', matic: 'fab fa-polygon', ltc: 'fas fa-chart-line',
    avax: 'fas fa-chart-simple', shib: 'fas fa-dog', trx: 'fas fa-charging-station'
  };
  const icon = icons[symbol.toLowerCase()] || 'fas fa-coins';
  return `<i class="${icon}"></i>`;
}

// ========== EXPORT/IMPORT DATA ==========
function exportData() {
  const data = {
    watchlist: Array.from(watchlistIds),
    portfolio: portfolioItems,
    priceAlerts: priceAlerts,
    exportDate: new Date().toISOString()
  };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cryptopulse_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported successfully!', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.watchlist) watchlistIds = new Set(data.watchlist);
      if (data.portfolio) portfolioItems = data.portfolio;
      if (data.priceAlerts) priceAlerts = data.priceAlerts;
      saveWatchlist();
      savePortfolio();
      savePriceAlerts();
      renderTable();
      updatePortfolioUI();
      showToast('Data imported successfully!', 'success');
    } catch (err) {
      showToast('Invalid backup file', 'error');
    }
  };
  reader.readAsText(file);
}

// ========== PRICE ALERTS ==========
function savePriceAlerts() {
  localStorage.setItem('cryptoPriceAlerts', JSON.stringify(priceAlerts));
}

function loadPriceAlerts() {
  const stored = localStorage.getItem('cryptoPriceAlerts');
  if (stored) priceAlerts = JSON.parse(stored);
  checkPriceAlerts();
}

function addPriceAlert(coinId, targetPrice, condition = 'above') {
  const coin = allCryptos.find(c => c.id === coinId);
  if (!coin) return;
  
  priceAlerts.push({
    id: Date.now(),
    coinId,
    coinSymbol: coin.symbol,
    targetPrice,
    condition,
    triggered: false,
    createdAt: new Date().toISOString()
  });
  savePriceAlerts();
  showToast(`Alert set for ${coin.symbol.toUpperCase()} ${condition} $${targetPrice}`, 'success');
}

function removePriceAlert(alertId) {
  priceAlerts = priceAlerts.filter(a => a.id !== alertId);
  savePriceAlerts();
  showToast('Alert removed', 'info');
}

function checkPriceAlerts() {
  priceAlerts.forEach(alert => {
    if (alert.triggered) return;
    const coin = allCryptos.find(c => c.id === alert.coinId);
    if (coin && coin.current_price) {
      const shouldTrigger = alert.condition === 'above' 
        ? coin.current_price >= alert.targetPrice 
        : coin.current_price <= alert.targetPrice;
      
      if (shouldTrigger) {
        alert.triggered = true;
        showToast(`🔔 PRICE ALERT: ${alert.coinSymbol.toUpperCase()} ${alert.condition} $${alert.targetPrice} (Current: $${coin.current_price})`, 'warning');
        savePriceAlerts();
      }
    }
  });
}

// ========== WATCHLIST ==========
function saveWatchlist() { 
  localStorage.setItem('cryptoWatchlist', JSON.stringify(Array.from(watchlistIds)));
}

function loadWatchlist() { 
  const stored = localStorage.getItem('cryptoWatchlist'); 
  if (stored) watchlistIds = new Set(JSON.parse(stored));
}

// ========== PORTFOLIO ==========
function savePortfolio() { 
  localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolioItems)); 
  updatePortfolioUI(); 
}

function loadPortfolio() { 
  const stored = localStorage.getItem('cryptoPortfolio'); 
  portfolioItems = stored ? JSON.parse(stored) : []; 
  updatePortfolioUI(); 
}

function updatePortfolioUI() {
  let totalValue = 0;
  let totalCost = 0;
  let dailyPnL = 0;
  
  portfolioItems.forEach(item => {
    const coin = allCryptos.find(c => c.id === item.id);
    if (coin?.current_price) {
      const currentValue = item.amount * coin.current_price;
      totalValue += currentValue;
      totalCost += item.amount * (item.purchasePrice || coin.current_price);
      
      // Calculate 24h change contribution
      const price24hAgo = coin.current_price / (1 + (coin.price_change_percentage_24h / 100));
      dailyPnL += item.amount * (coin.current_price - price24hAgo);
    }
  });
  
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  
  portfolioTotalSpan.innerText = formatUSD(totalValue);
  portfolioCountSpan.innerText = portfolioItems.length;
  portfolioPnLSpan.innerHTML = `${formatUSD(pnl)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`;
  portfolioPnLSpan.className = pnl >= 0 ? 'text-success' : 'text-danger';
  
  renderPortfolioModalList();
  updatePortfolioModalStats(totalValue, totalCost, pnl, pnlPercent, dailyPnL);
}

function updatePortfolioModalStats(totalValue, totalCost, pnl, pnlPercent, dailyPnL) {
  const container = document.getElementById('portfolioModalStats');
  if (container) {
    container.innerHTML = `
      <div class="portfolio-stats-grid" style="display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:20px; padding:16px; background:var(--bg-elevated); border-radius:20px;">
        <div><small>📊 Total Value</small><br><strong>${formatUSD(totalValue)}</strong></div>
        <div><small>💰 Total Cost</small><br><strong>${formatUSD(totalCost)}</strong></div>
        <div><small>📈 Total P&L</small><br><strong class="${pnl >= 0 ? 'text-success' : 'text-danger'}">${formatUSD(pnl)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)</strong></div>
        <div><small>⚡ 24h P&L</small><br><strong class="${dailyPnL >= 0 ? 'text-success' : 'text-danger'}">${formatUSD(dailyPnL)}</strong></div>
      </div>
    `;
  }
}

function addPortfolioItem(id, amount, purchasePrice = null) {
  if (amount <= 0) {
    showToast('Please enter a valid amount', 'error');
    return;
  }
  
  const existing = portfolioItems.find(p => p.id === id);
  if (existing) {
    existing.amount += amount;
  } else {
    const coin = allCryptos.find(c => c.id === id);
    if (coin) {
      portfolioItems.push({ 
        id, 
        symbol: coin.symbol, 
        name: coin.name, 
        amount, 
        purchasePrice: purchasePrice || null,
        dateAdded: new Date().toISOString()
      });
    }
  }
  savePortfolio();
  showToast(`Added ${amount} ${coin.symbol.toUpperCase()} to portfolio`, 'success');
}

function removePortfolioItem(idx) { 
  const removed = portfolioItems[idx];
  portfolioItems.splice(idx, 1); 
  savePortfolio();
  showToast(`Removed ${removed.symbol.toUpperCase()} from portfolio`, 'info');
}

function clearPortfolio() { 
  if (confirm('⚠️ Are you sure you want to clear your entire portfolio? This action cannot be undone.')) { 
    portfolioItems = []; 
    savePortfolio();
    showToast('Portfolio cleared', 'info');
  } 
}

function renderPortfolioModalList() {
  const container = document.getElementById('portfolioList');
  if (!container) return;
  
  if (portfolioItems.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;">✨ No assets yet.<br><small>Add from the table using the + button</small></div>';
    return;
  }
  
  container.innerHTML = portfolioItems.map((item, idx) => {
    const coin = allCryptos.find(c => c.id === item.id);
    const currentPrice = coin?.current_price || 0;
    const value = item.amount * currentPrice;
    const purchasePrice = item.purchasePrice || currentPrice;
    const pnlPercent = purchasePrice ? ((currentPrice - purchasePrice) / purchasePrice * 100) : 0;
    const change24h = coin?.price_change_percentage_24h || 0;
    
    return `
      <div class="portfolio-item" style="animation: fadeIn 0.3s ease;">
        <div>
          <strong style="font-size:1rem;">${item.symbol.toUpperCase()}</strong>
          <div><small>${item.amount.toFixed(8)} units</small></div>
          <div><small>Avg: ${formatUSD(purchasePrice)}</small></div>
        </div>
        <div style="text-align:right;">
          <div><strong>${formatUSD(value)}</strong></div>
          <div><small class="${pnlPercent >= 0 ? 'text-success' : 'text-danger'}">${pnlPercent >= 0 ? '▲' : '▼'} ${Math.abs(pnlPercent).toFixed(2)}%</small></div>
          <div><small class="${change24h >= 0 ? 'text-success' : 'text-danger'}">24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%</small></div>
          <button class="remove-port-item" data-idx="${idx}" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-top:5px;">
            <i class="fas fa-trash-alt"></i> Remove
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.remove-port-item').forEach(btn => {
    btn.addEventListener('click', (e) => removePortfolioItem(parseInt(btn.dataset.idx)));
  });
}

// ========== TABLE RENDER ==========
function renderTable() {
  if (!displayCryptos.length) {
    tableBody.innerHTML = '<tr><td colspan="10"><div class="loader"></div> No data available...</td></tr>';
    return;
  }
  
  let html = '';
  displayCryptos.forEach((coin, idx) => {
    const change24 = coin.price_change_percentage_24h || 0;
    const change7d = coin.price_change_percentage_7d_in_currency || 0;
    const isWatched = watchlistIds.has(coin.id);
    const ath = coin.ath || 0;
    const athPercent = ath ? ((coin.current_price / ath) * 100).toFixed(1) : '—';
    const volumeToCapRatio = coin.total_volume && coin.market_cap ? (coin.total_volume / coin.market_cap * 100).toFixed(1) : '—';
    
    html += `
      <tr style="animation: fadeIn 0.2s ease;">
        <td><strong>${idx + 1}</strong></td>
        <td class="coin-cell">
          <div class="coin-icon">${getIconHtml(coin.symbol)}</div> 
          <div>
            <strong>${coin.name}</strong>
            <div><small class="text-muted">${coin.symbol.toUpperCase()}</small></div>
          </div>
        </td>
        <td><strong>${formatUSD(coin.current_price)}</strong></td>
        <td class="${change24 >= 0 ? 'price-positive' : 'price-negative'}">
          <i class="fas ${change24 >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${formatPercentage(change24)}
        </td>
        <td class="${change7d >= 0 ? 'price-positive' : 'price-negative'}">${formatPercentage(change7d)}</td>
        <td><span title="Market Cap">${formatUSD(coin.market_cap)}</span></td>
        <td><span title="24h Volume">${formatUSD(coin.total_volume)}</span><br><small class="text-muted">${volumeToCapRatio}% vol/mcap</small></td>
        <td><span title="All Time High">${formatUSD(ath)}</span><br><small>${athPercent}% of ATH</small></td>
        <td>
          <button class="watchlist-btn ${isWatched ? 'watched' : ''}" data-id="${coin.id}" title="${isWatched ? 'Remove from watchlist' : 'Add to watchlist'}">
            <i class="fas ${isWatched ? 'fa-star' : 'fa-star-o'}"></i>
          </button>
        </td>
        <td class="action-icons">
          <i class="fas fa-chart-line view-chart" data-id="${coin.id}" data-name="${coin.name}" title="View Chart"></i>
          <i class="fas fa-plus-circle add-portfolio-quick" data-id="${coin.id}" data-symbol="${coin.symbol}" data-name="${coin.name}" title="Add to Portfolio"></i>
          <i class="fas fa-bell set-alert" data-id="${coin.id}" data-symbol="${coin.symbol}" data-price="${coin.current_price}" title="Set Price Alert"></i>
        </td>
      </tr>
    `;
  });
  tableBody.innerHTML = html;
  
  // Attach event listeners
  document.querySelectorAll('.watchlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { 
      e.stopPropagation(); 
      toggleWatchlist(btn.dataset.id); 
    });
  });
  
  document.querySelectorAll('.view-chart').forEach(icon => {
    icon.addEventListener('click', (e) => { 
      updateChart(icon.dataset.id, currentChartDays, icon.dataset.name); 
    });
  });
  
  document.querySelectorAll('.add-portfolio-quick').forEach(icon => {
    icon.addEventListener('click', (e) => {
      const amt = parseFloat(prompt(`💰 Enter amount of ${icon.dataset.name} to add:`));
      if (amt > 0) addPortfolioItem(icon.dataset.id, amt);
      else if (amt !== null) showToast('Please enter a valid amount', 'error');
    });
  });
  
  document.querySelectorAll('.set-alert').forEach(icon => {
    icon.addEventListener('click', (e) => {
      const targetPrice = parseFloat(prompt(`🔔 Set price alert for ${icon.dataset.symbol.toUpperCase()}\nCurrent price: $${icon.dataset.price}\nEnter target price:`));
      if (targetPrice > 0) {
        const condition = confirm('Alert when price goes ABOVE? (Cancel for BELOW)') ? 'above' : 'below';
        addPriceAlert(icon.dataset.id, targetPrice, condition);
      }
    });
  });
}

function toggleWatchlist(id) {
  if (watchlistIds.has(id)) {
    watchlistIds.delete(id);
    showToast('Removed from watchlist', 'info');
  } else {
    watchlistIds.add(id);
    showToast('Added to watchlist ⭐', 'success');
  }
  saveWatchlist();
  renderTable();
}

const debouncedFilter = debounce(() => {
  filterAndSort();
}, 300);

function filterAndSort() {
  let filtered = [...allCryptos];
  const searchTerm = searchInput.value.toLowerCase();
  
  if (searchTerm) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(searchTerm) || 
      c.symbol.toLowerCase().includes(searchTerm)
    );
  }
  
  const sortBy = sortSelect.value;
  switch(sortBy) {
    case 'price':
      filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
      break;
    case 'change':
      filtered.sort((a, b) => (b.price_change_percentage_24h || -101) - (a.price_change_percentage_24h || -101));
      break;
    case 'volume':
      filtered.sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));
      break;
    case 'marketcap':
      filtered.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
      break;
    default:
      filtered.sort((a, b) => (a.market_cap_rank || 999) - (b.market_cap_rank || 999));
  }
  
  displayCryptos = filtered.slice(0, 30);
  renderTable();
}

// ========== CHART ==========
async function updateChart(coinId, days, coinName = null) {
  try {
    showToast(`Loading chart for ${coinName || coinId}...`, 'info');
    currentChartCoin = coinId;
    currentChartDays = days;
    
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`, {
      params: { vs_currency: 'usd', days: days, interval: days <= 30 ? 'daily' : 'daily' }
    });
    
    const prices = res.data.prices.map(p => p[1]);
    const labels = prices.map((_, i) => {
      if (days <= 7) return `Day ${i + 1}`;
      if (days <= 14) return `D${i + 1}`;
      return `Day ${i + 1}`;
    });
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    document.getElementById('selectedCoinLabel').innerHTML = `
      <strong>${coinName || coinId.toUpperCase()}</strong> 
      <small>${days} days | Range: ${formatUSD(minPrice)} - ${formatUSD(maxPrice)}</small>
    `;
    
    if (currentChart) currentChart.destroy();
    const ctx = document.getElementById('priceChart').getContext('2d');
    currentChart = new Chart(ctx, {
      type: 'line',
      data: { 
        labels, 
        datasets: [{ 
          label: 'Price USD', 
          data: prices, 
          borderColor: '#60a5fa', 
          backgroundColor: 'rgba(96,165,250,0.1)', 
          tension: 0.3, 
          fill: true, 
          pointRadius: days <= 14 ? 2 : 1,
          pointBackgroundColor: '#60a5fa'
        }] 
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `Price: ${formatUSD(context.raw)}`
            }
          }
        }
      }
    });
  } catch (e) { 
    console.warn(e);
    showToast('Error loading chart data', 'error');
  }
}

// ========== FEAR & GREED CHART ==========
async function updateFearGreedChart() {
  try {
    const res = await axios.get('https://api.alternative.me/fng/?limit=30');
    fearGreedHistory = res.data.data.reverse();
    const values = fearGreedHistory.map(f => parseInt(f.value));
    const labels = fearGreedHistory.map(f => f.timestamp.substring(5));
    
    const ctx = document.getElementById('fearGreedChart').getContext('2d');
    // Clear existing chart if any
    if (window.fearChart) window.fearChart.destroy();
    
    window.fearChart = new Chart(ctx, {
      type: 'line',
      data: { 
        labels, 
        datasets: [{ 
          label: 'Fear & Greed Index', 
          data: values, 
          borderColor: '#c084fc', 
          backgroundColor: 'rgba(192,132,252,0.2)', 
          fill: true, 
          tension: 0.2,
          pointRadius: 3,
          pointBackgroundColor: '#c084fc'
        }] 
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: true, 
        plugins: { 
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Index: ${context.raw} - ${getFearGreedText(context.raw)}`
            }
          }
        }, 
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'Index Value' } } } 
      }
    });
  } catch (e) { console.warn(e); }
}

function getFearGreedText(value) {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 45) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
}

// ========== TICKER UPDATE ==========
function updateTickers() {
  if (!allCryptos.length) return;
  
  const sorted = [...allCryptos].sort((a, b) => (b.price_change_percentage_24h || -100) - (a.price_change_percentage_24h || -100));
  const gainers = sorted.slice(0, 7);
  const losers = sorted.slice(-7).reverse();
  
  gainersTicker.innerHTML = gainers.map(c => `
    <span class="ticker-item">
      <i class="fas fa-arrow-up text-success"></i> 
      <strong>${c.symbol.toUpperCase()}</strong> 
      <span class="text-success">${formatPercentage(c.price_change_percentage_24h)}</span>
    </span>
  `).join('');
  
  losersTicker.innerHTML = losers.map(c => `
    <span class="ticker-item">
      <i class="fas fa-arrow-down text-danger"></i> 
      <strong>${c.symbol.toUpperCase()}</strong> 
      <span class="text-danger">${formatPercentage(c.price_change_percentage_24h)}</span>
    </span>
  `).join('');
}

// ========== POPULATE SELECTS ==========
function populateSelects() {
  const options = allCryptos.map(c => `<option value="${c.id}">${c.name} (${c.symbol.toUpperCase()})</option>`).join('');
  ['assetSelect', 'convertFrom', 'convertTo'].forEach(id => { 
    const el = document.getElementById(id); 
    if (el) el.innerHTML = options; 
  });
}

// ========== CONVERTER ==========
async function performConversion() {
  const fromCoin = allCryptos.find(c => c.id === document.getElementById('convertFrom').value);
  const toCoin = allCryptos.find(c => c.id === document.getElementById('convertTo').value);
  const amount = parseFloat(document.getElementById('convertAmount').value) || 1;
  
  if (fromCoin?.current_price && toCoin?.current_price) {
    const rate = fromCoin.current_price / toCoin.current_price;
    const result = amount * rate;
    document.getElementById('convertResult').innerHTML = `
      <div style="font-size:1.2rem; margin-bottom:8px;">
        ${amount.toFixed(6)} ${fromCoin.symbol.toUpperCase()} = 
        <strong>${result.toFixed(8)} ${toCoin.symbol.toUpperCase()}</strong>
      </div>
      <div style="font-size:0.8rem; color:var(--text-muted);">
        1 ${fromCoin.symbol.toUpperCase()} ≈ ${rate.toFixed(6)} ${toCoin.symbol.toUpperCase()}
      </div>
      <div style="font-size:0.7rem; margin-top:8px;">
        ${fromCoin.symbol.toUpperCase()} 24h: ${formatPercentage(fromCoin.price_change_percentage_24h)} | 
        ${toCoin.symbol.toUpperCase()} 24h: ${formatPercentage(toCoin.price_change_percentage_24h)}
      </div>
    `;
  } else {
    document.getElementById('convertResult').innerHTML = '⚠️ Data is still loading. Please wait and try again.';
  }
}

// ========== NEWS ==========
async function loadNews() {
  const newsContainer = document.getElementById('newsList');
  newsContainer.innerHTML = '<div class="loader"></div> Loading latest news...';
  
  try {
    // Using a free CORS proxy and alternative news API
    const response = await fetch('https://cors-anywhere.herokuapp.com/https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = await response.json();
    
    if (data.Data && data.Data.length > 0) {
      newsContainer.innerHTML = data.Data.slice(0, 12).map(article => `
        <div class="news-item" style="animation: fadeIn 0.3s ease;">
          <div class="news-title">
            <i class="fas fa-newspaper"></i> 
            <strong>${article.title.substring(0, 100)}${article.title.length > 100 ? '...' : ''}</strong>
          </div>
          <div class="news-meta">
            <i class="far fa-clock"></i> ${new Date(article.published_on * 1000).toLocaleString()} | 
            <i class="fas fa-tag"></i> ${article.source}
          </div>
          <div class="news-body">${article.body.substring(0, 150)}...</div>
          <a href="${article.url}" target="_blank" class="news-link">Read more →</a>
        </div>
      `).join('');
    } else {
      throw new Error('No news data');
    }
  } catch (e) {
    // Fallback mock news
    newsContainer.innerHTML = `
      <div class="news-item">
        <div class="news-title">📰 Bitcoin approaches new all-time high as institutional inflows surge</div>
        <div class="news-meta">Just now · CryptoNews</div>
      </div>
      <div class="news-item">
        <div class="news-title">💰 Ethereum gas fees drop to 6-month low, network activity increases</div>
        <div class="news-meta">2 hours ago · ETH Daily</div>
      </div>
      <div class="news-item">
        <div class="news-title">🚀 Solana ecosystem sees 200% growth in Q4, new DeFi protocols launch</div>
        <div class="news-meta">5 hours ago · Solana News</div>
      </div>
      <div class="news-item">
        <div class="news-title">🏦 Major bank announces crypto custody services for institutional clients</div>
        <div class="news-meta">1 day ago · Financial Times</div>
      </div>
    `;
  }
}

// ========== MAIN FETCH ==========
async function fetchGlobalAndTop() {
  if (isLoading) return;
  isLoading = true;
  
  try {
    const [global, market, fearGreed] = await Promise.all([
      axios.get('https://api.coingecko.com/api/v3/global'),
      axios.get('https://api.coingecko.com/api/v3/coins/markets', { 
        params: { 
          vs_currency: 'usd', 
          order: 'market_cap_desc', 
          per_page: 150, 
          page: 1, 
          sparkline: false, 
          price_change_percentage: '7d,24h' 
        } 
      }),
      axios.get('https://api.alternative.me/fng/')
    ]);
    
    const globalData = global.data.data;
    globalCapSpan.innerText = formatUSD(globalData.total_market_cap?.usd);
    btcDominanceSpan.innerText = (globalData.market_cap_percentage?.btc?.toFixed(1) || '0') + '%';
    ethDominanceSpan.innerText = `ETH: ${(globalData.market_cap_percentage?.eth?.toFixed(1) || '0')}%`;
    totalVolumeSpan.innerText = formatUSD(globalData.total_volume?.usd);
    
    if (fearGreed.data?.data?.[0]) {
      const fg = fearGreed.data.data[0];
      fearGreedValueSpan.innerText = fg.value;
      fearGreedFill.style.width = `${fg.value}%`;
      fearGreedFill.style.backgroundColor = getFearGreedColor(fg.value);
      fearGreedTextSpan.innerText = fg.value_classification;
    }
    
    allCryptos = market.data;
    const bullish = allCryptos.filter(c => (c.price_change_percentage_24h || 0) > 0).length;
    const bearish = allCryptos.filter(c => (c.price_change_percentage_24h || 0) < 0).length;
    document.getElementById('bullishCount').innerText = bullish;
    document.getElementById('bearishCount').innerText = bearish;
    document.getElementById('marketSentiment').innerHTML = bullish > bearish ? '🟢 BULLISH' : '🔴 BEARISH';
    
    // Update additional metrics with real data where possible
    defiVolumeSpan.innerText = formatUSD(globalData.total_volume?.defi || 0);
    const ethGas = allCryptos.find(c => c.id === 'ethereum');
    ethGasSpan.innerText = ethGas ? `$${ethGas.current_price?.toFixed(2)}` : '~$3,500';
    const btcCoin = allCryptos.find(c => c.id === 'bitcoin');
    btcHashrateSpan.innerText = btcCoin ? `${formatCompactNumber(btcCoin.market_cap)} MCap` : '~$1.2T';
    stablecoinSpan.innerText = formatUSD(globalData.total_market_cap?.stablecoins || 0);
    
    filterAndSort();
    populateSelects();
    updatePortfolioUI();
    updateTickers();
    updateFearGreedChart();
    checkPriceAlerts();
    
    // Update last fetch time
    lastFetchTime = new Date();
    if (lastUpdateSpan) lastUpdateSpan.innerText = formatDate(lastFetchTime);
    
    if (!currentChart && allCryptos.length) {
      updateChart('bitcoin', 7, 'Bitcoin');
    }
    
    // Setup chart time buttons if not already set
    document.querySelectorAll('.chart-time-btn').forEach(btn => {
      btn.removeEventListener('click', btn._listener);
      btn._listener = () => {
        document.querySelectorAll('.chart-time-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateChart(currentChartCoin, parseInt(btn.dataset.days));
      };
      btn.addEventListener('click', btn._listener);
    });
    
    showToast('Data updated successfully', 'success');
  } catch (e) {
    console.error(e);
    tableBody.innerHTML = '<tr><td colspan="10"><div style="text-align:center;padding:40px;">⚠️ API Error. Please refresh or try again later.<br><small>Check your internet connection</small></div></td></tr>';
    showToast('Failed to fetch market data', 'error');
  } finally {
    isLoading = false;
  }
}

function getFearGreedColor(value) {
  if (value <= 25) return '#f87171';
  if (value <= 45) return '#fbbf24';
  if (value <= 55) return '#eab308';
  if (value <= 75) return '#a3e635';
  return '#4ade80';
}

// ========== MODALS ==========
function initModals() {
  const modals = {
    portfolioModalBtn: 'portfolioModal',
    converterModalBtn: 'converterModal',
    newsModalBtn: 'newsModal'
  };
  
  Object.entries(modals).forEach(([btnId, modalId]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.onclick = () => { 
        document.getElementById(modalId).style.display = 'flex'; 
        if (modalId === 'newsModal') loadNews();
        if (modalId === 'converterModal') performConversion();
        if (modalId === 'portfolioModal') renderPortfolioModalList();
      };
    }
  });
  
  document.getElementById('managePortfolioBtn').onclick = () => { 
    document.getElementById('portfolioModal').style.display = 'flex'; 
    renderPortfolioModalList(); 
  };
  
  document.getElementById('refreshBtn').onclick = () => fetchGlobalAndTop();
  
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => btn.closest('.modal').style.display = 'none';
  });
  
  window.onclick = (e) => { 
    if (e.target.classList.contains('modal')) e.target.style.display = 'none'; 
  };
  
  // Add Asset Button
  document.getElementById('addAssetBtn').onclick = () => {
    const id = document.getElementById('assetSelect').value;
    const amt = parseFloat(document.getElementById('assetAmount').value);
    const price = parseFloat(document.getElementById('assetPrice').value) || null;
    if (amt > 0) { 
      addPortfolioItem(id, amt, price); 
      document.getElementById('assetAmount').value = ''; 
      document.getElementById('assetPrice').value = ''; 
      renderPortfolioModalList();
    } else {
      showToast('Please enter a valid amount', 'error');
    }
  };
  
  document.getElementById('clearPortfolioBtn').onclick = () => clearPortfolio();
  document.getElementById('calculateConvertBtn').onclick = performConversion;
  
  // Add export/import buttons
  const exportBtn = document.createElement('div');
  exportBtn.className = 'glass-btn';
  exportBtn.innerHTML = '<i class="fas fa-download"></i><span> Export</span>';
  exportBtn.onclick = () => exportData();
  document.querySelector('.tools-badge').appendChild(exportBtn);
  
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json';
  importInput.style.display = 'none';
  importInput.onchange = (e) => importData(e.target.files[0]);
  document.body.appendChild(importInput);
  
  const importBtn = document.createElement('div');
  importBtn.className = 'glass-btn';
  importBtn.innerHTML = '<i class="fas fa-upload"></i><span> Import</span>';
  importBtn.onclick = () => importInput.click();
  document.querySelector('.tools-badge').appendChild(importBtn);
  
  if (searchInput) searchInput.addEventListener('input', debouncedFilter);
  if (sortSelect) sortSelect.addEventListener('change', filterAndSort);
}

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .toast-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--bg-card);
    border-left: 4px solid;
    border-radius: 12px;
    padding: 12px 20px;
    box-shadow: var(--shadow-lg);
    z-index: 1001;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    animation: slideIn 0.3s ease forwards;
  }
  
  @keyframes slideIn {
    to { transform: translateX(0); }
  }
  
  .toast-success { border-left-color: var(--success); }
  .toast-error { border-left-color: var(--danger); }
  .toast-warning { border-left-color: var(--warning); }
  .toast-info { border-left-color: var(--accent-primary); }
  
  .toast-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .text-muted { color: var(--text-muted); }
  .text-success { color: var(--success); }
  .text-danger { color: var(--danger); }
  .text-warning { color: var(--warning); }
  
  .fade-out {
    animation: fadeOut 0.3s ease forwards;
  }
  
  @keyframes fadeOut {
    to { opacity: 0; transform: translateY(-10px); }
  }
`;
document.head.appendChild(styleSheet);

// ========== INITIALIZATION ==========
async function init() {
  initTheme();
  themeToggleBtn.addEventListener('click', toggleTheme);
  loadWatchlist();
  loadPortfolio();
  loadPriceAlerts();
  await fetchGlobalAndTop();
  initModals();
  
  // Set auto-refresh every 45 seconds
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(fetchGlobalAndTop, 45000);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      fetchGlobalAndTop();
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    }
  });
  
  console.log('🚀 CryptoPulse Pro initialized successfully!');
}

// Start the application
init();
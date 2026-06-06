/**
 * Симулятор Ларька — основная логика игры
 * Склад, покупатели, локации, события и экономика
 */

// ===== Каталог товаров =====
const PRODUCTS = [
  // Базовые — Окраина города
  { id: 'bread',    name: 'Хлеб',      emoji: '🍞', buyPrice: 5,  sellPrice: 10,  category: 'basic',      unlockLocation: 'outskirts' },
  { id: 'milk',     name: 'Молоко',    emoji: '🥛', buyPrice: 10, sellPrice: 20,  category: 'basic',      unlockLocation: 'outskirts' },
  { id: 'sausage',  name: 'Колбаса',   emoji: '🥩', buyPrice: 20, sellPrice: 40,  category: 'basic',      unlockLocation: 'outskirts' },
  { id: 'apples',   name: 'Яблоки',    emoji: '🍏', buyPrice: 8,  sellPrice: 15,  category: 'basic',      unlockLocation: 'outskirts' },
  // Пляжные — Спальный район
  { id: 'icecream', name: 'Мороженое', emoji: '🍦', buyPrice: 15, sellPrice: 35,  category: 'beach',      unlockLocation: 'residential' },
  { id: 'soda',     name: 'Газировка', emoji: '🥤', buyPrice: 12, sellPrice: 30,  category: 'beach',      unlockLocation: 'residential' },
  // Стрит-фуд — Центр города
  { id: 'shawarma', name: 'Шаурма',    emoji: '🌯', buyPrice: 30, sellPrice: 80,  category: 'streetfood', unlockLocation: 'center' },
  { id: 'coffee',   name: 'Кофе',      emoji: '☕', buyPrice: 18, sellPrice: 50,  category: 'streetfood', unlockLocation: 'center' },
  // Элитные — Торговый центр
  { id: 'cake',     name: 'Торт',      emoji: '🍰', buyPrice: 60, sellPrice: 200, category: 'elite',      unlockLocation: 'mall' },
  { id: 'sushi',    name: 'Суши',      emoji: '🍣', buyPrice: 80, sellPrice: 280, category: 'elite',      unlockLocation: 'mall' },
];

// ===== Локации =====
const LOCATIONS = [
  {
    id: 'outskirts',
    name: 'Окраина города',
    icon: '🏚️',
    cost: 0,
    multiplier: 1,
    theme: 'outskirts',
    description: 'Стартовая точка. Базовые товары.',
  },
  {
    id: 'residential',
    name: 'Спальный район',
    icon: '🏘️',
    cost: 1000,
    multiplier: 1.5,
    theme: 'residential',
    description: 'Открывает пляжные товары: мороженое и газировку.',
  },
  {
    id: 'center',
    name: 'Центр города',
    icon: '🏙️',
    cost: 5000,
    multiplier: 2.5,
    theme: 'center',
    description: 'Открывает стрит-фуд: шаурму и кофе.',
  },
  {
    id: 'mall',
    name: 'Торговый центр',
    icon: '🏬',
    cost: 10000,
    multiplier: 4,
    theme: 'mall',
    description: 'Открывает элитные товары: торт и суши.',
  },
];

// Названия категорий для отображения в закупке
const CATEGORY_NAMES = {
  basic: 'Базовые товары',
  beach: 'Пляжные товары',
  streetfood: 'Стрит-фуд',
  elite: 'Элитные товары',
};

// Приветствия покупателей
const GREETINGS = [
  'Здравствуйте! Мне, пожалуйста...',
  'Добрый день! Хочу купить...',
  'Привет! Можно мне...',
  'Здрасте! Дайте, пожалуйста...',
  'Доброе утро! Нужно вот это...',
];

// Случайные текстовые события
const RANDOM_EVENTS = [
  {
    id: 'sanitary',
    icon: '🏥',
    title: 'Проверка санэпидемстанции!',
    text: 'Проверка санэпидемстанции! Вы заплатили штраф 100$.',
    apply(state) {
      state.balance = Math.max(0, state.balance - 100);
    },
  },
  {
    id: 'grandpa',
    icon: '📦',
    title: 'Посылка от дедушки!',
    text: 'Дедушка прислал посылку из деревни! Склад пополнился продуктами (+3 шт. каждого доступного товара).',
    apply(state) {
      getUnlockedProducts().forEach(p => {
        state.stock[p.id] = (state.stock[p.id] || 0) + 3;
      });
    },
  },
  {
    id: 'heatwave',
    icon: '☀️',
    title: 'Жара на улице!',
    text: 'Жара на улице! Мороженое и газировка временно продаются с двойной наценкой! (60 секунд)',
    apply(state) {
      state.heatWaveActive = true;
      state.heatWaveEndsAt = Date.now() + 60000;
    },
  },
];

// ===== Константы =====
const START_BALANCE = 500;
const START_LOCATION_ID = 'outskirts';
const MIN_ORDER_ITEMS = 1;
const MAX_ORDER_ITEMS = 3;
const MIN_ITEM_QTY = 1;
const MAX_ITEM_QTY = 3;
const CUSTOMER_DELAY_MIN = 2000;
const CUSTOMER_DELAY_MAX = 3000;
const RUSH_HOUR_DELAY = 500;
const RUSH_HOUR_INTERVAL = 3 * 60 * 1000;   // 3 минуты
const RUSH_HOUR_DURATION = 45 * 1000;        // 45 секунд
const RUSH_HOUR_BONUS = 0.20;                // +20% к выручке
const RANDOM_EVENT_INTERVAL = 2 * 60 * 1000; // 2 минуты

// ===== Пауза игры (случайное событие) =====
let isPaused = false;
let pauseStartedAt = 0;

// ===== Состояние игры =====
const gameState = {
  balance: START_BALANCE,
  stock: {},
  counter: [],
  customer: null,
  isProcessing: false,
  hasError: false,
  gameStarted: false,
  currentLocationId: START_LOCATION_ID,
  unlockedLocations: [START_LOCATION_ID],

  // События
  isRushHour: false,
  rushHourEndsAt: 0,
  nextRushHourAt: 0,
  nextRandomEventAt: 0,
  heatWaveActive: false,
  heatWaveEndsAt: 0,
  pendingRandomEvent: null,
  eventTimerInterval: null,
};

// ===== DOM-элементы =====
const elIntroScreen = document.getElementById('intro-screen');
const elGameWrapper = document.getElementById('game-wrapper');
const elBalance = document.getElementById('balance');
const elCurrentLocation = document.getElementById('current-location');
const elWarehouse = document.getElementById('warehouse');
const elCounter = document.getElementById('counter');
const elClearCounter = document.getElementById('btn-clear-counter');
const elCustomerAvatar = document.getElementById('customer-avatar');
const elCustomerSpeech = document.getElementById('customer-speech');
const elCustomerOrder = document.getElementById('customer-order');
const elPurchaseModal = document.getElementById('purchase-modal');
const elPurchaseList = document.getElementById('purchase-list');
const elLocationModal = document.getElementById('location-modal');
const elLocationList = document.getElementById('location-list');
const elBankruptModal = document.getElementById('bankrupt-modal');
const elRushHourBanner = document.getElementById('rush-hour-banner');
const elEventTimer = document.getElementById('event-timer');
const elRushTimer = document.getElementById('rush-timer');
const elEventTimerValue = document.getElementById('event-timer-value');
const elRandomEventModal = document.getElementById('random-event-modal');
const elEventIcon = document.getElementById('event-icon');
const elEventTitle = document.getElementById('event-title');
const elEventText = document.getElementById('event-text');

// ===== Инициализация =====

/** Создаёт пустой склад для всех товаров */
function createEmptyStock() {
  const stock = {};
  PRODUCTS.forEach(p => { stock[p.id] = 0; });
  return stock;
}

/** Запуск при загрузке страницы */
function initGame() {
  gameState.stock = createEmptyStock();
  bindEvents();
  applyLocationTheme();
  updateUI();
}

/** Начало игры после предыстории */
function startGame() {
  if (gameState.gameStarted) return;

  elIntroScreen.classList.add('fade-out');

  setTimeout(() => {
    elIntroScreen.classList.add('hidden');
    elGameWrapper.classList.remove('hidden');
    elGameWrapper.classList.add('appearing');
    elEventTimer.classList.remove('hidden');

    gameState.gameStarted = true;

    // Запускаем таймеры событий
    const now = Date.now();
    gameState.nextRushHourAt = now + RUSH_HOUR_INTERVAL;
    gameState.nextRandomEventAt = now + RANDOM_EVENT_INTERVAL;
    startEventTimers();

    spawnCustomer();
  }, 700);
}

/** Сброс игры после банкротства */
function resetGame() {
  stopEventTimers();

  gameState.balance = START_BALANCE;
  gameState.stock = createEmptyStock();
  gameState.counter = [];
  gameState.customer = null;
  gameState.isProcessing = false;
  gameState.hasError = false;
  gameState.currentLocationId = START_LOCATION_ID;
  gameState.unlockedLocations = [START_LOCATION_ID];
  gameState.isRushHour = false;
  gameState.heatWaveActive = false;
  gameState.pendingRandomEvent = null;

  const now = Date.now();
  gameState.nextRushHourAt = now + RUSH_HOUR_INTERVAL;
  gameState.nextRandomEventAt = now + RANDOM_EVENT_INTERVAL;

  elBankruptModal.classList.add('hidden');
  elRushHourBanner.classList.add('hidden');
  elRandomEventModal.classList.add('hidden');
  document.body.classList.remove('rush-hour-active');

  isPaused = false;
  pauseStartedAt = 0;

  applyLocationTheme();
  startEventTimers();
  updateUI();
  spawnCustomer();
}

// ===== Система событий =====

/** Запускает интервал обновления таймеров и проверки событий */
function startEventTimers() {
  stopEventTimers();
  updateEventTimersDisplay();
  gameState.eventTimerInterval = setInterval(tickEvents, 1000);
}

/** Останавливает интервал событий */
function stopEventTimers() {
  if (gameState.eventTimerInterval) {
    clearInterval(gameState.eventTimerInterval);
    gameState.eventTimerInterval = null;
  }
}

/** Ставит игру на паузу (таймеры и покупатели замирают) */
function pauseGame() {
  if (isPaused) return;
  isPaused = true;
  pauseStartedAt = Date.now();
}

/** Снимает паузу и сдвигает дедлайны на время простоя */
function resumeGame() {
  if (!isPaused) return;

  const pauseDuration = Date.now() - pauseStartedAt;

  if (gameState.isRushHour) {
    gameState.rushHourEndsAt += pauseDuration;
  } else {
    gameState.nextRushHourAt += pauseDuration;
  }

  gameState.nextRandomEventAt += pauseDuration;

  if (gameState.heatWaveActive) {
    gameState.heatWaveEndsAt += pauseDuration;
  }

  isPaused = false;
  pauseStartedAt = 0;
}

/** Ждёт снятия паузы, затем выполняет callback */
function waitUntilResumed(callback) {
  if (isPaused) {
    setTimeout(() => waitUntilResumed(callback), 200);
    return;
  }
  callback();
}

/** Каждую секунду: обновление таймеров, проверка «Часа пик» и жары */
function tickEvents() {
  if (!gameState.gameStarted) return;
  if (isPaused) return;

  const now = Date.now();

  // Завершение «Часа пик»
  if (gameState.isRushHour && now >= gameState.rushHourEndsAt) {
    endRushHour();
  }

  // Завершение жары
  if (gameState.heatWaveActive && now >= gameState.heatWaveEndsAt) {
    gameState.heatWaveActive = false;
    updateUI();
  }

  // Старт «Часа пик»
  if (!gameState.isRushHour && now >= gameState.nextRushHourAt) {
    startRushHour();
  }

  // Случайное событие (не показываем, если уже открыта карточка)
  if (!gameState.pendingRandomEvent &&
      elRandomEventModal.classList.contains('hidden') &&
      now >= gameState.nextRandomEventAt) {
    triggerRandomEvent();
  }

  updateEventTimersDisplay();
}

/** Запуск события «Час пик» */
function startRushHour() {
  gameState.isRushHour = true;
  gameState.rushHourEndsAt = Date.now() + RUSH_HOUR_DURATION;

  elRushHourBanner.classList.remove('hidden');
  document.body.classList.add('rush-hour-active');
}

/** Завершение «Часа пик» */
function endRushHour() {
  gameState.isRushHour = false;
  gameState.nextRushHourAt = Date.now() + RUSH_HOUR_INTERVAL;

  elRushHourBanner.classList.add('hidden');
  document.body.classList.remove('rush-hour-active');
}

/** Запуск случайного текстового события */
function triggerRandomEvent() {
  const event = RANDOM_EVENTS[randomInt(0, RANDOM_EVENTS.length - 1)];
  gameState.pendingRandomEvent = event;

  pauseGame();

  elEventIcon.textContent = event.icon;
  elEventTitle.textContent = event.title;
  elEventText.textContent = event.text;
  elRandomEventModal.classList.remove('hidden');
}

/** Закрытие карточки события и применение эффекта */
function dismissRandomEvent() {
  if (gameState.pendingRandomEvent) {
    gameState.pendingRandomEvent.apply(gameState);
    gameState.pendingRandomEvent = null;

    elBalance.classList.add('updated');
    setTimeout(() => elBalance.classList.remove('updated'), 500);

    updateUI();
    checkBankruptcy();
  }

  resumeGame();
  gameState.nextRandomEventAt = Date.now() + RANDOM_EVENT_INTERVAL;

  elRandomEventModal.classList.add('hidden');
  updateEventTimersDisplay();
}

/** Обновляет отображение таймеров в углу экрана */
function updateEventTimersDisplay() {
  if (!gameState.gameStarted) return;

  const now = Date.now();

  if (gameState.isRushHour) {
    elRushTimer.textContent = formatTime(Math.max(0, gameState.rushHourEndsAt - now));
    elRushTimer.classList.add('active-now');
  } else {
    elRushTimer.textContent = formatTime(Math.max(0, gameState.nextRushHourAt - now));
    elRushTimer.classList.remove('active-now');
  }

  elEventTimerValue.textContent = formatTime(Math.max(0, gameState.nextRandomEventAt - now));
}

/** Форматирует миллисекунды в M:SS */
function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Возвращает задержку до следующего покупателя */
function getCustomerDelay() {
  if (gameState.isRushHour) return RUSH_HOUR_DELAY;
  return randomInt(CUSTOMER_DELAY_MIN, CUSTOMER_DELAY_MAX);
}

// ===== Товары и локации =====

/** Находит товар по id */
function getProduct(id) {
  return PRODUCTS.find(p => p.id === id);
}

/** Находит локацию по id */
function getLocation(id) {
  return LOCATIONS.find(l => l.id === id);
}

/** Текущая локация */
function getCurrentLocation() {
  return getLocation(gameState.currentLocationId);
}

/** Разблокирована ли локация */
function isLocationUnlocked(locationId) {
  return gameState.unlockedLocations.includes(locationId);
}

/** Разблокирован ли товар (локация товара куплена) */
function isProductUnlocked(product) {
  return gameState.unlockedLocations.includes(product.unlockLocation);
}

/** Список доступных (разблокированных) товаров */
function getUnlockedProducts() {
  return PRODUCTS.filter(isProductUnlocked);
}

/** Название локации, на которой откроется товар */
function getUnlockLocationName(product) {
  const loc = getLocation(product.unlockLocation);
  return loc ? loc.name : '???';
}

/** Продажная цена с учётом локации, жары и прочего */
function getSellPrice(product) {
  const location = getCurrentLocation();
  let price = Math.round(product.sellPrice * location.multiplier);

  // Жара — двойная наценка на мороженое и газировку
  if (gameState.heatWaveActive && (product.id === 'icecream' || product.id === 'soda')) {
    price *= 2;
  }

  return price;
}

/** Применяет визуальную тему локации */
function applyLocationTheme() {
  const location = getCurrentLocation();
  const rushClass = gameState.isRushHour ? ' rush-hour-active' : '';
  document.body.className = `theme-${location.theme}${rushClass}`;
  elCurrentLocation.textContent = `Локация: ${location.name}`;
}

/** Переезд в другую локацию */
function moveToLocation(locationId) {
  if (locationId === gameState.currentLocationId) return;

  const location = getLocation(locationId);
  if (!location) return;

  if (!isLocationUnlocked(locationId)) {
    if (gameState.balance < location.cost) return;
    gameState.balance -= location.cost;
    gameState.unlockedLocations.push(locationId);

    elBalance.classList.add('updated');
    setTimeout(() => elBalance.classList.remove('updated'), 500);
  }

  gameState.currentLocationId = locationId;
  applyLocationTheme();
  updateUI();
  renderLocationList();
}

// ===== Покупатели =====

/** Генерирует случайный заказ из доступных товаров */
function generateOrder() {
  const available = getUnlockedProducts();
  if (available.length === 0) return [];

  const itemCount = randomInt(MIN_ORDER_ITEMS, Math.min(MAX_ORDER_ITEMS, available.length));
  const shuffled = shuffleArray([...available]);
  const selected = shuffled.slice(0, itemCount);

  return selected.map(product => ({
    productId: product.id,
    quantity: randomInt(MIN_ITEM_QTY, MAX_ITEM_QTY),
  }));
}

/** Создаёт нового покупателя */
function spawnCustomer() {
  if (gameState.isProcessing || !gameState.gameStarted) return;
  if (isPaused) {
    setTimeout(spawnCustomer, 200);
    return;
  }

  const order = generateOrder();
  if (order.length === 0) return;

  const greeting = GREETINGS[randomInt(0, GREETINGS.length - 1)];

  gameState.customer = {
    order,
    speech: greeting,
    isThanking: false,
  };

  gameState.counter = [];
  gameState.hasError = false;

  elCustomerAvatar.classList.remove('leaving');
  elCustomerAvatar.classList.add('arriving');
  setTimeout(() => elCustomerAvatar.classList.remove('arriving'), 500);

  updateUI();
  checkBankruptcy();
}

/** Завершение заказа — оплата и уход покупателя */
function completeOrder() {
  if (gameState.isProcessing || !gameState.customer) return;

  gameState.isProcessing = true;

  let earnings = 0;
  gameState.customer.order.forEach(item => {
    const product = getProduct(item.productId);
    earnings += getSellPrice(product) * item.quantity;
  });

  // Бонус +20% во время «Часа пик»
  if (gameState.isRushHour) {
    earnings = Math.round(earnings * (1 + RUSH_HOUR_BONUS));
  }

  gameState.balance += earnings;

  let thanksText = `Спасибо! Вот ${earnings}$ 💰`;
  if (gameState.isRushHour) {
    thanksText += ' ⚡(+20%)';
  }
  gameState.customer.speech = thanksText;
  gameState.customer.isThanking = true;

  elBalance.classList.add('updated');
  setTimeout(() => elBalance.classList.remove('updated'), 500);

  updateUI();

  setTimeout(() => {
    elCustomerAvatar.classList.add('leaving');

    setTimeout(() => {
      gameState.counter = [];
      gameState.customer = null;
      gameState.isProcessing = false;
      gameState.hasError = false;

      updateUI();

      const delay = getCustomerDelay();
      setTimeout(() => {
        waitUntilResumed(() => {
          if (!isBankrupt()) {
            spawnCustomer();
          }
        });
      }, delay);
    }, 600);
  }, 1500);
}

// ===== Механика стола и склада =====

/** Кладёт товар со склада на стол */
function placeOnCounter(productId) {
  if (gameState.isProcessing || !gameState.customer || gameState.hasError) return;
  if (!isProductUnlocked(getProduct(productId))) return;
  if (gameState.stock[productId] <= 0) return;

  gameState.stock[productId]--;
  gameState.counter.push(productId);

  validateCounter();
  updateUI();

  if (!gameState.hasError && isOrderComplete()) {
    completeOrder();
  }
}

/** Проверяет ошибки на столе */
function validateCounter() {
  if (!gameState.customer) {
    gameState.hasError = false;
    return;
  }

  const counterCounts = countItems(gameState.counter);
  const orderCounts = {};
  gameState.customer.order.forEach(item => {
    orderCounts[item.productId] = item.quantity;
  });

  gameState.hasError = false;

  for (const productId in counterCounts) {
    const onCounter = counterCounts[productId];
    const needed = orderCounts[productId] || 0;
    if (onCounter > needed) {
      gameState.hasError = true;
      break;
    }
  }
}

/** Возвращает товары со стола на склад */
function clearCounter() {
  gameState.counter.forEach(productId => {
    gameState.stock[productId]++;
  });
  gameState.counter = [];
  gameState.hasError = false;
  updateUI();
}

/** Заказ полностью собран? */
function isOrderComplete() {
  if (!gameState.customer || gameState.hasError) return false;

  const counterCounts = countItems(gameState.counter);

  return gameState.customer.order.every(item => {
    return (counterCounts[item.productId] || 0) === item.quantity;
  });
}

/** Считает выполненные позиции заказа */
function getFulfilledCounts() {
  const counterCounts = countItems(gameState.counter);
  const fulfilled = {};

  if (!gameState.customer) return fulfilled;

  gameState.customer.order.forEach(item => {
    const onCounter = counterCounts[item.productId] || 0;
    fulfilled[item.productId] = Math.min(onCounter, item.quantity);
  });

  return fulfilled;
}

// ===== Закупка =====

/** Покупает один товар на склад */
function buyProduct(productId) {
  const product = getProduct(productId);
  if (!product || !isProductUnlocked(product)) return;
  if (gameState.balance < product.buyPrice) return;

  gameState.balance -= product.buyPrice;
  gameState.stock[productId]++;

  elBalance.classList.add('updated');
  setTimeout(() => elBalance.classList.remove('updated'), 500);

  updateUI();
  checkBankruptcy();
}

// ===== Банкротство =====

/** Игрок обанкротился? */
function isBankrupt() {
  const totalStock = Object.values(gameState.stock).reduce((a, b) => a + b, 0);
  if (totalStock > 0) return false;

  const unlocked = getUnlockedProducts();
  if (unlocked.length === 0) return true;

  const cheapestPrice = Math.min(...unlocked.map(p => p.buyPrice));
  return gameState.balance < cheapestPrice;
}

/** Показывает окно банкротства */
function checkBankruptcy() {
  if (isBankrupt()) {
    elBankruptModal.classList.remove('hidden');
  }
}

// ===== Отрисовка интерфейса =====

/** Полное обновление UI */
function updateUI() {
  renderBalance();
  renderWarehouse();
  renderCounter();
  renderCustomer();
  renderPurchaseList();
  renderLocationList();
  updateEventTimersDisplay();
}

function renderBalance() {
  elBalance.textContent = `${gameState.balance}$`;
}

/** Склад — только разблокированные товары */
function renderWarehouse() {
  elWarehouse.innerHTML = '';

  const unlocked = getUnlockedProducts();

  if (unlocked.length === 0) {
    elWarehouse.innerHTML = '<p class="panel-hint">Нет доступных товаров</p>';
    return;
  }

  unlocked.forEach(product => {
    const count = gameState.stock[product.id];
    const disabled = count <= 0 || gameState.isProcessing || gameState.hasError || !gameState.customer;

    const card = document.createElement('div');
    card.className = `product-card${disabled ? ' disabled' : ''}`;
    card.innerHTML = `
      <span class="emoji">${product.emoji}</span>
      <div class="name">${product.name}</div>
      <div class="stock${count === 0 ? ' low' : ''}">На складе: ${count} шт.</div>
    `;

    if (!disabled) {
      card.addEventListener('click', () => placeOnCounter(product.id));
    }

    elWarehouse.appendChild(card);
  });
}

/** Стол продавца */
function renderCounter() {
  elCounter.innerHTML = '';

  if (gameState.counter.length === 0) {
    elCounter.innerHTML = '<p class="counter-empty">Стол пуст — выложите товары для покупателя</p>';
    elClearCounter.classList.add('hidden');
    return;
  }

  const wrongItems = getWrongCounterIndices();

  gameState.counter.forEach((productId, index) => {
    const product = getProduct(productId);
    const isWrong = wrongItems.has(index);

    const item = document.createElement('div');
    item.className = `counter-item${isWrong ? ' wrong' : ''}`;
    item.innerHTML = `<span>${product.emoji}</span> ${product.name}`;
    elCounter.appendChild(item);
  });

  elClearCounter.classList.toggle('hidden', !gameState.hasError);
}

/** Индексы ошибочных товаров на столе */
function getWrongCounterIndices() {
  const wrongSet = new Set();
  if (!gameState.customer) return wrongSet;

  const orderCounts = {};
  gameState.customer.order.forEach(item => {
    orderCounts[item.productId] = item.quantity;
  });

  const usedCorrect = {};

  gameState.counter.forEach((productId, index) => {
    const needed = orderCounts[productId] || 0;
    const used = usedCorrect[productId] || 0;

    if (used >= needed) {
      wrongSet.add(index);
    } else {
      usedCorrect[productId] = used + 1;
    }
  });

  return wrongSet;
}

/** Зона покупателя */
function renderCustomer() {
  if (!gameState.customer) {
    elCustomerSpeech.textContent = 'Ожидаем покупателя...';
    elCustomerSpeech.classList.remove('thanks');
    elCustomerOrder.innerHTML = '';
    return;
  }

  elCustomerSpeech.textContent = gameState.customer.speech;
  elCustomerSpeech.classList.toggle('thanks', gameState.customer.isThanking);

  const fulfilled = getFulfilledCounts();
  elCustomerOrder.innerHTML = '';

  gameState.customer.order.forEach(item => {
    const product = getProduct(item.productId);
    const done = fulfilled[item.productId] || 0;
    const isComplete = done >= item.quantity;

    const li = document.createElement('li');
    li.className = `order-item${isComplete ? ' fulfilled' : ''}`;
    li.innerHTML = `
      <span>${product.emoji}</span>
      <span>${product.name} ${done}/${item.quantity}</span>
      ${isComplete ? '<span class="check">✔</span>' : ''}
    `;
    elCustomerOrder.appendChild(li);
  });
}

/** Меню закупки — все товары, заблокированные с замком */
function renderPurchaseList() {
  if (!elPurchaseList) return;
  elPurchaseList.innerHTML = '';

  // Группируем по категориям
  const categories = ['basic', 'beach', 'streetfood', 'elite'];

  categories.forEach(cat => {
    const catProducts = PRODUCTS.filter(p => p.category === cat);
    if (catProducts.length === 0) return;

    const header = document.createElement('div');
    header.className = 'category-header';
    header.textContent = CATEGORY_NAMES[cat];
    elPurchaseList.appendChild(header);

    catProducts.forEach(product => {
      const unlocked = isProductUnlocked(product);
      const sellPrice = getSellPrice(product);
      const canBuy = unlocked && gameState.balance >= product.buyPrice;

      const row = document.createElement('div');
      row.className = `purchase-item${unlocked ? '' : ' locked'}`;

      if (unlocked) {
        row.innerHTML = `
          <span class="emoji">${product.emoji}</span>
          <div class="info">
            <div class="name">${product.name}</div>
            <div class="price">Закупка: ${product.buyPrice}$ · Продажа: ${sellPrice}$${gameState.heatWaveActive && (product.id === 'icecream' || product.id === 'soda') ? ' 🔥×2' : ''}</div>
            <div class="warehouse-stock">На складе: ${gameState.stock[product.id]} шт.</div>
          </div>
          <button class="btn-buy" ${canBuy ? '' : 'disabled'}>Купить 1 шт</button>
        `;
        row.querySelector('.btn-buy').addEventListener('click', () => buyProduct(product.id));
      } else {
        row.innerHTML = `
          <span class="emoji locked-emoji">${product.emoji}</span>
          <div class="info">
            <div class="name">${product.name}</div>
            <div class="lock-label">🔒 Откроется на локации «${getUnlockLocationName(product)}»</div>
            <div class="price-muted">Закупка: ${product.buyPrice}$ · Продажа: ${product.sellPrice}$</div>
          </div>
          <span class="lock-badge">🔒</span>
        `;
      }

      elPurchaseList.appendChild(row);
    });
  });
}

/** Список локаций */
function renderLocationList() {
  if (!elLocationList) return;
  elLocationList.innerHTML = '';

  LOCATIONS.forEach(location => {
    const isActive = location.id === gameState.currentLocationId;
    const isUnlocked = isLocationUnlocked(location.id);
    const canAfford = gameState.balance >= location.cost;

    const row = document.createElement('div');
    row.className = `location-item${isActive ? ' active' : ''}`;

    const multiplierText = location.multiplier === 1
      ? 'Наценка: ×1'
      : `Наценка: ×${location.multiplier}`;

    let costText = '';
    if (location.cost === 0) {
      costText = 'Бесплатно · стартовая локация';
    } else if (isUnlocked) {
      costText = 'Куплено · переезд бесплатный';
    } else {
      costText = `Стоимость переезда: ${location.cost}$`;
    }

    row.innerHTML = `
      <span class="loc-icon">${location.icon}</span>
      <div class="loc-info">
        <div class="loc-name">${location.name}</div>
        <div class="loc-desc">${location.description}<br>${costText}</div>
        <div class="loc-multiplier">${multiplierText}</div>
      </div>
    `;

    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'loc-badge';
      badge.textContent = '✔ Активная';
      row.appendChild(badge);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-move';
      btn.textContent = 'Переехать';
      if (!isUnlocked && !canAfford) btn.disabled = true;
      btn.addEventListener('click', () => moveToLocation(location.id));
      row.appendChild(btn);
    }

    elLocationList.appendChild(row);
  });
}

// ===== Вспомогательные функции =====

function countItems(arr) {
  const counts = {};
  arr.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  return counts;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== Обработчики событий =====

function bindEvents() {
  document.getElementById('btn-start').addEventListener('click', startGame);

  document.getElementById('btn-purchase').addEventListener('click', () => {
    elPurchaseModal.classList.remove('hidden');
    renderPurchaseList();
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    elPurchaseModal.classList.add('hidden');
  });

  elPurchaseModal.querySelector('.modal-overlay').addEventListener('click', () => {
    elPurchaseModal.classList.add('hidden');
  });

  document.getElementById('btn-locations').addEventListener('click', () => {
    elLocationModal.classList.remove('hidden');
    renderLocationList();
  });

  document.getElementById('btn-close-location').addEventListener('click', () => {
    elLocationModal.classList.add('hidden');
  });

  elLocationModal.querySelector('.modal-overlay').addEventListener('click', () => {
    elLocationModal.classList.add('hidden');
  });

  elClearCounter.addEventListener('click', clearCounter);
  document.getElementById('btn-restart').addEventListener('click', resetGame);
  document.getElementById('btn-event-ok').addEventListener('click', dismissRandomEvent);
}

// ===== Старт =====
initGame();

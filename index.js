<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GAV - The Incense Route</title>
    <script src="https://sdk.minepi.com/pi-sdk.js"></script>
    <link rel="stylesheet" href="css/style.css">
    <style>
        .page { display: none !important; }
        .page.active { display: block !important; }
        #calculator-modal { display: none; }
        #calculator-fab { display: none; }
    </style>
</head>
<body>

<header class="top-bar">
    <div class="logo">🛣️ GAV</div>
    <div class="network-badge"><span class="dot testnet"></span> Testnet</div>
    <div id="user-info">
        <span id="username">زائر</span>
        <button id="logout-btn" style="display:none;" onclick="logout()">خروج</button>
    </div>
</header>

<nav class="bottom-nav" id="bottom-nav" style="display:none;">
    <button class="nav-btn active" data-page="home" onclick="showPage('home')">
        <span class="nav-icon">🏠</span><span class="nav-label">الرئيسية</span>
    </button>
    <button class="nav-btn" data-page="products" onclick="showPage('products')">
        <span class="nav-icon">📦</span><span class="nav-label">المنتجات</span>
    </button>
    <button class="nav-btn" data-page="festivals" onclick="showPage('festivals')">
        <span class="nav-icon">🎪</span><span class="nav-label">المهرجانات</span>
    </button>
    <button class="nav-btn" data-page="cart" onclick="showPage('cart')">
        <span class="nav-icon">🛒</span><span class="nav-label">السلة</span>
    </button>
    <button class="nav-btn" data-page="merchant" onclick="showPage('merchant')">
        <span class="nav-icon">🏪</span><span class="nav-label">التاجر</span>
    </button>
</nav>

<button id="calculator-fab" class="calculator-fab" onclick="openCalculator()" title="الحاسبة الذكية">🧮</button>

<div id="calculator-modal" class="calculator-modal">
    <div class="calculator-sheet">
        <div class="calculator-header">
            <h3>🧮 الحاسبة الذكية</h3>
            <button class="calculator-close" onclick="closeCalculator()">✕</button>
        </div>
        <div class="calculator-body">
            <div class="calc-field">
                <label>💵 قيمة المنتج $</label>
                <input type="number" id="calc-usd" placeholder="100.00" step="0.01" min="0.01">
            </div>
            <div class="calc-field">
                <label>📊 القيمة المرجعية</label>
                <div class="calc-options">
                    <label class="calc-option">
                        <input type="radio" name="calc-ref" value="gcvalue">
                        <div class="calc-option-content">
                            <span class="calc-option-icon">💎</span>
                            <span class="calc-option-title">القيمة المرجعية</span>
                            <span class="calc-option-desc">314,159 $</span>
                            <span class="calc-option-split">85% YER + 15% Pi</span>
                        </div>
                    </label>
                    <label class="calc-option">
                        <input type="radio" name="calc-ref" value="dex">
                        <div class="calc-option-content">
                            <span class="calc-option-icon">📈</span>
                            <span class="calc-option-title">Pi DEX AMM</span>
                            <span class="calc-option-desc">السعر الحي</span>
                            <span class="calc-option-split">50% Pi + 50% YER</span>
                        </div>
                    </label>
                </div>
            </div>
            <button class="btn-primary" onclick="calculateConversion()" style="margin-top:16px;">⚡ احسب التوزيع</button>
            <div id="calc-results" style="display:none;margin-top:16px;">
                <div class="calc-result-card">
                    <div class="calc-result-row">
                        <span class="calc-result-label">💠 Pi</span>
                        <strong id="calc-result-pi" class="calc-result-value">0</strong>
                    </div>
                    <div class="calc-result-row">
                        <span class="calc-result-label">🪙 YER</span>
                        <strong id="calc-result-yer" class="calc-result-value">0</strong>
                    </div>
                    <div class="calc-result-note" id="calc-result-note"></div>
                </div>
                <button class="btn-secondary" onclick="applyCalculatorToProduct()" style="margin-top:12px;">📋 تطبيق على المنتج</button>
            </div>
        </div>
    </div>
</div>

<main class="container">

    <section id="page-login" class="page active">
        <div class="card">
            <h1>🛣️ GAV - طريق البخور</h1>
            <p class="subtitle">منصة التجارة العابرة للحدود</p>
            <p class="description">تبادل السلع التراثية والبخور والعطور عبر منظومة Arabian Eagle</p>
            <button id="login-btn" class="btn-primary" onclick="loginWithPi()">🚀 تسجيل الدخول بحساب Pi</button>
            <div id="login-error" class="error" style="display:none;"></div>
            <div class="status-note"><small>⚠️ التطبيق في مرحلة التطوير — Testnet فقط</small></div>
        </div>
    </section>

    <section id="page-home" class="page">
        <div class="card user-card">
            <h2>مرحباً، <span id="user-name"></span></h2>
            <p class="user-id">معرف Pi: <span id="user-id"></span></p>
        </div>
        <div class="card">
            <h3>💰 محفظتك</h3>
            <div class="balance-grid">
                <div class="balance-item">
                    <span class="label">Pi</span>
                    <span class="value" id="pi-balance">0.00</span>
                </div>
                <div class="balance-item">
                    <span class="label">YER</span>
                    <span class="value" id="yer-balance">0.00</span>
                </div>
            </div>
            <p class="subtitle" style="margin-top:12px; text-align:center;"><small>الدفع يتم عبر محفظة BIGISH-YER</small></p>
        </div>
        <div class="card">
            <h3>🌿 تصفح الأقسام</h3>
            <div id="categories-grid" class="categories-grid"></div>
        </div>
        <div class="card">
            <h3>🔥 أحدث المنتجات</h3>
            <div id="featured-products" class="products-grid"></div>
        </div>
    </section>

    <section id="page-products" class="page">
        <div class="card">
            <h3>📦 جميع المنتجات</h3>
            <input type="text" id="search-input" placeholder="ابحث عن منتج..." oninput="filterProducts()">
            <div id="filter-buttons" class="filter-buttons"></div>
            <div id="products-list" class="products-grid"></div>
        </div>
    </section>

    <section id="page-festivals" class="page">
        <div class="card">
            <h3>🎪 مهرجانات المقايضة</h3>
            <p class="subtitle">تبادل البضائع مقابل Pi بحرية كاملة</p>
            <button class="btn-primary" onclick="openCreateFestival()" style="margin-top:8px;">➕ إنشاء مهرجان جديد</button>
            <button class="btn-secondary" onclick="loadFestivalLog()" style="margin-top:8px;">📊 سجل المهرجانات</button>
        </div>
        <div class="card">
            <h3>🎯 المهرجانات النشطة</h3>
            <div id="festivals-list"><p class="empty-state">لا توجد مهرجانات حالياً.</p></div>
            <button class="btn-secondary" onclick="loadFestivals()" style="margin-top:12px;">🔄 تحديث</button>
        </div>
        <div class="card" id="festival-log-card" style="display:none;">
            <h3>📊 سجل المهرجانات</h3>
            <div id="festival-log-content"></div>
        </div>
        <div class="card">
            <h3>📋 مهرجاناتي</h3>
            <div id="my-festivals-list"><p class="empty-state">لم تنشئ أي مهرجان بعد.</p></div>
        </div>
    </section>

    <section id="page-cart" class="page">
        <div class="card">
            <h3>🛒 سلة التسوق</h3>
            <div id="cart-items"><p class="empty-state">السلة فارغة حالياً.</p></div>
            <div id="cart-summary" style="display:none;">
                <div class="cart-total">
                    <span>الإجمالي:</span>
                    <strong id="cart-total-amount">0</strong>
                </div>
                <button class="btn-primary" onclick="checkout()" style="margin-top:12px;">💳 إتمام الدفع</button>
            </div>
        </div>
    </section>

    <section id="page-orders" class="page">
        <div class="card">
            <h3>📋 طلباتي</h3>
            <div id="orders-list"><p class="empty-state">لا توجد طلبات بعد.</p></div>
            <button class="btn-secondary" onclick="refreshOrders()" style="margin-top:12px;">🔄 تحديث</button>
        </div>
    </section>

    <section id="page-merchant" class="page">
        <div class="card">
            <h3>🏪 لوحة التاجر</h3>
            <div id="merchant-stats" class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">المنتجات</span>
                    <span class="stat-value" id="stat-products">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">الطلبات</span>
                    <span class="stat-value" id="stat-orders">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Pi مكتسب</span>
                    <span class="stat-value" id="stat-pi">0.00</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">YER مكتسب</span>
                    <span class="stat-value" id="stat-yer">0.00</span>
                </div>
            </div>
        </div>

        <div class="card">
            <h3>➕ إضافة منتج جديد</h3>
            <input type="text" id="new-product-name" placeholder="اسم المنتج">
            <textarea id="new-product-description" placeholder="وصف المنتج" style="margin-top:8px;"></textarea>
            <select id="new-product-category" style="margin-top:8px;">
                <option value="incense">البخور والعطور</option>
                <option value="luban">البان</option>
                <option value="dates">التمور</option>
                <option value="textiles">المنسوجات</option>
                <option value="handicrafts">الحرف اليدوية</option>
                <option value="food">المواد الغذائية</option>
                <option value="vegetables">الخضروات والفواكه</option>
                <option value="meat">اللحوم</option>
                <option value="fish">الأسماك</option>
                <option value="beverages">المشروبات</option>
                <option value="coffee">البن والقهوة</option>
                <option value="honey">العسل الطبيعي</option>
                <option value="spices">التوابل</option>
                <option value="gold">الذهب والمجوهرات</option>
                <option value="silver">الفضيات</option>
                <option value="clothing">الملابس</option>
                <option value="accessories">الإكسسوارات</option>
                <option value="cosmetics">أدوات التجميل</option>
                <option value="electronics">الأجهزة الإلكترونية</option>
                <option value="smartphones">الهواتف الذكية</option>
                <option value="hardware">الخردوات والأدوات</option>
                <option value="home">مستلزمات المنزل</option>
                <option value="agriculture">المستلزمات الزراعية</option>
                <option value="medicines">الأدوية</option>
                <option value="supplements">المكملات الغذائية</option>
                <option value="sanitary">الأدوات الصحية</option>
                <option value="constructionTools">أدوات البناء</option>
                <option value="constructionMaterials">مواد البناء</option>
                <option value="electricalTools">أدوات الكهرباء</option>
                <option value="plumbingTools">أدوات السباكة</option>
                <option value="tiles">البلاط</option>
                <option value="ceramics">السيراميك</option>
                <option value="vehicles">المركبات</option>
                <option value="others">أخرى</option>
            </select>

            <input type="number" id="new-product-price-usd" placeholder="قيمة المنتج $" step="0.01" style="margin-top:8px;">
            <input type="number" id="new-product-price-pi" placeholder="السعر بـ Pi (تلقائي)" step="0.0000000001" style="margin-top:8px;" readonly>
            <input type="number" id="new-product-price-yer" placeholder="السعر بـ YER (تلقائي)" step="0.01" style="margin-top:8px;" readonly>

            <input type="hidden" id="new-product-reference-source">
            <input type="hidden" id="new-product-pi-ratio">

            <button class="btn-primary" onclick="addProduct()" style="margin-top:12px;">➕ إضافة المنتج</button>
        </div>

        <div class="card">
            <h3>📦 منتجاتي</h3>
            <div id="my-products-list"><p class="empty-state">لا توجد منتجات بعد.</p></div>
        </div>
    </section>

</main>

<script src="js/pi-config.js"></script>
<script src="js/auth.js"></script>
<script src="js/products.js"></script>
<script src="js/cart.js"></script>
<script src="js/payment.js"></script>
<script src="js/orders.js"></script>
<script src="js/merchant.js"></script>
<script src="js/converter.js"></script>
<script src="js/festivals.js"></script>

</body>
</html>
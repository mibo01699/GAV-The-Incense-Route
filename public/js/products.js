// ============================================
// GAV - The Incense Route | Products & Categories
// ============================================

let allProducts = [];
let allCategories = [];
let currentCategory = 'all';
let currentSearch = '';

// ============================================
// تحميل الأقسام
// ============================================
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();

        if (data.success) {
            allCategories = data.categories;
            renderCategories();
            renderFilterButtons();
        }
    } catch (err) {
        console.error("Categories load error:", err);
    }
}

function renderCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = '';
    allCategories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.onclick = () => {
            showPage('products');
            setCategory(cat.id);
        };
        card.innerHTML = `
            <span class="category-icon">${cat.icon}</span>
            <span class="category-name">${cat.name}</span>
        `;
        grid.appendChild(card);
    });
}

function renderFilterButtons() {
    const container = document.getElementById('filter-buttons');
    if (!container) return;

    container.innerHTML = '<button class="filter-btn active" onclick="setCategory(\'all\')">الكل</button>';

    allCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = cat.name;
        btn.onclick = () => setCategory(cat.id);
        btn.dataset.category = cat.id;
        container.appendChild(btn);
    });
}

function setCategory(catId) {
    currentCategory = catId;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if ((catId === 'all' && btn.textContent === 'الكل') ||
            btn.dataset.category === catId) {
            btn.classList.add('active');
        }
    });
    renderProducts();
}

// ============================================
// تحميل المنتجات
// ============================================
async function loadFeaturedProducts() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();

        if (data.success) {
            allProducts = data.products;
            renderFeatured();
            renderProducts();
        }
    } catch (err) {
        console.error("Products load error:", err);
    }
}

function renderFeatured() {
    const container = document.getElementById('featured-products');
    if (!container) return;

    if (allProducts.length === 0) {
        container.innerHTML = '<p class="empty-state">لا توجد منتجات بعد.</p>';
        return;
    }

    const featured = allProducts.slice(-4).reverse();
    container.innerHTML = '';
    featured.forEach(product => {
        container.appendChild(createProductCard(product));
    });
}

function renderProducts() {
    const container = document.getElementById('products-list');
    if (!container) return;

    let filtered = [...allProducts];

    // فلترة حسب القسم
    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }

    // فلترة حسب البحث
    if (currentSearch) {
        const s = currentSearch.toLowerCase();
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(s) ||
            (p.description && p.description.toLowerCase().includes(s))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">لا توجد منتجات مطابقة.</p>';
        return;
    }

    container.innerHTML = '';
    filtered.reverse().forEach(product => {
        container.appendChild(createProductCard(product));
    });
}

// ============================================
// بطاقة المنتج
// ============================================
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const category = allCategories.find(c => c.id === product.category);
    const icon = category ? category.icon : '📦';

    let priceHTML = '';
    if (product.pricePi > 0) {
        priceHTML += `
            <div class="price-row">
                <span class="price-label">Pi:</span>
                <span class="price-value">${parseFloat(product.pricePi).toFixed(2)}</span>
            </div>
        `;
    }
    if (product.priceYER > 0) {
        priceHTML += `
            <div class="price-row">
                <span class="price-label">YER:</span>
                <span class="price-value">${parseFloat(product.priceYER).toFixed(0)}</span>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="product-image">${icon}</div>
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-merchant">بواسطة: ${escapeHtml(product.merchantName || 'تاجر')}</div>
        <div class="product-price">${priceHTML}</div>
        <div class="product-actions">
            <button class="btn-small" onclick="addToCart('${product.id}')" style="width:100%;">🛒 أضف للسلة</button>
        </div>
    `;

    return card;
}

// ============================================
// البحث
// ============================================
function filterProducts() {
    const input = document.getElementById('search-input');
    if (!input) return;
    currentSearch = input.value.trim();
    renderProducts();
}

// ============================================
// أدوات مساعدة
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// إعادة تحميل المنتجات عند التنقل إلى صفحة المنتجات
document.addEventListener('DOMContentLoaded', () => {
    const originalShowPage = window.showPage;
    window.showPage = function(pageName) {
        if (originalShowPage) originalShowPage(pageName);
        if (pageName === 'products' && allProducts.length === 0) {
            loadFeaturedProducts();
        }
    };
});
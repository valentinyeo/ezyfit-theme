/**
 * Centralized Upsell Configuration
 *
 * This file contains all upsell logic used across:
 * - Product page (Select Add Ons section)
 * - Cart drawer
 * - Cart page
 *
 * To modify upsell behavior, edit this file only.
 */

window.ClickShadesUpsell = (function() {
  // ============================================
  // CONFIGURATION - Edit these values as needed
  // ============================================

  const CONFIG = {
    // Permanent upsell product (always shown)
    permanentUpsellHandle: 'windscreen-water-repellent',

    // Maximum number of upsell products to show (excluding permanent)
    maxUpsellProducts: 3,

    // Section heading
    heading: 'Select Add Ons',

    // Enable complementary products API (requires Search & Discovery app)
    useComplementaryApi: true,

    // Enable metafield-based upsells (custom.upsell_products)
    useMetafieldUpsells: true,

    // Enable title-based matching (fallback)
    useTitleMatching: true
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ============================================
  // UPSELL DATA FETCHING
  // ============================================

  /**
   * Fetch the permanent upsell product (Water Repellent)
   */
  async function fetchPermanentUpsell() {
    try {
      const response = await fetch(`/products/${CONFIG.permanentUpsellHandle}.json`);
      if (!response.ok) return null;

      const data = await response.json();
      const product = data.product;

      // Note: The .json API doesn't include 'available' field, so we check if product exists
      // and has variants. If inventory is tracked, we'd need to check via storefront API.
      if (!product || !product.variants?.length) return null;

      // Use first variant (products with managed inventory will return 404 if truly unavailable)
      const variant = product.variants[0];

      return {
        id: product.id,
        title: product.title,
        url: `/products/${product.handle}`,
        price: variant.price * 100, // Convert to cents
        priceFormatted: formatMoney(variant.price * 100),
        compareAtPrice: variant.compare_at_price ? variant.compare_at_price * 100 : null,
        compareAtPriceFormatted: variant.compare_at_price ? formatMoney(variant.compare_at_price * 100) : null,
        variantId: variant.id,
        image: product.images?.[0]?.src || null,
        available: true,
        isPermanent: true
      };
    } catch (e) {
      console.log('Could not fetch permanent upsell:', e);
      return null;
    }
  }

  /**
   * Fetch complementary products from Shopify API
   */
  async function fetchComplementaryProducts(productId, excludeIds = []) {
    if (!CONFIG.useComplementaryApi || !productId) return [];

    try {
      const response = await fetch(`/recommendations/products.json?product_id=${productId}&limit=${CONFIG.maxUpsellProducts}&intent=complementary`);
      if (!response.ok) return [];

      const data = await response.json();
      if (!data.products || data.products.length === 0) return [];

      return data.products
        .filter(p => p.available && !excludeIds.includes(p.id))
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          price: p.price,
          priceFormatted: formatMoney(p.price),
          compareAtPrice: p.compare_at_price,
          compareAtPriceFormatted: p.compare_at_price ? formatMoney(p.compare_at_price) : null,
          variantId: p.variants?.[0]?.id,
          image: p.featured_image,
          available: true,
          isPermanent: false
        }));
    } catch (e) {
      console.log('Could not fetch complementary products:', e);
      return [];
    }
  }

  /**
   * Fetch products matching car model from title
   */
  async function fetchTitleMatchingProducts(carModel, excludeIds = []) {
    if (!CONFIG.useTitleMatching || !carModel) return [];

    try {
      const response = await fetch(`/search/suggest.json?q=${encodeURIComponent(carModel)}&resources[type]=product&resources[limit]=10`);
      if (!response.ok) return [];

      const data = await response.json();
      const products = data.resources?.results?.products || [];

      return products
        .filter(p => p.available && !excludeIds.includes(p.id))
        .slice(0, CONFIG.maxUpsellProducts)
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
          price: p.price * 100,
          priceFormatted: formatMoney(p.price * 100),
          compareAtPrice: p.compare_at_price ? p.compare_at_price * 100 : null,
          compareAtPriceFormatted: p.compare_at_price ? formatMoney(p.compare_at_price * 100) : null,
          variantId: p.variants?.[0]?.id,
          image: p.featured_image,
          available: true,
          isPermanent: false
        }));
    } catch (e) {
      console.log('Could not fetch title matching products:', e);
      return [];
    }
  }

  /**
   * Get all upsell products for a given context
   * @param {Object} options
   * @param {number} options.productId - Current product ID (for complementary products)
   * @param {string} options.carModel - Car model name (for title matching)
   * @param {number[]} options.excludeIds - Product IDs to exclude (e.g., items already in cart)
   */
  async function getUpsellProducts(options = {}) {
    const { productId, carModel, excludeIds = [] } = options;
    const allUpsells = [];

    // 1. Always get permanent upsell (Water Repellent)
    const permanentUpsell = await fetchPermanentUpsell();
    if (permanentUpsell && !excludeIds.includes(permanentUpsell.id)) {
      allUpsells.push(permanentUpsell);
    }

    // 2. Try complementary products API
    if (productId) {
      const complementary = await fetchComplementaryProducts(productId, [...excludeIds, permanentUpsell?.id].filter(Boolean));
      if (complementary.length > 0) {
        allUpsells.push(...complementary);
        return allUpsells;
      }
    }

    // 3. Fall back to title matching
    if (carModel) {
      const titleMatches = await fetchTitleMatchingProducts(carModel, [...excludeIds, permanentUpsell?.id].filter(Boolean));
      allUpsells.push(...titleMatches);
    }

    return allUpsells;
  }

  // ============================================
  // CART OPERATIONS
  // ============================================

  async function addToCart(variantId, quantity = 1) {
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: parseInt(variantId), quantity }]
        })
      });

      if (!response.ok) throw new Error('Failed to add to cart');

      return await response.json();
    } catch (e) {
      console.error('Error adding to cart:', e);
      throw e;
    }
  }

  async function addMultipleToCart(variantIds) {
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: variantIds.map(id => ({ id: parseInt(id), quantity: 1 }))
        })
      });

      if (!response.ok) throw new Error('Failed to add to cart');

      return await response.json();
    } catch (e) {
      console.error('Error adding to cart:', e);
      throw e;
    }
  }

  async function getCartItemCount() {
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) return 0;
      const cart = await response.json();
      return cart.item_count;
    } catch (e) {
      return 0;
    }
  }

  function updateCartCountDisplay(count) {
    document.querySelectorAll('.cart-count-bubble, [data-cart-count]').forEach(el => {
      el.textContent = count;
    });
  }

  // ============================================
  // RENDERING
  // ============================================

  /**
   * Render a single upsell card (product page style)
   */
  function renderUpsellCard(product, options = {}) {
    const { onAddClick, showBadge = true } = options;
    const hasSale = product.compareAtPrice && product.compareAtPrice > product.price;

    const card = document.createElement('div');
    card.className = 'addon-card' + (product.isPermanent ? ' addon-card--featured addon-card--permanent' : '');
    card.dataset.variantId = product.variantId;
    card.dataset.price = product.price;

    card.innerHTML = `
      ${product.isPermanent && showBadge ? '<div class="addon-badge">Popular Add-On</div>' : ''}
      <a href="${product.url}" class="addon-image">
        ${product.image ? `<img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy">` : ''}
      </a>
      <div class="addon-info">
        <a href="${product.url}" class="addon-title-link"><h3 class="addon-title">${escapeHtml(product.title)}</h3></a>
        <div class="addon-price${hasSale ? ' has-sale' : ''}">
          ${hasSale ? `<span class="addon-price-compare">${product.compareAtPriceFormatted}</span>` : ''}
          <span class="addon-price-current">${product.priceFormatted}</span>
        </div>
        <button type="button" class="addon-atc-btn" data-variant-id="${product.variantId}">
          <span>Add to Cart</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="addon-plus">
            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;

    // Bind click handler
    const btn = card.querySelector('.addon-atc-btn');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalText = btn.querySelector('span').textContent;
      btn.querySelector('span').textContent = 'Adding...';
      btn.disabled = true;

      try {
        await addToCart(product.variantId);
        btn.querySelector('span').textContent = 'Added!';
        btn.classList.add('addon-atc-btn--success');

        const count = await getCartItemCount();
        updateCartCountDisplay(count);

        if (onAddClick) onAddClick(product);

        setTimeout(() => {
          btn.querySelector('span').textContent = originalText;
          btn.classList.remove('addon-atc-btn--success');
          btn.disabled = false;
        }, 2000);
      } catch (err) {
        btn.querySelector('span').textContent = 'Error';
        setTimeout(() => {
          btn.querySelector('span').textContent = originalText;
          btn.disabled = false;
        }, 2000);
      }
    });

    return card;
  }

  /**
   * Refresh cart drawer using Shopify section rendering
   */
  async function refreshCartDrawer() {
    try {
      const response = await fetch(`${window.routes.cart_url}?section_id=cart-drawer`);
      if (!response.ok) return;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Update cart drawer inner content
      const newDrawerInner = doc.querySelector('.drawer__inner');
      const currentDrawerInner = document.querySelector('#CartDrawer .drawer__inner');
      if (newDrawerInner && currentDrawerInner) {
        currentDrawerInner.innerHTML = newDrawerInner.innerHTML;
      }

      // Update cart icon bubble
      const iconResponse = await fetch(`${window.routes.cart_url}?section_id=cart-icon-bubble`);
      if (iconResponse.ok) {
        const iconHtml = await iconResponse.text();
        const iconDoc = parser.parseFromString(iconHtml, 'text/html');
        const iconBubble = document.getElementById('cart-icon-bubble');
        const newBubble = iconDoc.querySelector('.shopify-section');
        if (iconBubble && newBubble) {
          iconBubble.innerHTML = newBubble.innerHTML;
        }
      }

      // Re-initialize upsells
      if (typeof loadCartDrawerUpsells === 'function') {
        loadCartDrawerUpsells();
      }

      // Publish cart update event
      if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'upsell-config' });
      }
    } catch (e) {
      console.log('Error refreshing cart drawer:', e);
    }
  }

  /**
   * Render a single upsell card (cart drawer style)
   */
  function renderCartDrawerCard(product, options = {}) {
    const { onAddClick } = options;
    const price = (product.price / 100).toFixed(0);

    const item = document.createElement('div');
    item.className = 'cart-drawer__upsell-item';

    item.innerHTML = `
      <div class="cart-drawer__upsell-image">
        ${product.image ? `<img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy" width="140" height="140">` : ''}
      </div>
      <div class="cart-drawer__upsell-body">
        <p class="cart-drawer__upsell-name">${escapeHtml(product.title)}</p>
        <div class="cart-drawer__upsell-footer">
          <span class="cart-drawer__upsell-price">$${price}</span>
          <button type="button" class="cart-drawer__upsell-add" aria-label="Add ${escapeHtml(product.title)} to cart" data-variant-id="${product.variantId}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Bind click handler
    const btn = item.querySelector('.cart-drawer__upsell-add');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      btn.disabled = true;
      btn.innerHTML = '<span style="font-size: 10px;">...</span>';

      try {
        await addToCart(product.variantId);
        btn.innerHTML = '<span style="font-size: 10px;">✓</span>';
        btn.style.background = '#22c55e';

        if (onAddClick) onAddClick(product);

        // Dynamically update cart drawer instead of reloading
        await refreshCartDrawer();
      } catch (err) {
        btn.innerHTML = '<span style="font-size: 10px;">!</span>';
        setTimeout(() => {
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>`;
          btn.disabled = false;
          btn.style.background = '';
        }, 2000);
      }
    });

    return item;
  }

  // ============================================
  // GLOBAL CART UPDATE LISTENER
  // ============================================

  /**
   * Listen for any cart updates and execute callback
   * Works with Dawn theme's native cart events + intercepts all cart API calls
   */
  function onCartUpdate(callback) {
    // Listen for Dawn's native cart update events
    document.documentElement.addEventListener('cart:refresh', callback);
    document.addEventListener('cart:updated', callback);
    
    // Intercept all fetch requests to cart endpoints
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [url, options] = args;
      
      // Check if this is a cart mutation request
      const isCartMutation = 
        url.includes('/cart/add.js') || 
        url.includes('/cart/update.js') || 
        url.includes('/cart/change.js') ||
        url.includes('/cart/clear.js');
      
      // Call original fetch
      const fetchPromise = originalFetch.apply(this, args);
      
      // If it's a cart request, trigger callback after completion
      if (isCartMutation) {
        fetchPromise.then(response => {
          if (response.ok) {
            console.log('🔄 Cart updated via fetch, triggering callback');
            // Small delay to ensure cart state is updated
            setTimeout(callback, 50);
          }
          return response;
        }).catch(err => {
          console.error('Cart mutation failed:', err);
          return Promise.reject(err);
        });
      }
      
      return fetchPromise;
    };
  }

  // Auto-initialize: trigger on every cart update
  onCartUpdate(async function() {
    console.log('✅ Cart was updated! Running global handler...');
    
    // Update cart count display
    const count = await getCartItemCount();
    updateCartCountDisplay(count);
    
    // Add any other global cart update logic here
    // Examples:
    // - Refresh upsells in cart drawer
    // - Update free shipping progress bar
    // - Track analytics
    // - Show notifications
  });

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    CONFIG,
    getUpsellProducts,
    addToCart,
    addMultipleToCart,
    getCartItemCount,
    updateCartCountDisplay,
    renderUpsellCard,
    renderCartDrawerCard,
    refreshCartDrawer,
    onCartUpdate,
    formatMoney,
    escapeHtml
  };
})();
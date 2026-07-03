document.addEventListener('DOMContentLoaded', () => {
    // Basic setup
    const setupNavCart = () => {
        const cartLinks = document.querySelectorAll('.nav-actions .icon .fa-shopping-bag');
        cartLinks.forEach(icon => {
            const parent = icon.parentElement;
            parent.href = 'cart.html';
            parent.classList.add('position-relative');
            if (!parent.querySelector('.cart-badge')) {
                const badge = document.createElement('span');
                badge.className = 'cart-badge';
                badge.id = 'nav-cart-count';
                badge.innerText = '0';
                parent.appendChild(badge);
            }
        });
        updateCartBadge();
    };

    const updateCartBadge = () => {
        const cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(b => {
            b.innerText = totalItems;
            b.style.display = totalItems > 0 ? 'flex' : 'none';
        });
    };

    setupNavCart();

    // ==========================================
    // ADMIN PANEL & DYNAMIC INJECTION (PostgreSQL)
    // ==========================================
    if (window.location.pathname.includes('admin.html')) {
        const form = document.getElementById('add-product-form');
        const tbody = document.querySelector('#custom-products-table tbody');
        const ordersTbody = document.getElementById('custom-orders-tbody');

        const renderAdminTable = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/products');
                const customProducts = await res.json();
                if(tbody) {
                    tbody.innerHTML = customProducts.map((p) => `
                        <tr>
                            <td class="td-img" style="display: flex; gap: 5px;">
                                <img src="${p.img}" alt="${p.title}">
                                ${p.img2 ? `<img src="${p.img2}" alt="thumb 2">` : ''}
                                ${p.img3 ? `<img src="${p.img3}" alt="thumb 3">` : ''}
                            </td>
                            <td>${p.title}</td>
                            <td>${p.category}</td>
                            <td>${p.brand}</td>
                            <td>$${parseFloat(p.price).toFixed(2)}</td>
                            <td><button class="action-btn" onclick="deleteCustomProduct(${p.id})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('');
                }
            } catch (err) {
                if(tbody) tbody.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">Could not connect to database. Is the Node.js server running?</td></tr>';
            }
        };

        const renderAdminOrders = async () => {
            if (!ordersTbody) return;
            try {
                const res = await fetch('http://localhost:3000/api/orders');
                const orders = await res.json();
                
                if (orders.length === 0) {
                    ordersTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-light); padding: 2rem;">No orders placed yet.</td></tr>';
                    return;
                }

                ordersTbody.innerHTML = orders.map((order) => {
                    let itemsList = '';
                    try {
                        const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                        itemsList = parsedItems.map(item => `
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">
                                <img src="${item.img}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 2px;" alt="${item.title}">
                                <div>
                                    <div style="font-weight: 500; font-size: 0.85rem;">${item.title}</div>
                                    <div style="font-size: 0.75rem; color: #666;">Size: ${item.size} | Color: ${item.color} | Qty: ${item.qty}</div>
                                </div>
                            </div>
                        `).join('');
                    } catch (e) {
                        itemsList = '<span style="color: red;">Error reading items</span>';
                    }

                    const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const statusBadge = order.status === 'Dispatched' 
                        ? `<span style="background-color: #2ecc71; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.75rem; font-weight: 500; text-transform: uppercase;">DISPATCHED</span>`
                        : `<span style="background-color: #f39c12; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.75rem; font-weight: 500; text-transform: uppercase;">PENDING</span>`;

                    const dispatchBtn = order.status === 'Pending'
                        ? `<button class="checkout-btn" style="padding: 6px 12px; font-size: 0.7rem; border-radius: 3px; background-color: #2ecc71; color: white; border: none; cursor: pointer; margin: 0; width: auto;" onclick="dispatchOrder(${order.id})">DISPATCH</button>`
                        : `<button style="padding: 6px 12px; font-size: 0.7rem; border-radius: 3px; background-color: #ddd; color: #777; border: none; cursor: not-allowed; margin: 0; width: auto;" disabled>DISPATCHED</button>`;

                    const deleteBtn = `<button class="action-btn" style="margin-left: 15px;" onclick="deleteOrder(${order.id})"><i class="fas fa-trash"></i></button>`;

                    return `
                        <tr>
                            <td style="font-weight: 600;">#${order.id}</td>
                            <td style="font-size: 0.8rem; color: #666;">${dateStr}</td>
                            <td>${itemsList}</td>
                            <td style="font-weight: 600;">$${parseFloat(order.total_price).toFixed(2)}</td>
                            <td>${statusBadge}</td>
                            <td style="font-size: 0.85rem; font-weight: 500;">${order.customer_info?.name || ''}<br>${order.customer_info?.phone || ''}<br>${order.customer_info?.address || ''} ${order.customer_info?.city || ''} ${order.customer_info?.state || ''} ${order.customer_info?.zip || ''}<br>${order.customer_info?.country || ''}</td>
                            <td style="font-size: 0.85rem; font-weight: 500;">${order.shipping_date || 'N/A'}</td>
                            <td>
                                <div style="display: flex; align-items: center;">
                                    ${dispatchBtn}
                                    ${deleteBtn}
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');

            } catch (err) {
                ordersTbody.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">Could not connect to database to fetch orders.</td></tr>';
            }
        };

        // Navigation tab switching
        const navProducts = document.getElementById('admin-nav-products');
        const navOrders = document.getElementById('admin-nav-orders');
        const productsPanel = document.getElementById('admin-products-panel');
        const ordersPanel = document.getElementById('admin-orders-panel');

        if (navProducts && navOrders && productsPanel && ordersPanel) {
            navProducts.addEventListener('click', (e) => {
                e.preventDefault();
                navProducts.classList.add('active');
                navOrders.classList.remove('active');
                productsPanel.style.display = 'block';
                ordersPanel.style.display = 'none';
                renderAdminTable();
            });

            navOrders.addEventListener('click', (e) => {
                e.preventDefault();
                navOrders.classList.add('active');
                navProducts.classList.remove('active');
                productsPanel.style.display = 'none';
                ordersPanel.style.display = 'block';
                renderAdminOrders();
            });
        }
// Auto-show Orders panel on admin page load
if (navOrders && ordersPanel) {
  navProducts.classList.remove('active');
  navOrders.classList.add('active');
  productsPanel.style.display = 'none';
  ordersPanel.style.display = 'block';
  renderAdminOrders();
}

        if (tbody) renderAdminTable();

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const readAsBase64 = (file) => {
                    return new Promise((resolve) => {
                        if (!file) return resolve(null);
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                };

                const file1 = document.getElementById('prod-image').files[0];
                const file2 = document.getElementById('prod-image-2').files[0];
                const file3 = document.getElementById('prod-image-3').files[0];

                if (file1) {
                    const img1Base64 = await readAsBase64(file1);
                    const img2Base64 = await readAsBase64(file2);
                    const img3Base64 = await readAsBase64(file3);
                    
                    const newItem = {
                        title: document.getElementById('prod-name').value,
                        price: parseFloat(document.getElementById('prod-price').value),
                        category: document.getElementById('prod-category').value,
                        brand: document.getElementById('prod-brand').value,
                        img: img1Base64,
                        img2: img2Base64,
                        img3: img3Base64
                    };

                    try {
                        const response = await fetch('http://localhost:3000/api/products', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newItem)
                        });

                        if(response.ok) {
                            form.reset();
                            renderAdminTable();
                            alert('Success! The product and all images are now live on the website.');
                        } else {
                            alert('Error saving product to database.');
                        }
                    } catch (err) {
                        alert('Network error. Is the Node.js server running?');
                    }
                } else {
                    alert('Please select at least the main image file.');
                }
            });
        }

        window.deleteCustomProduct = async (id) => {
            try {
                await fetch(`http://localhost:3000/api/products/${id}`, { method: 'DELETE' });
                renderAdminTable();
            } catch (err) {
                console.error('Failed to delete product', err);
                alert('Could not delete product.');
            }
        };

        window.dispatchOrder = async (id) => {
            try {
                const res = await fetch(`http://localhost:3000/api/orders/${id}/dispatch`, {
                    method: 'PUT'
                });
                if (res.ok) {
                    renderAdminOrders();
                } else {
                    alert('Failed to dispatch order.');
                }
            } catch (err) {
                console.error(err);
                alert('Error connecting to backend.');
            }
        };

        window.deleteOrder = async (id) => {
            if (!confirm('Are you sure you want to delete this order?')) return;
            try {
                const res = await fetch(`http://localhost:3000/api/orders/${id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    renderAdminOrders();
                } else {
                    alert('Failed to delete order.');
                }
            } catch (err) {
                console.error(err);
                alert('Error connecting to backend.');
            }
        };
    }

    const injectCustomProducts = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/products');
            const customProducts = await res.json();
            if (!Array.isArray(customProducts) || customProducts.length === 0) {
                setupProductCards();
                return;
            }

            let targetGrid = null;
            let allowedCategory = null;

            if (window.location.pathname.includes('mens.html')) {
                targetGrid = document.querySelector('.collection-content .product-grid-3');
                allowedCategory = "Men's";
            } else if (window.location.pathname.includes('womens.html')) {
                targetGrid = document.querySelector('.collection-content .product-grid-3');
                allowedCategory = "Women's";
            } else if (window.location.pathname.includes('all-products.html')) {
                targetGrid = document.querySelector('.collection-content .product-grid-3');
                allowedCategory = "All";
            } else if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                targetGrid = document.querySelector('.product-grid');
                allowedCategory = "All";
            }

            if (targetGrid) {
                let htmlToInject = '';
                window.dynamicProductsMap = {}; // Store them globally to avoid huge base64 DOM strings
                
                [...customProducts].reverse().forEach(p => {
                    window.dynamicProductsMap[p.id] = p;
                    if (allowedCategory === 'All' || p.category === allowedCategory) {
                        htmlToInject += `
                            <div class="product-card" data-product-id="${p.id}">
                                <div class="product-image-wrapper">
                                    <div class="badge-new" style="background-color: var(--accent-blue);">NEW</div>
                                    <img src="${p.img}" alt="${p.title}">
                                </div>
                                <div class="product-info-collection">
                                    <div class="brand-row">
                                        <span class="brand">${p.brand}</span>
                                        <button class="wishlist-btn-small"><i class="far fa-heart"></i></button>
                                    </div>
                                    <h4>${p.title}</h4>
                                    <div class="price-row">
                                        <span class="price">$${parseFloat(p.price).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
                if (htmlToInject) {
                    targetGrid.insertAdjacentHTML('afterbegin', htmlToInject);
                }
            }
        } catch (e) {
            console.log('PostgreSQL backend not reachable or empty. Loading static template only.');
        } finally {
            setupProductCards();
            updateWishlistUI();
        }
    };

    if (!window.location.pathname.includes('admin.html') && !window.location.pathname.includes('cart.html') && !window.location.pathname.includes('wishlist.html') && !window.location.pathname.includes('product.html')) {
        injectCustomProducts();
    } else {
        setTimeout(() => setupProductCards(), 100);
    }

    // ==========================================
    // WISHLIST LOGIC
    // ==========================================
    const updateWishlistUI = () => {
        const wishlist = JSON.parse(localStorage.getItem('moda_wishlist')) || [];
        const wishlistBtns = document.querySelectorAll('.wishlist-btn-small, .btn-wishlist-outline');
        
        wishlistBtns.forEach(btn => {
            const card = btn.closest('.product-card');
            let title = '';
            if (card) {
                const titleEl = card.querySelector('h4');
                if (titleEl) title = titleEl.innerText.trim();
            } else if (btn.classList.contains('btn-wishlist-outline')) {
                const titleEl = document.querySelector('.product-detail-title');
                if(titleEl) title = titleEl.innerText.trim();
            }

            if (title) {
                const exists = wishlist.find(i => i.title === title);
                const icon = btn.querySelector('i');
                if (exists) {
                    if(icon) {
                        icon.classList.remove('far');
                        icon.classList.add('fas');
                        icon.style.color = 'var(--primary-color)';
                    }
                } else {
                    if(icon) {
                        icon.classList.remove('fas');
                        icon.classList.add('far');
                        icon.style.color = '';
                    }
                }
            }
        });
    };

    const toggleWishlist = (product) => {
        let wishlist = JSON.parse(localStorage.getItem('moda_wishlist')) || [];
        const index = wishlist.findIndex(i => i.title === product.title);
        
        if (index > -1) {
            wishlist.splice(index, 1);
        } else {
            wishlist.push(product);
        }
        
        localStorage.setItem('moda_wishlist', JSON.stringify(wishlist));
        updateWishlistUI();
    };

    document.addEventListener('click', (e) => {
        const btnSmall = e.target.closest('.wishlist-btn-small');
        const btnOutline = e.target.closest('.btn-wishlist-outline');
        
        if (btnSmall) {
            e.preventDefault();
            e.stopPropagation();
            
            const card = btnSmall.closest('.product-card');
            if (card) {
                const imgEl = card.querySelector('img');
                const titleEl = card.querySelector('h4');
                const priceEl = card.querySelector('.price');
                const brandEl = card.querySelector('.brand');

                if (imgEl && titleEl && priceEl) {
                    const priceText = priceEl.innerText.replace('$', '').replace(',', '');
                    toggleWishlist({
                        img: imgEl.src,
                        title: titleEl.innerText.trim(),
                        price: parseFloat(priceText),
                        brand: brandEl ? brandEl.innerText.trim() : 'MODA ARCHIVE'
                    });
                }
            }
        } else if (btnOutline) {
            e.preventDefault();
            const currentProduct = JSON.parse(localStorage.getItem('current_product'));
            if (currentProduct) toggleWishlist(currentProduct);
        }
    });

    // ==========================================
    // PRODUCT CARD CLICK -> REDIRECT TO PDP
    // ==========================================
    const setupProductCards = () => {
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(card => {
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            newCard.addEventListener('click', (e) => {
                if(e.target.closest('.wishlist-btn') || e.target.closest('.wishlist-btn-small')) {
                    return;
                }

                const imgEl = newCard.querySelector('img');
                const img = imgEl ? imgEl.src : '';
                const titleEl = newCard.querySelector('h4');
                const title = titleEl ? titleEl.innerText.trim() : 'Unknown Product';
                
                const priceEl = newCard.querySelector('.price');
                const priceText = priceEl ? priceEl.innerText : '$0.00';
                const price = parseFloat(priceText.replace('$', '').replace(',', ''));
                
                const brandEl = newCard.querySelector('.brand');
                const brand = brandEl ? brandEl.innerText.trim() : 'MODA ARCHIVE';

                const colorEl = newCard.querySelector('.color');
                const color = colorEl ? colorEl.innerText.trim() : 'Default';

                let img2 = '';
                let img3 = '';
                const cardId = newCard.getAttribute('data-product-id');
                if (cardId && window.dynamicProductsMap && window.dynamicProductsMap[cardId]) {
                    img2 = window.dynamicProductsMap[cardId].img2 || '';
                    img3 = window.dynamicProductsMap[cardId].img3 || '';
                }

                const currentProduct = {
                    img: img,
                    img2: img2,
                    img3: img3,
                    title: title,
                    price: price,
                    brand: brand,
                    color: color
                };
                
                localStorage.setItem('current_product', JSON.stringify(currentProduct));
                window.location.href = 'product.html';
            });
        });
    };

    // ==========================================
    // FILTER LOGIC (Brands)
    // ==========================================
    const brandCheckboxes = document.querySelectorAll('.filter-section input[type="checkbox"]');
    if (brandCheckboxes.length > 0) {
        brandCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const checkedBrands = Array.from(brandCheckboxes)
                    .filter(box => box.checked)
                    .map(box => box.nextElementSibling.innerText.trim().toUpperCase());
                
                const productCards = document.querySelectorAll('.collection-content .product-card');
                let visibleCount = 0;

                productCards.forEach(card => {
                    const brandEl = card.querySelector('.brand');
                    if (!brandEl) return;
                    const cardBrand = brandEl.innerText.trim().toUpperCase();
                    
                    if (checkedBrands.length === 0 || checkedBrands.includes(cardBrand)) {
                        card.style.display = ''; 
                        visibleCount++;
                    } else {
                        card.style.display = 'none';
                    }
                });

                const countEl = document.querySelector('.product-count');
                if (countEl) countEl.innerText = `${visibleCount} PRODUCTS FOUND`;
            });
        });
    }

    // ==========================================
    // PDP LOGIC
    // ==========================================
    if (window.location.pathname.includes('product.html')) {
        const currentProduct = JSON.parse(localStorage.getItem('current_product'));
        
        if (currentProduct) {
            const mainImg = document.querySelector('.main-product-img');
            if (mainImg) mainImg.src = currentProduct.img;

            const thumbs = document.querySelectorAll('.thumbnail-list .thumb');
            if (thumbs.length >= 3) {
                thumbs[0].src = currentProduct.img;
                thumbs[0].style.display = 'block';

                if (currentProduct.img2 && currentProduct.img2 !== currentProduct.img) {
                    thumbs[1].src = currentProduct.img2;
                    thumbs[1].style.display = 'block';
                } else {
                    thumbs[1].style.display = 'none';
                }

                if (currentProduct.img3 && currentProduct.img3 !== currentProduct.img && currentProduct.img3 !== currentProduct.img2) {
                    thumbs[2].src = currentProduct.img3;
                    thumbs[2].style.display = 'block';
                } else {
                    thumbs[2].style.display = 'none';
                }
            } else {
                thumbs.forEach(thumb => {
                    thumb.src = currentProduct.img;
                    thumb.style.display = 'block';
                });
            }
            
            const titleEl = document.querySelector('.product-detail-title');
            if (titleEl) titleEl.innerText = currentProduct.title;
            
            const priceEl = document.querySelector('.product-detail-price');
            if (priceEl) priceEl.innerText = '$' + currentProduct.price.toFixed(2);
        }

        // Thumbnail Click Logic
        const productThumbs = document.querySelectorAll('.thumbnail-list .thumb');
        const productMainImg = document.querySelector('.main-product-img');
        
        if (productThumbs.length > 0 && productMainImg) {
            productThumbs.forEach(thumb => {
                thumb.addEventListener('click', function() {
                    productThumbs.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    productMainImg.src = this.src;
                });
            });
        }

        // Size Selector Click Logic
        const sizeBtns = document.querySelectorAll('.pdp-sizes .size-btn');
        if (sizeBtns.length > 0) {
            sizeBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    sizeBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                });
            });
        }

        // Color Swatch Click Logic
        const colorBtns = document.querySelectorAll('.pdp-colors .color-btn');
        const selectedColorText = document.getElementById('pdp-selected-color');
        if (colorBtns.length > 0) {
            colorBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    colorBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    if (selectedColorText) {
                        const colorName = this.getAttribute('data-color') || 'CHARCOAL GREY';
                        selectedColorText.innerText = colorName.toUpperCase();
                    }
                });
            });
        }

        const addToCartBtn = document.getElementById('pdp-add-to-cart');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                if (!currentProduct) return;

                const activeSizeBtn = document.querySelector('.pdp-sizes .size-btn.active');
                const selectedSize = activeSizeBtn ? activeSizeBtn.innerText.trim() : 'M';

                const activeColorBtn = document.querySelector('.pdp-colors .color-btn.active');
                const selectedColor = activeColorBtn ? (activeColorBtn.getAttribute('data-color') || 'CHARCOAL GREY') : 'CHARCOAL GREY';

                const item = {
                    id: Date.now() + Math.random(),
                    img: currentProduct.img,
                    title: currentProduct.title,
                    price: currentProduct.price,
                    brand: currentProduct.brand,
                    qty: 1,
                    size: selectedSize,
                    color: selectedColor
                };

                let cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
                const existing = cart.find(i => i.title === item.title && i.size === item.size && i.color === item.color);
                if(existing) {
                    existing.qty += 1;
                } else {
                    cart.push(item);
                }
                localStorage.setItem('moda_cart', JSON.stringify(cart));
                
                window.location.href = 'cart.html';
            });
        }
    }

    // ==========================================
    // CART & WISHLIST PAGE LOGIC
    // ==========================================
    if (window.location.pathname.includes('cart.html')) {
        renderCart();
        setupCheckoutModal();
    }

    function renderCart() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        let cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
        container.innerHTML = '';

        if (cart.length === 0) {
            container.innerHTML = '<p style="padding: 2rem 0; color: var(--text-light);">Your shopping cart is currently empty.</p>';
            updateTotals(cart);
            return;
        }

        cart.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <div class="cart-item-info">
                    <img src="${item.img}" alt="${item.title}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-brand">${item.brand}</div>
                        <h4 class="cart-item-title">${item.title}</h4>
                        <div class="cart-item-meta">Size: ${item.size} | Color: ${item.color}</div>
                    </div>
                </div>
                <div class="cart-item-qty">
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                        <input type="text" class="qty-input" value="${item.qty}" readonly>
                        <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                    </div>
                </div>
                <div class="cart-item-total">
                    <div class="item-price">$${(item.price * item.qty).toFixed(2)}</div>
                    <div class="item-actions">
                        <button class="wishlist-btn-small" style="font-family: inherit; font-size: 0.8rem; border: none; background: transparent; cursor: pointer; text-transform: uppercase; color: var(--text-light);"><i class="far fa-heart"></i> SAVE</button>
                        <button onclick="removeItem(${index})"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(itemEl);
        });

        updateTotals(cart);
        updateWishlistUI();
    }

    window.updateQty = function(index, delta) {
        let cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
        if (cart[index]) {
            cart[index].qty += delta;
            if (cart[index].qty < 1) cart[index].qty = 1;
            localStorage.setItem('moda_cart', JSON.stringify(cart));
            renderCart();
            updateCartBadge();
        }
    }

    window.removeItem = function(index) {
        let cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
        cart.splice(index, 1);
        localStorage.setItem('moda_cart', JSON.stringify(cart));
        renderCart();
        updateCartBadge();
    }

    function updateTotals(cart) {
        const subtotalEl = document.getElementById('summary-subtotal');
        const taxEl = document.getElementById('summary-tax');
        const totalEl = document.getElementById('summary-total');
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * 0.0824; 
        const total = subtotal + tax;

        if (subtotalEl) subtotalEl.innerText = '$' + subtotal.toFixed(2);
        if (taxEl) taxEl.innerText = '$' + tax.toFixed(2);
        if (totalEl) totalEl.innerText = '$' + total.toFixed(2);
    }

    function setupCheckoutModal() {
        const checkoutBtn = document.querySelector('.checkout-btn');
        const modal = document.getElementById('checkout-modal');
        const closeBtn = document.querySelector('.close-modal-btn');
        const successCloseBtn = document.getElementById('success-close-btn');
        const form = document.getElementById('order-checkout-form');
        const paymentFormStep = document.getElementById('payment-form-step');
        const paymentSuccessStep = document.getElementById('payment-success-step');
        const modalGrandTotal = document.getElementById('modal-grand-total');
        const successShippingDate = document.getElementById('success-shipping-date');

        if (!checkoutBtn || !modal) return;

        checkoutBtn.addEventListener('click', () => {
            const cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
            if (cart.length === 0) {
                alert('Your shopping cart is empty!');
                return;
            }

            // Calculate total price
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const tax = subtotal * 0.0824;
            const total = subtotal + tax;

            if (modalGrandTotal) {
                modalGrandTotal.innerText = '$' + total.toFixed(2);
            }

            // Reset modal steps
            paymentFormStep.style.display = 'block';
            paymentSuccessStep.style.display = 'none';
            modal.style.display = 'flex';
        });

        const closeModal = () => {
            modal.style.display = 'none';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (successCloseBtn) {
            successCloseBtn.addEventListener('click', () => {
                closeModal();
                // Clear cart and reload cart page
                localStorage.removeItem('moda_cart');
                renderCart();
                updateCartBadge();
            });
        }

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const cart = JSON.parse(localStorage.getItem('moda_cart')) || [];
                const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
                const tax = subtotal * 0.0824;
                const total = parseFloat((subtotal + tax).toFixed(2));

                // Order details to send to server
                const orderData = {
                    items: cart.map(item => ({
                        title: item.title,
                        price: item.price,
                        brand: item.brand,
                        qty: item.qty,
                        size: item.size,
                        color: item.color,
                        img: item.img
                    })),
                    total_price: total,
                    customer_info: {
                        name: document.getElementById('cust-name')?.value || '',
                        phone: document.getElementById('cust-phone')?.value || '',
                        email: document.getElementById('cust-email')?.value || '',
                        address: document.getElementById('cust-address')?.value || '',
                        city: document.getElementById('cust-city')?.value || '',
                        state: document.getElementById('cust-state')?.value || '',
                        zip: document.getElementById('cust-zip')?.value || '',
                        country: document.getElementById('cust-country')?.value || ''
                    }
                };

                try {
                    // Disable submit button during fetch
                    const submitBtn = document.getElementById('submit-payment-btn');
                    if (submitBtn) submitBtn.disabled = true;

                    const res = await fetch('http://localhost:3000/api/orders', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(orderData)
                    });

                    if (res.ok) {
                        const data = await res.json();
                        
                        // Show success shipping date
                        if (successShippingDate) {
                            successShippingDate.innerText = data.shipping_date;
                        }

                        // Switch to success step
                        paymentFormStep.style.display = 'none';
                        paymentSuccessStep.style.display = 'block';
                    } else {
                        alert('Error processing order. Please try again.');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Network error. Is the Node.js server running?');
                } finally {
                    const submitBtn = document.getElementById('submit-payment-btn');
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
    }

    if (window.location.pathname.includes('wishlist.html')) {
        const container = document.getElementById('wishlist-container');
        const emptyMsg = document.getElementById('empty-wishlist-msg');
        
        window.renderWishlistPage = () => {
            if (!container || !emptyMsg) return;
            const wishlist = JSON.parse(localStorage.getItem('moda_wishlist')) || [];
            if (wishlist.length === 0) {
                container.innerHTML = '';
                emptyMsg.style.display = 'block';
                return;
            }

            emptyMsg.style.display = 'none';
            container.innerHTML = wishlist.map(item => `
                <div class="product-card">
                    <div class="product-image-wrapper">
                        <img src="${item.img}" alt="${item.title}">
                    </div>
                    <div class="product-info-collection">
                        <div class="brand-row">
                            <span class="brand">${item.brand}</span>
                            <button class="wishlist-btn-small">
                                <i class="fas fa-heart" style="color: var(--primary-color);"></i>
                            </button>
                        </div>
                        <h4>${item.title}</h4>
                        <div class="price-row">
                            <span class="price">$${item.price.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            const cards = container.querySelectorAll('.product-card');
            cards.forEach(card => {
                card.addEventListener('click', (e) => {
                    if(e.target.closest('.wishlist-btn-small')) return;
                    const title = card.querySelector('h4').innerText.trim();
                    const item = wishlist.find(i => i.title === title);
                    if(item) {
                        localStorage.setItem('current_product', JSON.stringify({
                            img: item.img, title: item.title, price: item.price, brand: item.brand, color: 'Default'
                        }));
                        window.location.href = 'product.html';
                    }
                });
            });
        };

        renderWishlistPage();

        document.addEventListener('click', (e) => {
            const btnSmall = e.target.closest('.wishlist-btn-small');
            if (btnSmall) {
                setTimeout(() => { if (window.renderWishlistPage) window.renderWishlistPage(); }, 50);
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const getSessionId = () => {
        const userStr = localStorage.getItem('moda_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.id) return 'user_' + user.id;
            } catch(e) {}
        }
        let sid = localStorage.getItem('moda_session_id');
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('moda_session_id', sid);
        }
        return sid;
    };

    window.logout = () => {
        localStorage.removeItem('moda_user');
        window.location.href = 'account.html';
    };

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

    const updateCartBadge = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/cart/${getSessionId()}`);
            if(!res.ok) return;
            const cart = await res.json();
            const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
            const badges = document.querySelectorAll('.cart-badge, .bag-count');
            badges.forEach(b => {
                b.innerText = totalItems;
                b.style.display = totalItems > 0 ? 'flex' : 'none';
            });
        } catch(e) {}
    };

    setupNavCart();

    const setupSearchBars = () => {
        const searchInputs = document.querySelectorAll('.search-bar input');
        searchInputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        window.location.href = `all-products.html?search=${encodeURIComponent(query)}`;
                    }
                }
            });
            // Also make the search icon clickable
            const icon = input.previousElementSibling;
            if (icon && icon.tagName.toLowerCase() === 'i') {
                icon.style.cursor = 'pointer';
                icon.addEventListener('click', () => {
                    const query = input.value.trim();
                    if (query) {
                        window.location.href = `all-products.html?search=${encodeURIComponent(query)}`;
                    }
                });
            }
        });
    };
    setupSearchBars();
    // ==========================================
    // ADMIN PANEL & DYNAMIC INJECTION (PostgreSQL)
    // ==========================================
    if (window.location.pathname.includes('admin.html')) {
        const form = document.getElementById('add-product-form');
        const tbody = document.querySelector('#custom-products-table tbody');
        const ordersTbody = document.getElementById('custom-orders-tbody');

        let allAdminProducts = [];
        let filteredAdminProducts = [];
        let adminProductsCurrentPage = 1;
        const adminProductsPerPage = 5;

        const populateAdminCategoryFilter = () => {
            const filterDropdown = document.getElementById('products-category-filter');
            if (!filterDropdown) return;
            
            const categories = ['T-SHIRTS', 'SHIRTS', 'JEANS', 'JACKETS', 'TROUSERS', 'BLAZERS', 'SHOES', 'ACCESSORIES', 'TOPS', 'DRESSES', 'SKIRTS', 'BAGS'];
            
            filterDropdown.innerHTML = '<option value="ALL">ALL</option>' + 
                categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        };

        window.filterAdminProducts = () => {
            const filterDropdown = document.getElementById('products-category-filter');
            const sectionDropdown = document.getElementById('products-section-filter');
            if (!filterDropdown) return;
            
            const selectedCategory = filterDropdown.value.toUpperCase();
            const selectedSection = sectionDropdown ? sectionDropdown.value : 'ALL';
            
            let tempProducts = [...allAdminProducts];
            
            if (selectedSection !== 'ALL') {
                tempProducts = tempProducts.filter(p => p.category === selectedSection);
            }
            
            if (selectedCategory !== 'ALL') {
                let searchWord = selectedCategory.toLowerCase();
                if (searchWord === 'shoes') searchWord = 'shoe';
                else if (searchWord === 'accessories') searchWord = 'accessory';
                else if (searchWord === 'dresses') searchWord = 'dress';
                else if (searchWord.endsWith('s')) searchWord = searchWord.slice(0, -1);
                
                tempProducts = tempProducts.filter(p => {
                    const cat = (p.category || '').toUpperCase();
                    const title = (p.title || '').toLowerCase();
                    return cat === selectedCategory || title.includes(searchWord) || title.includes(selectedCategory.toLowerCase());
                });
            }
            
            filteredAdminProducts = tempProducts;
            adminProductsCurrentPage = 1;
            displayAdminProducts();
        };

        const renderAdminProductsPagination = () => {
            const paginationContainer = document.getElementById('products-pagination');
            if (!paginationContainer) return;
            
            const totalPages = Math.ceil(filteredAdminProducts.length / adminProductsPerPage);
            if (totalPages <= 1) {
                paginationContainer.innerHTML = '';
                return;
            }

            let html = `
                <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.75rem;" onclick="changeAdminProductsPage(${adminProductsCurrentPage - 1})" ${adminProductsCurrentPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Prev</button>
                <span style="font-size: 0.85rem; font-weight: 500; color: #062b2b;">Page ${adminProductsCurrentPage} of ${totalPages}</span>
                <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.75rem;" onclick="changeAdminProductsPage(${adminProductsCurrentPage + 1})" ${adminProductsCurrentPage === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Next</button>
            `;
            paginationContainer.innerHTML = html;
        };

        window.changeAdminProductsPage = (page) => {
            const totalPages = Math.ceil(filteredAdminProducts.length / adminProductsPerPage);
            if (page >= 1 && page <= totalPages) {
                adminProductsCurrentPage = page;
                displayAdminProducts();
            }
        };

        const displayAdminProducts = () => {
            if (!tbody) return;
            
            if (filteredAdminProducts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">No products found in this category.</td></tr>';
                renderAdminProductsPagination();
                return;
            }

            const start = (adminProductsCurrentPage - 1) * adminProductsPerPage;
            const end = start + adminProductsPerPage;
            const paginatedProducts = filteredAdminProducts.slice(start, end);

            tbody.innerHTML = paginatedProducts.map((p) => `
                <tr>
                    <td class="td-img" style="display: flex; gap: 5px;">
                        <img src="${p.img}" alt="${p.title}">
                        ${p.img2 ? `<img src="${p.img2}" alt="thumb 2">` : ''}
                        ${p.img3 ? `<img src="${p.img3}" alt="thumb 3">` : ''}
                    </td>
                    <td>${p.title}</td>
                    <td>${p.category}</td>
                    <td>${p.brand}</td>
                    <td>₹${parseFloat(p.price).toFixed(2)}</td>
                    <td>${p.stock !== undefined ? p.stock : 0}</td>
                    <td>${p.sizes || 'N/A'}</td>
                    <td><button class="action-btn" onclick="deleteCustomProduct(${p.id})"><i class="fas fa-trash"></i></button></td>
                </tr>
            `).join('');

            renderAdminProductsPagination();
        };

        const renderAdminTable = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/products?admin=true');
                allAdminProducts = await res.json();
                filteredAdminProducts = [...allAdminProducts];
                adminProductsCurrentPage = 1;
                populateAdminCategoryFilter();
                displayAdminProducts();
            } catch (err) {
                if(tbody) tbody.innerHTML = '<tr><td colspan="8" style="color: red; text-align: center;">Could not connect to database. Is the Node.js server running?</td></tr>';
            }
        };

        const categoriesList = ['ALL', 'T-SHIRTS', 'SHIRTS', 'JEANS', 'JACKETS', 'TROUSERS', 'BLAZERS', 'SHOES', 'ACCESSORIES', 'TOPS', 'DRESSES', 'SKIRTS', 'BAGS'];
        
        const loadCategoryVisibility = async () => {
            const grid = document.getElementById('category-visibility-grid');
            if (!grid) return;
            try {
                const res = await fetch('http://localhost:3000/api/settings/categories');
                const { hidden } = await res.json();
                
                grid.innerHTML = categoriesList.map(cat => `
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; text-transform: none;">
                        <input type="checkbox" value="${cat}" ${hidden.includes(cat) ? '' : 'checked'}>
                        ${cat}
                    </label>
                `).join('');
                
                const saveBtn = document.getElementById('save-categories-btn');
                const saveMsg = document.getElementById('save-categories-msg');
                if (saveBtn) {
                    saveBtn.onclick = async () => {
                        const checkboxes = grid.querySelectorAll('input[type="checkbox"]');
                        const newHidden = [];
                        checkboxes.forEach(cb => {
                            if (!cb.checked) newHidden.push(cb.value);
                        });
                        
                        try {
                            await fetch('http://localhost:3000/api/settings/categories', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ hidden: newHidden })
                            });
                            saveMsg.innerText = 'Visibility saved successfully!';
                            saveMsg.style.color = '#10b981';
                            setTimeout(() => saveMsg.innerText = '', 3000);
                        } catch(e) {
                            saveMsg.innerText = 'Error saving settings.';
                            saveMsg.style.color = 'red';
                        }
                    };
                }
            } catch(e) {
                grid.innerHTML = '<span style="color:red">Failed to load settings.</span>';
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
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <img src="${item.img}" style="width: 45px; height: 55px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" alt="${item.title}">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.8rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${item.title}</div>
                                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 3px;">Size: ${item.size} | Color: ${item.color} | Qty: ${item.qty}</div>
                                </div>
                            </div>
                        `).join('');
                    } catch (e) {
                        itemsList = '<span style="color: red;">Error reading items</span>';
                    }

                    const dateObj = new Date(order.created_at);
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                    let badgeColor = '#f59e0b';
                    if (order.status === 'Dispatched') badgeColor = '#3b82f6';
                    else if (order.status === 'Out for Delivery') badgeColor = '#8b5cf6';
                    else if (order.status === 'Delivered') badgeColor = '#10b981';

                    const statusBadge = `<span style="background-color: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; display: inline-block;">${order.status === 'Pending' ? 'PROCESSING' : order.status.toUpperCase()}</span>`;

                    const dispatchBtn = `
                        <select onchange="updateOrderStatus(${order.id}, this.value)" style="padding: 6px 8px; font-size: 0.75rem; border: 1px solid #cbd5e1; border-radius: 4px; outline: none; background: white; cursor: pointer; color: #0f172a; font-weight: 500; min-width: 100px;">
                            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Processing</option>
                            <option value="Dispatched" ${order.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                            <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                    `;
                    
                    const deleteBtn = `<button class="action-btn" style="color: #ef4444; background: #fee2e2; width: 28px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: 0.2s; border: none; cursor: pointer;" onclick="deleteOrder(${order.id})" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'"><i class="fas fa-trash"></i></button>`;

                    return `
                        <tr>
                            <td style="font-weight: 700; color: #0f172a; font-size: 0.85rem;">#${order.id}</td>
                            <td style="font-size: 0.8rem; color: #64748b; line-height: 1.5;">${dateStr},<br>${timeStr}</td>
                            <td>${itemsList}</td>
                            <td style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">₹${parseFloat(order.total_price).toFixed(2)}</td>
                            <td>${statusBadge}</td>
                            <td style="font-size: 0.8rem; color: #334155; line-height: 1.5;">
                                <span style="font-weight: 600; color: #0f172a; text-transform: lowercase;">${order.customer_info?.name || ''}</span><br>
                                ${order.customer_info?.phone || ''}<br>
                                ${order.customer_info?.address || ''}, ${order.customer_info?.city || ''} ${order.customer_info?.zip || ''}<br>
                                ${order.customer_info?.country || 'US'}
                            </td>
                            <td style="font-size: 0.85rem; font-weight: 500;">
                                <div style="margin-bottom: 6px; font-weight: 600; font-size: 0.75rem; color: #0f172a;">${order.shipping_date || 'N/A'}</div>
                                <div style="display: flex; align-items: center; gap: 8px;">
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

        const customersTbody = document.getElementById('custom-customers-tbody');

        const renderAdminCustomers = async () => {
            if (!customersTbody) return;
            try {
                const res = await fetch('http://localhost:3000/api/admin/customers');
                const customers = await res.json();
                window.adminCustomers = customers; // Save for modal
                
                if (customers.length === 0) {
                    customersTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-light); padding: 2rem;">No customers found.</td></tr>';
                    return;
                }

                customersTbody.innerHTML = customers.map((c) => {
                    const avatarStr = c.name ? c.name.charAt(0).toUpperCase() : '?';
                    const lastOrderStr = c.last_order_date 
                        ? new Date(c.last_order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '<span style="color: #999;">Never</span>';
                        
                    return `
                        <tr>
                            <td style="font-weight: 600;">#${c.id}</td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 36px; height: 36px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem;">
                                        ${avatarStr}
                                    </div>
                                    <div style="font-weight: 600; font-family: 'Inter', sans-serif;">${c.name || 'Unknown'}</div>
                                </div>
                            </td>
                            <td style="color: var(--text-light);">${c.email}</td>
                            <td style="text-align: center;">
                                <span style="background: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.85rem;">
                                    ${c.total_orders}
                                </span>
                            </td>
                            <td style="font-weight: 600; font-family: 'Inter', sans-serif;">₹${parseFloat(c.total_spent).toFixed(2)}</td>
                            <td style="font-size: 0.9rem;">${lastOrderStr}</td>
                            <td>
                                <button class="action-btn" style="color: #64748b; font-size: 1rem;" title="View Details" onclick="viewCustomerDetails(${c.id})"><i class="fas fa-eye"></i></button>
                            </td>
                        </tr>
                    `;
                }).join('');

            } catch (err) {
                customersTbody.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">Could not connect to database to fetch customers.</td></tr>';
            }
        };

        window.viewCustomerDetails = async (userId) => {
            const customer = window.adminCustomers.find(c => c.id === userId);
            if (!customer) return;

            const modal = document.getElementById('customer-modal');
            const content = document.getElementById('customer-modal-content');
            if (!modal || !content) return;

            content.innerHTML = '<p style="padding: 2rem 0; text-align: center;">Loading order history...</p>';
            modal.style.display = 'flex';

            try {
                const res = await fetch(`http://localhost:3000/api/orders/user/${userId}`);
                const orders = await res.json();
                
                let ordersHtml = '';
                if (orders.length === 0) {
                    ordersHtml = '<p style="color: #666; padding: 1rem 0;">No order history available for this customer.</p>';
                } else {
                    ordersHtml = `
                        <div style="margin-top: 1.5rem;">
                            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">Recent Orders</h3>
                            <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto; padding-right: 10px;">
                                ${orders.map(o => `
                                    <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 1rem; background: #f8fafc;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                            <span style="font-weight: 600;">Order #${o.id}</span>
                                            <span style="color: #64748b; font-size: 0.85rem;">${new Date(o.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                                            <span>Status: <strong style="color: ${o.status !== 'Dispatched' ? '#f59e0b' : '#10b981'}">${o.status === 'Pending' ? 'Processing' : o.status}</strong></span>
                                            <span style="font-weight: 600;">₹${parseFloat(o.total_price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                content.innerHTML = `
                    <div style="display: flex; gap: 1.5rem; margin-bottom: 2rem;">
                        <div style="width: 80px; height: 80px; min-width: 80px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 600; font-family: var(--font-heading);">
                            ${customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div style="display: flex; flex-direction: column; justify-content: center;">
                            <h3 style="font-size: 1.5rem; margin-bottom: 0.4rem;">${customer.name || 'Unknown'}</h3>
                            <div style="color: #64748b; font-size: 0.95rem; margin-bottom: 0.3rem;"><i class="fas fa-envelope" style="width: 20px;"></i> ${customer.email}</div>
                            <div style="color: #64748b; font-size: 0.95rem;"><i class="fas fa-shopping-bag" style="width: 20px;"></i> ${customer.total_orders} Orders (Lifetime Value: <strong style="color:#000;">₹${parseFloat(customer.total_spent).toFixed(2)}</strong>)</div>
                        </div>
                    </div>
                    ${ordersHtml}
                `;

            } catch (err) {
                content.innerHTML = '<p style="color: red;">Failed to load customer details.</p>';
            }
        };

        // Navigation tab switching
        const navProducts = document.getElementById('admin-nav-products');
        const navOrders = document.getElementById('admin-nav-orders');
        const navCustomers = document.getElementById('admin-nav-customers');
        const productsPanel = document.getElementById('admin-products-panel');
        const ordersPanel = document.getElementById('admin-orders-panel');
        const customersPanel = document.getElementById('admin-customers-panel');

        if (navProducts && navOrders && navCustomers && productsPanel && ordersPanel && customersPanel) {
            const clearTabs = () => {
                navProducts.classList.remove('active');
                navOrders.classList.remove('active');
                navCustomers.classList.remove('active');
                productsPanel.style.display = 'none';
                ordersPanel.style.display = 'none';
                customersPanel.style.display = 'none';
            };

            navProducts.addEventListener('click', (e) => {
                e.preventDefault();
                clearTabs();
                navProducts.classList.add('active');
                productsPanel.style.display = 'block';
                renderAdminTable();
            });

            navOrders.addEventListener('click', (e) => {
                e.preventDefault();
                clearTabs();
                navOrders.classList.add('active');
                ordersPanel.style.display = 'block';
                renderAdminOrders();
            });

            navCustomers.addEventListener('click', (e) => {
                e.preventDefault();
                clearTabs();
                navCustomers.classList.add('active');
                customersPanel.style.display = 'block';
                renderAdminCustomers();
            });
            
            // Set default tab on load
            clearTabs();
            navProducts.classList.add('active');
            productsPanel.style.display = 'block';
            renderAdminTable();
        }

        if (tbody) {
            renderAdminTable();
            loadCategoryVisibility();
        }

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
                    
                    const checkedSizes = Array.from(document.querySelectorAll('#prod-sizes input[type="checkbox"]'))
                        .filter(cb => cb.checked)
                        .map(cb => cb.value)
                        .join(',');

                    const descriptionValue = document.getElementById('prod-description').value;
                    const materialValue = document.getElementById('prod-material').value;
                    const shippingValue = document.getElementById('prod-shipping').value;
                    console.log('Description value:', descriptionValue);
                    console.log('Material value:', materialValue);
                    console.log('Shipping value:', shippingValue);

                    const newItem = {
                        title: document.getElementById('prod-name').value,
                        price: parseFloat(document.getElementById('prod-price').value),
                        category: document.getElementById('prod-category').value,
                        brand: document.getElementById('prod-brand').value,
                        img: img1Base64,
                        img2: img2Base64,
                        img3: img3Base64,
                        sizes: checkedSizes,
                        description: descriptionValue,
                        material: materialValue,
                        shipping: shippingValue,
                        stock: parseInt(document.getElementById('prod-stock').value) || 0
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

        window.updateOrderStatus = async (id, newStatus) => {
            try {
                const res = await fetch(`http://localhost:3000/api/orders/${id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                if (res.ok) {
                    renderAdminOrders();
                } else {
                    alert('Failed to update status.');
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

            const fileName = window.location.pathname.split('/').pop();
            if (fileName === 'mens.html') {
                targetGrid = document.querySelector('.product-area .product-grid');
                allowedCategory = "Men's";
            } else if (fileName === 'womens.html') {
                targetGrid = document.querySelector('.product-area .product-grid');
                allowedCategory = "Women's";
            } else if (fileName === 'all-products.html') {
                targetGrid = document.querySelector('.product-area .product-grid');
                allowedCategory = "All";
            } else if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                targetGrid = document.querySelector('.product-grid');
                allowedCategory = "All";
            }

            if (targetGrid) {
                let htmlToInject = '';
                window.dynamicProductsMap = {}; 
                
                [...customProducts].reverse().forEach(p => {
                    window.dynamicProductsMap[p.id] = p;
                    if (allowedCategory === 'All' || p.category === allowedCategory) {
                        htmlToInject += `
                            <div class="product-card" data-product-id="${p.id}" data-category="${p.category}">
                                <div class="product-img-wrap">
                                    <span class="badge new" style="background-color: var(--accent-blue);">NEW</span>
                                    <button class="wishlist-btn"><i class="far fa-heart"></i></button>
                                    <img src="${p.img}" alt="${p.title}">
                                </div>
                                <div class="product-info">
                                    <div class="brand">${p.brand}</div>
                                    <h4 class="title">${p.title}</h4>
                                    <div class="price-wrap">
                                        <span class="price">₹${parseFloat(p.price).toFixed(2)}</span>
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
            if (typeof window.applyFilters === 'function') {
                setTimeout(() => window.applyFilters(), 100);
            }
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
    const updateWishlistUI = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/wishlist/${getSessionId()}`);
            if(!res.ok) return;
            const wishlist = await res.json();
            const wishlistBtns = document.querySelectorAll('.wishlist-btn, .btn-wishlist-outline');
            
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
        } catch(e) {}
    };

    const toggleWishlist = async (product) => {
        try {
            await fetch(`http://localhost:3000/api/wishlist/${getSessionId()}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(product)
            });
            updateWishlistUI();
            if (window.renderWishlistPage) window.renderWishlistPage();
        } catch(e) {}
    };

    document.addEventListener('click', (e) => {
        const btnSmall = e.target.closest('.wishlist-btn');
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
                    const priceText = priceEl.innerText.replace('₹', '').replace(',', '');
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
                if(e.target.closest('.wishlist-btn')) {
                    return;
                }

                const imgEl = newCard.querySelector('img');
                const img = imgEl ? imgEl.src : '';
                const titleEl = newCard.querySelector('h4');
                const title = titleEl ? titleEl.innerText.trim() : 'Unknown Product';
                
                const priceEl = newCard.querySelector('.price');
                const priceText = priceEl ? priceEl.innerText : '₹0.00';
                const price = parseFloat(priceText.replace('₹', '').replace(',', ''));
                
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

                if (cardId) {
                    localStorage.setItem('current_product_id', cardId);
                    localStorage.removeItem('current_product');
                } else {
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
                    localStorage.removeItem('current_product_id');
                }
                
                window.location.href = 'product.html';
            });
        });
    };

    // ==========================================
    // SEARCH LOGIC
    // ==========================================
    const searchInputs = document.querySelectorAll('.search-bar input');
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = (urlParams.get('search') || '').trim();
    
    if (searchQuery) {
        searchInputs.forEach(input => input.value = searchQuery);
    }
    
    searchInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = input.value.trim();
                if (query) {
                    window.location.href = `all-products.html?search=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = 'all-products.html';
                }
            }
        });
    });

    // ==========================================
    // Filter logic has been unified and moved to initMensFilters (now initialized for all collection pages)

    // ==========================================
    // PDP LOGIC
    // ==========================================
    if (window.location.pathname.includes('product.html')) {
        const loadProductPage = async () => {
            let currentProduct = null;
            const productId = localStorage.getItem('current_product_id');
            if (productId) {
                try {
                    const res = await fetch(`http://localhost:3000/api/products/${productId}`);
                    if (res.ok) {
                        currentProduct = await res.json();
                    }
                } catch(e) {}
            } else {
                currentProduct = JSON.parse(localStorage.getItem('current_product'));
            }
            
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
            if (priceEl) priceEl.innerText = '₹' + currentProduct.price.toFixed(2);
            
            const descriptionEl = document.getElementById('product-description');
            if (descriptionEl && currentProduct.description) {
                descriptionEl.innerText = currentProduct.description;
            }
            
            // Update tab content for Material & Care and Shipping
            const tabContent = document.querySelector('.tab-content');
            if (tabContent && currentProduct) {
                let descriptionHtml = '';
                if (currentProduct.description) {
                    descriptionHtml = `<p>${currentProduct.description}</p>`;
                } else {
                    descriptionHtml = '<p>Product description not available.</p>';
                }
                
                let materialHtml = '';
                if (currentProduct.material) {
                    materialHtml = `<p>${currentProduct.material}</p>`;
                } else {
                    materialHtml = '<p>Material and care information not available.</p>';
                }
                
                let shippingHtml = '';
                if (currentProduct.shipping) {
                    shippingHtml = `<p>${currentProduct.shipping}</p>`;
                } else {
                    shippingHtml = '<p>Shipping information not available.</p>';
                }
                
                // Store content for tabs
                window.tabContents = {
                    description: descriptionHtml,
                    material: materialHtml,
                    shipping: shippingHtml
                };
                
                // Set initial tab content to description
                tabContent.innerHTML = window.tabContents.description;
            }
            
            // Fade in main section after loading
            const mainSection = document.getElementById('product-main-section');
            if (mainSection) {
                mainSection.style.opacity = '1';
            }
        }

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

        // Tab switching functionality
        const tabHeaders = document.querySelectorAll('.tab-headers .tab');
        const tabContent = document.querySelector('.tab-content');
        
        if (tabHeaders.length > 0 && tabContent) {
            tabHeaders.forEach((tab, index) => {
                tab.addEventListener('click', function() {
                    tabHeaders.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    const tabName = this.innerText.toLowerCase();
                    if (window.tabContents && window.tabContents[tabName]) {
                        tabContent.innerHTML = window.tabContents[tabName];
                    }
                });
            });
        }

        const sizeBtns = document.querySelectorAll('.pdp-sizes .size-btn');
        if (sizeBtns.length > 0) {
            sizeBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    sizeBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                });
            });
        }

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
            addToCartBtn.addEventListener('click', async () => {
                if (!currentProduct) return;

                const activeSizeBtn = document.querySelector('.pdp-sizes .size-btn.active');
                const selectedSize = activeSizeBtn ? activeSizeBtn.innerText.trim() : 'M';

                const activeColorBtn = document.querySelector('.pdp-colors .color-btn.active');
                const selectedColor = activeColorBtn ? (activeColorBtn.getAttribute('data-color') || 'CHARCOAL GREY') : 'CHARCOAL GREY';

                const item = {
                    img: currentProduct.img,
                    title: currentProduct.title,
                    price: currentProduct.price,
                    brand: currentProduct.brand,
                    qty: 1,
                    size: selectedSize,
                    color: selectedColor
                };

                try {
                    const submitBtn = document.getElementById('pdp-add-to-cart');
                    if (submitBtn) submitBtn.disabled = true;
                    
                    await fetch(`http://localhost:3000/api/cart/${getSessionId()}`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(item)
                    });
                    
                    window.location.href = 'cart.html';
                } catch(e) {
                    alert('Error adding to cart. Is the backend running?');
                    const submitBtn = document.getElementById('pdp-add-to-cart');
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        const pdpWishlistBtn = document.querySelector('.btn-wishlist-outline');
        if (pdpWishlistBtn) {
            pdpWishlistBtn.addEventListener('click', async () => {
                if (!currentProduct) return;
                
                // Add loading state or feedback
                const icon = pdpWishlistBtn.querySelector('i');
                if (icon) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                    icon.style.color = 'var(--primary-color, #111)';
                }

                await toggleWishlist({
                    img: currentProduct.img,
                    title: currentProduct.title,
                    price: currentProduct.price,
                    brand: currentProduct.brand
                });
                
                // Show a quick alert or change text to let user know it worked
                pdpWishlistBtn.innerHTML = '<i class="fas fa-heart" style="color: var(--primary-color, #111);"></i> ADDED TO WISHLIST';
                
                // Optionally redirect to wishlist page
                // window.location.href = 'wishlist.html'; 
            });
        }

        // Fetch related products dynamically
        if (currentProduct && currentProduct.category) {
            try {
                const res = await fetch('http://localhost:3000/api/products');
                if (res.ok) {
                    const allProducts = await res.json();
                    const relatedProducts = allProducts.filter(p => p.category === currentProduct.category && p.id !== currentProduct.id).slice(0, 4);
                    const grid = document.getElementById('related-products-grid');
                    if (grid) {
                        if (relatedProducts.length > 0) {
                            grid.innerHTML = relatedProducts.map(p => `
                                <div class="product-card" data-product-id="${p.id}" data-category="${p.category}" style="cursor: pointer;">
                                    <div class="product-img-wrap">
                                        <button class="wishlist-btn"><i class="far fa-heart"></i></button>
                                        <img src="${p.img}" alt="${p.title}">
                                    </div>
                                    <div class="product-info">
                                        <div class="brand">${p.brand || 'MODA ARCHIVE'}</div>
                                        <h4 class="title">${p.title}</h4>
                                        <div class="price-wrap">
                                            <span class="price">₹${parseFloat(p.price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('');

                            // Setup click listener to navigate to the related product
                            grid.querySelectorAll('.product-card').forEach(card => {
                                card.addEventListener('click', (e) => {
                                    if (e.target.closest('.wishlist-btn')) return;
                                    localStorage.setItem('current_product_id', card.dataset.productId);
                                    const prod = allProducts.find(p => p.id == card.dataset.productId);
                                    if (prod) localStorage.setItem('current_product', JSON.stringify(prod));
                                    window.location.href = 'product.html';
                                });
                            });

                            // Setup wishlist button click listener
                            grid.querySelectorAll('.wishlist-btn').forEach(btn => {
                                btn.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    const card = e.target.closest('.product-card');
                                    const prod = allProducts.find(p => p.id == card.dataset.productId);
                                    if (prod) {
                                        const icon = btn.querySelector('i');
                                        if (icon) {
                                            icon.classList.remove('far');
                                            icon.classList.add('fas');
                                            icon.style.color = 'var(--primary-color, #111)';
                                        }
                                        if (typeof toggleWishlist === 'function') {
                                            await toggleWishlist({
                                                img: prod.img,
                                                title: prod.title,
                                                price: prod.price,
                                                brand: prod.brand || 'MODA ARCHIVE'
                                            });
                                        }
                                    }
                                });
                            });
                        } else {
                            grid.innerHTML = '<p>No related products found.</p>';
                        }
                    }
                }
            } catch(e) {
                console.error('Error fetching related products:', e);
            }
        }

        // Fetch and handle reviews
        if (currentProduct) {
            const fetchReviews = async () => {
                try {
                    const res = await fetch(`http://localhost:3000/api/reviews/${currentProduct.id}`);
                    if (res.ok) {
                        const reviews = await res.json();
                        const listContainer = document.getElementById('reviews-list-container');
                        const avgRatingEl = document.getElementById('review-avg-rating');
                        const countTextEl = document.getElementById('review-count-text');
                        const starsEl = document.getElementById('review-avg-stars');

                        if (!listContainer) return;

                        if (reviews.length === 0) {
                            listContainer.innerHTML = '<p style="padding-top: 2rem;">No reviews yet. Be the first to review this product!</p>';
                            if (avgRatingEl) avgRatingEl.innerText = '0.0';
                            if (countTextEl) countTextEl.innerText = 'BASED ON 0 REVIEWS';
                            if (starsEl) starsEl.innerHTML = '<i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i>';
                            return;
                        }

                        let totalRating = 0;
                        listContainer.innerHTML = reviews.map(r => {
                            totalRating += r.rating;
                            const d = new Date(r.created_at);
                            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
                            let starHtml = '';
                            for (let i = 1; i <= 5; i++) {
                                starHtml += i <= r.rating ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
                            }
                            return `
                                <div class="review-item">
                                    <div class="review-header">
                                        <span class="reviewer-name">${r.reviewer_name.toUpperCase()}</span>
                                        <span class="review-date">${dateStr}</span>
                                    </div>
                                    <div class="stars">${starHtml}</div>
                                    <h5>${r.title}</h5>
                                    <p>${r.content}</p>
                                </div>
                            `;
                        }).join('');

                        const avgRating = (totalRating / reviews.length).toFixed(1);
                        if (avgRatingEl) avgRatingEl.innerText = avgRating;
                        if (countTextEl) countTextEl.innerText = `BASED ON ${reviews.length} REVIEW${reviews.length > 1 ? 'S' : ''}`;
                        if (starsEl) {
                            let avgStarHtml = '';
                            const fullStars = Math.floor(avgRating);
                            const halfStar = avgRating - fullStars >= 0.5;
                            for (let i = 1; i <= 5; i++) {
                                if (i <= fullStars) {
                                    avgStarHtml += '<i class="fas fa-star"></i>';
                                } else if (i === fullStars + 1 && halfStar) {
                                    avgStarHtml += '<i class="fas fa-star-half-alt"></i>';
                                } else {
                                    avgStarHtml += '<i class="far fa-star"></i>';
                                }
                            }
                            starsEl.innerHTML = avgStarHtml;
                        }
                    }
                } catch(e) {
                    console.error('Error fetching reviews:', e);
                }
            };

            await fetchReviews();

            // Review Modal Logic
            const modal = document.getElementById('review-modal');
            const openBtn = document.getElementById('open-review-modal-btn');
            const closeBtn = document.getElementById('close-review-modal');
            const reviewForm = document.getElementById('review-form');

            if (modal && openBtn && closeBtn && reviewForm) {
                openBtn.addEventListener('click', () => {
                    modal.style.display = 'flex';
                    const userStr = localStorage.getItem('moda_user');
                    if (userStr) {
                        try {
                            const user = JSON.parse(userStr);
                            if (user && user.name) {
                                const nameInput = document.getElementById('review-name');
                                nameInput.value = user.name;
                                nameInput.readOnly = true;
                                nameInput.style.backgroundColor = '#f0f0f0'; // Visual cue that it's disabled
                            }
                        } catch(e) {}
                    }
                });
                closeBtn.addEventListener('click', () => modal.style.display = 'none');
                window.addEventListener('click', (e) => {
                    if (e.target === modal) modal.style.display = 'none';
                });

                reviewForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = reviewForm.querySelector('button[type="submit"]');
                    btn.disabled = true;
                    btn.innerText = 'SUBMITTING...';

                    const newReview = {
                        product_id: currentProduct.id,
                        reviewer_name: document.getElementById('review-name').value,
                        rating: parseInt(document.getElementById('review-rating').value),
                        title: document.getElementById('review-title').value,
                        content: document.getElementById('review-content').value
                    };

                    try {
                        const res = await fetch('http://localhost:3000/api/reviews', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newReview)
                        });
                        if (res.ok) {
                            modal.style.display = 'none';
                            reviewForm.reset();
                            await fetchReviews();
                        } else {
                            alert('Failed to submit review.');
                        }
                    } catch (err) {
                        alert('Error submitting review.');
                    } finally {
                        btn.disabled = false;
                        btn.innerText = 'SUBMIT REVIEW';
                    }
                });
            }
        }
        
        };
        loadProductPage();
    }

    // ==========================================
    // CART & WISHLIST PAGE LOGIC
    // ==========================================
    if (window.location.pathname.includes('cart.html')) {
        renderCart();
        setupCheckoutModal();
    }

    async function renderCart() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        container.innerHTML = '<p style="padding: 2rem 0; color: var(--text-light);">Loading cart...</p>';
        
        try {
            const res = await fetch(`http://localhost:3000/api/cart/${getSessionId()}`);
            const cart = await res.json();
            container.innerHTML = '';

            if (cart.length === 0) {
                container.innerHTML = '<p style="padding: 2rem 0; color: var(--text-light);">Your shopping cart is currently empty.</p>';
                updateTotals(cart);
                return;
            }

            cart.forEach((item) => {
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
                            <button class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
                            <input type="text" class="qty-input" value="${item.qty}" readonly>
                            <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
                        </div>
                    </div>
                    <div class="cart-item-total">
                        <div class="item-price">₹${(item.price * item.qty).toFixed(2)}</div>
                        <div class="item-actions">
                            <button class="wishlist-btn-small" style="font-family: inherit; font-size: 0.8rem; border: none; background: transparent; cursor: pointer; text-transform: uppercase; color: var(--text-light);"><i class="far fa-heart"></i> SAVE</button>
                            <button onclick="removeItem(${item.id})"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
                container.appendChild(itemEl);
            });

            updateTotals(cart);
            updateWishlistUI();
        } catch(e) {
            container.innerHTML = '<p style="padding: 2rem 0; color: red;">Error loading cart. Is backend running?</p>';
        }
    }

    window.updateQty = async function(itemId, delta) {
        try {
            await fetch(`http://localhost:3000/api/cart/${getSessionId()}/${itemId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({delta})
            });
            renderCart();
            updateCartBadge();
        } catch(e) {}
    }

    window.removeItem = async function(itemId) {
        try {
            await fetch(`http://localhost:3000/api/cart/${getSessionId()}/${itemId}`, {
                method: 'DELETE'
            });
            renderCart();
            updateCartBadge();
        } catch(e) {}
    }

    let isPromoApplied = false;

    const promoBtn = document.getElementById('promo-btn');
    if (promoBtn) {
        promoBtn.addEventListener('click', async () => {
            const input = document.getElementById('promo-input');
            const msg = document.getElementById('promo-msg');
            const code = input.value.trim().toUpperCase();
            
            if (code === 'MODA20') {
                if (localStorage.getItem('moda20_used') === 'true') {
                    msg.innerText = 'This promo code has already been used.';
                    msg.style.color = '#e74c3c';
                } else {
                    isPromoApplied = true;
                    msg.innerText = 'Promo code applied! 20% discount.';
                    msg.style.color = '#10b981';
                    try {
                        const res = await fetch(`http://localhost:3000/api/cart/${getSessionId()}`);
                        const cart = await res.json();
                        updateTotals(cart);
                    } catch(e){}
                }
            } else {
                msg.innerText = 'Invalid promo code.';
                msg.style.color = '#e74c3c';
                isPromoApplied = false;
                try {
                    const res = await fetch(`http://localhost:3000/api/cart/${getSessionId()}`);
                    const cart = await res.json();
                    updateTotals(cart);
                } catch(e){}
            }
        });
    }

    function updateTotals(cart) {
        const subtotalEl = document.getElementById('summary-subtotal');
        const taxEl = document.getElementById('summary-tax');
        const totalEl = document.getElementById('summary-total');
        const discountEl = document.getElementById('summary-discount');
        const discountRow = document.getElementById('summary-discount-row');

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const discountAmt = subtotal * (isPromoApplied ? 0.20 : 0);
        const discountedSubtotal = subtotal - discountAmt;
        const tax = discountedSubtotal * 0.0824; 
        const total = discountedSubtotal + tax;

        if (subtotalEl) subtotalEl.innerText = '₹' + subtotal.toFixed(2);
        
        if (discountEl && discountRow) {
            if (isPromoApplied) {
                discountRow.style.display = 'flex';
                discountEl.innerText = '-₹' + discountAmt.toFixed(2);
            } else {
                discountRow.style.display = 'none';
            }
        }
        
        if (taxEl) taxEl.innerText = '₹' + tax.toFixed(2);
        if (totalEl) totalEl.innerText = '₹' + total.toFixed(2);
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

        checkoutBtn.addEventListener('click', async () => {
            const userJson = localStorage.getItem('moda_user');
            if (!userJson) {
                window.location.href = 'account.html?msg=checkout';
                return;
            }

            try {
                const res = await fetch(`http://localhost:3000/api/cart/${getSessionId()}`);
                const cart = await res.json();
                
                if (cart.length === 0) {
                    alert('Your shopping cart is empty!');
                    return;
                }

                window.currentCheckoutCart = cart;

                const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
                const discountAmt = subtotal * (isPromoApplied ? 0.20 : 0);
                const discountedSubtotal = subtotal - discountAmt;
                const tax = discountedSubtotal * 0.0824;
                const total = discountedSubtotal + tax;

                if (modalGrandTotal) {
                    modalGrandTotal.innerText = '₹' + total.toFixed(2);
                }

                paymentFormStep.style.display = 'block';
                paymentSuccessStep.style.display = 'none';
                modal.style.display = 'flex';
            } catch (e) {
                alert('Error connecting to backend to fetch cart.');
            }
        });

        const closeModal = () => {
            modal.style.display = 'none';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (successCloseBtn) {
            successCloseBtn.addEventListener('click', () => {
                closeModal();
                renderCart();
                updateCartBadge();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const cartData = window.currentCheckoutCart || [];
                const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.qty), 0);
                const discountAmt = subtotal * (isPromoApplied ? 0.20 : 0);
                const discountedSubtotal = subtotal - discountAmt;
                const tax = discountedSubtotal * 0.0824;
                const total = parseFloat((discountedSubtotal + tax).toFixed(2));

                let orderUserId = null;
                try {
                    const u = JSON.parse(localStorage.getItem('moda_user'));
                    if (u && u.id) orderUserId = u.id;
                } catch(e) {}

                const orderData = {
                    items: cartData.map(item => ({
                        title: item.title,
                        price: item.price,
                        qty: item.qty,
                        size: item.size,
                        color: item.color,
                        img: item.img
                    })),
                    total_price: total,
                    user_id: orderUserId,
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
                    const submitBtn = document.getElementById('submit-payment-btn');
                    if (submitBtn) submitBtn.disabled = true;

                    const res = await fetch('http://localhost:3000/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                    });

                    if (res.ok) {
                        const data = await res.json();
                        
                        if (isPromoApplied) {
                            localStorage.setItem('moda20_used', 'true');
                        }
                        
                        if (successShippingDate) {
                            successShippingDate.innerText = data.shipping_date;
                        }

                        // Clear the cart on backend after successful order
                        await fetch(`http://localhost:3000/api/cart/${getSessionId()}`, { method: 'DELETE' });

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
        
        window.renderWishlistPage = async () => {
            if (!container || !emptyMsg) return;
            try {
                const res = await fetch(`http://localhost:3000/api/wishlist/${getSessionId()}`);
                const wishlist = await res.json();
                
                if (wishlist.length === 0) {
                    container.innerHTML = '';
                    emptyMsg.style.display = 'block';
                    return;
                }

                emptyMsg.style.display = 'none';
                container.innerHTML = wishlist.map(item => `
                    <div class="product-card">
                        <div class="product-img-wrap">
                            <button class="wishlist-btn wishlist-btn-small">
                                <i class="fas fa-heart" style="color: var(--primary-color);"></i>
                            </button>
                            <img src="${item.img}" alt="${item.title}">
                        </div>
                        <div class="product-info">
                            <div class="brand">${item.brand}</div>
                            <h4 class="title">${item.title}</h4>
                            <div class="price-wrap">
                                <span class="price">₹${item.price.toFixed(2)}</span>
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
            } catch(e) {}
        };

        renderWishlistPage();
    }

    // ==========================================
    // ACCOUNT LOGIC
    // ==========================================
    const checkAuthState = () => {
        const userJson = localStorage.getItem('moda_user');
        const accountLinks = document.querySelectorAll('.account-link-nav');
        
        if (userJson) {
            try {
                const user = JSON.parse(userJson);
                accountLinks.forEach(link => {
                    link.innerText = user.name.split(' ')[0]; // Show first name
                    link.href = 'account.html';
                });
            } catch (e) {
                console.error("Error parsing user data");
            }
        } else {
            accountLinks.forEach(link => {
                link.innerText = 'Account';
                link.href = 'account.html';
            });
        }
    };
    checkAuthState();

    if (window.location.pathname.includes('account.html')) {
        const uStr = localStorage.getItem('moda_user');
        if (uStr) {
            try {
                const u = JSON.parse(uStr);
                if (u && u.id) {
                    const profileSection = document.getElementById('profile-section');
                    const authWrapper = document.getElementById('auth-wrapper');
                    
                    if (profileSection && authWrapper) {
                        profileSection.style.display = 'block';
                        authWrapper.style.display = 'none';
                        
                        document.getElementById('profile-name').innerText = u.name || '';
                        document.getElementById('profile-email').innerText = u.email || '';
                        
                        const greetingEl = document.getElementById('greeting-name');
                        if (greetingEl) greetingEl.innerText = (u.name || 'User').split(' ')[0];

                        const settingsName = document.getElementById('settings-name');
                        const settingsEmail = document.getElementById('settings-email');
                        if (settingsName) settingsName.value = u.name || '';
                        if (settingsEmail) settingsEmail.value = u.email || '';

                        
                        fetch(`http://localhost:3000/api/orders/user/${u.id}`)
                            .then(res => res.json())
                            .then(orders => {
                                const list = document.getElementById('user-orders-list');
                                if (!list) return;
                                if (!orders || orders.length === 0) {
                                    list.innerHTML = '<p>No orders found.</p>';
                                    return;
                                }
                                let html = '';
                                orders.forEach(order => {
                                    const formattedTotal = '₹' + order.total_price.toFixed(2);
                                    html += `
                                        <div class="order-card">
                                            <div class="order-header">
                                                <div class="order-header-info">
                                                    <p class="order-date">Placed on ${order.shipping_date}</p>
                                                    <p class="order-id">Order #${order.id}</p>
                                                </div>
                                                <div class="order-status status-${order.status}">${order.status === 'Pending' ? 'Processing' : order.status}</div>
                                            </div>
                                            <div class="order-body">
                                                <div class="order-item-list">
                                                    ${(order.items || []).map(item => `
                                                        <div class="order-item">
                                                            <img src="${item.img || 'https://via.placeholder.com/90x120'}" alt="${item.title}" class="order-item-img">
                                                            <div class="order-item-details">
                                                                <h4 class="order-item-title">${item.title}</h4>
                                                                <p class="order-item-meta">Qty: ${item.qty} | Brand: ${item.brand || 'MODA ARCHIVE'}</p>
                                                                <span class="order-item-price">₹${item.price ? parseFloat(item.price).toFixed(2) : '0.00'}</span>
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                            <div class="order-footer">
                                                <span class="order-total">Total: ${formattedTotal}</span>
                                                <button class="btn-outline" onclick="trackPackage(${order.id}, '${order.status}')">Track Package</button>
                                            </div>
                                        </div>
                                    `;
                                });
                                list.innerHTML = html;
                                
                                // Define trackPackage if not defined
                                if (!window.trackPackage) {
                                    window.trackPackage = (orderId, status) => {
                                        const modal = document.getElementById('tracking-modal');
                                        const title = document.getElementById('tracking-order-title');
                                        const idText = document.getElementById('tracking-order-id');
                                        const timeline = document.getElementById('tracking-timeline-container');
                                        
                                        if (modal && title && idText && timeline) {
                                            title.innerText = 'Track Package';
                                            idText.innerText = 'Order #' + orderId + ' • Tracking ID: TRK' + orderId + Math.floor(Math.random() * 10000);
                                            
                                            let timelineHtml = `
                                                <div class="tracking-step active">
                                                    <div class="tracking-step-title">Order Placed</div>
                                                    <div class="tracking-step-desc">We have received your order.</div>
                                                </div>
                                                <div class="tracking-step ${['Dispatched', 'Out for Delivery', 'Delivered'].includes(status) ? 'active' : ''}">
                                                    <div class="tracking-step-title">Processing</div>
                                                    <div class="tracking-step-desc">${['Dispatched', 'Out for Delivery', 'Delivered'].includes(status) ? 'Your items have been picked and packed.' : 'Your items are being picked and packed.'}</div>
                                                </div>
                                                <div class="tracking-step ${['Dispatched', 'Out for Delivery', 'Delivered'].includes(status) ? 'active' : ''}">
                                                    <div class="tracking-step-title">Dispatched</div>
                                                    <div class="tracking-step-desc">${['Dispatched', 'Out for Delivery', 'Delivered'].includes(status) ? 'Your package is on the way. Courier: BlueDart.' : 'Pending'}</div>
                                                </div>
                                                <div class="tracking-step ${['Out for Delivery', 'Delivered'].includes(status) ? 'active' : ''}">
                                                    <div class="tracking-step-title">Out for Delivery</div>
                                                    <div class="tracking-step-desc">${['Out for Delivery', 'Delivered'].includes(status) ? 'Out for delivery today.' : 'Pending'}</div>
                                                </div>
                                                <div class="tracking-step ${status === 'Delivered' ? 'delivered' : ''}">
                                                    <div class="tracking-step-title">Delivered</div>
                                                    <div class="tracking-step-desc">${status === 'Delivered' ? 'Your package has been delivered! 🎉' : 'Pending'}</div>
                                                </div>
                                            `;
                                            timeline.innerHTML = timelineHtml;
                                            
                                            // Handle confetti
                                            const existingConfetti = modal.querySelector('.confetti-wrapper');
                                            if (existingConfetti) existingConfetti.remove();
                                            
                                            if (status === 'Delivered') {
                                                const confettiWrapper = document.createElement('div');
                                                confettiWrapper.className = 'confetti-wrapper';
                                                
                                                // Create a burst of confetti from bottom center (party popper style)
                                                for (let i = 0; i < 70; i++) {
                                                    const confetti = document.createElement('div');
                                                    confetti.className = 'confetti';
                                                    
                                                    // Math for burst physics
                                                    const angle = (Math.random() * 80 + 230) * (Math.PI / 180); // Upwards cone
                                                    const velocity = 150 + Math.random() * 300; 
                                                    const tx = Math.cos(angle) * velocity;
                                                    const ty = Math.sin(angle) * velocity;
                                                    const rotate = (Math.random() - 0.5) * 1000;
                                                    
                                                    // Set custom css variables for the animation keyframes
                                                    confetti.style.setProperty('--tx', `${tx}px`);
                                                    confetti.style.setProperty('--ty', `${ty}px`);
                                                    confetti.style.setProperty('--rot', `${rotate}deg`);
                                                    
                                                    // Start at bottom middle
                                                    confetti.style.left = '50%';
                                                    confetti.style.bottom = '-20px';
                                                    confetti.style.animationDelay = (Math.random() * 0.15) + 's';
                                                    
                                                    // Random colors and shapes
                                                    const colors = ['#f2d74e', '#95c3de', '#ff9a91', '#10b981', '#a855f7', '#ec4899'];
                                                    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                                                    if (Math.random() > 0.5) confetti.style.borderRadius = '50%';
                                                    if (Math.random() > 0.7) {
                                                        confetti.style.width = '12px';
                                                        confetti.style.height = '12px';
                                                    }
                                                    
                                                    confettiWrapper.appendChild(confetti);
                                                }
                                                modal.querySelector('.tracking-modal-content').appendChild(confettiWrapper);
                                            }
                                            
                                            modal.style.display = 'flex';
                                        }
                                    };
                                }
                            })
                            .catch(err => {
                                const list = document.getElementById('user-orders-list');
                                if (list) list.innerHTML = '<p>Error loading orders.</p>';
                            });
                    }
                }
            } catch(e) {}
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('msg') === 'checkout') {
                const authTitle = document.querySelector('.auth-title');
                if (authTitle) {
                    authTitle.insertAdjacentHTML('afterend', '<div class="form-message error" style="display: block; margin-bottom: 1.5rem; background-color: #fef3c7; color: #92400e; border-color: #f59e0b; padding: 1rem; border-radius: 4px;">Please create an account or sign in to proceed with your order.</div>');
                }
            }
        }

        const registerForm = document.getElementById('register-form');
        const loginForm = document.getElementById('login-form');
        const registerMsg = document.getElementById('register-message');
        const loginMsg = document.getElementById('login-message');
        
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const uStr = localStorage.getItem('moda_user');
                if (!uStr) return;
                const u = JSON.parse(uStr);
                const msgEl = document.getElementById('settings-message');
                msgEl.style.display = 'block';
                
                const name = document.getElementById('settings-name').value;
                const email = document.getElementById('settings-email').value;
                const password = document.getElementById('settings-password').value;
                
                try {
                    const res = await fetch(`http://localhost:3000/api/users/${u.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password })
                    });
                    const data = await res.json();
                    
                    if (res.ok && data.success) {
                        msgEl.className = 'form-message success';
                        msgEl.innerText = 'Profile updated successfully!';
                        localStorage.setItem('moda_user', JSON.stringify(data.user));
                        document.getElementById('profile-name').innerText = data.user.name;
                        document.getElementById('profile-email').innerText = data.user.email;
                        const greetingEl = document.getElementById('greeting-name');
                        if (greetingEl) greetingEl.innerText = data.user.name.split(' ')[0];
                        document.getElementById('settings-password').value = '';
                        checkAuthState();
                    } else {
                        msgEl.className = 'form-message error';
                        msgEl.innerText = data.error || 'Failed to update profile.';
                    }
                } catch (err) {
                    msgEl.className = 'form-message error';
                    msgEl.innerText = 'Network error. Try again.';
                }
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('register-name').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;

                try {
                    const res = await fetch('http://localhost:3000/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        registerMsg.className = 'form-message success';
                        registerMsg.innerText = 'Registration successful! You can now log in.';
                        registerMsg.style.display = 'block';
                        registerForm.reset();
                    } else {
                        registerMsg.className = 'form-message error';
                        registerMsg.innerText = data.error || 'Registration failed.';
                        registerMsg.style.display = 'block';
                    }
                } catch (err) {
                    registerMsg.className = 'form-message error';
                    registerMsg.innerText = 'Error connecting to server.';
                    registerMsg.style.display = 'block';
                }
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;

                try {
                    const res = await fetch('http://localhost:3000/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        localStorage.setItem('moda_user', JSON.stringify(data.user));
                        loginMsg.className = 'form-message success';
                        loginMsg.innerText = 'Login successful! Redirecting...';
                        loginMsg.style.display = 'block';
                        
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1000);
                    } else {
                        loginMsg.className = 'form-message error';
                        loginMsg.innerText = data.error || 'Login failed.';
                        loginMsg.style.display = 'block';
                    }
                } catch (err) {
                    loginMsg.className = 'form-message error';
                    loginMsg.innerText = 'Error connecting to server.';
                    loginMsg.style.display = 'block';
                }
            });
        }
    }

    // ==========================================
    // MENS PAGE FILTERS (DYNAMIC BRAND, SIZE)
    // ==========================================
    const initMensFilters = () => {
        if (!document.querySelector('.sidebar-filters') || !document.querySelector('.product-area')) return;

        const filterGroups = document.querySelectorAll('.filter-group');
        let brandGroup = null;
        let sizeGroup = null;
        
        filterGroups.forEach(group => {
            const title = group.querySelector('.filter-title');
            if (title && title.textContent.includes('BRAND')) brandGroup = group;
            if (title && title.textContent.includes('SIZE')) sizeGroup = group;
        });

        const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '5XL'];
        const sizeButtons = sizeGroup ? sizeGroup.querySelectorAll('.size-grid button') : [];

        const categoryStripItems = document.querySelectorAll('.categories-strip .category-item');
        let selectedCategoryItem = 'ALL';

        if (categoryStripItems.length > 0) {
            fetch('http://localhost:3000/api/settings/categories')
                .then(res => res.json())
                .then(data => {
                    const hidden = data.hidden || [];
                    categoryStripItems.forEach(item => {
                        const catText = item.querySelector('span').textContent.trim().toUpperCase();
                        if (hidden.includes(catText)) {
                            item.style.display = 'none';
                        }
                        item.addEventListener('click', () => {
                            categoryStripItems.forEach(i => i.classList.remove('active'));
                            item.classList.add('active');
                            selectedCategoryItem = catText;
                            applyFilters();
                        });
                    });
                })
                .catch(e => {
                    categoryStripItems.forEach(item => {
                        item.addEventListener('click', () => {
                            categoryStripItems.forEach(i => i.classList.remove('active'));
                            item.classList.add('active');
                            selectedCategoryItem = item.querySelector('span').textContent.trim().toUpperCase();
                            applyFilters();
                        });
                    });
                });
        }

        const buildBrandUI = () => {
            if (!brandGroup) return;
            const ul = brandGroup.querySelector('.filter-list');
            if (!ul) return;

            // Preserve currently checked brands
            const activeCheckboxes = ul.querySelectorAll('input[type="checkbox"]:checked');
            const previouslySelected = Array.from(activeCheckboxes).map(cb => cb.value);

            // Re-scan all products
            const allCards = document.querySelectorAll('.product-area .product-card');
            const brandCounts = {};
            
            allCards.forEach(card => {
                const brandEl = card.querySelector('.brand');
                const cardBrand = brandEl ? brandEl.textContent.trim() : 'MODA ARCHIVE';
                brandCounts[cardBrand] = (brandCounts[cardBrand] || 0) + 1;
                
                if (!card.dataset.sizes) {
                    const cardId = card.getAttribute('data-product-id');
                    if (cardId && window.dynamicProductsMap && window.dynamicProductsMap[cardId] && window.dynamicProductsMap[cardId].sizes) {
                        card.dataset.sizes = window.dynamicProductsMap[cardId].sizes.split(',').map(s => s.trim().toUpperCase()).join(',');
                    } else {
                        const sizes = [...allSizes].sort(() => 0.5 - Math.random()).slice(0, 4);
                        card.dataset.sizes = sizes.join(',');
                    }
                }
            });

            ul.innerHTML = '';
            
            Object.keys(brandCounts).sort().forEach(brandName => {
                const li = document.createElement('li');
                const isChecked = previouslySelected.includes(brandName) ? 'checked' : '';
                li.innerHTML = `<label><input type="checkbox" value="${brandName}" ${isChecked}> ${brandName}</label> <span class="count">(${brandCounts[brandName]})</span>`;
                ul.appendChild(li);
            });

            const newCheckboxes = ul.querySelectorAll('input[type="checkbox"]');
            newCheckboxes.forEach(cb => {
                cb.addEventListener('change', applyFilters);
            });
        };

        const applyFilters = () => {
            // Extract selected brands from UI
            let selectedBrands = [];
            if (brandGroup) {
                const activeCheckboxes = brandGroup.querySelectorAll('input[type="checkbox"]:checked');
                selectedBrands = Array.from(activeCheckboxes).map(cb => cb.value.toLowerCase());
            }

            const selectedSizes = Array.from(sizeButtons)
                .filter(btn => btn.classList.contains('active'))
                .map(btn => btn.textContent.trim().toUpperCase());

            const urlParamsLocal = new URLSearchParams(window.location.search);
            const urlSearchQueryLocal = (urlParamsLocal.get('search') || '').trim().toLowerCase();

            let visibleCount = 0;
            const currentCards = document.querySelectorAll('.product-area .product-card');
            
            currentCards.forEach(card => {
                const brandEl = card.querySelector('.brand');
                const cardBrand = brandEl ? brandEl.textContent.trim().toLowerCase() : 'moda archive';
                const titleEl = card.querySelector('.title, h4');
                const cardTitle = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
                const cardCategory = (card.getAttribute('data-category') || '').toLowerCase();
                
                const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(cardBrand);

                const cardSizes = card.dataset.sizes ? card.dataset.sizes.split(',') : allSizes;
                const sizeMatch = selectedSizes.length === 0 || selectedSizes.some(size => cardSizes.includes(size));
                
                const searchMatch = !urlSearchQueryLocal || 
                    cardTitle.includes(urlSearchQueryLocal) || 
                    cardBrand.includes(urlSearchQueryLocal) || 
                    cardCategory.includes(urlSearchQueryLocal);

                let categoryStripMatch = true;
                if (selectedCategoryItem !== 'ALL') {
                    if (selectedCategoryItem === 'T-SHIRTS') categoryStripMatch = cardTitle.includes('t-shirt') || cardTitle.includes('tshirt');
                    else if (selectedCategoryItem === 'SHIRTS') categoryStripMatch = cardTitle.includes('shirt') && !cardTitle.includes('t-shirt') && !cardTitle.includes('tshirt');
                    else if (selectedCategoryItem === 'JEANS') categoryStripMatch = cardTitle.includes('jean') || cardTitle.includes('denim');
                    else if (selectedCategoryItem === 'JACKETS') categoryStripMatch = cardTitle.includes('jacket') || cardTitle.includes('coat');
                    else if (selectedCategoryItem === 'TROUSERS') categoryStripMatch = cardTitle.includes('trouser') || cardTitle.includes('pant') || cardTitle.includes('chino');
                    else if (selectedCategoryItem === 'BLAZERS') categoryStripMatch = cardTitle.includes('blazer') || cardTitle.includes('suit');
                    else if (selectedCategoryItem === 'SHOES') categoryStripMatch = cardTitle.includes('shoe') || cardTitle.includes('sneaker') || cardTitle.includes('boot');
                    else if (selectedCategoryItem === 'ACCESSORIES') categoryStripMatch = cardTitle.includes('watch') || cardTitle.includes('belt') || cardTitle.includes('wallet') || cardTitle.includes('accessory');
                    else if (selectedCategoryItem === 'TOPS') categoryStripMatch = cardTitle.includes('top') || cardTitle.includes('blouse') || cardTitle.includes('tee');
                    else if (selectedCategoryItem === 'DRESSES') categoryStripMatch = cardTitle.includes('dress') || cardTitle.includes('gown');
                    else if (selectedCategoryItem === 'SKIRTS') categoryStripMatch = cardTitle.includes('skirt');
                    else if (selectedCategoryItem === 'BAGS') categoryStripMatch = cardTitle.includes('bag') || cardTitle.includes('purse') || cardTitle.includes('tote');
                    else categoryStripMatch = cardTitle.includes(selectedCategoryItem.toLowerCase());
                }

                if (brandMatch && sizeMatch && searchMatch && categoryStripMatch) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            
            const countEl = document.querySelector('.item-count');
            if (countEl) countEl.textContent = `${visibleCount} Items Found`;
        };

        const sortProducts = () => {
            const sortSelect = document.getElementById('sort-select');
            if (!sortSelect) return;
            const sortVal = sortSelect.value;
            const grid = document.querySelector('.product-area .product-grid');
            if (!grid) return;
            const cards = Array.from(grid.querySelectorAll('.product-card'));

            cards.sort((a, b) => {
                const getPrice = (card) => {
                    const priceEl = card.querySelector('.price');
                    if (!priceEl) return 0;
                    return parseFloat(priceEl.textContent.replace('₹', '').replace(/,/g, ''));
                };

                if (sortVal === 'price-low') {
                    return getPrice(a) - getPrice(b);
                } else if (sortVal === 'price-high') {
                    return getPrice(b) - getPrice(a);
                } else if (sortVal === 'newest') {
                    // ID is sequential, higher is newer
                    const idA = parseInt(a.dataset.productId || '0');
                    const idB = parseInt(b.dataset.productId || '0');
                    return idB - idA; 
                } else {
                    // popularity (default) - no strict sort needed for demo
                    return 0;
                }
            });

            // Re-append in new order
            cards.forEach(card => grid.appendChild(card));
        };

        sizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                applyFilters();
            });
        });

        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', sortProducts);
        }

        const viewToggles = document.querySelectorAll('.view-toggles button');
        const productGrid = document.querySelector('.product-area .product-grid');
        
        if (viewToggles.length === 2 && productGrid) {
            // Grid view (default)
            viewToggles[0].addEventListener('click', () => {
                viewToggles[0].classList.add('active');
                viewToggles[1].classList.remove('active');
                productGrid.classList.remove('list-view');
            });
            // List view
            viewToggles[1].addEventListener('click', () => {
                viewToggles[1].classList.add('active');
                viewToggles[0].classList.remove('active');
                productGrid.classList.add('list-view');
            });
        }

        // Initialize UI and apply filters
        buildBrandUI();
        applyFilters();
        
        // Expose globally so dynamic injections can re-trigger UI build
        window.applyFilters = () => {
            buildBrandUI();
            applyFilters();
            sortProducts();
        };
    };

    initMensFilters();

});

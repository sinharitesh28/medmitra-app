// Scripts/auth-guard.js - Updated for Server-Side Auth

(function() {
    async function initAuth() {
        // Skip for login page
        if (window.location.pathname.includes('login.html')) return;

        try {
            // Ensure CONFIG is loaded
            const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
            
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${baseUrl}/api/auth/me`, { 
                credentials: 'include',
                headers: headers 
            });
            
            if (res.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            if (!res.ok) throw new Error('Auth check failed');

            const user = await res.json();
            updateUI(user);
        } catch (e) {
            console.error('Auth Error:', e);
            // Optional: Redirect to login if fetch fails completely
            // window.location.href = '/login.html';
        }
    }

    function updateUI(user) {
        // 1. Update Header
        const header = document.querySelector('header');
        if (header) {
            // Check if we have the new structure or need to adapt
            let rightContainer = document.getElementById('user-profile');
            
            if (!rightContainer) {
                // Adapt existing header if it doesn't match new structure
                if (getComputedStyle(header).position === 'static') {
                    header.style.position = 'relative';
                }
                
                rightContainer = document.createElement('div');
                rightContainer.id = 'user-profile';
                rightContainer.style.position = 'absolute';
                rightContainer.style.right = '20px';
                rightContainer.style.top = '50%';
                rightContainer.style.transform = 'translateY(-50%)';
                rightContainer.style.display = 'flex';
                rightContainer.style.alignItems = 'center';
                rightContainer.style.gap = '15px';
                rightContainer.style.color = 'white';
                header.appendChild(rightContainer);
            }

            rightContainer.innerHTML = `
                <div style="text-align:right; font-size:0.9rem;">
                    <strong>${user.name || user.email}</strong><br>
                    <small style="opacity:0.8">${user.role}</small>
                </div>
                <button id="logoutBtn" style="
                    padding: 5px 12px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid white;
                    border-radius: 4px;
                    color: white;
                    cursor: pointer;
                    font-size: 0.8rem;">Logout</button>
            `;

            document.getElementById('logoutBtn').onclick = async () => {
                const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
                await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
                localStorage.removeItem('auth_token'); // Clear Token
                window.location.href = 'login.html';
            };
        }

        // 2. Inject Admin Link
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
            const nav = document.querySelector('.medmitra-nav');
            if (nav && !nav.innerHTML.includes('admin_dashboard.html')) {
                const adminLink = document.createElement('a');
                adminLink.href = 'admin_dashboard.html';
                adminLink.textContent = 'Admin Panel';
                adminLink.style.backgroundColor = '#6610f2'; // Distinction
                adminLink.style.color = 'white';
                nav.appendChild(adminLink);
            }
        }
    }

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }
})();
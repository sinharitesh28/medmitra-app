// Scripts/auth-guard.js - Updated for Server-Side Auth

(function() {
    async function initAuth() {
        // Skip for login page
        if (window.location.pathname.includes('login.html')) return;

        try {
            // Ensure CONFIG is loaded
            const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
            
            const token = localStorage.getItem('auth_token');
            console.log('[AuthGuard] Checking auth. Token exists:', !!token);
            
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            console.log(`[AuthGuard] Fetching ${baseUrl}/api/auth/me`);
            const res = await fetch(`${baseUrl}/api/auth/me`, { 
                credentials: 'include',
                headers: headers 
            });
            
            console.log('[AuthGuard] Response Status:', res.status);

            if (res.status === 401) {
                console.warn('[AuthGuard] 401 Unauthorized. Redirecting to login.');
                window.location.href = 'login.html';
                return;
            }
            if (!res.ok) throw new Error('Auth check failed');

            const user = await res.json();
            console.log('[AuthGuard] Auth success for:', user.email);
            updateUI(user);
        } catch (e) {
            console.error('[AuthGuard] Error:', e);
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
                rightContainer = document.createElement('div');
                rightContainer.id = 'user-profile';
                rightContainer.className = "flex items-center gap-3 ml-auto";
                header.appendChild(rightContainer);
            }

            rightContainer.innerHTML = `
                <div class="hidden sm:block text-right leading-tight">
                    <div class="text-xs font-bold text-gray-800">${user.name || user.email}</div>
                    <div class="text-[10px] text-secondary font-bold uppercase tracking-wider">${user.role}</div>
                </div>
                <button id="logoutBtn" class="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors border border-gray-100 hover:border-red-100" title="Sign Out">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
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
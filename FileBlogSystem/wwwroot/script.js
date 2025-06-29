document.addEventListener("DOMContentLoaded", () => {
    const appContainer = document.getElementById("app-container");
    const mainNav = document.getElementById("main-nav");

    const API_BASE_URL = "http://localhost:5211";

    let user = null;
    let token = null; 
    let tokenExpires = null;

    let currentPage = "feed";

    let CATEGORIES = [];
    let TAGS = [];

    function loadAuthData() {
        try {
            user = JSON.parse(localStorage.getItem("user")) || null;
            token = localStorage.getItem("token") || null;
            tokenExpires = localStorage.getItem("tokenExpires") ? new Date(localStorage.getItem("tokenExpires")) : null;
            console.log("DEBUG just seeing user:", user);

            if (tokenExpires && tokenExpires <= new Date()) {
                console.warn("Token expired. Clearing authentication data.");
                clearAuthData();
            }
        } catch (e) {
            console.error("Failed to load auth data from localStorage:", e);
            clearAuthData();
        }
    }

    function saveAuthData() {
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("token", token);
        localStorage.setItem("tokenExpires", tokenExpires ? tokenExpires.toISOString() : '');
    }

    function clearAuthData() {
        user = null;
        token = null;
        tokenExpires = null;
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("tokenExpires");
    }

    function isAuthenticated() {
        return !!user && !!token && tokenExpires && tokenExpires > new Date();
    }

    async function fetchAuthenticated(url, options = {}) {
        if (!isAuthenticated()) {
            console.warn('Attempted authenticated fetch without valid token. Redirecting to login.');
            clearAuthData();
            renderAuthForm('login');
            throw new Error('Authentication required.');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 401 || response.status === 403) {
                console.error(`Authorization error: ${response.status} for ${url}`);
                showMessage("Your session has expired or you do not have permission. Please log in again.", "error", appContainer);
                clearAuthData();
                renderAuthForm('login');
                throw new Error(`Authorization error: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Network or fetch error for ${url}:`, error);
            throw error; 
        }
    }

   
    async function fetchCategoriesAndTags() {
        try {
            const [categoriesRes, tagsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/categories`),
                fetch(`${API_BASE_URL}/api/tags`)
            ]);

            if (categoriesRes.ok) {
                const categoriesData = await categoriesRes.json();
                CATEGORIES = categoriesData; 
            } else {
                console.warn('Could not fetch categories. Using empty array.', await categoriesRes.text());
                CATEGORIES = [];
            }

            if (tagsRes.ok) {
                const tagsData = await tagsRes.json();
                TAGS = tagsData;
            } else {
                console.warn('Could not fetch tags. Using empty array.', await tagsRes.text());
                TAGS = [];
            }
        } catch (error) {
            console.error('Error fetching categories or tags:', error);
            CATEGORIES = [];
            TAGS = [];
        }
    }

    function renderAuthForm(type = "login") {
        appContainer.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h2 id="auth-title">${type === "login" ? "Welcome Back" : "Create Account"}</h2>
                        <p id="auth-subtitle">${type === "login" ? "Sign in to your account" : ""}</p>
                    </div>
                    
                    <form id="auth-form" class="auth-form">
                        <div class="form-group">
                            <label for="username"><i class="fas fa-user"></i> Username</label>
                            <input type="text" id="username" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="password"><i class="fas fa-lock"></i> Password</label>
                            <input type="password" id="password" required>
                        </div>
                        
                        <div id="signup-fields" style="display: ${type === "signup" ? "block" : "none"};">
                            <div class="form-group">
                                <label for="confirm-password"><i class="fas fa-lock"></i> Confirm Password</label>
                                <input type="password" id="confirm-password"> 
                            </div>
                        </div>
                        <div id="signup-fields" style="display: ${type === "signup" ? "block" : "none"};">
                            <div class="form-group">
                                <label for="email"><i class="fas fa-lock"></i> Email</label>
                                <input type="email" id="email">
                            </div>
                        </div>
                        
                        <button type="submit" class="auth-submit-btn" id="auth-submit">
                            <i class="fas fa-sign-in-alt"></i>
                            <span id="submit-text">${type === "login" ? "Sign In" : "Create Account"}</span>
                        </button>
                        
                        <div class="auth-switch">
                            <p id="auth-switch-text">
                                ${type === "login" ? "Don't have an account?" : "Already have an account?"}
                                <a href="#" id="auth-switch-link">${type === "login" ? "Sign Up" : "Sign In"}</a>
                            </p>
                        </div>
                        
                        <div id="auth-message" class="message" style="display: none;"></div>
                    </form>
                </div>
            </div>
        `;

        const form = document.getElementById("auth-form");
        const messageElement = document.getElementById("auth-message");
        const signupFields = document.getElementById("signup-fields");
        const authTitle = document.getElementById("auth-title");
        const authSubtitle = document.getElementById("auth-subtitle");
        const submitText = document.getElementById("submit-text");
        const authSwitchTextContainer = document.getElementById("auth-switch-text");

        let currentType = type;

        const setupSwitchLink = () => {
            const switchLink = document.getElementById("auth-switch-link");
            if (switchLink) {
                switchLink.onclick = (e) => {
                    e.preventDefault();
                    currentType = currentType === "login" ? "signup" : "login";

                    if (currentType === "signup") {
                        signupFields.style.display = "block";
                        authTitle.textContent = "Create Account";
                        authSubtitle.textContent = "";
                        submitText.textContent = "Create Account";
                        authSwitchTextContainer.innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>';
                    } else {
                        signupFields.style.display = "none";
                        authTitle.textContent = "Welcome Back";
                        authSubtitle.textContent = "Sign in to your account";
                        submitText.textContent = "Sign In";
                        authSwitchTextContainer.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Sign Up</a>';
                    }
                    setupSwitchLink();
                    messageElement.style.display = "none";
                };
            }
        };
        setupSwitchLink();

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            showMessage("", "", messageElement);

            const usernameInput = document.getElementById("username");
            const passwordInput = document.getElementById("password");

            const credentials = {
                username: usernameInput.value,
                password: passwordInput.value,
                roles: ["Author"]
            };

            let endpoint = '';
            if (currentType === 'login') {
                endpoint = `${API_BASE_URL}/api/auth/login`;
            } else { 
                const confirmPasswordInput = document.getElementById("confirm-password");
                const emailInput = document.getElementById("email");
                //const roleSelect = "Author";

                if (credentials.password !== confirmPasswordInput.value) {
                    showMessage("Passwords do not match.", "error", messageElement);
                    return;
                }
                credentials.email = emailInput.value;
                endpoint = `${API_BASE_URL}/api/users`;
            }

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(credentials),
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMessage = data.errors ? Object.values(data.errors).flat().join('; ') : (data.detail || data.message || `API Error: ${response.statusText}`);
                    throw new Error(errorMessage);
                }

                if (currentType === "login") {
                    user = { username: data.user.username, roles: data.user.roles || ['Author'] };
                    token = data.token;
                    tokenExpires = new Date(data.expires);
                    saveAuthData();
                    renderAppContent();
                } else {
                    showMessage("Account created successfully! Signing you in...", "success", messageElement);
                    setTimeout(async () => {
                        try {
                            const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    username: credentials.username,
                                    password: credentials.password,
                                }),
                            });

                            const loginData = await loginResponse.json();

                            if (loginResponse.ok) {
                                user = { username: loginData.user.username, roles: loginData.user.roles || ['Author'] };
                                token = loginData.token;
                                tokenExpires = new Date(loginData.expires);
                                saveAuthData();
                                renderAppContent();
                            } else {
                                showMessage("Account created! Please sign in manually.", "success", messageElement);
                            }
                        } catch (error) {
                            showMessage(`Account created! Auto-login failed: ${error.message}. Please sign in manually.`, "error", messageElement);
                        }
                    }, 1500);
                }
            } catch (error) {
                showMessage(error.message, "error", messageElement);
            }
        });
    }

    async function renderDashboard() {
        appContainer.innerHTML = `
            <div class="dashboard">
                <div class="search-section">
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="search-input" placeholder="Search...">
                    </div>
                    <div class="filter-container">
                        <select id="tag-filter">
                            <option value="">All Tags</option>
                            ${TAGS.map((tag) => `<option value="${tag.id}">${getTagNameById(tag.id)}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <div class="post-creation-section">
                    <h3><i class="fas fa-plus-circle"></i> Create New Post</h3>
                    <form id="create-post-form" class="create-post-form">
                        <div class="form-row">
                            <div class="form-group flex-2">
                                <label for="post-title">Title</label>
                                <input type="text" id="post-title" placeholder="Enter your post title..." required>
                            </div>
                            <div class="form-group">
                                <label for="post-category">Category</label>
                                <select id="post-category" required>
                                    <option value="">Select Category</option>
                                    ${CATEGORIES.map((cat) => `<option value="${cat.id}">${getCategoryNameById(cat.id)}</option>`).join("")}
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="post-content">Content</label>
                            <textarea id="post-content" placeholder="Write your post content here..." rows="6" required></textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group flex-2">
                                <label for="post-tags">Tags</label>
                                <select id="post-tags" multiple>
                                    ${TAGS.map((tag) => `<option value="${tag.id}">${getTagNameById(tag.id)}</option>`).join("")}
                                </select>
                                <small>Hold Ctrl/Cmd to select multiple tags</small>
                            </div>
                            <div class="form-group">
                                <label for="post-image">Image</label>
                                <input type="file" id="post-image" accept="image/*">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="post-status">Status</label>
                                <select id="post-status">
                                    <option value="draft">Save as Draft</option>
                                    <option value="publish">Publish Now</option>
                                    <option value="schedule">Schedule</option>
                                </select>
                            </div>
                            <div class="form-group" id="schedule-group" style="display: none;">
                                <label for="schedule-date">Schedule Date</label>
                                <input type="date" id="schedule-date" min="${getMinDate()}">
                                <label for="schedule-time">Schedule Time</label>
                                <input type="time" id="schedule-time">
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-paper-plane"></i>
                                <span id="submit-btn-text">Create Post</span>
                            </button>
                        </div>

                        <div id="create-post-message" class="message" style="display: none;"></div>
                    </form>
                </div>

                <div class="feed-section">
                    <div class="feed-header">
                        <h3><i class="fas fa-stream"></i> Recent Posts</h3>
                        <div class="feed-stats">
                            <span id="posts-count">Loading...</span>
                        </div>
                    </div>
                    <div id="posts-container" class="posts-container">
                        <div class="loading-posts">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading posts...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setupPostCreation();
        setupSearchAndFilter();
        loadPosts();
    }

    function setupPostCreation() {
        const form = document.getElementById("create-post-form");
        const statusSelect = document.getElementById("post-status");
        const scheduleGroup = document.getElementById("schedule-group");
        const submitBtnText = document.getElementById("submit-btn-text");
        const messageElement = document.getElementById("create-post-message");
        const postImageInput = document.getElementById("post-image");
        const scheduleDateInput = document.getElementById("schedule-date");
        const scheduleTimeInput = document.getElementById("schedule-time");

        scheduleDateInput.min = getMinDate();

        statusSelect.addEventListener("change", () => {
            if (statusSelect.value === "schedule") {
                scheduleGroup.style.display = "block";
                submitBtnText.textContent = "Schedule Post";
            } else {
                scheduleGroup.style.display = "none";
                submitBtnText.textContent = statusSelect.value === "draft" ? "Save Draft" : "Publish Post";
            }
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            showMessage("", "", messageElement);

            const selectedTags = Array.from(document.getElementById("post-tags").selectedOptions).map(
                (option) => option.value,
            );

            const selectedCategoryId = document.getElementById("post-category").value;

            const status = document.getElementById("post-status").value;
            let publishedDate = null;
            
            if (status === "publish") {
                publishedDate = new Date().toISOString();
            } else if (status === "schedule") {
                const dateVal = scheduleDateInput.value;
                const timeVal = scheduleTimeInput.value;

                if (!dateVal || !timeVal) {
                    showMessage("Please select both a date and time for scheduling.", "error", messageElement);
                    return;
                }

                const scheduledDateTime = new Date(`${dateVal}T${timeVal}:00`);
                const now = new Date();

                if (scheduledDateTime <= now) {
                    showMessage("Scheduled date and time must be in the future.", "error", messageElement);
                    return;
                }
                publishedDate = scheduledDateTime.toISOString();
            }

            const newPost = {
                title: document.getElementById("post-title").value,
                AuthorUsername: user.username, 
                content: document.getElementById("post-content").value,
                categories: selectedCategoryId ? [selectedCategoryId] : [],
                tags: selectedTags,
                isDraft: status === "draft" || (status === "schedule" && new Date(publishedDate) > new Date()),
                publishedDate: publishedDate,
                scheduledFor: status === "schedule"
                    ? new Date(`${scheduleDateInput.value}T${scheduleTimeInput.value}:00`).toISOString()
                    : null,
                ImageUrl: null,
                Base64Image: null
            };

            if (postImageInput.files.length > 0) {
                const file = postImageInput.files[0];
                try {
                    newPost.base64Image = await readFileAsBase64(file);
                } catch (error) {
                    showMessage("Error reading image file: " + error.message, "error", messageElement);
                    return; 
                }
            }

            if (status === "publish") {
                newPost.publishedDate = new Date().toISOString();
            }

            try {
                const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts`, {
                    method: 'POST',
                    body: JSON.stringify(newPost),
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMessage = data.errors ? Object.values(data.errors).flat().join('; ') : (data.detail || data.message || `API Error: ${response.statusText}`);
                    throw new Error(errorMessage);
                }

                showMessage("Post created successfully!", "success", messageElement);
                form.reset();
                if (newPost.isDraft) {
                    currentPage = "drafts";
                } else {
                    currentPage = "feed";
                }
                renderAppContent();
            } catch (error) {
                console.error("Create post error:", error);
                showMessage(error.message, "error", messageElement);
            }
        });
    }


    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }


    function setupSearchAndFilter() {
         const searchInput = document.getElementById("search-input");
         const tagFilter = document.getElementById("tag-filter");
     
         if (searchInput && tagFilter) {
             searchInput.addEventListener("input", debounce(loadPosts, 300));
             tagFilter.addEventListener("change", loadPosts);
         }
    }

    function getMinDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function getTagNameById(id) {
        const tag = TAGS.find(t => t.id === id);
        return tag ? tag.name : id;
    }
    
    function getCategoryNameById(id) {
        const cat = CATEGORIES.find(c => c.id === id);
        return cat ? cat.name : id;
    }

    async function loadPosts() {
        const postsContainer = document.getElementById("posts-container");
        const postsCount = document.getElementById("posts-count");

        if (!postsContainer || !postsCount) return;

        postsContainer.innerHTML = `
            <div class="loading-posts">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading posts...</p>
            </div>
        `;
        postsCount.textContent = "Loading...";
    
        const searchInput = document.getElementById("search-input");
        const tagFilter = document.getElementById("tag-filter");
    
        const searchTerm = searchInput?.value || '';
        const selectedTag = tagFilter?.value || '';

        const queryParams = new URLSearchParams();
        if (searchTerm) {
            queryParams.append('searchTerm', searchTerm);
            //queryParams.append('AuthorUsername', searchTerm);
        }
        if (selectedTag) {
            queryParams.append('tag', selectedTag);
        }
        queryParams.append('IsDraft', 'false');

        const url = `${API_BASE_URL}/api/posts?${queryParams.toString()}`;

        try {
            const headers = isAuthenticated() ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetchAuthenticated(url, { headers });

            if (!response.ok) {
                const errorData = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : await response.text();
                throw new Error(errorData.detail || errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const posts = await response.json();

            postsContainer.innerHTML = "";
            postsCount.textContent = `${posts.length} posts`;

            if (posts.length === 0) {
                postsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>No posts found.</h3>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                `;
                return;
            }

            posts.forEach((post) => {
                const postCard = document.createElement("div");
                postCard.classList.add("post-card");
                postCard.dataset.tags = (post.tags && Array.isArray(post.tags)) ? post.tags.join(",") : "";
                postCard.dataset.post = JSON.stringify(post);

                const isAuthor = isAuthenticated() && user.username === post.AuthorUsername; 
                console.log("DEBUG just seeing post:", post);
                postCard.innerHTML = `
                    <div class="post-header">
                        <div class="post-author-info">
                            <div class="author-avatar">
                                 <img src="${API_BASE_URL}/content/static/avatar.jpg" class="avatar-img" alt="Avatar" />
                            </div>
                            <div class="author-details">
                                <span class="post-author">@${post.authorUsername || 'Unknown'}</span>
                                <span class="post-date">${formatDate(post.publishedDate || post.creationDate)}</span>
                            </div>
                        </div>
                        <div class="post-status">
                            ${post.isDraft ? '<span class="draft-badge"><i class="fas fa-edit"></i> Draft</span>' : '<span class="published-badge"><i class="fas fa-check-circle"></i> Published</span>'}
                        </div>
                    </div>
                    
                    <div class="post-body">
                        <h3 class="post-title">${post.title}</h3>
                        <div class="post-meta">
                            <span class="post-category"><i class="fas fa-folder"></i> 
                              ${Array.isArray(post.categories) ? post.categories.map(getCategoryNameById).join(', ') : 'Uncategorized'}
                            </span>
                            <div class="post-tags">
                                ${post.tags && post.tags.length > 0 ? post.tags.map((tag) => `<span class="tag"><i class="fas fa-tag"></i> ${getTagNameById(tag)}</span>`).join("") : ''}
                            </div>
                        </div>
                        <p class="post-content">${post.content.substring(0, 200)}</p>
                        ${post.imageUrl ? `<img src="${API_BASE_URL}${post.imageUrl}" alt="${post.title || 'Post Image'}" class="post-image">` : ""}
                    </div>
                    
                    <div class="post-actions">
                        ${isAuthor ? `
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline dropdown-toggle">
                                    <i class="fas fa-ellipsis-h"></i> Actions
                                </button>
                                <div class="dropdown-menu">
                                    <a href="#" class="dropdown-item edit-post-btn" data-post-slug="${post.slug}"><i class="fas fa-edit"></i> Edit</a>
                                    <a href="#" class="dropdown-item delete-post-btn" data-post-slug="${post.slug}"><i class="fas fa-trash"></i> Delete</a>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                postsContainer.appendChild(postCard);
            });

            postsContainer.querySelectorAll('.dropdown-toggle').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dropdownMenu = e.currentTarget.nextElementSibling;
                    dropdownMenu.classList.toggle('show');
                });
            });

            document.removeEventListener('click', closeDropdowns);
            document.addEventListener('click', closeDropdowns);

            postsContainer.querySelectorAll('.edit-post-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const postSlug = e.currentTarget.dataset.postSlug;
                    const postData = JSON.parse(e.currentTarget.closest('.post-card').dataset.post);
                    renderEditPostForm(postSlug, postData);
                });
            });

            postsContainer.querySelectorAll('.delete-post-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const postSlug = e.currentTarget.dataset.postSlug;
                    console.log("DEBUG just seeing postSlug:", postSlug);
                    console.log("DEBUG just seeing dataset:", e.currentTarget.dataset);
                    if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
                        await deletePost(postSlug);
                        loadPosts();
                    }
                });
            });

        } catch (error) {
            postsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading posts: ${error.message}</p>
                </div>
            `;
            postsCount.textContent = "Error";
            console.error('Error in loadPosts:', error);
        }
    }

    function closeDropdowns(event) {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (!menu.contains(event.target) && !menu.previousElementSibling.contains(event.target)) {
                menu.classList.remove('show');
            }
        });
    }

    function renderDraftsPage() {
        if (!isAuthenticated()) {
            showMessage("You must be logged in to view your drafts.", "error", appContainer);
            renderAuthForm('login');
            return;
        }

        appContainer.innerHTML = `
            <div class="drafts-page">
                <div class="page-header">
                    <h2><i class="fas fa-edit"></i> My Drafts & Posts</h2>
                    <p>Manage your posts and drafts</p>
                </div>
                
                <div id="drafts-container" class="drafts-container">
                    <div class="loading-posts">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading drafts...</p>
                    </div>
                </div>
            </div>
        `;

        loadDrafts();
    }

    async function loadDrafts() {
        const draftsContainer = document.getElementById("drafts-container");
        
        draftsContainer.innerHTML = `
            <div class="loading-posts">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading drafts...</p>
            </div>
        `;

        try {
            //const url = `${API_BASE_URL}/api/posts?isDraft=true&AuthorUsername=${user.username}`; 
            const responsedraft = await fetchAuthenticated(`/api/posts?authorUsername=${user.username}&isDraft=true`);
            const response = await fetchAuthenticated(`/api/posts?authorUsername=${user.username}`);

            if (!response.ok) {
                const errorData = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : await response.text();
                throw new Error(errorData.detail || errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const drafts = await responsedraft.json();
            const posts = await response.json();

            draftsContainer.innerHTML = "";

            if (drafts.length === 0 && posts.length === 0) {
                draftsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt"></i>
                        <h3>No drafts yet</h3>
                        <p>Your draft posts will appear here</p>
                        <button class="btn btn-primary" onclick="currentPage = 'feed'; renderAppContent();">
                            <i class="fas fa-plus"></i> Create New Post
                        </button>
                    </div>
                `;
                return;
            }

            [...drafts, ...posts].forEach((draft) => {
                const draftCard = document.createElement("div");
                draftCard.className = "draft-card";
                draftCard.dataset.post = JSON.stringify(draft);


                draftCard.innerHTML = `
                    <div class="draft-header">
                        <div class="author-details">
                            <span class="post-author">@${draft.authorUsername || 'Unknown'}</span>
                            <span class="draft-date">Last modified: ${formatDate(draft.modificationDate || draft.createdAt)}</span>
                        </div>
                        <div class="post-status">
                         ${
                           draft.isDraft && draft.scheduledFor
                             ? '<span class="scheduled-badge"><i class="fas fa-clock"></i> Scheduled</span>'
                             : draft.isDraft
                               ? '<span class="draft-badge"><i class="fas fa-edit"></i> Draft</span>'
                               : '<span class="published-badge"><i class="fas fa-check-circle"></i> Published</span>'
                         }
                       </div>
                    </div>
                    <div class="draft-content">
                        <h3>${draft.title}</h3>
                        <p>${draft.content.substring(0, 150)}${draft.content.length > 150 ? '...' : ''}</p>
                        <div class="draft-meta">
                            <span class="draft-category">${Array.isArray(draft.categories) ? draft.categories.map(getCategoryNameById).join(', ') : 'Uncategorized'}</span>
                            <div class="draft-tags">
                                ${draft.tags && draft.tags.length > 0 ? draft.tags.map((tag) => `<span class="tag">${getTagNameById(tag)}</span>`).join("") : ''}
                            </div>
                        </div>
                        ${draft.imageUrl ? `<img src="${API_BASE_URL}${draft.imageUrl}" alt="${draft.title}" class="post-image-preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px;">` : ""}

                    </div>
                    <div class="draft-actions">
                        <button class="btn btn-primary edit-draft-btn" data-post-slug="${draft.slug}"><i class="fas fa-edit"></i>Edit</button>
                        ${
                          draft.isDraft
                            ? (draft.scheduledFor
                                ? `<button class="btn btn-secondary cancel-schedule-btn" data-post-slug="${draft.slug}"><i class="fas fa-ban"></i>Cancel Schedule</button>`
                                : `<button class="btn btn-success publish-draft-btn" data-post-slug="${draft.slug}"><i class="fas fa-paper-plane"></i>Publish Now</button>`)
                            : ''
                        }    
                        <button class="btn btn-danger delete-draft-btn" data-post-slug="${draft.slug}"><i class="fas fa-trash"></i>Delete</button>
                    </div>
                `;
                draftsContainer.appendChild(draftCard);
            });

            draftsContainer.querySelectorAll('.edit-draft-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const postSlug = e.currentTarget.dataset.postSlug;
                    const postData = JSON.parse(e.currentTarget.closest('.draft-card').dataset.post);
                    renderEditPostForm(postSlug, postData);
                });
            });

            draftsContainer.querySelectorAll('.publish-draft-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const postSlug = e.currentTarget.dataset.postSlug;
                    if (confirm('Are you sure you want to publish this draft?')) {
                        await publishDraft(postSlug);
                        loadDrafts();
                        loadPosts(); 
                    }
                });
            });

            draftsContainer.querySelectorAll('.delete-draft-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const postSlug = e.currentTarget.dataset.postSlug;
                    if (confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
                        console.log("DEBUG just seeing postSlug:", postSlug);
                        console.log("DEBUG just seeing dataset:", e.currentTarget.dataset);
                        await deletePost(postSlug);
                        loadDrafts(); 
                    }
                });
            });

            draftsContainer.querySelectorAll('.cancel-schedule-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const postSlug = e.currentTarget.dataset.postSlug;
                    if (confirm('Are you sure you want to cancel the schedule and revert this post to a regular draft?')) {
                        await cancelPostSchedule(postSlug);
                        loadDrafts();
                    }
                });
            });

        } catch (error) {
            draftsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading drafts: ${error.message}</p>
                </div>
            `;
            console.error('Error in loadDrafts:', error);
        }
    }

    async function renderEditPostForm(postId, postData) {
       let publishedDateValue = '';
        let publishedTimeValue = '';
        postData.publishedDate = getMinDate();
        postData.ImageUrl = postData.ImageUrl || null;
        postData.Base64Image = postData.Base64Image || null;
        postData.isDraft = postData.isDraft || false;
        postData.categories = postData.categories || [];
        postData.scheduledFor = postData.scheduledFor || null;

        if (postData.publishedDate) {
            const dateObj = new Date(postData.publishedDate);
            publishedDateValue = dateObj.toISOString().split('T')[0]; 
            publishedTimeValue = dateObj.toTimeString().substring(0, 5);
        }

        appContainer.innerHTML = `
            <div class="post-creation-section">
                <h3><i class="fas fa-edit"></i> Edit Blog Post</h3>
                <form id="edit-post-form" class="create-post-form">
                    <input type="hidden" id="edit-post-id" value="${postId}">
                    <div class="form-row">
                        <div class="form-group flex-2">
                            <label for="edit-post-title">Title</label>
                            <input type="text" id="edit-post-title" value="${postData.title}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-post-category">Category</label>
                            <select id="edit-post-category" required>
                                <option value="">Select Category</option>
                                    ${CATEGORIES.map((cat) => `<option value="${cat.id}" ${postData.categories?.includes(cat.id) ? 'selected' : ''}>${getCategoryNameById(cat.id)}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="edit-post-content">Content</label>
                        <textarea id="edit-post-content" rows="10" required>${postData.content}</textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group flex-2">
                            <label for="edit-post-tags">Tags</label>
                            <select id="edit-post-tags" multiple>
                                ${TAGS.map((tag) => `<option value="${tag.id}" ${postData.tags && postData.tags.includes(tag.id) ? 'selected' : ''}>${getTagNameById(tag.id)}</option>`).join("")}
                            </select>
                            <small>Hold Ctrl/Cmd to select multiple tags</small>
                        </div>
                        <div class="form-group">
                            <label for="edit-post-image">Image</label>
                            <input type="file" id="edit-post-image" accept="image/*">
                             ${postData.imageUrl ? `<img src="${API_BASE_URL}${postData.imageUrl}" alt="${postData.title || 'Current Image'}" class="post-image-preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px;">
                                <button type="button" class="btn btn-sm btn-danger remove-image-btn" style="margin-top: 5px;">Remove Image</button>
                                ` : ''}                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-post-status">Status</label>
                            <select id="edit-post-status">
                                <option value="draft" ${postData.isDraft ? 'selected' : ''}>Save as Draft</option>
                                <option value="publish" ${!postData.isDraft ? 'selected' : ''}>Publish Now</option>
                                <option value="schedule" ${postData.isDraft && postData.publishedDate ? 'selected' : ''}>Schedule</option>
                            </select>
                        </div>
                        <div class="form-group" id="edit-schedule-group" style="display: ${postData.isDraft && postData.publishedDate ? 'block' : 'none'};">
                            <label for="edit-schedule-date">Schedule Date</label>
                            <input type="date" id="edit-schedule-date" value="${publishedDateValue}" min="${getMinDate()}">
                            <label for="edit-schedule-time">Schedule Time</label>
                            <input type="time" id="edit-schedule-time" value="${publishedTimeValue}">
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i>
                            <span>Update Post</span>
                        </button>
                        <button type="button" class="btn btn-outline" id="cancel-edit-post">
                            <i class="fas fa-times"></i>
                            <span>Cancel</span>
                        </button>
                    </div>

                    <div id="edit-post-message" class="message" style="display: none;"></div>
                </form>
            </div>
        `;

        const form = document.getElementById("edit-post-form");
        const messageElement = document.getElementById("edit-post-message");
        const cancelEditButton = document.getElementById("cancel-edit-post");
        const editPostImageInput = document.getElementById("edit-post-image");
        const removeImageBtn = document.querySelector('.remove-image-btn'); 
        let imageRemoved = false;
        const editStatusSelect = document.getElementById("edit-post-status");
        const editScheduleGroup = document.getElementById("edit-schedule-group");
        const editScheduleDateInput = document.getElementById("edit-schedule-date");
        const editScheduleTimeInput = document.getElementById("edit-schedule-time");

        editScheduleDateInput.min = getMinDate();

        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                imageRemoved = true;
                const imagePreview = document.querySelector('.post-image-preview');
                if (imagePreview) {
                    imagePreview.remove(); 
                }
                removeImageBtn.remove(); 
                showMessage("Image marked for removal on update.", "info", messageElement);
            });
        }

        editStatusSelect.addEventListener("change", () => {
            if (editStatusSelect.value === "schedule") {
                editScheduleGroup.style.display = "block";
            } else {
                editScheduleGroup.style.display = "none";
            }
        });

        cancelEditButton.addEventListener('click', () => {
            currentPage = postData.isDraft ? "drafts" : "feed";
            renderAppContent();
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            showMessage("", "", messageElement);

            const selectedTags = Array.from(document.getElementById("edit-post-tags").selectedOptions).map(
                (option) => option.value,
            );

            const newStatus = document.getElementById("edit-post-status").value;
            console.log("DEBUG just seeing newStatus:", newStatus);
            const wasDraft = postData.isDraft;
            let publishedDate = null;

            if (newStatus === "publish") {
                publishedDate = new Date().toISOString();
            } else if (newStatus === "schedule") {
                const dateVal = editScheduleDateInput.value;
                const timeVal = editScheduleTimeInput.value;

                if (!dateVal || !timeVal) {
                    showMessage("Please select both a date and time for scheduling.", "error", messageElement);
                    return;
                }

                const scheduledDateTime = new Date(`${dateVal}T${timeVal}:00`);
                const now = new Date();

                if (scheduledDateTime <= now) {
                    showMessage("Scheduled date and time must be in the future.", "error", messageElement);
                    return;
                }
                publishedDate = scheduledDateTime.toISOString();
            }
            else if (!wasDraft && newStatus === "publish") {
                publishedDate = postData.publishedDate;
            }

            const updatedPost = {
                id: postData.id,
                title: document.getElementById("edit-post-title").value,
                AuthorUsername: user.username,
                content: document.getElementById("edit-post-content").value,
                categories: [document.getElementById("edit-post-category").value],
                tags: selectedTags,
                isDraft: newStatus === "draft" || newStatus === "schedule",
                publishedDate: publishedDate,
                ImageUrl: postData.ImageUrl,
                Base64Image: postData.Base64Image || null
            };

            if (editPostImageInput.files.length > 0) {
                const file = editPostImageInput.files[0];
                try {
                    updatedPost.base64Image = await readFileAsBase64(file);
                    updatedPost.ImageUrl = null;
                } catch (error) {
                    showMessage("Error reading new image file: " + error.message, "error", messageElement);
                    return;
                }
            } else if (imageRemoved) {
                updatedPost.ImageUrl = null;
            } else {
                updatedPost.ImageUrl = postData.ImageUrl;
            }

            if (wasDraft && updatedPost.isDraft === false) {
                updatedPost.publishedDate = new Date().toISOString();
            } else if (updatedPost.isDraft) {
                updatedPost.publishedDate = null;
            } else { 
                updatedPost.publishedDate = postData.publishedDate;
            }


            try {
                const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts/${postId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedPost),
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMessage = data.errors ? Object.values(data.errors).flat().join('; ') : (data.detail || data.message || `API Error: ${response.statusText}`);
                    throw new Error(errorMessage);
                }

                showMessage("Post updated successfully!", "success", messageElement);
                setTimeout(() => {
                    currentPage = updatedPost.isDraft ? "drafts" : "feed";
                    renderAppContent();
                }, 1500);
            } catch (error) {
                console.error("Update post error:", error);
                showMessage(error.message, "error", messageElement);
            }
        });
    }

    
    async function publishDraft(postSlug) {
        try {
            const getResponse = await fetchAuthenticated(`${API_BASE_URL}/api/posts/${postSlug}`);
            if (!getResponse.ok) throw new Error("Could not fetch draft for publishing.");
            const draftToPublish = await getResponse.json();

            draftToPublish.isDraft = false;
            draftToPublish.publishedDate = new Date().toISOString();
            draftToPublish.selectedTags = draftToPublish.tags || [];
            draftToPublish.selectedCategoryId = draftToPublish.category && draftToPublish.category.length > 0 ? draftToPublish.category[0] : null;
            draftToPublish.imageUrl = draftToPublish.ImageUrl || null;

            const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts/${postSlug}`, {
                method: 'PUT',
                body: JSON.stringify(draftToPublish),
            });

            if (!response.ok) {
                const errorData = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : await response.text();
                throw new Error(errorData.detail || errorData.message || `Failed to publish post: ${response.statusText}`);
            }
            showMessage("Draft published successfully!", "success", appContainer);
            return true;
        } catch (error) {
            console.error('Error publishing draft:', error);
            showMessage(`Error publishing draft: ${error.message}`, "error", appContainer);
            return false;
        }
    }

    async function deletePost(postSlug) {
        try {
            const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts/${postSlug}`, {
                method: 'DELETE',
            });

            if (response.status === 204) {
                showMessage("Post deleted successfully!", "success", appContainer);
                return true;
            } else {
                const errorData = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : await response.text();
                throw new Error(errorData.detail || errorData.message || `Failed to delete post: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            showMessage(`Error deleting post: ${error.message}`, "error", appContainer);
            return false;
        }
    }

   
    function showMessage(text, type, container) {
        const existingMessage = container.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        if (!text) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';

        container.prepend(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }


    function formatDate(dateString) {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return "Just now";
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 172800) return "Yesterday";

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    async function cancelPostSchedule(postSlug) {
        try {
            const getResponse = await fetchAuthenticated(`${API_BASE_URL}/api/posts/${postSlug}`);
            if (!getResponse.ok) throw new Error("Could not fetch post for canceling schedule.");
            const postToUpdate = await getResponse.json();

            postToUpdate.isDraft = true;
            postToUpdate.publishedDate = null;
            postToUpdate.scheduledFor = null;

            const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts/${postSlug}`, {
                method: 'PUT',
                body: JSON.stringify(postToUpdate),
            });

            if (!response.ok) {
                const errorData = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : await response.text();
                throw new Error(errorData.detail || errorData.message || `Failed to cancel schedule: ${response.statusText}`);
            }
            showMessage("Post schedule cancelled and reverted to draft.", "success", appContainer);
            return true;
        } catch (error) {
            console.error('Error cancelling schedule:', error);
            showMessage(`Error cancelling schedule: ${error.message}`, "error", appContainer);
            return false;
        }
    }

    function formatTime(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }


    function updateNav() {
        mainNav.innerHTML = "";
        if (isAuthenticated()) {
            mainNav.innerHTML = `
                <div class="nav-links">
                    <button class="nav-btn ${currentPage === "feed" ? "active" : ""}" data-page="feed">
                        <i class="fas fa-home"></i> My Feed
                    </button>
                    <button class="nav-btn ${currentPage === "drafts" ? "active" : ""}" data-page="drafts">
                        <i class="fas fa-edit"></i> My Drafts & Posts
                    </button>
                </div>
                <div class="nav-user">
                     <img src="${API_BASE_URL}/content/static/avatar.jpg" class="avatar-img" alt="Avatar" />
                    <span class="user-info">
                        ${user.username}
                    </span>
                    <button class="nav-btn logout-btn" id="nav-logout">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            `;

            document.querySelectorAll(".nav-btn[data-page]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    currentPage = btn.dataset.page;
                    renderAppContent();
                });
            });

            document.getElementById("nav-logout").addEventListener("click", () => {
                clearAuthData();
                currentPage = "feed";
                renderAppContent();
            });
        } else {
            mainNav.innerHTML = `
                <button class="nav-btn ${currentPage === "login" ? "active" : ""}" data-page="login" id="nav-login">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
                <button class="nav-btn ${currentPage === "signup" ? "active" : ""}" data-page="signup" id="nav-signup">
                    <i class="fas fa-user-plus"></i> Sign Up
                </button>
            `;
            document.getElementById("nav-login").addEventListener("click", () => { currentPage = "login"; renderAuthForm('login'); });
            document.getElementById("nav-signup").addEventListener("click", () => { currentPage = "signup"; renderAuthForm('signup'); });
        }
    }

    
    async function renderAppContent() {
        loadAuthData(); 

        if (CATEGORIES.length === 0 || TAGS.length === 0) {

            appContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading application data...</p>
                </div>
            `;
            await fetchCategoriesAndTags();
        }

        updateNav();


        const loadingSpinner = appContainer.querySelector('.loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.remove();
        }

        if (isAuthenticated()) {
            if (currentPage === "drafts") {
                renderDraftsPage();
            } else {
                renderDashboard();
            }
        } else {
            renderAuthForm("login");
        }
    }

    renderAppContent();
});
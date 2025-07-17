document.addEventListener("DOMContentLoaded", () => {
  const appContainer = document.getElementById("app-container")
  const mainNav = document.getElementById("main-nav")

  const API_BASE_URL = "http://localhost:5211"

  let user = null
  let token = null
  let tokenExpires = null

  let currentPage = "feed"

  let CATEGORIES = []
  let TAGS = []

  function loadAuthData() {
    try {
      user = JSON.parse(localStorage.getItem("user")) || null
      token = localStorage.getItem("token") || null
      tokenExpires = localStorage.getItem("tokenExpires") ? new Date(localStorage.getItem("tokenExpires")) : null
      console.log("DEBUG just seeing user:", user)

      if (tokenExpires && tokenExpires <= new Date()) {
        console.warn("Token expired. Clearing authentication data.")
        clearAuthData()
      }
    } catch (e) {
      console.error("Failed to load auth data from localStorage:", e)
      clearAuthData()
    }
  }

  function saveAuthData() {
    localStorage.setItem("user", JSON.stringify(user))
    localStorage.setItem("token", token)
    localStorage.setItem("tokenExpires", tokenExpires ? tokenExpires.toISOString() : "")
  }

  function clearAuthData() {
    user = null
    token = null
    tokenExpires = null
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    localStorage.removeItem("tokenExpires")
  }

  function isAuthenticated() {
    return !!user && !!token && tokenExpires && tokenExpires > new Date()
  }

  async function fetchAuthenticated(url, options = {}) {
    if (!isAuthenticated()) {
      console.warn("Attempted authenticated fetch without valid token. Redirecting to login.")
      clearAuthData()
      renderAuthForm("login")
      throw new Error("Authentication required.")
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    }

    try {
      const response = await fetch(url, { ...options, headers })

      if (response.status === 401 || response.status === 403) {
        console.error(`Authorization error: ${response.status} for ${url}`)
        showMessage(
          "Your session has expired or you do not have permission. Please log in again.",
          "error",
          appContainer,
        )
        clearAuthData()
        renderAuthForm("login")
        throw new Error(`Authorization error: ${response.status}`)
      }
      return response
    } catch (error) {
      console.error(`Network or fetch error for ${url}:`, error)
      throw error
    }
  }

  async function fetchCommentsForPost(postSlug) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/post/${postSlug}/comments`)
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`)
      }
      const comments = await response.json()

      for (const comment of comments) {
        try {
          const userResponse = await fetchAuthenticated(`${API_BASE_URL}/api/user/${comment.username}`)
          if (userResponse.ok) {
            const userData = await userResponse.json()
            comment.authorProfilePictureUrl = userData.profilePictureUrl
          }
        } catch (error) {
          comment.authorProfilePictureUrl = null
        }
      }

      return comments
    } catch (error) {
      console.error("Error fetching comments:", error)
      return []
    }
  }

  async function addCommentToPost(postSlug, commentContent) {
    try {
      const commentData = {
        content: commentContent,
        username: user.username,
        createdAt: new Date().toISOString(),
      }

      const response = await fetchAuthenticated(`${API_BASE_URL}/api/post/${postSlug}/comment`, {
        method: "POST",
        body: JSON.stringify(commentData),
      })

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.status}`)
      }

      const newComment = await response.json()
      return newComment
    } catch (error) {
      console.error("Error adding comment:", error)
      return null
    }
  }

  function displayComments(comments, commentsList) {
    commentsList.innerHTML = ""

    if (comments.length === 0) {
      commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>'
      return
    }

    comments.forEach((comment) => {
      const commentElement = document.createElement("div")
      commentElement.className = "comment-item"
      commentElement.innerHTML = `
        <div class="comment-header">
          <div class="comment-author">
            <img src="${comment.authorProfilePictureUrl || `${API_BASE_URL}/content/static/avatar.jpg`}" class="avatar-img" alt="Avatar" style="width: 24px; height: 24px; margin-right: 8px;" />
            @${comment.username}
          </div>
          <div class="comment-date">${formatDate(comment.createdAt)}</div>
        </div>
        <p class="comment-content">${comment.content}</p>
      `
      commentsList.appendChild(commentElement)
    })
  }

  async function fetchCategoriesAndTags() {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetchAuthenticated(`${API_BASE_URL}/api/categories`),
        fetchAuthenticated(`${API_BASE_URL}/api/tags`),
      ])

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        CATEGORIES = categoriesData
      } else {
        console.warn("Could not fetch categories. Using empty array.", await categoriesRes.text())
        CATEGORIES = []
      }

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json()
        TAGS = tagsData
      } else {
        console.warn("Could not fetch tags. Using empty array.", await tagsRes.text())
        TAGS = []
      }
    } catch (error) {
      console.error("Error fetching categories or tags:", error)
      CATEGORIES = []
      TAGS = []
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
        `

    const form = document.getElementById("auth-form")
    const messageElement = document.getElementById("auth-message")
    const signupFields = document.getElementById("signup-fields")
    const authTitle = document.getElementById("auth-title")
    const authSubtitle = document.getElementById("auth-subtitle")
    const submitText = document.getElementById("submit-text")
    const authSwitchTextContainer = document.getElementById("auth-switch-text")

    let currentType = type

    const setupSwitchLink = () => {
      const switchLink = document.getElementById("auth-switch-link")
      if (switchLink) {
        switchLink.onclick = (e) => {
          e.preventDefault()
          currentType = currentType === "login" ? "signup" : "login"

          if (currentType === "signup") {
            signupFields.style.display = "block"
            authTitle.textContent = "Create Account"
            authSubtitle.textContent = ""
            submitText.textContent = "Create Account"
            authSwitchTextContainer.innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>'
          } else {
            signupFields.style.display = "none"
            authTitle.textContent = "Welcome Back"
            authSubtitle.textContent = "Sign in to your account"
            submitText.textContent = "Sign In"
            authSwitchTextContainer.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Sign Up</a>'
          }
          setupSwitchLink()
          messageElement.style.display = "none"
        }
      }
    }
    setupSwitchLink()

    function showFieldError(fieldId, message) {
      const field = document.getElementById(fieldId)
      const existingError = field.parentNode.querySelector(".field-error")
      if (existingError) {
        existingError.remove()
      }

      if (message) {
        const errorDiv = document.createElement("div")
        errorDiv.className = "field-error"
        errorDiv.style.color = "#dc3545"
        errorDiv.style.fontSize = "12px"
        errorDiv.style.marginTop = "4px"
        errorDiv.textContent = message
        field.parentNode.appendChild(errorDiv)
        field.style.borderColor = "#dc3545"
      } else {
        field.style.borderColor = ""
      }
    }

    function clearFieldErrors() {
      document.querySelectorAll(".field-error").forEach((error) => error.remove())
      document.querySelectorAll("input").forEach((input) => (input.style.borderColor = ""))
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      showMessage("", "", messageElement)
      clearFieldErrors()

      const usernameInput = document.getElementById("username")
      const passwordInput = document.getElementById("password")

      const credentials = {
        username: usernameInput.value.trim(),
        password: passwordInput.value,
        roles: ["Author"],
      }

      if (currentType === "login") {
        if (!credentials.username.trim()) {
          showFieldError("username", "Username is required")
          return
        }
        if (!credentials.password) {
          showFieldError("password", "Password is required")
          return
        }
      } else {
        const confirmPasswordInput = document.getElementById("confirm-password")
        const emailInput = document.getElementById("email")

        if (!credentials.username.trim()) {
          showFieldError("username", "Username is required")
          return
        }
        if (!credentials.password) {
          showFieldError("password", "Password is required")
          return
        }
        if (credentials.password !== confirmPasswordInput.value) {
          showFieldError("confirm-password", "Passwords do not match")
          return
        }
        if (!emailInput.value.trim()) {
          showFieldError("email", "Email is required")
          return
        }

        if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
          showFieldError("email", "Please enter a valid email address")
          isValid = false
          return
        }

        credentials.email = emailInput.value.trim()
      }

      let endpoint = ""
      if (currentType === "login") {
        endpoint = `${API_BASE_URL}/api/auth/login`
      } else {
        endpoint = `${API_BASE_URL}/api/user`
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401 && currentType === "login") {
            showFieldError("username", "Invalid username or password")
            showFieldError("password", "Invalid username or password")
            showMessage("Please check your credentials and try again.", "error", messageElement)
          } else if (response.status === 409 && currentType === "signup") {
            showFieldError("username", "This username is already taken")
            showMessage("Please choose a different username.", "error", messageElement)
          } else {
            const errorMessage = data.errors
              ? Object.values(data.errors).flat().join("; ")
              : data.detail || data.message || `API Error: ${response.statusText}`

            if (data.errors) {
              Object.keys(data.errors).forEach((field) => {
                const fieldId = field.toLowerCase()
                if (document.getElementById(fieldId)) {
                  showFieldError(fieldId, data.errors[field][0])
                }
              })
            }

            showMessage(errorMessage, "error", messageElement)
          }
          return
        }

        if (currentType === "login") {
          try {
            const userResponse = await fetch(`${API_BASE_URL}/api/user/${data.user.username}`, {
              headers: { Authorization: `Bearer ${data.token}` },
            })
            if (userResponse.ok) {
              const fullUserData = await userResponse.json()
              user = {
                username: data.user.username,
                roles: data.user.roles || ["Author"],
                email: fullUserData.email,
                profilePictureUrl: fullUserData.profilePictureUrl,
              }
            } else {
              user = { username: data.user.username, roles: data.user.roles || ["Author"] }
            }
          } catch (error) {
            user = { username: data.user.username, roles: data.user.roles || ["Author"] }
          }

          token = data.token
          tokenExpires = new Date(data.expires)
          saveAuthData()
          renderAppContent()
        } else {
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
            })

            const loginData = await loginResponse.json()

            if (loginResponse.ok) {
              user = { username: loginData.user.username, roles: loginData.user.roles || ["Author"] }
              token = loginData.token
              tokenExpires = new Date(loginData.expires)
              saveAuthData()
              renderAppContent()
            } else {
              throw new Error("Auto-login failed")
            }
          } catch (error) {
            console.error("Auto-login error:", error)
            showMessage("Account created successfully! Please sign in.", "success", messageElement)
            setTimeout(() => {
              currentType = "login"
              signupFields.style.display = "none"
              authTitle.textContent = "Welcome Back"
              authSubtitle.textContent = "Sign in to your account"
              submitText.textContent = "Sign In"
              authSwitchTextContainer.innerHTML =
                'Don\'t have an account? <a href="#" id="auth-switch-link">Sign Up</a>'
              setupSwitchLink()
              messageElement.style.display = "none"
            }, 2000)
          }
        }
      } catch (error) {
        showMessage("Network error. Please check your connection and try again.", "error", messageElement)
      }
    })
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
        `

    setupPostCreation()
    setupSearchAndFilter()
    loadPosts()
  }

  function setupPostCreation() {
    const form = document.getElementById("create-post-form")
    const statusSelect = document.getElementById("post-status")
    const scheduleGroup = document.getElementById("schedule-group")
    const submitBtnText = document.getElementById("submit-btn-text")
    const messageElement = document.getElementById("create-post-message")
    const postImageInput = document.getElementById("post-image")
    const scheduleDateInput = document.getElementById("schedule-date")
    const scheduleTimeInput = document.getElementById("schedule-time")

    scheduleDateInput.min = getMinDate()

    statusSelect.addEventListener("change", () => {
      if (statusSelect.value === "schedule") {
        scheduleGroup.style.display = "block"
        submitBtnText.textContent = "Schedule Post"
      } else {
        scheduleGroup.style.display = "none"
        submitBtnText.textContent = statusSelect.value === "draft" ? "Save Draft" : "Publish Post"
      }
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      showMessage("", "", messageElement)

      const selectedTags = Array.from(document.getElementById("post-tags").selectedOptions).map(
        (option) => option.value,
      )

      const selectedCategoryId = document.getElementById("post-category").value

      const status = document.getElementById("post-status").value
      let publishedDate = null

      if (status === "publish") {
        publishedDate = new Date().toISOString()
      } else if (status === "schedule") {
        const dateVal = scheduleDateInput.value
        const timeVal = scheduleTimeInput.value

        if (!dateVal || !timeVal) {
          showMessage("Please select both a date and time for scheduling.", "error", messageElement)
          return
        }

        const scheduledDateTime = new Date(`${dateVal}T${timeVal}:00`)
        const now = new Date()

        if (scheduledDateTime <= now) {
          showMessage("Scheduled date and time must be in the future.", "error", messageElement)
          return
        }
        publishedDate = scheduledDateTime.toISOString()
      }

      const newPost = {
        title: document.getElementById("post-title").value,
        AuthorUsername: user.username,
        content: document.getElementById("post-content").value,
        categories: selectedCategoryId ? [selectedCategoryId] : [],
        tags: selectedTags,
        isDraft: status === "draft" || (status === "schedule" && new Date(publishedDate) > new Date()),
        publishedDate: publishedDate,
        scheduledFor:
          status === "schedule"
            ? new Date(`${scheduleDateInput.value}T${scheduleTimeInput.value}:00`).toISOString()
            : null,
        ImageUrl: null,
        Base64Image: null,
      }

      if (postImageInput.files.length > 0) {
        const file = postImageInput.files[0]
        try {
          newPost.base64Image = await readFileAsBase64(file)
        } catch (error) {
          showMessage("Error reading image file: " + error.message, "error", messageElement)
          return
        }
      }

      if (status === "publish") {
        newPost.publishedDate = new Date().toISOString()
      }

      try {
        const response = await fetchAuthenticated(`${API_BASE_URL}/api/post`, {
          method: "POST",
          body: JSON.stringify(newPost),
        })

        const data = await response.json()

        if (!response.ok) {
          const errorMessage = data.errors
            ? Object.values(data.errors).flat().join("; ")
            : data.detail || data.message || `API Error: ${response.statusText}`
          throw new Error(errorMessage)
        }

        showMessage("Post created successfully!", "success", messageElement)
        form.reset()
        if (newPost.isDraft) {
          currentPage = "drafts"
        } else {
          currentPage = "feed"
        }
        renderAppContent()
      } catch (error) {
        console.error("Create post error:", error)
        showMessage(error.message, "error", messageElement)
      }
    })
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
      reader.readAsDataURL(file)
    })
  }

  function setupSearchAndFilter() {
    const searchInput = document.getElementById("search-input")
    const tagFilter = document.getElementById("tag-filter")

    if (searchInput && tagFilter) {
      searchInput.addEventListener("input", debounce(loadPosts, 300))
      tagFilter.addEventListener("change", loadPosts)
    }
  }

  function getMinDate() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func.apply(this, args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  function getTagNameById(id) {
    const tag = TAGS.find((t) => t.id === id)
    return tag ? tag.name : id
  }

  function getCategoryNameById(id) {
    const cat = CATEGORIES.find((c) => c.id === id)
    return cat ? cat.name : id
  }

  async function fetchPostsWithProfilePictures(posts) {
    const userCache = new Map()

    for (const post of posts) {
      if (!userCache.has(post.authorUsername)) {
        try {
          const userResponse = await fetchAuthenticated(`${API_BASE_URL}/api/user/${post.authorUsername}`)
          if (userResponse.ok) {
            const userData = await userResponse.json()
            userCache.set(post.authorUsername, userData.profilePictureUrl)
          }
        } catch (error) {
          console.warn(`Could not fetch profile for ${post.authorUsername}`)
          userCache.set(post.authorUsername, null)
        }
      }
      post.authorProfilePictureUrl = userCache.get(post.authorUsername)
    }

    return posts
  }

  async function loadPosts() {
    const postsContainer = document.getElementById("posts-container")
    const postsCount = document.getElementById("posts-count")

    if (!postsContainer || !postsCount) return

    postsContainer.innerHTML = `
            <div class="loading-posts">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading posts...</p>
            </div>
        `
    postsCount.textContent = "Loading..."

    const searchInput = document.getElementById("search-input")
    const tagFilter = document.getElementById("tag-filter")

    const searchTerm = searchInput?.value || ""
    const selectedTag = tagFilter?.value || ""

    const queryParams = new URLSearchParams()
    if (searchTerm) {
      queryParams.append("searchTerm", searchTerm)
      //queryParams.append('AuthorUsername', searchTerm);
    }
    if (selectedTag) {
      queryParams.append("tag", selectedTag)
    }
    queryParams.append("IsDraft", "false")

    const url = `${API_BASE_URL}/api/posts?${queryParams.toString()}`

    try {
      const headers = isAuthenticated() ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetchAuthenticated(url, { headers })

      if (!response.ok) {
        const errorData = response.headers.get("Content-Type")?.includes("application/json")
          ? await response.json()
          : await response.text()
        throw new Error(errorData.detail || errorData.message || `HTTP error! Status: ${response.status}`)
      }
      const posts = await response.json()

      postsContainer.innerHTML = ""
      postsCount.textContent = `${posts.length} posts`

      if (posts.length === 0) {
        postsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>No posts found.</h3>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                `
        return
      }

      const enrichedPosts = await fetchPostsWithProfilePictures(posts)

      enrichedPosts.forEach((post) => {
        const postCard = document.createElement("div")
        postCard.classList.add("post-card")
        postCard.dataset.tags = post.tags && Array.isArray(post.tags) ? post.tags.join(",") : ""
        postCard.dataset.post = JSON.stringify(post)
        const isLikedByCurrentUser = post.likedByUsers?.includes(user?.username)
        const likeCount = post.likedByUsers?.length || 0
        const slug = post.slug

        const isAuthor = isAuthenticated() && user.username === post.AuthorUsername
        console.log("DEBUG just seeing post:", post)
        postCard.innerHTML = `
    <div class="post-header">
        <div class="post-author-info">
            <div class="author-avatar">
                 <img src="${post.authorProfilePictureUrl || `${API_BASE_URL}/content/static/avatar.jpg`}" class="avatar-img" alt="Avatar" />
            </div>
            <div class="author-details">
                <span class="post-author">@${post.authorUsername || "Unknown"}</span>
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
              ${Array.isArray(post.categories) ? post.categories.map(getCategoryNameById).join(", ") : "Uncategorized"}
            </span>
            <div class="post-tags">
                ${post.tags && post.tags.length > 0 ? post.tags.map((tag) => `<span class="tag"><i class="fas fa-tag"></i> ${getTagNameById(tag)}</span>`).join("") : ""}
            </div>
        </div>
        <p class="post-content">${post.content.substring(0, 200)}</p>
        ${post.imageUrl ? `<img src="${API_BASE_URL}${post.imageUrl}" alt="${post.title || "Post Image"}" class="post-image">` : ""}
    </div>
    
    <div class="post-engagement">
        <div class="post-stats">
            <div class="like-section">
                <button class="like-btn ${isLikedByCurrentUser ? "liked" : ""}" data-post-id="${post.id}">
                  <i class="fas fa-heart"></i>
                  <span>${isLikedByCurrentUser ? "Liked" : "Like"}</span>
                </button>
                <span class="like-count">${likeCount} like${likeCount !== 1 ? "s" : ""}</span>
            </div>
            <div class="comment-count">
                <i class="fas fa-comment"></i>
                <span class="comment-count-text">${post.commentCount || 0} comments</span>
            </div>
        </div>
        
        <div class="comments-section">
            <div class="comments-header">
                <h4><i class="fas fa-comments"></i> Comments</h4>
                <button class="toggle-comments-btn" data-post-slug="${post.slug}">
                    <span class="toggle-text">Show Comments</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
            
            ${
              isAuthenticated()
                ? `
                <div class="comment-form">
                    <textarea class="comment-input" placeholder="Write a comment..." data-post-slug="${post.slug}"></textarea>
                    <button class="comment-submit-btn" data-post-slug="${post.slug}">
                        <i class="fas fa-paper-plane"></i>
                        Post
                    </button>
                </div>
            `
                : '<p class="no-comments">Please log in to comment</p>'
            }
            
            <div class="comments-list" data-post-slug="${post.slug}">
                <p class="no-comments">No comments yet. Be the first to comment!</p>
            </div>
        </div>
    </div>
    
    <div class="post-actions">
        ${
          isAuthor
            ? `
            <div class="dropdown">
                <button class="btn btn-sm btn-outline dropdown-toggle">
                    <i class="fas fa-ellipsis-h"></i> Actions
                </button>
                <div class="dropdown-menu">
                    <a href="#" class="dropdown-item edit-post-btn" data-post-slug="${post.slug}"><i class="fas fa-edit"></i> Edit</a>
                    <a href="#" class="dropdown-item delete-post-btn" data-post-slug="${post.slug}"><i class="fas fa-trash"></i> Delete</a>
                </div>
            </div>
        `
            : ""
        }
    </div>
`

        postsContainer.appendChild(postCard)

        fetchCommentsForPost(post.slug).then((comments) => {
          const commentCountSpan = postCard.querySelector(".comment-count-text")
          if (commentCountSpan) {
            commentCountSpan.textContent = `${comments.length} comment${comments.length !== 1 ? "s" : ""}`
          }
        })
      })

      postsContainer.querySelectorAll(".dropdown-toggle").forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation()
          const dropdownMenu = e.currentTarget.nextElementSibling
          dropdownMenu.classList.toggle("show")
        })
      })

      document.removeEventListener("click", closeDropdowns)
      document.addEventListener("click", closeDropdowns)

      postsContainer.querySelectorAll(".edit-post-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          e.preventDefault()
          const postSlug = e.currentTarget.dataset.postSlug
          const postData = JSON.parse(e.currentTarget.closest(".post-card").dataset.post)
          renderEditPostForm(postSlug, postData)
        })
      })

      postsContainer.querySelectorAll(".delete-post-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.preventDefault()
          const postSlug = e.currentTarget.dataset.postSlug
          console.log("DEBUG just seeing postSlug:", postSlug)
          console.log("DEBUG just seeing dataset:", e.currentTarget.dataset)
          if (confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
            await deletePost(postSlug)
            loadPosts()
          }
        })
      })

      postsContainer.querySelectorAll(".like-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.preventDefault()
          const likeBtn = e.currentTarget
          const postId = likeBtn.dataset.postId
          const isLiked = likeBtn.classList.contains("liked")
          const likeCount = likeBtn.parentElement.querySelector(".like-count")

          try {
            const url = `${API_BASE_URL}/api/post/${postId}/${isLiked ? "unlike" : "like"}`
            const response = await fetchAuthenticated(url, { method: "POST" })
            if (!response.ok) throw new Error("Failed to update like")

            const result = await response.json()
            const newCount = result.likedBy?.length || 0

            likeBtn.classList.toggle("liked")
            likeBtn.querySelector("span").textContent = isLiked ? "Like" : "Liked"
            likeBtn.parentElement.querySelector(".like-count").textContent =
              `${newCount} like${newCount !== 1 ? "s" : ""}`
          } catch (err) {
            console.error("Like toggle error:", err)
          }
        })
      })

      postsContainer.querySelectorAll(".toggle-comments-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.preventDefault()
          const postSlug = e.currentTarget.dataset.postSlug
          const commentsList = document.querySelector(`.comments-list[data-post-slug="${postSlug}"]`)
          const toggleText = e.currentTarget.querySelector(".toggle-text")
          const toggleIcon = e.currentTarget.querySelector("i")
          const commentCountText = e.currentTarget.closest(".post-card").querySelector(".comment-count-text")

          if (commentsList.classList.contains("show")) {
            commentsList.classList.remove("show")
            toggleText.textContent = "Show Comments"
            toggleIcon.className = "fas fa-chevron-down"
          } else {
            commentsList.classList.add("show")
            toggleText.textContent = "Hide Comments"
            toggleIcon.className = "fas fa-chevron-up"

            commentsList.innerHTML =
              '<p class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Loading comments...</p>'

            const comments = await fetchCommentsForPost(postSlug)
            displayComments(comments, commentsList)

            commentCountText.textContent = `${comments.length} comment${comments.length !== 1 ? "s" : ""}`
          }
        })
      })

      postsContainer.querySelectorAll(".comment-submit-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.preventDefault()
          const postSlug = e.currentTarget.dataset.postSlug
          const commentInput = document.querySelector(`.comment-input[data-post-slug="${postSlug}"]`)
          const commentsList = document.querySelector(`.comments-list[data-post-slug="${postSlug}"]`)
          const commentCountText = document
            .querySelector(`[data-post-slug="${postSlug}"]`)
            .closest(".post-card")
            .querySelector(".comment-count-text")

          if (!commentInput.value.trim()) {
            return
          }

          const originalText = button.innerHTML
          button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...'
          button.disabled = true

          try {
            const newComment = await addCommentToPost(postSlug, commentInput.value.trim())

            if (newComment) {
              commentInput.value = ""

              const comments = await fetchCommentsForPost(postSlug)
              displayComments(comments, commentsList)

              commentCountText.textContent = `${comments.length} comment${comments.length !== 1 ? "s" : ""}`

              if (!commentsList.classList.contains("show")) {
                commentsList.classList.add("show")
                const toggleBtn = document.querySelector(`.toggle-comments-btn[data-post-slug="${postSlug}"]`)
                toggleBtn.querySelector(".toggle-text").textContent = "Hide Comments"
                toggleBtn.querySelector("i").className = "fas fa-chevron-up"
              }
            } else {
              showMessage("Failed to add comment. Please try again.", "error", commentsList)
            }
          } catch (error) {
            console.error("Error adding comment:", error)
            showMessage("Error adding comment. Please try again.", "error", commentsList)
          } finally {
            button.innerHTML = originalText
            button.disabled = false
          }
        })
      })
    } catch (error) {
      postsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading posts: ${error.message}</p>
                </div>
            `
      postsCount.textContent = "Error"
      console.error("Error in loadPosts:", error)
    }
  }

  function closeDropdowns(event) {
    document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
      if (!menu.contains(event.target) && !menu.previousElementSibling.contains(event.target)) {
        menu.classList.remove("show")
      }
    })
  }

  function renderDraftsPage() {
    if (!isAuthenticated()) {
      showMessage("You must be logged in to view your drafts.", "error", appContainer)
      renderAuthForm("login")
      return
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
        `

    loadDrafts()
  }

  async function loadDrafts() {
    const draftsContainer = document.getElementById("drafts-container")

    draftsContainer.innerHTML = `
            <div class="loading-posts">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading drafts...</p>
            </div>
        `

    try {
      //const url = `${API_BASE_URL}/api/posts?isDraft=true&AuthorUsername=${user.username}`;
      const responsedraft = await fetchAuthenticated(`/api/posts?authorUsername=${user.username}&isDraft=true`)
      const response = await fetchAuthenticated(`/api/posts?authorUsername=${user.username}`)

      if (!response.ok) {
        const errorData = response.headers.get("Content-Type")?.includes("application/json")
          ? await response.json()
          : await response.text()
        throw new Error(errorData.detail || errorData.message || `HTTP error! Status: ${response.status}`)
      }
      const drafts = await responsedraft.json()
      const posts = await response.json()

      draftsContainer.innerHTML = ""

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
                `
        return
      }
      ;[...drafts, ...posts].forEach((draft) => {
        const draftCard = document.createElement("div")
        draftCard.className = "draft-card"
        draftCard.dataset.post = JSON.stringify(draft)

        draftCard.innerHTML = `
                    <div class="draft-header">
                        <div class="author-details">
                            <span class="post-author">@${draft.authorUsername || "Unknown"}</span>
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
                        <p>${draft.content.substring(0, 150)}${draft.content.length > 150 ? "..." : ""}</p>
                        <div class="draft-meta">
                            <span class="draft-category">${Array.isArray(draft.categories) ? draft.categories.map(getCategoryNameById).join(", ") : "Uncategorized"}</span>
                            <div class="draft-tags">
                                ${draft.tags && draft.tags.length > 0 ? draft.tags.map((tag) => `<span class="tag">${getTagNameById(tag)}</span>`).join("") : ""}
                            </div>
                        </div>
                        ${draft.imageUrl ? `<img src="${API_BASE_URL}${draft.imageUrl}" alt="${draft.title}" class="post-image-preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px;">` : ""}

                    </div>
                    <div class="draft-actions">
                        <button class="btn btn-primary edit-draft-btn" data-post-slug="${draft.slug}"><i class="fas fa-edit"></i>Edit</button>
                        ${
                          draft.isDraft
                            ? draft.scheduledFor
                              ? `<button class="btn btn-secondary cancel-schedule-btn" data-post-slug="${draft.slug}"><i class="fas fa-ban"></i>Cancel Schedule</button>`
                              : `<button class="btn btn-success publish-draft-btn" data-post-slug="${draft.slug}"><i class="fas fa-paper-plane"></i>Publish Now</button>`
                            : ""
                        }    
                        <button class="btn btn-danger delete-draft-btn" data-post-slug="${draft.slug}"><i class="fas fa-trash"></i>Delete</button>
                    </div>
                `
        draftsContainer.appendChild(draftCard)
      })

      draftsContainer.querySelectorAll(".edit-draft-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const postSlug = e.currentTarget.dataset.postSlug
          const postData = JSON.parse(e.currentTarget.closest(".draft-card").dataset.post)
          renderEditPostForm(postSlug, postData)
        })
      })

      draftsContainer.querySelectorAll(".publish-draft-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const postSlug = e.currentTarget.dataset.postSlug
          if (confirm("Are you sure you want to publish this draft?")) {
            await publishDraft(postSlug)
            loadDrafts()
            loadPosts()
          }
        })
      })

      draftsContainer.querySelectorAll(".delete-draft-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const postSlug = e.currentTarget.dataset.postSlug
          if (confirm("Are you sure you want to delete this draft? This action cannot be undone.")) {
            console.log("DEBUG just seeing postSlug:", postSlug)
            console.log("DEBUG just seeing dataset:", e.currentTarget.dataset)
            await deletePost(postSlug)
            loadDrafts()
          }
        })
      })

      draftsContainer.querySelectorAll(".cancel-schedule-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const postSlug = e.currentTarget.dataset.postSlug
          if (confirm("Are you sure you want to cancel the schedule and revert this post to a regular draft?")) {
            await cancelPostSchedule(postSlug)
            loadDrafts()
          }
        })
      })
    } catch (error) {
      draftsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading drafts: ${error.message}</p>
                </div>
            `
      console.error("Error in loadDrafts:", error)
    }
  }

  async function renderEditPostForm(postId, postData) {
    let publishedDateValue = ""
    let publishedTimeValue = ""
    postData.publishedDate = getMinDate()
    postData.ImageUrl = postData.ImageUrl || null
    postData.Base64Image = postData.Base64Image || null
    postData.isDraft = postData.isDraft || false
    postData.categories = postData.categories || []
    postData.scheduledFor = postData.scheduledFor || null

    if (postData.publishedDate) {
      const dateObj = new Date(postData.publishedDate)
      publishedDateValue = dateObj.toISOString().split("T")[0]
      publishedTimeValue = dateObj.toTimeString().substring(0, 5)
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
                                    ${CATEGORIES.map((cat) => `<option value="${cat.id}" ${postData.categories?.includes(cat.id) ? "selected" : ""}>${getCategoryNameById(cat.id)}</option>`).join("")}
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
                                ${TAGS.map((tag) => `<option value="${tag.id}" ${postData.tags && postData.tags.includes(tag.id) ? "selected" : ""}>${getTagNameById(tag.id)}</option>`).join("")}
                            </select>
                            <small>Hold Ctrl/Cmd to select multiple tags</small>
                        </div>
                        <div class="form-group">
                            <label for="edit-post-image">Image</label>
                            <input type="file" id="edit-post-image" accept="image/*">
                             ${
                               postData.imageUrl
                                 ? `<img src="${API_BASE_URL}${postData.imageUrl}" alt="${postData.title || "Current Image"}" class="post-image-preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px;">
                                <button type="button" class="btn btn-sm btn-danger remove-image-btn" style="margin-top: 5px;">Remove Image</button>
                                `
                                 : ""
                             }                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-post-status">Status</label>
                            <select id="edit-post-status">
                                <option value="draft" ${postData.isDraft ? "selected" : ""}>Save as Draft</option>
                                <option value="publish" ${!postData.isDraft ? "selected" : ""}>Publish Now</option>
                                <option value="schedule" ${postData.isDraft && postData.publishedDate ? "selected" : ""}>Schedule</option>
                            </select>
                        </div>
                        <div class="form-group" id="edit-schedule-group" style="display: ${postData.isDraft && postData.publishedDate ? "block" : "none"};">
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
        `

    const form = document.getElementById("edit-post-form")
    const messageElement = document.getElementById("edit-post-message")
    const cancelEditButton = document.getElementById("cancel-edit-post")
    const editPostImageInput = document.getElementById("edit-post-image")
    const removeImageBtn = document.querySelector(".remove-image-btn")
    let imageRemoved = false
    const editStatusSelect = document.getElementById("edit-post-status")
    const editScheduleGroup = document.getElementById("edit-schedule-group")
    const editScheduleDateInput = document.getElementById("edit-schedule-date")
    const editScheduleTimeInput = document.getElementById("edit-schedule-time")

    editScheduleDateInput.min = getMinDate()

    if (removeImageBtn) {
      removeImageBtn.addEventListener("click", () => {
        imageRemoved = true
        const imagePreview = document.querySelector(".post-image-preview")
        if (imagePreview) {
          imagePreview.remove()
        }
        removeImageBtn.remove()
        showMessage("Image marked for removal on update.", "info", messageElement)
      })
    }

    editStatusSelect.addEventListener("change", () => {
      if (editStatusSelect.value === "schedule") {
        editScheduleGroup.style.display = "block"
      } else {
        editScheduleGroup.style.display = "none"
      }
    })

    cancelEditButton.addEventListener("click", () => {
      currentPage = postData.isDraft ? "drafts" : "feed"
      renderAppContent()
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      showMessage("", "", messageElement)

      const selectedTags = Array.from(document.getElementById("edit-post-tags").selectedOptions).map(
        (option) => option.value,
      )

      const newStatus = document.getElementById("edit-post-status").value
      console.log("DEBUG just seeing newStatus:", newStatus)
      const wasDraft = postData.isDraft
      let publishedDate = null

      if (newStatus === "publish") {
        publishedDate = new Date().toISOString()
      } else if (newStatus === "schedule") {
        const dateVal = editScheduleDateInput.value
        const timeVal = editScheduleTimeInput.value

        if (!dateVal || !timeVal) {
          showMessage("Please select both a date and time for scheduling.", "error", messageElement)
          return
        }

        const scheduledDateTime = new Date(`${dateVal}T${timeVal}:00`)
        const now = new Date()

        if (scheduledDateTime <= now) {
          showMessage("Scheduled date and time must be in the future.", "error", messageElement)
          return
        }
        publishedDate = scheduledDateTime.toISOString()
      } else if (!wasDraft && newStatus === "publish") {
        publishedDate = postData.publishedDate
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
        Base64Image: postData.Base64Image || null,
      }

      if (editPostImageInput.files.length > 0) {
        const file = editPostImageInput.files[0]
        try {
          updatedPost.base64Image = await readFileAsBase64(file)
          updatedPost.ImageUrl = null
        } catch (error) {
          showMessage("Error reading new image file: " + error.message, "error", messageElement)
          return
        }
      } else if (imageRemoved) {
        updatedPost.ImageUrl = null
      } else {
        updatedPost.ImageUrl = postData.ImageUrl
      }

      if (wasDraft && updatedPost.isDraft === false) {
        updatedPost.publishedDate = new Date().toISOString()
      } else if (updatedPost.isDraft) {
        updatedPost.publishedDate = null
      } else {
        updatedPost.publishedDate = postData.publishedDate
      }

      try {
        const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-post/${postId}`, {
          method: "PUT",
          body: JSON.stringify(updatedPost),
        })

        const data = await response.json()

        if (!response.ok) {
          const errorMessage = data.errors
            ? Object.values(data.errors).flat().join("; ")
            : data.detail || data.message || `API Error: ${response.statusText}`
          throw new Error(errorMessage)
        }

        showMessage("Post updated successfully!", "success", messageElement)
        setTimeout(() => {
          currentPage = updatedPost.isDraft ? "drafts" : "feed"
          renderAppContent()
        }, 1500)
      } catch (error) {
        console.error("Update post error:", error)
        showMessage(error.message, "error", messageElement)
      }
    })
  }

  async function publishDraft(postSlug) {
    try {
      const getResponse = await fetchAuthenticated(`${API_BASE_URL}/api/post/${postSlug}`)
      if (!getResponse.ok) throw new Error("Could not fetch draft for publishing.")
      const draftToPublish = await getResponse.json()

      draftToPublish.isDraft = false
      draftToPublish.publishedDate = new Date().toISOString()
      draftToPublish.selectedTags = draftToPublish.tags || []
      draftToPublish.selectedCategoryId =
        draftToPublish.category && draftToPublish.category.length > 0 ? draftToPublish.category[0] : null
      draftToPublish.imageUrl = draftToPublish.ImageUrl || null

      const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-post/${postSlug}`, {
        method: "PUT",
        body: JSON.stringify(draftToPublish),
      })

      if (!response.ok) {
        const errorData = response.headers.get("Content-Type")?.includes("application/json")
          ? await response.json()
          : await response.text()
        throw new Error(errorData.detail || errorData.message || `Failed to publish post: ${response.statusText}`)
      }
      showMessage("Draft published successfully!", "success", appContainer)
      return true
    } catch (error) {
      console.error("Error publishing draft:", error)
      showMessage(`Error publishing draft: ${error.message}`, "error", appContainer)
      return false
    }
  }

  async function deletePost(postSlug) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-post/${postSlug}`, {
        method: "DELETE",
      })

      if (response.status === 204) {
        showMessage("Post deleted successfully!", "success", appContainer)
        return true
      } else {
        const errorData = response.headers.get("Content-Type")?.includes("application/json")
          ? await response.json()
          : await response.text()
        throw new Error(errorData.detail || errorData.message || `Failed to delete post: ${response.statusText}`)
      }
    } catch (error) {
      console.error("Error deleting post:", error)
      showMessage(`Error deleting post: ${error.message}`, "error", appContainer)
      return false
    }
  }

  function showMessage(text, type, container) {
    const existingMessage = container.querySelector(".message")
    if (existingMessage) {
      existingMessage.remove()
    }

    if (!text) return

    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${type}`
    messageDiv.textContent = text
    messageDiv.style.display = "block"

    container.prepend(messageDiv)

    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove()
      }
    }, 5000)
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 172800) return "Yesterday"

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  async function cancelPostSchedule(postSlug) {
    try {
      const getResponse = await fetchAuthenticated(`${API_BASE_URL}/api/post/${postSlug}`)
      if (!getResponse.ok) throw new Error("Could not fetch post for canceling schedule.")
      const postToUpdate = await getResponse.json()

      postToUpdate.isDraft = true
      postToUpdate.publishedDate = null
      postToUpdate.scheduledFor = null

      const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-post/${postSlug}`, {
        method: "PUT",
        body: JSON.stringify(postToUpdate),
      })

      if (!response.ok) {
        const errorData = response.headers.get("Content-Type")?.includes("application/json")
          ? await response.json()
          : await response.text()
        throw new Error(errorData.detail || errorData.message || `Failed to cancel schedule: ${response.statusText}`)
      }
      showMessage("Post schedule cancelled and reverted to draft.", "success", appContainer)
      return true
    } catch (error) {
      console.error("Error cancelling schedule:", error)
      showMessage(`Error cancelling schedule: ${error.message}`, "error", appContainer)
      return false
    }
  }

  function formatTime(dateString) {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  function updateNav() {
    mainNav.innerHTML = ""
    if (isAuthenticated()) {
      mainNav.innerHTML = `
                <div class="nav-links">
                    <button class="nav-btn ${currentPage === "feed" ? "active" : ""}" data-page="feed">
                        <i class="fas fa-home"></i> My Feed
                    </button>
                    <button class="nav-btn ${currentPage === "drafts" ? "active" : ""}" data-page="drafts">
                        <i class="fas fa-edit"></i> My Drafts & Posts
                    </button>
                    ${
                      user.roles && user.roles.includes("Admin")
                        ? `
                          <button class="nav-btn ${currentPage === "admin" ? "active" : ""}" data-page="admin">
                              <i class="fas fa-shield-alt"></i> Admin Panel
                          </button>
                          `
                        : ""
                    }
               </div>
                <div class="nav-user">
                 <div class="dropdown">
                   <button class="dropdown-toggle" id="profile-dropdown">
                     <img src="${user.profilePictureUrl || `${API_BASE_URL}/content/static/avatar.jpg`}" class="avatar-img" alt="Avatar" />
                     <span>${user.username}</span>
                     <i class="fas fa-chevron-down"></i>
                   </button>
                   <div class="dropdown-menu" id="profile-menu">
                     <a href="#" class="dropdown-item" id="edit-profile-btn">
                       <i class="fas fa-user-edit"></i> Edit Profile
                     </a>
                     <a href="#" class="dropdown-item" id="change-password-btn">
                       <i class="fas fa-key"></i> Change Password
                     </a>
                     <a href="#" class="dropdown-item" id="nav-logout">
                       <i class="fas fa-sign-out-alt"></i> Logout
                     </a>
                   </div>
                 </div>
               </div>
            `

      document.getElementById("profile-dropdown").addEventListener("click", (e) => {
        e.stopPropagation()
        document.getElementById("profile-menu").classList.toggle("show")
      })

      document.addEventListener("click", () => {
        document.getElementById("profile-menu").classList.remove("show")
      })

      document.getElementById("edit-profile-btn").addEventListener("click", (e) => {
        e.preventDefault()
        showEditProfileModal()
      })

      document.getElementById("change-password-btn").addEventListener("click", (e) => {
        e.preventDefault()
        showChangePasswordModal()
      })

      document.getElementById("nav-logout").addEventListener("click", () => {
        clearAuthData()
        currentPage = "feed"
        renderAppContent()
      })

      document.querySelectorAll(".nav-btn[data-page]").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentPage = btn.dataset.page
          renderAppContent()
        })
      })
    } else {
      mainNav.innerHTML = `
                    <button class="nav-btn ${currentPage === "login" ? "active" : ""}" data-page="login" id="nav-login">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                    <button class="nav-btn ${currentPage === "signup" ? "active" : ""}" data-page="signup" id="nav-signup">
                        <i class="fas fa-user-plus"></i> Sign Up
                    </button>
                `
      document.getElementById("nav-login").addEventListener("click", () => {
        currentPage = "login"
        renderAuthForm("login")
      })
      document.getElementById("nav-signup").addEventListener("click", () => {
        currentPage = "signup"
        renderAuthForm("signup")
      })
    }
  }

  function showEditProfileModal() {
    const modalHtml = `
    <div class="modal-overlay" id="edit-profile-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Profile</h3>
          <button class="modal-close" id="close-edit-profile-modal">&times;</button>
        </div>
        <form id="edit-profile-form" class="modal-form">
          <div class="form-group">
            <label for="edit-username">Username</label>
            <input type="text" id="edit-username" value="${user.username}" required>
          </div>
          <div class="form-group">
            <label for="edit-email">Email</label>
            <input type="email" id="edit-email" value="${user.email || ""}" required>
          </div>
          <div class="form-group">
            <label for="edit-profile-picture">Profile Picture</label>
            <input type="file" id="edit-profile-picture" accept="image/*">
            <div class="current-picture" style="margin-top: 10px;">
              <img src="${user.profilePictureUrl || `${API_BASE_URL}/content/static/avatar.jpg`}" 
                   alt="Current Profile Picture" 
                   style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
            </div>
          </div>
          <div class="modal-actions">
          <button class="btn btn-danger btn-sm delete-user-btn" data-username="${user.username}">
                <i class="fas fa-trash"></i> Delete account
              </button>
            <button type="button" class="btn btn-outline" id="cancel-edit-profile">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Profile</button>
          </div>
          <div id="edit-profile-message" class="message" style="display: none;"></div>
        </form>
      </div>
    </div>
  `

    document.body.insertAdjacentHTML("beforeend", modalHtml)

    const modal = document.getElementById("edit-profile-modal")
    const form = document.getElementById("edit-profile-form")
    const closeBtn = document.getElementById("close-edit-profile-modal")
    const cancelBtn = document.getElementById("cancel-edit-profile")
    const deleteUserBtn = document.querySelector(".delete-user-btn")
    const messageElement = document.getElementById("edit-profile-message")

    const closeModal = () => modal.remove()

    closeBtn.addEventListener("click", closeModal)
    cancelBtn.addEventListener("click", closeModal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal()
    })

    deleteUserBtn.addEventListener("click", async (e) => {
      e.preventDefault()

      const username = deleteUserBtn.dataset.username

      if (confirm(`Are you sure you want to delete your account ${username}?`)) {
      try {
        const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-user/${username}`, {
        method: "DELETE",
        })

        if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete account")
        }

        showMessage("Account deleted successfully!", "success", messageElement)
        setTimeout(() => {
          closeModal()
          clearAuthData()
          currentPage = "feed"
          renderAppContent()
        }, 1500)
      } catch (error) {
        showMessage(error.message, "error", messageElement)
      }
      }
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const username = document.getElementById("edit-username").value
      const email = document.getElementById("edit-email").value
      const profilePictureFile = document.getElementById("edit-profile-picture").files[0]

      try {
        const updateData = {
          email: email,
          roles: user.roles,
        }

        if (profilePictureFile) {
          updateData.profilePictureBase64 = await readFileAsBase64(profilePictureFile)
          updateData.profilePictureFileName = profilePictureFile.name
        }

        const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-user/${user.username}`, {
          method: "PUT",
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to update profile")
        }

        const updatedUser = await response.json()
        user.email = updatedUser.email
        user.profilePictureUrl = updatedUser.profilePictureUrl
        saveAuthData()

        showMessage("Profile updated successfully!", "success", messageElement)
        setTimeout(() => {
          closeModal()
          renderAppContent()
        }, 1500)
      } catch (error) {
        showMessage(error.message, "error", messageElement)
      }
    })
  }

  function showChangePasswordModal() {
    const modalHtml = `
    <div class="modal-overlay" id="change-password-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Change Password</h3>
          <button class="modal-close" id="close-change-password-modal">&times;</button>
        </div>
        <form id="change-password-form" class="modal-form">
          <div class="form-group">
            <label for="current-password">Current Password</label>
            <input type="password" id="current-password" required>
          </div>
          <div class="form-group">
            <label for="new-password">New Password</label>
            <input type="password" id="new-password" required>
          </div>
          <div class="form-group">
            <label for="confirm-new-password">Confirm New Password</label>
            <input type="password" id="confirm-new-password" required>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="cancel-change-password">Cancel</button>
            <button type="submit" class="btn btn-primary">Change Password</button>
          </div>
          <div id="change-password-message" class="message" style="display: none;"></div>
        </form>
      </div>
    </div>
  `

    document.body.insertAdjacentHTML("beforeend", modalHtml)

    const modal = document.getElementById("change-password-modal")
    const form = document.getElementById("change-password-form")
    const closeBtn = document.getElementById("close-change-password-modal")
    const cancelBtn = document.getElementById("cancel-change-password")
    const messageElement = document.getElementById("change-password-message")

    const closeModal = () => modal.remove()

    closeBtn.addEventListener("click", closeModal)
    cancelBtn.addEventListener("click", closeModal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal()
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const currentPassword = document.getElementById("current-password").value
      const newPassword = document.getElementById("new-password").value
      const confirmNewPassword = document.getElementById("confirm-new-password").value

      if (newPassword !== confirmNewPassword) {
        showMessage("New passwords do not match", "error", messageElement)
        return
      }

      try {
        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: user.username,
            password: currentPassword,
          }),
        })

        if (!loginResponse.ok) {
          throw new Error("Current password is incorrect")
        }

        const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-user/${user.username}`, {
          method: "PUT",
          body: JSON.stringify({
            email: user.email,
            roles: user.roles,
            hashedPassword: newPassword,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to change password")
        }

        showMessage("Password changed successfully!", "success", messageElement)
        setTimeout(() => {
          closeModal()
        }, 1500)
      } catch (error) {
        showMessage(error.message, "error", messageElement)
      }
    })
  }

  async function renderAdminPage() {
    if (!isAuthenticated() || !user.roles.includes("Admin")) {
      showMessage("You must be an admin to access this page.", "error", appContainer)
      currentPage = "feed"
      renderAppContent()
      return
    }

    appContainer.innerHTML = `
    <div class="admin-page">
      <div class="page-header">
        <h2><i class="fas fa-shield-alt"></i> Admin Panel</h2>
        <p>Manage users, categories, and tags</p>
      </div>
      
      <div class="admin-sections">
        <!-- User Management Section -->
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-users"></i> User Management</h3>
            <div class="section-stats">
              <span id="users-count">Loading...</span>
            </div>
          </div>
          <div id="users-container" class="admin-container">
            <div class="loading-posts">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading users...</p>
            </div>
          </div>
        </div>

        <!-- Categories Management Section -->
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-folder"></i> Categories Management</h3>
            <button class="btn btn-primary" id="add-category-btn">
              <i class="fas fa-plus"></i> Add Category
            </button>
          </div>
          <div id="categories-container" class="admin-container">
            <div class="loading-posts">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading categories...</p>
            </div>
          </div>
        </div>

        <!-- Tags Management Section -->
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-tags"></i> Tags Management</h3>
            <button class="btn btn-primary" id="add-tag-btn">
              <i class="fas fa-plus"></i> Add Tag
            </button>
          </div>
          <div id="tags-container" class="admin-container">
            <div class="loading-posts">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading tags...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

    loadAdminData()
  }

  async function loadAdminData() {
    await Promise.all([loadUsersAdmin(), loadCategoriesAdmin(), loadTagsAdmin()])
  }

  async function loadUsersAdmin() {
    const usersContainer = document.getElementById("users-container")
    const usersCount = document.getElementById("users-count")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/users`)
      if (!response.ok) throw new Error("Failed to fetch users")

      const users = await response.json()
      usersContainer.innerHTML = ""
      usersCount.textContent = `${users.length} users`

      users.forEach((user) => {
        const userCard = document.createElement("div")
        userCard.className = "admin-item-card"
        userCard.innerHTML = `
        <div class="admin-item-header">
          <div class="admin-item-info">
            <h4>@${user.username}</h4>
            <p>${user.email}</p>
            <div class="user-roles">
              ${user.roles.map((role) => `<span class="role-badge ${role.toLowerCase()}">${role}</span>`).join("")}
            </div>
          </div>
          <div class="admin-item-actions">
            ${
              !user.roles.includes("Admin")
                ? `
              <button class="btn btn-success btn-sm make-admin-btn" data-username="${user.username}">
                <i class="fas fa-user-shield"></i> Make Admin
              </button>
            `
                : user.username !== window.user?.username
                  ? `
              <button class="btn btn-warning btn-sm remove-admin-btn" data-username="${user.username}">
                <i class="fas fa-user-minus"></i> Remove Admin
              </button>
            `
                  : ""
            }
            ${
              user.username !== window.user?.username
                ? `
              <button class="btn btn-danger btn-sm delete-user-btn" data-username="${user.username}">
                <i class="fas fa-trash"></i> Delete
              </button>
            `
                : '<span class="text-muted">Current User</span>'
            }
          </div>
        </div>
      `
        usersContainer.appendChild(userCard)
      })

      usersContainer.querySelectorAll(".make-admin-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username
          if (confirm(`Make ${username} an admin?`)) {
            await toggleUserAdmin(username, true)
            loadUsersAdmin()
          }
        })
      })

      usersContainer.querySelectorAll(".remove-admin-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username
          if (confirm(`Remove admin privileges from ${username}?`)) {
            await toggleUserAdmin(username, false)
            loadUsersAdmin()
          }
        })
      })

      usersContainer.querySelectorAll(".delete-user-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username
          if (confirm(`Delete user ${username}? This action cannot be undone.`)) {
            await deleteUser(username)
            loadUsersAdmin()
          }
        })
      })
    } catch (error) {
      usersContainer.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading users: ${error.message}</p>
      </div>
    `
      usersCount.textContent = "Error"
    }
  }

  async function loadCategoriesAdmin() {
    const categoriesContainer = document.getElementById("categories-container")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/categories`)
      if (!response.ok) throw new Error("Failed to fetch categories")

      const categories = await response.json()
      categoriesContainer.innerHTML = ""

      if (categories.length === 0) {
        categoriesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>No categories yet</h3>
          <p>Create your first category</p>
        </div>
      `
        return
      }

      categories.forEach((category) => {
        const categoryCard = document.createElement("div")
        categoryCard.className = "admin-item-card"
        categoryCard.innerHTML = `
        <div class="admin-item-header">
          <div class="admin-item-info">
            <h4>${category.name}</h4>
            <p>${category.description || "No description"}</p>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-outline btn-sm edit-category-btn" data-category='${JSON.stringify(category)}'>
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-sm delete-category-btn" data-id="${category.id}" data-name="${category.name}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `
        categoriesContainer.appendChild(categoryCard)
      })

      categoriesContainer.querySelectorAll(".edit-category-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const category = JSON.parse(e.target.dataset.category)
          showCategoryModal(category)
        })
      })

      categoriesContainer.querySelectorAll(".delete-category-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.dataset.id
          const name = e.target.dataset.name
          if (confirm(`Delete category "${name}"? This action cannot be undone.`)) {
            await deleteCategory(id)
            loadCategoriesAdmin()
          }
        })
      })
    } catch (error) {
      categoriesContainer.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading categories: ${error.message}</p>
      </div>
    `
    }

    document.getElementById("add-category-btn").addEventListener("click", () => {
      showCategoryModal()
    })
  }

  async function loadTagsAdmin() {
    const tagsContainer = document.getElementById("tags-container")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch tags")

      const tags = await response.json()
      tagsContainer.innerHTML = ""

      if (tags.length === 0) {
        tagsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-tags"></i>
          <h3>No tags yet</h3>
          <p>Create your first tag</p>
        </div>
      `
        return
      }

      tags.forEach((tag) => {
        const tagCard = document.createElement("div")
        tagCard.className = "admin-item-card"
        tagCard.innerHTML = `
        <div class="admin-item-header">
          <div class="admin-item-info">
            <h4>${tag.name}</h4>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-outline btn-sm edit-tag-btn" data-tag='${JSON.stringify(tag)}'>
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-sm delete-tag-btn" data-id="${tag.id}" data-name="${tag.name}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `
        tagsContainer.appendChild(tagCard)
      })

      tagsContainer.querySelectorAll(".edit-tag-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const tag = JSON.parse(e.target.dataset.tag)
          showTagModal(tag)
        })
      })

      tagsContainer.querySelectorAll(".delete-tag-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.dataset.id
          const name = e.target.dataset.name
          if (confirm(`Delete tag "${name}"? This action cannot be undone.`)) {
            await deleteTag(id)
            loadTagsAdmin()
          }
        })
      })
    } catch (error) {
      tagsContainer.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading tags: ${error.message}</p>
      </div>
    `
    }

    document.getElementById("add-tag-btn").addEventListener("click", () => {
      showTagModal()
    })
  }

  async function toggleUserAdmin(username, makeAdmin) {
    try {
      const getUserResponse = await fetchAuthenticated(`${API_BASE_URL}/api/user/${username}`)
      if (!getUserResponse.ok) throw new Error("Failed to fetch user")

      const userData = await getUserResponse.json()
      let newRoles = [...userData.roles]

      if (makeAdmin && !newRoles.includes("Admin")) {
        newRoles.push("Admin")
      } else if (!makeAdmin && newRoles.includes("Admin")) {
        newRoles = newRoles.filter((role) => role !== "Admin")
      }

      const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-user/${username}`, {
        method: "PUT",
        body: JSON.stringify({
          email: userData.email,
          roles: newRoles,
        }),
      })

      if (!response.ok) throw new Error("Failed to update user")

      showMessage(
        `User ${username} ${makeAdmin ? "promoted to" : "removed from"} admin successfully!`,
        "success",
        appContainer,
      )
      return true
    } catch (error) {
      showMessage(`Error updating user: ${error.message}`, "error", appContainer)
      return false
    }
  }

  async function deleteUser(username) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-user/${username}`, {
        method: "DELETE",
      })

      if (response.status === 204) {
        showMessage(`User ${username} deleted successfully!`, "success", appContainer)
        return true
      } else {
        throw new Error("Failed to delete user")
      }
    } catch (error) {
      showMessage(`Error deleting user: ${error.message}`, "error", appContainer)
      return false
    }
  }

  function showCategoryModal(category = null) {
    const isEdit = !!category
    const modalHtml = `
    <div class="modal-overlay" id="category-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${isEdit ? "Edit Category" : "Add Category"}</h3>
          <button class="modal-close" id="close-category-modal">&times;</button>
        </div>
        <form id="category-form" class="modal-form">
          <div class="form-group">
            <label for="category-name">Name</label>
            <input type="text" id="category-name" value="${category?.name || ""}" required>
          </div>
          <div class="form-group">
            <label for="category-description">Description</label>
            <textarea id="category-description" rows="3">${category?.description || ""}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="cancel-category">Cancel</button>
            <button type="submit" class="btn btn-primary">
              ${isEdit ? "Update" : "Create"} Category
            </button>
          </div>
        </form>
      </div>
    </div>
  `

    document.body.insertAdjacentHTML("beforeend", modalHtml)

    const modal = document.getElementById("category-modal")
    const form = document.getElementById("category-form")
    const closeBtn = document.getElementById("close-category-modal")
    const cancelBtn = document.getElementById("cancel-category")

    const closeModal = () => {
      modal.remove()
    }

    closeBtn.addEventListener("click", closeModal)
    cancelBtn.addEventListener("click", closeModal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal()
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      const name = document.getElementById("category-name").value
      const description = document.getElementById("category-description").value

      try {
        let response
        if (isEdit) {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/update-category`, {
            method: "PUT",
            body: JSON.stringify({
              id: category.id,
              newName: name,
              description: description,
            }),
          })
        } else {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/category`, {
            method: "POST",
            body: JSON.stringify({
              name: name,
              description: description,
            }),
          })
        }

        if (!response.ok) throw new Error("Failed to save category")

        showMessage(`Category ${isEdit ? "updated" : "created"} successfully!`, "success", appContainer)
        closeModal()
        loadCategoriesAdmin()
        fetchCategoriesAndTags()
      } catch (error) {
        showMessage(`Error saving category: ${error.message}`, "error", form)
      }
    })
  }

  function showTagModal(tag = null) {
    const isEdit = !!tag
    const modalHtml = `
    <div class="modal-overlay" id="tag-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${isEdit ? "Edit Tag" : "Add Tag"}</h3>
          <button class="modal-close" id="close-tag-modal">&times;</button>
        </div>
        <form id="tag-form" class="modal-form">
          <div class="form-group">
            <label for="tag-name">Name</label>
            <input type="text" id="tag-name" value="${tag?.name || ""}" required>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="cancel-tag">Cancel</button>
            <button type="submit" class="btn btn-primary">
              ${isEdit ? "Update" : "Create"} Tag
            </button>
          </div>
        </form>
      </div>
    </div>
  `

    document.body.insertAdjacentHTML("beforeend", modalHtml)

    const modal = document.getElementById("tag-modal")
    const form = document.getElementById("tag-form")
    const closeBtn = document.getElementById("close-tag-modal")
    const cancelBtn = document.getElementById("cancel-tag")

    const closeModal = () => {
      modal.remove()
    }

    closeBtn.addEventListener("click", closeModal)
    cancelBtn.addEventListener("click", closeModal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal()
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      const name = document.getElementById("tag-name").value

      try {
        let response
        if (isEdit) {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/update-tag`, {
            method: "PUT",
            body: JSON.stringify({
              id: tag.id,
              newName: name,
            }),
          })
        } else {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/tag`, {
            method: "POST",
            body: JSON.stringify({
              name: name,
            }),
          })
        }

        if (!response.ok) throw new Error("Failed to save tag")

        showMessage(`Tag ${isEdit ? "updated" : "created"} successfully!`, "success", appContainer)
        closeModal()
        loadTagsAdmin()
        fetchCategoriesAndTags()
      } catch (error) {
        showMessage(`Error saving tag: ${error.message}`, "error", form)
      }
    })
  }

  async function deleteCategory(id) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-category/${id}`, {
        method: "DELETE",
      })

      if (response.status === 204) {
        showMessage("Category deleted successfully!", "success", appContainer)
        fetchCategoriesAndTags()
        return true
      } else {
        throw new Error("Failed to delete category")
      }
    } catch (error) {
      showMessage(`Error deleting category: ${error.message}`, "error", appContainer)
      return false
    }
  }

  async function deleteTag(id) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-tag/${id}`, {
        method: "DELETE",
      })

      if (response.status === 204) {
        showMessage("Tag deleted successfully!", "success", appContainer)
        fetchCategoriesAndTags()
        return true
      } else {
        throw new Error("Failed to delete tag")
      }
    } catch (error) {
      showMessage(`Error deleting tag: ${error.message}`, "error", appContainer)
      return false
    }
  }

  async function renderAppContent() {
    loadAuthData()

    if (CATEGORIES.length === 0 || TAGS.length === 0) {
      appContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading application data...</p>
                </div>
            `
      await fetchCategoriesAndTags()
    }

    updateNav()

    const loadingSpinner = appContainer.querySelector(".loading-spinner")
    if (loadingSpinner) {
      loadingSpinner.remove()
    }

    if (isAuthenticated()) {
      if (currentPage === "admin") {
        renderAdminPage()
      } else if (currentPage === "drafts") {
        renderDraftsPage()
      } else {
        renderDashboard()
      }
    } else {
      renderAuthForm("login")
    }
  }

  renderAppContent()
})

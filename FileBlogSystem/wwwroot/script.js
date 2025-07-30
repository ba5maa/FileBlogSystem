document.addEventListener("DOMContentLoaded", async () => {
  const appContainer = document.getElementById("app-container")
  const mainNav = document.getElementById("main-nav")

  const API_BASE_URL = "http://localhost:5211"

  let user = null
  let token = null
  let tokenExpires = null

  let currentPage = "welcome"
  let currentPostSlug = null
  let currentAdminSection = "posts"
  let base64Image = null;

  let CATEGORIES = []
  let TAGS = []

  function initializeRouting() {
    handleRouteChange()

    window.addEventListener("popstate", handleRouteChange)
  }

  function handleRouteChange() {
    const path = window.location.pathname
    const searchParams = new URLSearchParams(window.location.search)

    if (path === "/" || path === "/welcome") {
      currentPage = "welcome"
      currentPostSlug = null
    } else if (path === "/feed") {
      currentPage = "feed"
      currentPostSlug = null
    } else if (path === "/login") {
      currentPage = "login"
      currentPostSlug = null
    } else if (path === "/signup") {
      currentPage = "signup"
      currentPostSlug = null
    } else if (path === "/drafts") {
      currentPage = "drafts"
      currentPostSlug = null
    } else if (path === "/profile") {
      currentPage = "profile"
      currentPostSlug = null
    } else if (path === "/admin") {
      currentPage = "admin"
      currentPostSlug = null
      const section = searchParams.get("section")
      if (section && ["users", "categories", "tags", "posts"].includes(section)) {
        currentAdminSection = section
      }
    } else if (path === "/create-blog") {
      currentPage = "create-blog"
      currentPostSlug = null
    } else if (path.startsWith("/post/")) {
      const slug = path.replace("/post/", "")
      if (slug) {
        currentPage = "blog-post"
        currentPostSlug = slug
      } else {
        navigateTo("/welcome")
        return
      }
    } else {
      navigateTo("/welcome")
      return
    }

    renderAppContent()
  }

  function navigateTo(path, replace = false) {
    if (replace) {
      window.history.replaceState(null, "", path)
    } else {
      window.history.pushState(null, "", path)
    }
    handleRouteChange()
  }

  function updateURL() {
    let newPath = "/"

    switch (currentPage) {
      case "welcome":
        newPath = "/welcome"
        break
      case "feed":
        newPath = "/feed"
        break
      case "login":
        newPath = "/login"
        break
      case "signup":
        newPath = "/signup"
        break
      case "drafts":
        newPath = "/drafts"
        break
      case "profile":
        newPath = "/profile"
        break
      case "admin":
        newPath = `/admin?section=${currentAdminSection}`
        break
      case "create-blog":
        newPath = "/create-blog"
        break
      case "blog-post":
        if (currentPostSlug) {
          newPath = `/post/${currentPostSlug}`
        } else {
          newPath = "/welcome"
        }
        break
      default:
        newPath = "/welcome"
    }

    if (window.location.pathname + window.location.search !== newPath) {
      window.history.replaceState(null, "", newPath)
    }
  }

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
      navigateTo("/login")
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
        navigateTo("/login")
        throw new Error(`Authorization error: ${response.status}`)
      }
      return response
    } catch (error) {
      console.error(`Network or fetch error for ${url}:`, error)
      throw error
    }
  }

async function fetchPublicPosts(limit = 6) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts?IsDraft=false&limit=${limit}`);
    if (!response.ok) {
      throw new Error("Failed to fetch posts");
    }
    const posts = await response.json();

    const sortedPosts = posts
      .sort((a, b) => {
        const aLikes = a.likedByUsers?.length || 0;
        const bLikes = b.likedByUsers?.length || 0;
        return bLikes - aLikes;
      })
      .slice(0, limit);

    const userCache = new Map();

    for (const post of sortedPosts) {
      if (!userCache.has(post.authorUsername)) {
        try {
          const userResponse = await fetch(`${API_BASE_URL}/api/user/${post.authorUsername}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            userCache.set(post.authorUsername, userData.profilePictureUrl);
          } else {
            userCache.set(post.authorUsername, null);
          }
        } catch (err) {
          console.warn(`Profile fetch failed for ${post.authorUsername}:`, err);
          userCache.set(post.authorUsername, null);
        }
      }
      post.authorProfilePictureUrl = userCache.get(post.authorUsername);
    }

    return sortedPosts;
  } catch (error) {
    console.error("Error fetching public posts:", error);
    return [];
  }
}


function convertMarkdownToHtml(markdownText) {
  if (!markdownText) return "";

  let html = markdownText
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/gim, '<img src="$2" alt="$1" class="preview-image">')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
    .replace(/^- (.*$)/gim, "<li>$1</li>");

  if (html.includes("<li>")) {
    html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
  }

  html = html
    .replace(/```([^`\n]*)?\n([\s\S]*?)\n```/gim, "<pre><code>$2</code></pre>")
    .replace(/`([^`]*)`/gim, "<code>$1</code>"); 

  html = html
    .replace(/\n\n/gim, "</p><p>")
    .replace(/\n/gim, "<br>");

  if (
    !html.startsWith("<h") &&
    !html.startsWith("<p>") &&
    !html.startsWith("<ul>") &&
    !html.startsWith("<blockquote>") &&
    !html.startsWith("<pre>")
  ) {
    html = "<p>" + html + "</p>";
  }

  return html;
}

 async function renderBlogPostPage(slug) {
    // if (!isAuthenticated()) {
    //   navigateTo("/welcome")
    //   return
    // }
    console.log("DEBUG just seeing slug:", slug)
    currentPage = "blog-post"
    currentPostSlug = slug
    updateURL()

    appContainer.innerHTML = `
      <div class="blog-post-page">
        <div class="blog-post-header">
          <button class="back-btn" id="back-to-feed">
            <i class="fas fa-arrow-left"></i>
            ${isAuthenticated() ? "Back to Feed" : "Back to loved blogs"}
          </button>
        </div>
        <div class="blog-post-layout">
          <div class="blog-post-main">
            <div class="loading-posts">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading blog post...</p>
            </div>
          </div>
          <div class="blog-post-sidebar">
            <div class="sidebar-sticky-container">
              <div class="post-engagement-sidebar">
                <div class="engagement-stats">
                  <button class="like-btn-sidebar" id="like-btn-sidebar">
                    <i class="fas fa-heart"></i>
                    <span>Like</span>
                  </button>
                  <span class="like-count-sidebar">0 likes</span>
                </div>
              </div>
              
              <div class="comments-sidebar">
                <div class="comments-header">
                  <h3><i class="fas fa-comments"></i> Comments</h3>
                </div>
                <div class="loading-comments">
                  <i class="fas fa-spinner fa-spin"></i>
                  <p>Loading comments...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    document.getElementById("back-to-feed").addEventListener("click", () => {
      navigateTo("/feed")
    })

    try {
      const response = await fetch(`${API_BASE_URL}/api/post/${slug}`)
      if (!response.ok) {
        throw new Error("Failed to load blog post")
      }

      const post = await response.json()

      try {
        const userResponse = await fetch(`${API_BASE_URL}/api/user/${post.authorUsername}`)
        if (userResponse.ok) {
          const userData = await userResponse.json()
          post.authorProfilePictureUrl = userData.profilePictureUrl
        }
      } catch (error) {
        post.authorProfilePictureUrl = null
      }

      const blogMain = document.querySelector(".blog-post-main")
      const isLikedByCurrentUser = post.likedByUsers?.includes(user?.username)
      const likeCount = post.likedByUsers?.length || 0

      document.title = `${post.title} - FileBlogSystem`

      console.log("DEBUG just seeing blogmain:", blogMain)

      blogMain.innerHTML = `
        <article class="blog-post-article">
          <header class="blog-post-article-header">
            <h1 class="blog-post-title">${post.title}</h1>
            
            <div class="blog-post-meta">
              <div class="blog-post-author">
                <img src="${
                   post.authorProfilePictureUrl
                     ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(post.authorProfilePictureUrl.replace(/^\/content\//, ""))}&width=80&height=80`
                     : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=80&height=80`
                 }" class="author-avatar-large" alt="Author Avatar" />
                 
                <div class="author-info">
                  <span class="author-name">@${post.authorUsername}</span>
                  <span class="publish-date">${formatDate(post.publishedDate || post.creationDate)}</span>
                </div>
              </div>
              
              <div class="blog-post-tags">
                ${
                  post.categories && Array.isArray(post.categories)
                    ? post.categories
                        .map(
                          (cat) => `
                  <span class="category-tag">
                    <i class="fas fa-folder"></i>
                    ${getCategoryNameById(cat)}
                  </span>
                `,
                        )
                        .join("")
                    : ""
                }
                ${
                  post.tags && post.tags.length > 0
                    ? post.tags
                        .map(
                          (tag) => `
                  <span class="tag">
                    <i class="fas fa-tag"></i>
                    ${getTagNameById(tag)}
                  </span>
                `,
                        )
                        .join("")
                    : ""
                }
              </div>
            </div>
          </header>

          <div class="blog-post-content">
            ${convertMarkdownToHtml(post.content)}
          </div>
        </article>
      `

      const likeBtnSidebar = document.getElementById("like-btn-sidebar")
      const likeCountSidebar = document.querySelector(".like-count-sidebar")

      if (likeBtnSidebar && likeCountSidebar) {
        likeBtnSidebar.classList.toggle("liked", isLikedByCurrentUser)
        likeBtnSidebar.querySelector("span").textContent = isLikedByCurrentUser ? "Liked" : "Like"
        likeCountSidebar.textContent = `${likeCount} like${likeCount !== 1 ? "s" : ""}`
        likeBtnSidebar.dataset.postId = post.id

        likeBtnSidebar.addEventListener("click", async (e) => {
          e.preventDefault()
          const postId = likeBtnSidebar.dataset.postId
          const isLiked = likeBtnSidebar.classList.contains("liked")

          try {
            const url = `${API_BASE_URL}/api/post/${postId}/${isLiked ? "unlike" : "like"}`
            const response = await fetchAuthenticated(url, { method: "POST" })
            if (!response.ok) throw new Error("Failed to update like")

            const result = await response.json()
            const newCount = result.likedBy?.length || 0

            likeBtnSidebar.classList.toggle("liked")
            likeBtnSidebar.querySelector("span").textContent = isLiked ? "Like" : "Liked"
            likeCountSidebar.textContent = `${newCount} like${newCount !== 1 ? "s" : ""}`
          } catch (err) {
            console.error("Like toggle error:", err)
          }
        })
      }

      loadCommentsInSidebar(post.slug)
    } catch (error) {
      console.error("Error loading blog post:", error)
      document.querySelector(".blog-post-main").innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error loading blog post: ${error.message}</p>
          <button class="btn btn-primary" onclick="navigateTo('/welcome')">
            <i class="fas fa-home"></i>
            Go to Welcome
          </button>
        </div>
      `
      document.title = "FileBlogSystem"
    }
  }

  async function loadCommentsInSidebar(slug) {
    const sidebar = document.querySelector(".comments-sidebar")

    try {
      const comments = await fetchCommentsForPost(slug)

      sidebar.innerHTML = `
        <div class="comments-header">
          <h3><i class="fas fa-comments"></i> Comments (${comments.length})</h3>
        </div>
        
        ${
          isAuthenticated()
            ? `
            <div class="comment-form">
              <textarea class="comment-input" placeholder="Write a comment..." data-post-slug="${slug}"></textarea>
              <button class="comment-submit-btn" data-post-slug="${slug}">
                <i class="fas fa-paper-plane"></i>
                Post Comment
              </button>
            </div>
          `
            : '<div class="login-to-comment">Please log in to comment</div>'
        }
        
        <div class="comments-list" data-post-slug="${slug}">
        </div>
      `

      const commentsList = sidebar.querySelector(".comments-list")
      displayComments(comments, commentsList)

      const commentSubmitBtn = sidebar.querySelector(".comment-submit-btn")
      if (commentSubmitBtn) {
        commentSubmitBtn.addEventListener("click", async (e) => {
          e.preventDefault()
          const commentInput = sidebar.querySelector(".comment-input")

          if (!commentInput.value.trim()) return

          const originalText = commentSubmitBtn.innerHTML
          commentSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...'
          commentSubmitBtn.disabled = true

          try {
            const newComment = await addCommentToPost(slug, commentInput.value.trim())
            if (newComment) {
              commentInput.value = ""
              loadCommentsInSidebar(slug)
            }
          } catch (error) {
            console.error("Error adding comment:", error)
          } finally {
            commentSubmitBtn.innerHTML = originalText
            commentSubmitBtn.disabled = false
          }
        })
      }
    } catch (error) {
      sidebar.innerHTML = `
        <div class="comments-header">
          <h3><i class="fas fa-comments"></i> Comments</h3>
        </div>
        <p class="error-loading-comments">Error loading comments</p>
      `
    }
  }

  async function fetchCommentsForPost(postSlug) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/post/${postSlug}/comments`)
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`)
      }
      const comments = await response.json()

      for (const comment of comments) {
        try {
          const userResponse = await fetch(`${API_BASE_URL}/api/user/${comment.username}`)
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
      commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>'
      return
    }

    comments.forEach((comment) => {
      const commentElement = document.createElement("div")
      commentElement.className = "comment-item"
      commentElement.innerHTML = `
        <div class="comment-header">
          <div class="comment-author">
            <img src="${
              comment.authorProfilePictureUrl
                ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(comment.authorProfilePictureUrl.replace(/^\/content\//, ""))}&width=64&height=64`
                : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=64&height=64`
            }" class="avatar-img" alt="Avatar" />
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
      let categoriesRes, tagsRes

      try {
        categoriesRes = await fetch(`${API_BASE_URL}/api/categories`)
        tagsRes = await fetch(`${API_BASE_URL}/api/tags`)
      } catch (error) {
        if (isAuthenticated()) {
          categoriesRes = await fetchAuthenticated(`${API_BASE_URL}/api/categories`)
          tagsRes = await fetchAuthenticated(`${API_BASE_URL}/api/tags`)
        } else {
          throw error
        }
      }

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

async function renderWelcomePage() {
  currentPage = "welcome";
  updateURL();

  document.title = "Welcome to FileBlogSystem - Discover Amazing Stories";

  appContainer.innerHTML = `
    <div class="welcome-page">
      <div class="welcome-hero">
        <div>
          <h1>
            Welcome to FileBlogSystem
          </h1>
          <p>
            Discover amazing stories, share your thoughts, and connect with a community of passionate writers and readers.
          </p>
          <div class="welcome-cta-buttons">
            <button class="welcome-cta-btn" id="welcome-signup-btn">
              <i class="fas fa-user-plus"></i>
              Start Your Journey
            </button>
            <button class="welcome-cta-btn" id="welcome-login-btn">
              <i class="fas fa-sign-in-alt"></i>
              Sign In
            </button>
          </div>
        </div>
      </div>

      <div class="welcome-features">
        <div class="feature-card">
          <div>
            <i class="fas fa-pen-fancy"></i>
          </div>
          <h3>Write & Share</h3>
          <p>Express your thoughts and share your stories with our intuitive writing tools and markdown support.</p>
        </div>
        
        <div class="feature-card">
          <div>
            <i class="fas fa-users"></i>
          </div>
          <h3>Connect</h3>
          <p>Join a vibrant community of writers and readers. Like, comment, and engage with amazing content.</p>
        </div>
        
        <div class="feature-card">
          <div>
            <i class="fas fa-heart"></i>
          </div>
          <h3>Discover</h3>
          <p>Explore trending topics, discover new authors, and find content that inspires and educates.</p>
        </div>
      </div>

      <div class="popular-posts-section">
        <div class="section-header">
          <h2>
            <i class="fas fa-fire"></i>
            Most Loved Stories
          </h2>
          <p>
            Discover the most popular and engaging blog posts from our amazing community of writers.
          </p>
        </div>
        
        <div id="popular-posts-container">
          <div class="loading-posts">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading amazing stories...</p>
          </div>
        </div>
      </div>

      <div class="welcome-cta-section">
        <h2>
          Ready to Share Your Story?
        </h2>
        <p>
          Join thousands of writers and readers in our growing community.
        </p>
        <div class="welcome-cta-buttons">
          <button class="welcome-cta-btn" id="welcome-signup-btn-2">
            <i class="fas fa-rocket"></i>
            Get Started Free
          </button>
          <button class="welcome-cta-btn" id="welcome-explore-btn">
            <i class="fas fa-compass"></i>
            Explore More
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("welcome-signup-btn").addEventListener("click", () => {
    navigateTo("/signup");
  });

  document.getElementById("welcome-login-btn").addEventListener("click", () => {
    navigateTo("/login");
  });

  document.getElementById("welcome-signup-btn-2").addEventListener("click", () => {
    navigateTo("/signup");
  });

  document.getElementById("welcome-explore-btn").addEventListener("click", () => {
    document.querySelector(".popular-posts-section").scrollIntoView({
      behavior: "smooth",
    });
  });

  loadPopularPosts();
}

async function loadPopularPosts() {
  const container = document.getElementById("popular-posts-container");

  try {
    const posts = await fetchPublicPosts(6);

    container.innerHTML = "";

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="no-posts-message">
          <i class="fas fa-book-open"></i>
          <h3>No posts available yet</h3>
          <p>Be the first to share your amazing story!</p>
        </div>
      `;
      return;
    }

    posts.forEach((post, index) => {
      const likeCount = post.likedByUsers?.length || 0;
      const rankBadge = `#${index + 1}`;
      const markdownPreview = convertMarkdownToHtml(post.content.substring(0, 150));

      const postCard = document.createElement("div");
      postCard.className = "popular-post-card";
      
      postCard.innerHTML = `
        <div class="rank-badge">
          ${rankBadge} Most Loved
        </div>
        
        <div class="post-image-container">
          ${
            post.imageUrl
              ? `<img src="${API_BASE_URL}/api/image?path=${encodeURIComponent(post.imageUrl.replace(/^\/content\//, ""))}&width=300&height=200" alt="${post.title}" />`
              : `<div class="post-image-placeholder">
                  <i class="fas fa-image"></i>
                </div>`
          }
        </div>
        
        <div class="post-content">
          <div>
            <div class="post-category">
              <i class="fas fa-folder"></i>
              ${Array.isArray(post.categories) ? post.categories.map(getCategoryNameById).join(", ") : "Uncategorized"}
            </div>
            
            <h3>${post.title}</h3>
            
            <div class="post-preview-text">${markdownPreview}${post.content.length > 150 ? "..." : ""}</div>
          </div>
          
          <div class="post-footer">
            <div class="author-info">
              <img src="${
                 post.authorProfilePictureUrl
                   ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(post.authorProfilePictureUrl.replace(/^\/content\//, ""))}&width=64&height=64`
                   : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=64&height=64`
               }" alt="Author Avatar" />
               
              <div>
                <div class="author-username">@${post.authorUsername}</div>
                <div class="post-date">${formatDate(post.publishedDate || post.creationDate)}</div>
              </div>
            </div>
            
            <div class="post-actions">
              <div class="like-count">
                <i class="fas fa-heart"></i>
                <span>${likeCount}</span>
              </div>
              <div class="read-more-btn">
                <i class="fas fa-eye"></i>
                Read More
              </div>
            </div>
          </div>
        </div>
      `;
      
      postCard.addEventListener("click", () => {
        console.log("DEBUG just seeing post slug:", post.slug)
        if (post.slug) {
          currentPostSlug = post.slug;
          navigateTo(`/post/${post.slug}`);
          renderBlogPostPage(post.slug);
        } else {
          if (confirm("Please sign in to read the full article. Would you like to sign in now?")) {
            navigateTo("/login");
          }
        }
      });

      container.appendChild(postCard);
    });
  } catch (error) {
    console.error("Error loading popular posts:", error);
    container.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error loading posts</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
}
 

  function renderAuthForm(type = "login") {
    currentPage = type
    updateURL()

    document.title = type === "login" ? "Login - FileBlogSystem" : "Sign Up - FileBlogSystem"

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

    const currentType = type

    const setupSwitchLink = () => {
      const switchLink = document.getElementById("auth-switch-link")
      if (switchLink) {
        switchLink.onclick = (e) => {
          e.preventDefault()
          const newType = currentType === "login" ? "signup" : "login"
          navigateTo(`/${newType}`)
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
          navigateTo("/feed")
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
              try {
                 const userResponse = await fetch(`${API_BASE_URL}/api/user/${loginData.user.username}`, {
                   headers: { Authorization: `Bearer ${loginData.token}` },
                 });
                 if (userResponse.ok) {
                  const fullUserData = await userResponse.json();
                  user = {
                    username: loginData.user.username,
                    roles: loginData.user.roles || ["Author"],
                    email: fullUserData.email,
                  };
                } else {
                  user = { username: loginData.user.username, roles: loginData.user.roles || ["Author"] };
                }
              } catch (error) {
                user = { username: loginData.user.username, roles: loginData.user.roles || ["Author"] };
              }
            
              token = loginData.token;
              tokenExpires = new Date(loginData.expires);
              saveAuthData();
              navigateTo("/feed");
            } else {
              throw new Error("Auto-login failed")
            }
          } catch (error) {
            console.error("Auto-login error:", error)
            showMessage("Account created successfully! Please sign in.", "success", messageElement)
            setTimeout(() => {
              navigateTo("/login")
            }, 2000)
          }
        }
      } catch (error) {
        showMessage("Network error. Please check your connection and try again.", "error", messageElement)
      }
    })
  }

  async function renderDashboard() {
    currentPage = "feed"
    updateURL()

    document.title = "Feed - FileBlogSystem"

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

                <div class="create-blog-section">
                    <div class="create-blog-card">
                        <div class="create-blog-content">
                            <div class="create-blog-icon">
                                <i class="fas fa-pen-fancy"></i>
                            </div>
                            <div class="create-blog-text">
                                <h3>Share Your Story</h3>
                                <p>Create a new blog post and share your thoughts with the world</p>
                            </div>
                        </div>
                        <button class="create-blog-btn" id="create-blog-btn">
                            <i class="fas fa-plus"></i>
                            Create Blog
                        </button>
                    </div>
                </div>

                <div class="feed-section">
                    <div class="feed-header">
                        <h3><i class="fas fa-stream"></i> Recent Blogs</h3>
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

    document.getElementById("create-blog-btn").addEventListener("click", () => {
      navigateTo("/create-blog")
    })

    setupSearchAndFilter()
    loadPosts()
  }

  function renderCreateBlogPage() {
    currentPage = "create-blog"
    updateURL()

    document.title = "Create Blog - FileBlogSystem"

    appContainer.innerHTML = `
        <div class="create-blog-page">
            <div class="blog-editor-header">
                <div class="header-left">
                    <button class="back-btn" id="back-to-feed">
                        <i class="fas fa-arrow-left"></i>
                        Back to Feed
                    </button>
                </div>
                <div class="header-right">
                    <div class="editor-actions">
                        <button class="btn btn-outline" id="save-draft-btn">
                            <i class="fas fa-save"></i>
                            Save Draft
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-primary dropdown-toggle" id="publish-dropdown">
                                <i class="fas fa-paper-plane"></i>
                                Publish
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="dropdown-menu" id="publish-menu">
                                <a href="#" class="dropdown-item" id="publish-now">
                                    <i class="fas fa-paper-plane"></i> Publish Now
                                </a>
                                <a href="#" class="dropdown-item" id="schedule-post">
                                    <i class="fas fa-clock"></i> Schedule Post
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="blog-editor-container">
                <div class="blog-meta-section">
                    <div class="form-group">
                        <input type="text" id="blog-title" placeholder="Enter your blog title..." class="blog-title-input">
                    </div>
                    
                    <div class="meta-row">
                        <div class="form-group">
                            <label for="blog-category">Category</label>
                            <select id="blog-category" required>
                                <option value="">Select Category</option>
                                ${CATEGORIES.map((cat) => `<option value="${cat.id}">${getCategoryNameById(cat.id)}</option>`).join("")}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="blog-tags">Tags</label>
                            <select id="blog-tags" multiple>
                                ${TAGS.map((tag) => `<option value="${tag.id}">${getTagNameById(tag.id)}</option>`).join("")}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="editor-main">
                    <div class="editor-toolbar">
                        <div class="toolbar-group">
                            <button class="toolbar-btn" id="bold-btn" title="Bold">
                                <i class="fas fa-bold"></i>
                            </button>
                            <button class="toolbar-btn" id="italic-btn" title="Italic">
                                <i class="fas fa-italic"></i>
                            </button>
                            <button class="toolbar-btn" id="heading-btn" title="Heading">
                                <i class="fas fa-heading"></i>
                            </button>
                        </div>
                        
                        <div class="toolbar-group">
                            <button class="toolbar-btn" id="link-btn" title="Link">
                                <i class="fas fa-link"></i>
                            </button>
                            <button class="toolbar-btn" id="image-btn" title="Insert Image">
                                <i class="fas fa-image"></i>
                            </button>
                            <button class="toolbar-btn" id="code-btn" title="Code">
                                <i class="fas fa-code"></i>
                            </button>
                        </div>
                        
                        <div class="toolbar-group">
                            <button class="toolbar-btn" id="list-btn" title="List">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="toolbar-btn" id="quote-btn" title="Quote">
                                <i class="fas fa-quote-left"></i>
                            </button>
                        </div>
                        
                        <input type="file" id="image-upload" accept="image/*" style="display: none;">
                    </div>

                    <div class="editor-content">
                        <div class="editor-tabs">
                            <button class="tab-btn active" id="write-tab">Write</button>
                            <button class="tab-btn" id="preview-tab">Preview</button>
                        </div>
                        
                        <div class="editor-panes">
                            <div class="editor-pane active" id="write-pane">
                                <textarea id="markdown-editor" placeholder="Write your blog content in Markdown...
                                
                                # Example Heading
                                
                                This is a paragraph with **bold text** and *italic text*.
                                
                                ## Subheading
                                
                                - List item 1
                                - List item 2
                                
                                > This is a quote
                                
                                \`\`\`javascript
                                // Code block
                                console.log('Hello World');
                                \`\`\`
                                
                                You can insert images anywhere by clicking the image button in the toolbar or using markdown syntax: ![Alt text](image-url)"></textarea>
                            </div>
                            
                            <div class="editor-pane" id="preview-pane">
                                <div class="markdown-preview" id="markdown-preview">
                                    <p class="preview-placeholder">Start writing to see preview...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

               <div class="form-row" style="margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px;">
              <div class="form-group">
                <label for="create-post-image">Image</label>
                <input type="file" id="create-post-image" accept="image/*">
                <img id="create-post-image-preview" src="#" alt="Preview" class="post-image-preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px; display: none;">
                <button type="button" class="btn btn-sm btn-danger" id="remove-create-image-btn" style="margin-top: 5px; display: none;">Remove Image</button>
              </div>
            </div>
            
            
            </div>

            <div id="schedule-modal" class="modal-overlay" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Schedule Post</h3>
                        <button class="modal-close" id="close-schedule-modal">&times;</button>
                    </div>
                    <div class="modal-form">
                        <div class="form-group">
                            <label for="schedule-date">Date</label>
                            <input type="date" id="schedule-date" min="${getMinDate()}">
                        </div>
                        <div class="form-group">
                            <label for="schedule-time">Time</label>
                            <input type="time" id="schedule-time">
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-outline" id="cancel-schedule">Cancel</button>
                            <button class="btn btn-primary" id="confirm-schedule">Schedule Post</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="blog-message" class="message" style="display: none;"></div>
        </div>
    `

    setupBlogEditor()
  }

  function setupBlogEditor() {
    const backBtn = document.getElementById("back-to-feed")
    const markdownEditor = document.getElementById("markdown-editor")
    const markdownPreview = document.getElementById("markdown-preview")
    const writeTab = document.getElementById("write-tab")
    const previewTab = document.getElementById("preview-tab")
    const writePaneEl = document.getElementById("write-pane")
    const previewPaneEl = document.getElementById("preview-pane")
    const publishDropdown = document.getElementById("publish-dropdown")
    const publishMenu = document.getElementById("publish-menu")
    const scheduleModal = document.getElementById("schedule-modal")
    const messageElement = document.getElementById("blog-message")
    const createImageInput = document.getElementById("create-post-image");
    const imagePreview = document.getElementById("create-post-image-preview");
    const removeImageBtn = document.getElementById("remove-create-image-btn");
    
    
    createImageInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          base64Image = await readFileAsBase64(file);
          imagePreview.src = base64Image;
          imagePreview.style.display = "block";
          removeImageBtn.style.display = "inline-block";
        } catch (error) {
          showMessage("Error reading image: " + error.message, "error", document.getElementById("blog-message"));
        }
      }
    });
    
    removeImageBtn.addEventListener("click", () => {
      createImageInput.value = "";
      base64Image = null;
      imagePreview.src = "#";
      imagePreview.style.display = "none";
      removeImageBtn.style.display = "none";
    });


    backBtn.addEventListener("click", () => {
      navigateTo("/feed")
    })

    writeTab.addEventListener("click", () => {
      writeTab.classList.add("active")
      previewTab.classList.remove("active")
      writePaneEl.classList.add("active")
      previewPaneEl.classList.remove("active")
    })

    previewTab.addEventListener("click", () => {
      previewTab.classList.add("active")
      writeTab.classList.remove("active")
      previewPaneEl.classList.add("active")
      writePaneEl.classList.remove("active")
      updatePreview()
    })

    markdownEditor.addEventListener("input", debounce(updatePreview, 300))

    function updatePreview() {
      const markdownText = markdownEditor.value
      if (!markdownText.trim()) {
        markdownPreview.innerHTML = '<p class="preview-placeholder">Start writing to see preview...</p>'
        return
      }

      markdownPreview.innerHTML = convertMarkdownToHtml(markdownText)
    }

    setupToolbar()

    publishDropdown.addEventListener("click", (e) => {
      e.stopPropagation()
      publishMenu.classList.toggle("show")
    })

    document.addEventListener("click", () => {
      publishMenu.classList.remove("show")
    })

    document.getElementById("publish-now").addEventListener("click", (e) => {
      e.preventDefault()
      publishBlog("publish")
    })

    document.getElementById("save-draft-btn").addEventListener("click", () => {
      publishBlog("draft")
    })

    document.getElementById("schedule-post").addEventListener("click", (e) => {
      e.preventDefault()
      scheduleModal.style.display = "flex"
    })

    document.getElementById("close-schedule-modal").addEventListener("click", () => {
      scheduleModal.style.display = "none"
    })

    document.getElementById("cancel-schedule").addEventListener("click", () => {
      scheduleModal.style.display = "none"
    })

    document.getElementById("confirm-schedule").addEventListener("click", () => {
      const date = document.getElementById("schedule-date").value
      const time = document.getElementById("schedule-time").value

      if (!date || !time) {
        showMessage("Please select both date and time", "error", messageElement)
        return
      }

      const scheduledDateTime = new Date(`${date}T${time}:00`)
      if (scheduledDateTime <= new Date()) {
        showMessage("Scheduled time must be in the future", "error", messageElement)
        return
      }

      scheduleModal.style.display = "none"
      publishBlog("schedule", scheduledDateTime)
    })

    scheduleModal.addEventListener("click", (e) => {
      if (e.target === scheduleModal) {
        scheduleModal.style.display = "none"
      }
    })
  }

  function setupToolbar() {
    const editor = document.getElementById("markdown-editor")
    const imageUpload = document.getElementById("image-upload")
    const messageElement = document.getElementById("blog-message");


    document.getElementById("bold-btn").addEventListener("click", () => {
      insertMarkdown("**", "**", "bold text")
    })

    document.getElementById("italic-btn").addEventListener("click", () => {
      insertMarkdown("*", "*", "italic text")
    })

    document.getElementById("heading-btn").addEventListener("click", () => {
      insertMarkdown("## ", "", "Heading")
    })

    document.getElementById("link-btn").addEventListener("click", () => {
      const url = prompt("Enter URL:")
      if (url) {
        insertMarkdown("[", `](${url})`, "link text")
      }
    })

    document.getElementById("image-btn").addEventListener("click", () => {
      imageUpload.click()
    })

    imageUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const title = document.getElementById("blog-title")?.value.trim();
          const tempSlug = title ? title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "") : "temp";
    
          const formData = new FormData();
          formData.append("image", file);
    
          const response = await fetch(`${API_BASE_URL}/api/post/${tempSlug}/upload-image`, {
            method: "POST",
            body: formData,
          });
    
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Image upload failed");
    
          const altText = prompt("Enter alt text for the image:") || "Image";
          const imageUrl = data.imageUrl;
    
          insertMarkdown("![", `](${imageUrl})`, altText);
        } catch (error) {
          const messageElement = document.getElementById("blog-message");
          showMessage("Error uploading image: " + error.message, "error", messageElement);
        }
      }
    });
    
       

    document.getElementById("code-btn").addEventListener("click", () => {
      insertMarkdown("`", "`", "code")
    })

    document.getElementById("list-btn").addEventListener("click", () => {
      insertMarkdown("- ", "", "List item")
    })

    document.getElementById("quote-btn").addEventListener("click", () => {
      insertMarkdown("> ", "", "Quote")
    })

    function insertMarkdown(before, after, placeholder) {
      const start = editor.selectionStart
      const end = editor.selectionEnd
      const selectedText = editor.value.substring(start, end)
      const replacement = before + (selectedText || placeholder) + after

      editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end)

      const newCursorPos = selectedText ? start + replacement.length : start + before.length + placeholder.length
      editor.setSelectionRange(newCursorPos, newCursorPos)
      editor.focus()

      const event = new Event("input")
      editor.dispatchEvent(event)
    }
  }

  async function publishBlog(status, scheduledDate = null) {
    const title = document.getElementById("blog-title").value.trim()
    const content = document.getElementById("markdown-editor").value.trim()
    const categoryId = document.getElementById("blog-category").value
    const selectedTags = Array.from(document.getElementById("blog-tags").selectedOptions).map((option) => option.value)
    const messageElement = document.getElementById("blog-message")

    if (!title) {
      showMessage("Please enter a blog title", "error", messageElement)
      return
    }

    if (!content) {
      showMessage("Please write some content", "error", messageElement)
      return
    }

    if (!categoryId) {
      showMessage("Please select a category", "error", messageElement)
      return
    }

    let publishedDate = null
    let isDraft = true

    if (status === "publish") {
      publishedDate = new Date().toISOString()
      isDraft = false
    } else if (status === "schedule") {
      publishedDate = scheduledDate.toISOString()
      isDraft = true
    }

    const newPost = {
      title: title,
      AuthorUsername: user.username,
      content: content,
      categories: [categoryId],
      tags: selectedTags,
      isDraft: isDraft,
      publishedDate: publishedDate,
      scheduledFor: status === "schedule" ? scheduledDate.toISOString() : null,
      ImageUrl: null,
      Base64Image: base64Image || null,
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

      let successMessage = ""
      if (status === "publish") {
        successMessage = "Blog post published successfully!"
      } else if (status === "draft") {
        successMessage = "Blog post saved as draft!"
      } else if (status === "schedule") {
        successMessage = `Blog post scheduled for ${scheduledDate.toLocaleString()}!`
      }

      showMessage(successMessage, "success", messageElement)

      setTimeout(() => {
        if (status === "draft") {
          navigateTo("/drafts")
        } else {
          navigateTo("/feed")
        }
      }, 2000)
    } catch (error) {
      console.error("Publish blog error:", error)
      showMessage(error.message, "error", messageElement)
    }
  }

  function setupSearchAndFilter() {
    const searchInput = document.getElementById("search-input")
    const tagFilter = document.getElementById("tag-filter")

    if (searchInput || tagFilter) {
      searchInput.addEventListener(
        "input",
        debounce(() => {
          loadPosts()
        }, 300),
      )
      tagFilter.addEventListener("change", () => {
        loadPosts()
      })
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

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
      reader.readAsDataURL(file)
    })
  }

  async function fetchPostsWithProfilePictures(posts) {
    const userCache = new Map()

    for (const post of posts) {
      if (!userCache.has(post.authorUsername)) {
        try {
          const userResponse = await fetch(`${API_BASE_URL}/api/user/${post.authorUsername}`)
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

  function createPostCard(post) {
    const isLikedByCurrentUser = post.likedByUsers?.includes(user?.username)
    const likeCount = post.likedByUsers?.length || 0
    const isAuthor = isAuthenticated() && user.username === post.authorUsername
    const markdownPreview = convertMarkdownToHtml(post.content.substring(0, 200))

    const postCard = document.createElement("div")
    postCard.classList.add("post-card")
    postCard.dataset.post = JSON.stringify(post)

    postCard.innerHTML = `
      ${
        post.isDraft || post.scheduledFor
          ? `
        <div class="post-status-badge">
          ${
            post.isDraft && post.scheduledFor
              ? '<span class="scheduled-badge"><i class="fas fa-clock"></i> Scheduled</span>'
              : post.isDraft
                ? '<span class="draft-badge"><i class="fas fa-edit"></i> Draft</span>'
                : '<span class="published-badge"><i class="fas fa-check-circle"></i> Published</span>'
          }
        </div>
      `
          : ""
      }
      
      <div class="post-image-container">
        ${
          post.imageUrl
            ? `<img src="${API_BASE_URL}/api/image?path=${encodeURIComponent(post.imageUrl.replace(/^\/content\//, ""))}&width=300&height=200" alt="${post.title}" class="post-image">`
            : '<div class="post-image-placeholder"><i class="fas fa-image"></i></div>'
        }
      </div>
      
      <div class="post-card-content">
        <div class="post-card-header">
          <div class="post-category-tag">
            <i class="fas fa-folder"></i>
            ${Array.isArray(post.categories) ? post.categories.map(getCategoryNameById).join(", ") : "Uncategorized"}
          </div>
          <h3 class="post-card-title" data-post-slug="${post.slug}">${post.title}</h3>
          <div class="post-card-excerpt">${markdownPreview}${post.content.length > 200 ? "..." : ""}</div>
          ${
            post.tags && post.tags.length > 0
              ? `
            <div class="post-tags">
              ${post.tags
                .map(
                  (tag) => `
                <span class="post-tag">
                  <i class="fas fa-tag"></i>
                  ${getTagNameById(tag)}
                </span>
              `,
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
        
        <div class="post-card-footer">
          <div class="post-author-info">
           <img src="${post.authorProfilePictureUrl 
             ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(post.authorProfilePictureUrl.replace(/^\/content\//, ""))}&width=40&height=40`
             : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=40&height=40`}" 
     class="post-author-avatar" alt="Author Avatar" />

            <div class="post-author-details">
              <span class="post-author-name">@${post.authorUsername}</span>
              <span class="post-date">${formatDate(post.publishedDate || post.creationDate)}</span>
            </div>
          </div>
          
          <div class="post-engagement">
            <button class="post-like-btn ${isLikedByCurrentUser ? "liked" : ""}" data-post-id="${post.id}">
              <i class="fas fa-heart"></i>
              <span>${likeCount}</span>
            </button>
            <button class="post-comment-btn" data-post-slug="${post.slug}">
              <i class="fas fa-comment"></i>
              <span id="comment-count-${post.slug}">0</span>
            </button>
          </div>
        </div>
      </div>
    `

    return postCard
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
    }
    if (selectedTag) {
      queryParams.append("tag", selectedTag)
    }
    queryParams.append("IsDraft", "false")

    console.log("Loading posts with params:", queryParams.toString())

    const url = `${API_BASE_URL}/api/posts?${queryParams.toString()}`

    try {
      const response = await fetch(url)

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
        const postCard = createPostCard(post)
        postsContainer.appendChild(postCard)

        const postTitle = postCard.querySelector(".post-card-title")
        postTitle.addEventListener("click", (e) => {
          const postSlug = postTitle.dataset.postSlug
          navigateTo(`/post/${postSlug}`)
        })

        fetchCommentsForPost(post.slug).then((comments) => {
          const commentCountSpan = postCard.querySelector(`#comment-count-${post.slug}`)
          if (commentCountSpan) {
            commentCountSpan.textContent = comments.length
          }
        })
      })

      setupPostCardEventListeners(postsContainer)
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

  function setupPostCardEventListeners(container) {
    container.querySelectorAll(".dropdown-toggle").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation()
        const dropdownMenu = e.currentTarget.nextElementSibling
        dropdownMenu.classList.toggle("show")
      })
    })

    document.addEventListener("click", (event) => {
      container.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
        if (!menu.contains(event.target) && !menu.previousElementSibling.contains(event.target)) {
          menu.classList.remove("show")
        }
      })
    })

    container.querySelectorAll(".edit-post-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault()
        const postSlug = e.currentTarget.dataset.postSlug
        const postData = JSON.parse(e.currentTarget.closest(".post-card").dataset.post)
        renderEditPostForm(postSlug, postData)
      })
    })

    container.querySelectorAll(".delete-post-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.preventDefault()
        const postSlug = e.currentTarget.dataset.postSlug
        if (confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
          await deletePost(postSlug)
          loadPosts()
        }
      })
    })

    container.querySelectorAll(".post-like-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const likeBtn = e.currentTarget
        const postId = likeBtn.dataset.postId
        const isLiked = likeBtn.classList.contains("liked")

        try {
          const url = `${API_BASE_URL}/api/post/${postId}/${isLiked ? "unlike" : "like"}`
          const response = await fetchAuthenticated(url, { method: "POST" })
          if (!response.ok) throw new Error("Failed to update like")

          const result = await response.json()
          const newCount = result.likedBy?.length || 0

          likeBtn.classList.toggle("liked")
          likeBtn.querySelector("span").textContent = newCount
        } catch (err) {
          console.error("Like toggle error:", err)
        }
      })
    })

    container.querySelectorAll(".post-comment-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault()
        const postSlug = button.dataset.postSlug
        navigateTo(`/post/${postSlug}`)
      })
    })

    container.querySelectorAll(".post-card").forEach((card) => {
      const contentArea = card.querySelector(".post-card-excerpt")
      if (contentArea) {
        contentArea.style.cursor = "pointer"
        contentArea.addEventListener("click", (e) => {
          e.preventDefault()
          const post = JSON.parse(card.dataset.post)
          navigateTo(`/post/${post.slug}`)
        })
      }
      const imageArea = card.querySelector(".post-image, .post-image-placeholder")
      if (imageArea) {
        imageArea.style.cursor = "pointer"
        imageArea.addEventListener("click", (e) => {
          e.preventDefault()
          const post = JSON.parse(card.dataset.post)
          navigateTo(`/post/${post.slug}`)
        })
      }
    })
  }

  function renderDraftsPage() {
    if (!isAuthenticated()) {
      showMessage("You must be logged in to view your drafts.", "error", appContainer)
      navigateTo("/login")
      return
    }

    currentPage = "drafts"
    updateURL()

    document.title = "My Drafts & Posts - FileBlogSystem"

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
      const responsedraft = await fetchAuthenticated(
        `${API_BASE_URL}/api/posts?authorUsername=${user.username}&isDraft=true`,
      )
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts?authorUsername=${user.username}`)

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
            <button class="btn btn-primary" onclick="navigateTo('/create-blog')">
              <i class="fas fa-plus"></i> Create New Blog
            </button>
          </div>
        `
        return
      }

      const allPosts = [...drafts, ...posts]
      const enrichedPosts = await fetchPostsWithProfilePictures(allPosts)

      enrichedPosts.forEach((post) => {
        const postCard = createPostCard(post)

        const cardContent = postCard.querySelector(".post-card-content")
        const actionsHtml = `
          <div class="post-card-actions" style="margin-top: 1rem; padding-top: 1rem; display: flex; gap: 0.5rem; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-primary btn-sm edit-draft-btn" data-post-slug="${post.slug}">
              <i class="fas fa-edit"></i> Edit
            </button>
            ${
              post.isDraft
                ? post.scheduledFor
                  ? `<button class="btn btn-outline btn-sm cancel-schedule-btn" data-post-slug="${post.slug}">
                   <i class="fas fa-ban"></i> Cancel Schedule
                 </button>`
                  : `<button class="btn btn-success btn-sm publish-draft-btn" data-post-slug="${post.slug}">
                   <i class="fas fa-paper-plane"></i> Publish Now
                 </button>`
                : ""
            }
            <button class="btn btn-danger btn-sm delete-draft-btn" data-post-slug="${post.slug}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        `
        cardContent.insertAdjacentHTML("beforeend", actionsHtml)

        draftsContainer.appendChild(postCard)
      })

      setupDraftEventListeners(draftsContainer)
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

  function setupDraftEventListeners(container) {
    container.querySelectorAll(".edit-draft-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const postSlug = e.currentTarget.dataset.postSlug
        const postData = JSON.parse(e.currentTarget.closest(".post-card").dataset.post)
        renderEditPostForm(postSlug, postData)
      })
    })

    container.querySelectorAll(".publish-draft-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const postSlug = e.currentTarget.dataset.postSlug
        if (confirm("Are you sure you want to publish this draft?")) {
          await publishDraft(postSlug)
          loadDrafts()
        }
      })
    })

    container.querySelectorAll(".delete-draft-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const postSlug = e.currentTarget.dataset.postSlug
        if (confirm("Are you sure you want to delete this draft? This action cannot be undone.")) {
          await deletePost(postSlug)
          loadDrafts()
        }
      })
    })

    container.querySelectorAll(".cancel-schedule-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const postSlug = e.currentTarget.dataset.postSlug
        if (confirm("Are you sure you want to cancel the schedule and revert this post to a regular draft?")) {
          await cancelPostSchedule(postSlug)
          loadDrafts()
        }
      })
    })
  }

  async function renderEditPostForm(postId, postData) {
    let publishedDateValue = ""
    let publishedTimeValue = ""
    postData.publishedDate = postData.publishedDate || getMinDate()
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

    document.title = `Edit: ${postData.title} - FileBlogSystem`

    appContainer.innerHTML = `
      <div class="create-blog-page">
        <div class="blog-editor-header">
          <div class="header-left">
            <button class="back-btn" id="back-to-drafts">
              <i class="fas fa-arrow-left"></i>
              Back to Drafts
            </button>
          </div>
          <div class="header-right">
            <div class="editor-actions">
              <button class="btn btn-outline" id="save-draft-btn">
                <i class="fas fa-save"></i>
                Save Draft
              </button>
              <div class="dropdown">
                <button class="btn btn-primary dropdown-toggle" id="publish-dropdown">
                  <i class="fas fa-paper-plane"></i>
                  Publish
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div class="dropdown-menu" id="publish-menu">
                  <a href="#" class="dropdown-item" id="publish-now">
                    <i class="fas fa-paper-plane"></i> Publish Now
                  </a>
                  <a href="#" class="dropdown-item" id="schedule-post">
                    <i class="fas fa-clock"></i> Schedule Post
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="blog-editor-container">
          <input type="hidden" id="edit-post-id" value="${postId}">
          
          <div class="blog-meta-section">
            <div class="form-group">
              <input type="text" id="blog-title" placeholder="Enter your blog title..." class="blog-title-input" value="${postData.title}">
            </div>
            
            <div class="meta-row">
              <div class="form-group">
                <label for="blog-category">Category</label>
                <select id="blog-category" required>
                  <option value="">Select Category</option>
                  ${CATEGORIES.map((cat) => `<option value="${cat.id}" ${postData.categories?.includes(cat.id) ? "selected" : ""}>${getCategoryNameById(cat.id)}</option>`).join("")}
                </select>
              </div>
              
              <div class="form-group">
                <label for="blog-tags">Tags</label>
                <select id="blog-tags" multiple>
                  ${TAGS.map((tag) => `<option value="${tag.id}" ${postData.tags && postData.tags.includes(tag.id) ? "selected" : ""}>${getTagNameById(tag.id)}</option>`).join("")}
                </select>
              </div>
            </div>
          </div>

          <div class="editor-main">
            <div class="editor-toolbar">
              <div class="toolbar-group">
                <button class="toolbar-btn" id="bold-btn" title="Bold">
                  <i class="fas fa-bold"></i>
                </button>
                <button class="toolbar-btn" id="italic-btn" title="Italic">
                  <i class="fas fa-italic"></i>
                </button>
                <button class="toolbar-btn" id="heading-btn" title="Heading">
                  <i class="fas fa-heading"></i>
                </button>
              </div>
              
              <div class="toolbar-group">
                <button class="toolbar-btn" id="link-btn" title="Link">
                  <i class="fas fa-link"></i>
                </button>
                <button class="toolbar-btn" id="image-btn" title="Insert Image">
                  <i class="fas fa-image"></i>
                </button>
                <button class="toolbar-btn" id="code-btn" title="Code">
                  <i class="fas fa-code"></i>
                </button>
              </div>
              
              <div class="toolbar-group">
                <button class="toolbar-btn" id="list-btn" title="List">
                  <i class="fas fa-list"></i>
                </button>
                <button class="toolbar-btn" id="quote-btn" title="Quote">
                  <i class="fas fa-quote-left"></i>
                </button>
              </div>
              
              <input type="file" id="image-upload" accept="image/*" style="display: none;">
            </div>

            <div class="editor-content">
              <div class="editor-tabs">
                <button class="tab-btn active" id="write-tab">Write</button>
                <button class="tab-btn" id="preview-tab">Preview</button>
              </div>
              
              <div class="editor-panes">
                <div class="editor-pane active" id="write-pane">
                  <textarea id="markdown-editor" placeholder="Write your blog content in Markdown...">${postData.content}</textarea>
                </div>
                
                <div class="editor-pane" id="preview-pane">
                  <div class="markdown-preview" id="markdown-preview">
                    <p class="preview-placeholder">Start writing to see preview...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-row" style="margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px;">
            
            <div class="form-group">
              <label for="edit-post-image">Image</label>
              <input type="file" id="edit-post-image" accept="image/*">
              ${
                postData.imageUrl
                  ? `<img src="${API_BASE_URL}${postData.imageUrl}" alt="${postData.title || "Current Image"}" class="post-image-preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px;">
                   <button type="button" class="btn btn-sm btn-danger remove-image-btn" style="margin-top: 5px;">Remove Image</button>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div id="schedule-modal" class="modal-overlay" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Schedule Post</h3>
              <button class="modal-close" id="close-schedule-modal">&times;</button>
            </div>
            <div class="modal-form">
              <div class="form-group">
                <label for="schedule-date">Date</label>
                <input type="date" id="schedule-date" min="${getMinDate()}">
              </div>
              <div class="form-group">
                <label for="schedule-time">Time</label>
                <input type="time" id="schedule-time">
              </div>
              <div class="modal-actions">
                <button class="btn btn-outline" id="cancel-schedule">Cancel</button>
                <button class="btn btn-primary" id="confirm-schedule">Schedule Post</button>
              </div>
            </div>
          </div>
        </div>

        <div id="edit-post-message" class="message" style="display: none;"></div>
      </div>
    `

    setupEditBlogEditor(postId, postData)
  }

  function setupEditBlogEditor(postId, postData) {
    const backBtn = document.getElementById("back-to-drafts")
    const markdownEditor = document.getElementById("markdown-editor")
    const markdownPreview = document.getElementById("markdown-preview")
    const writeTab = document.getElementById("write-tab")
    const previewTab = document.getElementById("preview-tab")
    const writePaneEl = document.getElementById("write-pane")
    const previewPaneEl = document.getElementById("preview-pane")
    const publishDropdown = document.getElementById("publish-dropdown")
    const publishMenu = document.getElementById("publish-menu")
    const scheduleModal = document.getElementById("schedule-modal")
    const messageElement = document.getElementById("edit-post-message")
    const editPostImageInput = document.getElementById("edit-post-image")
    const removeImageBtn = document.querySelector(".remove-image-btn")

    let imageRemoved = false

    backBtn.addEventListener("click", () => {
      navigateTo("/drafts")
    })

    writeTab.addEventListener("click", () => {
      writeTab.classList.add("active")
      previewTab.classList.remove("active")
      writePaneEl.classList.add("active")
      previewPaneEl.classList.remove("active")
    })

    previewTab.addEventListener("click", () => {
      previewTab.classList.add("active")
      writeTab.classList.remove("active")
      previewPaneEl.classList.add("active")
      writePaneEl.classList.remove("active")
      updatePreview()
    })

    markdownEditor.addEventListener("input", debounce(updatePreview, 300))

    function updatePreview() {
      const markdownText = markdownEditor.value
      if (!markdownText.trim()) {
        markdownPreview.innerHTML = '<p class="preview-placeholder">Start writing to see preview...</p>'
        return
      }

      markdownPreview.innerHTML = convertMarkdownToHtml(markdownText)
    }

    updatePreview()

    setupEditToolbar()

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

    publishDropdown.addEventListener("click", (e) => {
      e.stopPropagation()
      publishMenu.classList.toggle("show")
    })

    document.addEventListener("click", () => {
      publishMenu.classList.remove("show")
    })

    document.getElementById("publish-now").addEventListener("click", (e) => {
      e.preventDefault()
      updatePost("publish")
    })

    document.getElementById("save-draft-btn").addEventListener("click", () => {
      updatePost("draft")
    })

    document.getElementById("schedule-post").addEventListener("click", (e) => {
      e.preventDefault()
      scheduleModal.style.display = "flex"
    })

    document.getElementById("close-schedule-modal").addEventListener("click", () => {
      scheduleModal.style.display = "none"
    })

    document.getElementById("cancel-schedule").addEventListener("click", () => {
      scheduleModal.style.display = "none"
    })

    document.getElementById("confirm-schedule").addEventListener("click", () => {
      const date = document.getElementById("schedule-date").value
      const time = document.getElementById("schedule-time").value

      if (!date || !time) {
        showMessage("Please select both date and time", "error", messageElement)
        return
      }

      const scheduledDateTime = new Date(`${date}T${time}:00`)
      if (scheduledDateTime <= new Date()) {
        showMessage("Scheduled time must be in the future", "error", messageElement)
        return
      }

      scheduleModal.style.display = "none"
      updatePost("schedule", scheduledDateTime)
    })

    scheduleModal.addEventListener("click", (e) => {
      if (e.target === scheduleModal) {
        scheduleModal.style.display = "none"
      }
    })

    async function updatePost(status, scheduledDate = null) {
      showMessage("", "", messageElement)

      const selectedTags = Array.from(document.getElementById("blog-tags").selectedOptions).map(
        (option) => option.value,
      )

      const newStatus = status
      const wasDraft = postData.isDraft
      let publishedDate = null

      if (newStatus === "publish") {
        publishedDate = new Date().toISOString()
      } else if (newStatus === "schedule") {
        if (scheduledDate) {
          publishedDate = scheduledDate.toISOString()
        }
      } else if (!wasDraft && newStatus === "publish") {
        publishedDate = postData.publishedDate
      }

      const updatedPost = {
        id: postData.id,
        title: document.getElementById("blog-title").value,
        AuthorUsername: user.username,
        content: document.getElementById("markdown-editor").value,
        categories: [document.getElementById("blog-category").value],
        tags: selectedTags,
        isDraft: newStatus === "draft" || newStatus === "schedule",
        publishedDate: publishedDate,
        ImageUrl: postData.ImageUrl,
        Base64Image: postData.Base64Image || null,
        ExplicitlyRemoveImage: imageRemoved === true
        
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
        updatedPost.ExplicitlyRemoveImage = true;

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
          if (updatedPost.isDraft) {
            navigateTo("/drafts")
          } else {
            navigateTo("/feed")
          }
        }, 1500)
      } catch (error) {
        console.error("Update post error:", error)
        showMessage(error.message, "error", messageElement)
      }
    }

    function setupEditToolbar() {
      const editor = document.getElementById("markdown-editor")
      const imageUpload = document.getElementById("image-upload")
      const messageElement = document.getElementById("blog-message");

      document.getElementById("bold-btn").addEventListener("click", () => {
        insertMarkdown("**", "**", "bold text")
      })

      document.getElementById("italic-btn").addEventListener("click", () => {
        insertMarkdown("*", "*", "italic text")
      })

      document.getElementById("heading-btn").addEventListener("click", () => {
        insertMarkdown("## ", "", "Heading")
      })

      document.getElementById("link-btn").addEventListener("click", () => {
        const url = prompt("Enter URL:")
        if (url) {
          insertMarkdown("[", `](${url})`, "link text")
        }
      })

      document.getElementById("image-btn").addEventListener("click", () => {
        imageUpload.click()
      })

     imageUpload.addEventListener("change", async (e) => {
           const file = e.target.files[0];
           if (file) {
             try {
               const title = document.getElementById("blog-title")?.value.trim();
               const tempSlug = title ? title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "") : "temp";
         
               const formData = new FormData();
               formData.append("image", file);
         
               const response = await fetch(`${API_BASE_URL}/api/post/${tempSlug}/upload-image`, {
                 method: "POST",
                 body: formData,
               });
         
               const data = await response.json();
               if (!response.ok) throw new Error(data.message || "Image upload failed");
         
               const altText = prompt("Enter alt text for the image:") || "Image";
               const imageUrl = data.imageUrl;
         
               insertMarkdown("![", `](${imageUrl})`, altText);
             } catch (error) {
               const messageElement = document.getElementById("blog-message");
               showMessage("Error uploading image: " + error.message, "error", messageElement);
             }
           }
         });
         
      

      document.getElementById("code-btn").addEventListener("click", () => {
        insertMarkdown("`", "`", "code")
      })

      document.getElementById("list-btn").addEventListener("click", () => {
        insertMarkdown("- ", "", "List item")
      })

      document.getElementById("quote-btn").addEventListener("click", () => {
        insertMarkdown("> ", "", "Quote")
      })

      function insertMarkdown(before, after, placeholder) {
        const start = editor.selectionStart
        const end = editor.selectionEnd
        const selectedText = editor.value.substring(start, end)
        const replacement = before + (selectedText || placeholder) + after

        editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end)

        const newCursorPos = selectedText ? start + replacement.length : start + before.length + placeholder.length
        editor.setSelectionRange(newCursorPos, newCursorPos)
        editor.focus()

        const event = new Event("input")
        editor.dispatchEvent(event)
      }
    }
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

  function renderProfilePage() {
    if (!isAuthenticated()) {
      showMessage("You must be logged in to view your profile.", "error", appContainer)
      navigateTo("/login")
      return
    }

    currentPage = "profile"
    updateURL()

    document.title = "Profile - FileBlogSystem"

    appContainer.innerHTML = `
      <div class="profile-page">
        <div class="profile-container">
          <div class="profile-sidebar">
            <div class="profile-header">
              <div class="profile-avatar">
                <img src="${
                  user.profilePictureUrl
                    ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(user.profilePictureUrl.replace(/^\/content\//, ""))}&width=120&height=120`
                    : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=120&height=120`
                }" 
                class="profile-avatar-large" alt="Profile Avatar" />
                
              </div>
              <div class="profile-info">
                <h2>@${user.username}</h2>
                <p>${user.email || "No email provided"}</p>
                <div class="user-roles">
                  ${user.roles.map((role) => `<span class="role-badge ${role.toLowerCase()}">${role}</span>`).join("")}
                </div>
              </div>
            </div>
            
            <nav class="profile-nav">
              <button class="profile-nav-btn active" data-section="edit-profile">
                <i class="fas fa-user-edit"></i>
                Edit Profile
              </button>
              <button class="profile-nav-btn" data-section="change-password">
                <i class="fas fa-key"></i>
                Change Password
              </button>
              <button class="profile-nav-btn logout-btn" id="profile-logout">
                <i class="fas fa-sign-out-alt"></i>
                Logout
              </button>
            </nav>
          </div>
          
          <div class="profile-content">
            <div id="profile-section-content">
              <div class="loading-posts">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    document.querySelectorAll(".profile-nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (btn.id === "profile-logout") {
          clearAuthData()
          navigateTo("/welcome")
          return
        }

        const section = btn.dataset.section
        document.querySelectorAll(".profile-nav-btn").forEach((b) => b.classList.remove("active"))
        btn.classList.add("active")
        loadProfileSection(section)
      })
    })

    loadProfileSection("edit-profile")
  }

  function loadProfileSection(section) {
    const contentContainer = document.getElementById("profile-section-content")

    switch (section) {
      case "edit-profile":
        renderEditProfileSection(contentContainer)
        break
      case "change-password":
        renderChangePasswordSection(contentContainer)
        break
      default:
        renderEditProfileSection(contentContainer)
    }
  }

  function renderEditProfileSection(container) {
    container.innerHTML = `
      <div class="profile-section">
        <div class="section-header">
          <h3><i class="fas fa-user-edit"></i> Edit Profile</h3>
          <p>Update your profile information</p>
        </div>
        
        <form id="edit-profile-form" class="profile-form">
          <div class="form-group">
            <label for="edit-username">Username</label>
            <input type="text" id="edit-username" value="${user.username} " required readonly>
            <small class="form-text text-muted">Username cannot be changed.</small>
          </div>
          
          <div class="form-group">
            <label for="edit-email">Email</label>
            <input type="email" id="edit-email" value="${user.email || ""}" required>
          </div>
          
          <div class="form-group">
            <label for="edit-profile-picture">Profile Picture</label>
            <input type="file" id="edit-profile-picture" accept="image/*" value="${user.profilePictureUrl ? user.profilePictureUrl : ''}">
            <div class="current-picture" style="margin-top: 10px;">
              <img src="${
                user.profilePictureUrl
                  ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(user.profilePictureUrl.replace(/^\/content\//, ""))}&width=150&height=150`
                  : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=150&height=150`
              }" 
              alt="Current Profile Picture" 
              class="profile-preview-img" />
              
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-save"></i>
              Update Profile
            </button>
            <button type="button" class="btn btn-danger delete-account-btn" data-username="${user.username}">
              <i class="fas fa-trash"></i>
              Delete Account
            </button>
          </div>
          
          <div id="edit-profile-message" class="message" style="display: none;"></div>
        </form>
      </div>
    `

    const form = document.getElementById("edit-profile-form")
    const deleteAccountBtn = document.querySelector(".delete-account-btn")
    const messageElement = document.getElementById("edit-profile-message")

    deleteAccountBtn.addEventListener("click", async (e) => {
      e.preventDefault()
      const username = deleteAccountBtn.dataset.username

      if (confirm(`Are you sure you want to delete your account ${username}? This action cannot be undone.`)) {
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
            clearAuthData()
            navigateTo("/welcome")
          }, 1500)
        } catch (error) {
          showMessage(error.message, "error", messageElement)
        }
      }
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const useremail = document.getElementById("edit-email").value
      const profilePictureFile = document.getElementById("edit-profile-picture").files[0]

      try {
        const updateData = {
          email: useremail,
          roles: user.roles,
        }

        if (profilePictureFile !== null) {
          updateData.profilePictureBase64 = await readFileAsBase64(profilePictureFile)
          updateData.profilePictureFileName = profilePictureFile.name
        } else if (user.profilePictureUrl) {
          updateData.profilePictureUrl = user.profilePictureUrl
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

        const sidebarAvatar = document.querySelector(".profile-avatar-large")
        const previewImg = document.querySelector(".profile-preview-img")
        if (sidebarAvatar && updatedUser.profilePictureUrl) {
          sidebarAvatar.src = updatedUser.profilePictureUrl
        }
        if (previewImg && updatedUser.profilePictureUrl) {
          previewImg.src = updatedUser.profilePictureUrl
        }
      } catch (error) {
        showMessage(error.message, "error", messageElement)
      }
    })
  }

  function renderChangePasswordSection(container) {
    container.innerHTML = `
      <div class="profile-section">
        <div class="section-header">
          <h3><i class="fas fa-key"></i> Change Password</h3>
          <p>Update your account password</p>
        </div>
        
        <form id="change-password-form" class="profile-form">
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
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-key"></i>
              Change Password
            </button>
          </div>
          
          <div id="change-password-message" class="message" style="display: none;"></div>
        </form>
      </div>
    `

    const form = document.getElementById("change-password-form")
    const messageElement = document.getElementById("change-password-message")

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
        form.reset()
      } catch (error) {
        showMessage(error.message, "error", messageElement)
      }
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
                   <button class="profile-btn" id="profile-btn">
                     <img src="${
                        user.profilePictureUrl
                          ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(user.profilePictureUrl.replace(/^\/content\//, ""))}&width=64&height=64`
                          : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=64&height=64`
                      }" class="avatar-img" alt="Avatar" />
                      
                     <span style="color: #1a1a1a;">${user.username}</span>
                   </button>
               </div>
            `

      document.getElementById("profile-btn").addEventListener("click", () => {
        navigateTo("/profile")
      })

      document.querySelectorAll(".nav-btn[data-page]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const page = btn.dataset.page
          if (page === "admin") {
            navigateTo(`/admin?section=${currentAdminSection}`)
          } else {
            navigateTo(`/${page}`)
          }
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
        navigateTo("/login")
      })
      document.getElementById("nav-signup").addEventListener("click", () => {
        navigateTo("/signup")
      })
    }
  }

  async function renderAdminPage() {
    if (!isAuthenticated() || !user.roles.includes("Admin")) {
      showMessage("You must be an admin to access this page.", "error", appContainer)
      navigateTo("/welcome")
      return
    }

    currentPage = "admin"
    updateURL()

    document.title = "Admin Panel - FileBlogSystem"

    appContainer.innerHTML = `
    <div class="admin-page">
      <div class="page-header">
        <h2><i class="fas fa-shield-alt"></i> Admin Panel</h2>
        <p>Manage your blog platform</p>
      </div>
      
      <div class="admin-navigation">
        <div class="admin-nav-buttons">
          <button class="admin-nav-btn ${currentAdminSection === "posts" ? "active" : ""}" data-section="posts">
              <i class="fas fa-file-alt"></i> Blogs Management
            </button>
          <button class="admin-nav-btn ${currentAdminSection === "users" ? "active" : ""}" data-section="users">
            <i class="fas fa-users"></i> User Management
          </button>
          <button class="admin-nav-btn ${currentAdminSection === "categories" ? "active" : ""}" data-section="categories">
            <i class="fas fa-folder"></i> Categories Management
          </button>
          <button class="admin-nav-btn ${currentAdminSection === "tags" ? "active" : ""}" data-section="tags">
            <i class="fas fa-tags"></i> Tags Management
          </button>
        </div>
      </div>
      
      <div id="admin-content" class="admin-content">
        <div class="loading-posts">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Loading...</p>
        </div>
      </div>
    </div>
  `

    document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentAdminSection = btn.dataset.section
        document.querySelectorAll(".admin-nav-btn").forEach((b) => b.classList.remove("active"))
        btn.classList.add("active")
        navigateTo(`/admin?section=${currentAdminSection}`, true)
        loadAdminSection(currentAdminSection)
      })
    })

    loadAdminSection(currentAdminSection)
  }

  async function loadAdminSection(section) {
    const adminContent = document.getElementById("admin-content")

    adminContent.innerHTML = `
      <div class="loading-posts">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading ${section}...</p>
      </div>
    `

    switch (section) {
      case "users":
        await loadUsersAdmin()
        break
      case "categories":
        await loadCategoriesAdmin()
        break
      case "tags":
        await loadTagsAdmin()
        break
      case "posts":
        await loadPostsAdmin()
        break
      default:
        await loadUsersAdmin()
    }
  }

  async function loadUsersAdmin() {
    const adminContent = document.getElementById("admin-content")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/users`)
      if (!response.ok) throw new Error("Failed to fetch users")

      const allUsers = await response.json()
      const users = allUsers.filter((user) => user.isActive === true)

      adminContent.innerHTML = `
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-users"></i> User Management</h3>
            <div class="section-stats">
              <span>${users.length} users</span>
            </div>
          </div>
          <div id="users-container" class="admin-container">
          </div>
        </div>
      `

      const usersContainer = document.getElementById("users-container")

      users.forEach((user) => {
        const userCard = document.createElement("div")
        userCard.className = "admin-item-card user-management-card"
        userCard.innerHTML = `
        <div class="user-card-header">
          <div class="user-avatar-section">
            <img src="${
                user.profilePictureUrl
                  ? `${API_BASE_URL}/api/image?path=${encodeURIComponent(user.profilePictureUrl.replace(/^\/content\//, ""))}&width=48&height=48`
                  : `${API_BASE_URL}/api/image?path=static/avatar.jpg&width=48&height=48`
              }" 
              class="user-admin-avatar" alt="User Avatar" />
              
            <div class="user-basic-info">
              <h4 class="user-admin-name">@${user.username}</h4>
              <p class="user-admin-email">${user.email}</p>
            </div>
          </div>
          <div class="user-status-indicator ${user.roles.includes("Admin") ? "admin-status" : "author-status"}">
            <i class="fas ${user.roles.includes("Admin") ? "fa-shield-alt" : "fa-user"}"></i>
          </div>
        </div>
        
        <div class="user-roles-section">
          <div class="roles-display">
            <span class="roles-label">Roles:</span>
            <div class="user-roles-list">
              ${user.roles.map((role) => `<span class="role-badge ${role.toLowerCase()}">${role}</span>`).join("")}
            </div>
          </div>
        </div>
        
        <div class="user-actions-section">
          <div class="role-management">
            ${
              !user.roles.includes("Admin")
                ? `
              <button class="btn btn-success btn-sm make-admin-btn" data-username="${user.username}">
                <i class="fas fa-user-shield"></i> Promote to Admin
              </button>
            `
                : user.username !== window.user?.username
                  ? `
              <button class="btn btn-warning btn-sm remove-admin-btn" data-username="${user.username}">
                <i class="fas fa-user-minus"></i> Remove Admin
              </button>
            `
                  : `<span class="current-user-badge"><i class="fas fa-star"></i> Current User</span>`
            }
          </div>
          <div class="user-management">
            ${
              user.username !== window.user?.username
                ? `
              <button class="btn btn-danger btn-sm delete-user-btn" data-username="${user.username}">
                <i class="fas fa-trash-alt"></i> Delete User
              </button>
            `
                : ""
            }
          </div>
        </div>
      `
        usersContainer.appendChild(userCard)
      })

      usersContainer.querySelectorAll(".make-admin-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username
          if (confirm(`Promote ${username} to admin? They will have full administrative privileges.`)) {
            await toggleUserAdmin(username, true)
            loadUsersAdmin()
          }
        })
      })

      usersContainer.querySelectorAll(".remove-admin-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username
          if (confirm(`Remove admin privileges from ${username}? They will become a regular author.`)) {
            await toggleUserAdmin(username, false)
            loadUsersAdmin()
          }
        })
      })

      usersContainer.querySelectorAll(".delete-user-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const username = e.target.dataset.username
          if (
            confirm(
              `Delete user ${username}? This will permanently remove their account and all associated data. This action cannot be undone.`,
            )
          ) {
            await deleteUser(username)
            loadUsersAdmin()
          }
        })
      })
    } catch (error) {
      adminContent.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading users: ${error.message}</p>
      </div>
    `
    }
  }

  async function loadCategoriesAdmin() {
    const adminContent = document.getElementById("admin-content")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/categories`)
      if (!response.ok) throw new Error("Failed to fetch categories")

      const categories = await response.json()

      adminContent.innerHTML = `
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-folder"></i> Categories Management</h3>
            <button class="btn btn-primary" id="add-category-btn">
              <i class="fas fa-plus"></i> Add Category
            </button>
          </div>
          <div id="categories-container" class="admin-container">
          </div>
        </div>
      `

      const categoriesContainer = document.getElementById("categories-container")

      if (categories.length === 0) {
        categoriesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>No categories yet</h3>
          <p>Create your first category</p>
        </div>
      `
      } else {
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
      }

      document.getElementById("add-category-btn").addEventListener("click", () => {
        showCategoryModal()
      })
    } catch (error) {
      adminContent.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading categories: ${error.message}</p>
      </div>
    `
    }
  }

  async function loadTagsAdmin() {
    const adminContent = document.getElementById("admin-content")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch tags")

      const tags = await response.json()

      adminContent.innerHTML = `
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-tags"></i> Tags Management</h3>
            <button class="btn btn-primary" id="add-tag-btn">
              <i class="fas fa-plus"></i> Add Tag
            </button>
          </div>
          <div id="tags-container" class="admin-container">
          </div>
        </div>
      `

      const tagsContainer = document.getElementById("tags-container")

      if (tags.length === 0) {
        tagsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-tags"></i>
          <h3>No tags yet</h3>
          <p>Create your first tag</p>
        </div>
      `
      } else {
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
      }

      document.getElementById("add-tag-btn").addEventListener("click", () => {
        showTagModal()
      })
    } catch (error) {
      adminContent.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading tags: ${error.message}</p>
      </div>
    `
    }
  }

  async function loadPostsAdmin() {
    const adminContent = document.getElementById("admin-content")

    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/posts`)
      if (!response.ok) throw new Error("Failed to fetch posts")

      const posts = await response.json()

      adminContent.innerHTML = `
        <div class="admin-section">
          <div class="section-header">
            <h3><i class="fas fa-file-alt"></i> Blogs Management</h3>
            <div class="section-stats">
              <span>${posts.length} blogs</span>
            </div>
          </div>
          <div id="posts-container" class="admin-container">
          </div>
        </div>
      `

      const postsContainer = document.getElementById("posts-container")

      if (posts.length === 0) {
        postsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-alt"></i>
          <h3>No posts yet</h3>
          <p>Posts will appear here when users create them</p>
        </div>
      `
      } else {
        const enrichedPosts = await fetchPostsWithProfilePictures(posts)

        enrichedPosts.forEach((post) => {
          const postCard = createPostCard(post)

          const cardContent = postCard.querySelector(".post-card-content")
          const actionsHtml = `
            <div class="post-card-actions" style="margin-top: 1rem; padding-top: 1rem; display: flex; gap: 0.5rem; border-top: 1px solid #f0f0f0;">
              <button class="btn btn-outline btn-sm view-post-btn" data-post-slug="${post.slug}">
                <i class="fas fa-eye"></i> View
              </button>
              <button class="btn btn-danger btn-sm delete-post-admin-btn" data-post-slug="${post.slug}" data-title="${post.title}">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          `
          cardContent.insertAdjacentHTML("beforeend", actionsHtml)

          postsContainer.appendChild(postCard)
        })

        postsContainer.querySelectorAll(".view-post-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const postSlug = e.target.dataset.postSlug
            navigateTo(`/post/${postSlug}`)
          })
        })

        postsContainer.querySelectorAll(".delete-post-admin-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const postSlug = e.target.dataset.postSlug
            const title = e.target.dataset.title
            if (confirm(`Delete post "${title}"? This action cannot be undone.`)) {
              await deletePost(postSlug)
              loadPostsAdmin()
            }
          })
        })
      }
    } catch (error) {
      adminContent.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading posts: ${error.message}</p>
      </div>
    `
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
            <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Create"} Category</button>
          </div>
          <div id="category-message" class="message" style="display: none;"></div>
        </form>
      </div>
    </div>
  `

    document.body.insertAdjacentHTML("beforeend", modalHtml)

    const modal = document.getElementById("category-modal")
    const form = document.getElementById("category-form")
    const closeBtn = document.getElementById("close-category-modal")
    const cancelBtn = document.getElementById("cancel-category")
    const messageElement = document.getElementById("category-message")

    const closeModal = () => modal.remove()

    closeBtn.addEventListener("click", closeModal)
    cancelBtn.addEventListener("click", closeModal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal()
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const name = document.getElementById("category-name").value.trim()
      const description = document.getElementById("category-description").value.trim()

      if (!name) {
        showMessage("Category name is required", "error", messageElement)
        return
      }

      try {
        const categoryData = { name, description }
        let response

        if (isEdit) {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/update-category/${category.id}`, {
            method: "PUT",
            body: JSON.stringify(categoryData),
          })
        } else {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/category`, {
            method: "POST",
            body: JSON.stringify(categoryData),
          })
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `Failed to ${isEdit ? "update" : "create"} category`)
        }

        showMessage(`Category ${isEdit ? "updated" : "created"} successfully!`, "success", messageElement)
        setTimeout(() => {
          closeModal()
          loadCategoriesAdmin()
          fetchCategoriesAndTags()
        }, 1500)
      } catch (error) {
        showMessage(error.message, "error", messageElement)
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
            <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Create"} Tag</button>
          </div>
          <div id="tag-message" class="message" style="display: none;"></div>
        </form>
      </div>
    </div>
  `

    document.body.insertAdjacentHTML("beforeend", modalHtml)

    const modal = document.getElementById("tag-modal")
    const form = document.getElementById("tag-form")
    const closeBtn = document.getElementById("close-tag-modal")
    const cancelBtn = document.getElementById("cancel-tag")
    const messageElement = document.getElementById("tag-message")

    const closeModal = () => modal.remove()

    closeBtn.addEventListener("click", closeModal)
    cancelBtn.addEventListener("click", closeModal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal()
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const name = document.getElementById("tag-name").value.trim()

      if (!name) {
        showMessage("Tag name is required", "error", messageElement)
        return
      }

      try {
        const tagData = { name }
        let response

        if (isEdit) {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/update-tag/${tag.id}`, {
            method: "PUT",
            body: JSON.stringify(tagData),
          })
        } else {
          response = await fetchAuthenticated(`${API_BASE_URL}/api/tag`, {
            method: "POST",
            body: JSON.stringify(tagData),
          })
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `Failed to ${isEdit ? "update" : "create"} tag`)
        }

        showMessage(`Tag ${isEdit ? "updated" : "created"} successfully!`, "success", messageElement)
        setTimeout(() => {
          closeModal()
          loadTagsAdmin()
          fetchCategoriesAndTags()
        }, 1500)
      } catch (error) {
        showMessage(error.message, "error", messageElement)
      }
    })
  }

  async function toggleUserAdmin(username, makeAdmin) {
    try {
      const userResponse = await fetchAuthenticated(`${API_BASE_URL}/api/user/${username}`)
      if (!userResponse.ok) throw new Error("Failed to fetch user data")

      const userData = await userResponse.json()
      const newRoles = makeAdmin ? ["Author", "Admin"] : ["Author"]

      const response = await fetchAuthenticated(`${API_BASE_URL}/api/update-user/${username}`, {
        method: "PUT",
        body: JSON.stringify({
          email: userData.email,
          roles: newRoles,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update user roles")
      }

      showMessage(
        `User ${username} ${makeAdmin ? "promoted to admin" : "admin privileges removed"} successfully!`,
        "success",
        appContainer,
      )
    } catch (error) {
      showMessage(error.message, "error", appContainer)
    }
  }

  async function deleteUser(username) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-user/${username}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete user")
      }

      showMessage(`User ${username} deleted successfully!`, "success", appContainer)
    } catch (error) {
      showMessage(error.message, "error", appContainer)
    }
  }

  async function deleteCategory(id) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-category/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete category")
      }

      showMessage("Category deleted successfully!", "success", appContainer)
      await fetchCategoriesAndTags()
    } catch (error) {
      showMessage(error.message, "error", appContainer)
    }
  }

  async function deleteTag(id) {
    try {
      const response = await fetchAuthenticated(`${API_BASE_URL}/api/delete-tag/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete tag")
      }

      showMessage("Tag deleted successfully!", "success", appContainer)
      await fetchCategoriesAndTags()
    } catch (error) {
      showMessage(error.message, "error", appContainer)
    }
  }

  async function renderAppContent() {
    updateNav()

    if (!isAuthenticated() && currentPage !== "login" && currentPage !== "signup") {
      await renderWelcomePage()
      return
    }

    switch (currentPage) {
      case "welcome":
        await renderWelcomePage()
        break
      case "login":
        renderAuthForm("login")
        break
      case "signup":
        renderAuthForm("signup")
        break
      case "feed":
        await renderDashboard()
        break
      case "create-blog":
        renderCreateBlogPage()
        break
      case "blog-post":
        if (currentPostSlug) {
          await renderBlogPostPage(currentPostSlug)
        } else {
          navigateTo("/welcome")
        }
        break
      case "drafts":
        renderDraftsPage()
        break
      case "profile":
        renderProfilePage()
        break
      case "admin":
        await renderAdminPage()
        break
      default:
        await renderWelcomePage()
    }
  }

  loadAuthData()
  await fetchCategoriesAndTags()
  initializeRouting()

  window.navigateTo = navigateTo
})

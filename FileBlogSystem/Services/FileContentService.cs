using FileBlogSystem.Models; 
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.IO;
using System.Linq; 

namespace FileBlogSystem.Services
{
    public class FileContentService : IContentService
    {
        private readonly string _contentRootPath;
        private readonly ILogger<FileContentService> _logger;
        private readonly string _postsFolderPath;
        private readonly string _categoriesFolderPath;
        private readonly string _tagsFolderPath;
        private readonly string _usersFolderPath;

        public FileContentService(IWebHostEnvironment env, ILogger<FileContentService> logger)
        {
            // env.ContentRootPath points to where .csproj is
            _contentRootPath = Path.Combine(env.ContentRootPath, "content");
            _logger = logger;
            _postsFolderPath = Path.Combine(_contentRootPath, "posts");
            _categoriesFolderPath = Path.Combine(_contentRootPath, "categories");
            _tagsFolderPath = Path.Combine(_contentRootPath, "tags");
            _usersFolderPath = Path.Combine(_contentRootPath, "users");
            Directory.CreateDirectory(_postsFolderPath);
            Directory.CreateDirectory(_categoriesFolderPath);
            Directory.CreateDirectory(_tagsFolderPath);
            Directory.CreateDirectory(_usersFolderPath);
        }

        private async Task<T?> ReadJsonFileAsync<T>(string filePath) where T : class
        {
            if (!File.Exists(filePath))
            {
                _logger.LogWarning($"File not found: {filePath}");
                return null;
            }

            try
            {
                var jsonContent = await File.ReadAllTextAsync(filePath);
                return JsonSerializer.Deserialize<T>(jsonContent, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error reading or deserializing JSON file: {filePath}");
                return null;
            }
        }

        // --- Blog Post Methods ---
        public async Task<List<BlogPostMeta>> GetAllBlogPostsMetaAsync()
        {
            var postsMeta = new List<BlogPostMeta>();
            var postsDirectory = Path.Combine(_contentRootPath, "posts");

            if (!Directory.Exists(postsDirectory))
            {
                _logger.LogWarning($"Posts directory not found: {postsDirectory}");
                return postsMeta;
            }

            foreach (var postFolder in Directory.EnumerateDirectories(postsDirectory))
            {
                var metaFilePath = Path.Combine(postFolder, "meta.json");
                var meta = await ReadJsonFileAsync<BlogPostMeta>(metaFilePath);

                if (meta != null)
                {
                    // Extract slug from folder name (YYYY-MM-DD-post-slug)
                    var folderName = Path.GetFileName(postFolder);
                    meta.Slug = folderName.Length > 11 && folderName[4] == '-' && folderName[7] == '-' && folderName[10] == '-'
                                ? folderName.Substring(11) // remove YYYY-MM-DD-
                                : folderName; // fallback if format is unexpected

                    meta.PostFolderPath = postFolder; //store the full path for content reading later
                    postsMeta.Add(meta);
                }
            }

            return postsMeta.OrderByDescending(p => p.PublishedDate).ToList(); // Order by date
        }

        public async Task<BlogPostMeta?> GetBlogPostMetaBySlugAsync(string slug)
        {
            var allPosts = await GetAllBlogPostsMetaAsync();
            return allPosts.FirstOrDefault(p => p.Slug?.Equals(slug, StringComparison.OrdinalIgnoreCase) == true);
        }

        public async Task<string?> GetBlogPostContentAsync(string postFolderPath)
        {
            var contentFilePath = Path.Combine(postFolderPath, "content.md");
            if (!File.Exists(contentFilePath))
            {
                _logger.LogWarning($"Content file not found: {contentFilePath}");
                return null;
            }
            try
            {
                return await File.ReadAllTextAsync(contentFilePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error reading content file: {contentFilePath}");
                return null;
            }
        }

        // --- Category Methods ---
        public async Task<List<Category>> GetAllCategoriesAsync()
        {
            var categories = new List<Category>();
            try
            {
                if (!Directory.Exists(_categoriesFolderPath))
                {
                    Directory.CreateDirectory(_categoriesFolderPath);
                    return categories;
                }

                var categoryFiles = Directory.EnumerateFiles(_categoriesFolderPath, "*.json", SearchOption.TopDirectoryOnly);

                foreach (var filePath in categoryFiles)
                {
                    var category = await ReadJsonFileAsync<Category>(filePath);
                    if (category != null)
                    {
                        categories.Add(category);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error reading categories from {_categoriesFolderPath}.");
            }
            return categories.OrderBy(c => c.Name).ToList();
        }

        // --- Tag Methods ---
        public async Task<List<Tag>> GetAllTagsAsync()
        {
            var tags = new List<Tag>();
            try
            {
                if (!Directory.Exists(_tagsFolderPath))
                {
                    Directory.CreateDirectory(_tagsFolderPath);
                    return tags;
                }

                var tagFiles = Directory.EnumerateFiles(_tagsFolderPath, "*.json", SearchOption.TopDirectoryOnly);

                foreach (var filePath in tagFiles)
                {
                    var tag = await ReadJsonFileAsync<Tag>(filePath);
                    if (tag != null)
                    {
                        tags.Add(tag);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error reading tags from {_tagsFolderPath}.");
            }
            return tags.OrderBy(t => t.Name).ToList();
        }

        // --- GET User Method ---
        public async Task<User?> GetUserByUsernameAsync(string username)
        {
            try
            {
                var userDir = Path.Combine(_usersFolderPath, username.Trim().ToLowerInvariant());
                var profileFilePath = Path.Combine(userDir, "profile.json");

                if (File.Exists(profileFilePath))
                {
                    var user = await ReadJsonFileAsync<User>(profileFilePath);
                    return user;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user '{username}'.");
            }
            return null;
        }

        // --- Write Method for Blog Posts ---
        public async Task<BlogPostMeta?> CreateBlogPostAsync(CreateBlogPostRequest request)
        {
            try
            {
                var baseSlug = !string.IsNullOrEmpty(request.CustomUrl)
                               ? GenerateSlug(request.CustomUrl)
                               : GenerateSlug(request.Title);

                var datePrefix = DateTime.UtcNow.ToString("yyyy-MM-dd");
                var postFolderName = $"{datePrefix}-{baseSlug}";
                var postFolderPath = Path.Combine(_contentRootPath, "posts", postFolderName);

                if (Directory.Exists(postFolderPath))
                {
                    // Handle potential rare conflict, e.g., by appending a timestamp or GUID
                    postFolderName = $"{datePrefix}-{baseSlug}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                    postFolderPath = Path.Combine(_contentRootPath, "posts", postFolderName);
                }


                // create the post directory
                Directory.CreateDirectory(postFolderPath);

                // prepare BlogPostMeta for saving
                var now = DateTime.UtcNow;
                var newPostMeta = new BlogPostMeta
                {
                    Title = request.Title,
                    Description = request.Description,
                    PublishedDate = now,
                    ModificationDate = now,
                    Tags = request.Tags ?? new List<string>(), // handle potential null
                    Categories = request.Categories ?? new List<string>(),
                    CustomUrl = request.CustomUrl,
                    Slug = baseSlug, // store the generated slug here
                    PostFolderPath = postFolderPath // store the path for internal use
                };

                // save meta.json
                var metaFilePath = Path.Combine(postFolderPath, "meta.json");
                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var metaJson = JsonSerializer.Serialize(newPostMeta, jsonOptions);
                await File.WriteAllTextAsync(metaFilePath, metaJson);

                // save content.md
                var contentFilePath = Path.Combine(postFolderPath, "content.md");
                await File.WriteAllTextAsync(contentFilePath, request.Content);

                _logger.LogInformation($"Successfully created new blog post: {newPostMeta.Title} at {postFolderPath}");

                return newPostMeta;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating blog post.");
                return null;
            }
        }

        // --- Helper method for slug generation ---
        private string GenerateSlug(string title)
        {
            var slug = title.ToLowerInvariant();
            slug = Regex.Replace(slug, @"[^a-z0-9\s-]", ""); // Remove invalid chars
            slug = Regex.Replace(slug, @"\s+", "-").Trim(); // Convert spaces to hyphens
            slug = Regex.Replace(slug, @"-+", "-");        // Collapse multiple hyphens
            return slug;
        }

        // --- New Write Method for Update ---
        public async Task<BlogPostMeta?> UpdateBlogPostAsync(string originalSlug, UpdateBlogPostRequest request)
        {
            var existingPostMeta = await GetBlogPostMetaBySlugAsync(originalSlug);
            if (existingPostMeta == null || string.IsNullOrEmpty(existingPostMeta.PostFolderPath))
            {
                _logger.LogWarning($"Attempted to update non-existent or pathless post with slug: {originalSlug}");
                return null; // Post not found
            }

            var newBaseSlug = !string.IsNullOrEmpty(request.CustomUrl)
                              ? GenerateSlug(request.CustomUrl)
                              : GenerateSlug(request.Title);

            var originalFolderName = Path.GetFileName(existingPostMeta.PostFolderPath);
            string datePrefix = "";

            if (originalFolderName.Length >= 10 && originalFolderName[4] == '-' && originalFolderName[7] == '-' && originalFolderName[10] == '-')
            {
                datePrefix = originalFolderName.Substring(0, 10);
            }
            else
            {
                datePrefix = DateTime.UtcNow.ToString("yyyy-MM-dd");
            }


            var newPostFolderName = $"{datePrefix}-{newBaseSlug}";
            var newPostFolderPath = Path.Combine(_contentRootPath, "posts", newPostFolderName);

            if (existingPostMeta.PostFolderPath != newPostFolderPath)
            {
                try
                {
                    if (Directory.Exists(newPostFolderPath))
                    {
                        _logger.LogError($"Target folder '{newPostFolderPath}' already exists for renaming. Cannot rename post '{originalSlug}'.");
                        return null;
                    }
                    Directory.Move(existingPostMeta.PostFolderPath, newPostFolderPath);
                    _logger.LogInformation($"Renamed post folder from '{existingPostMeta.PostFolderPath}' to '{newPostFolderPath}' for slug '{originalSlug}'.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error renaming post folder from '{existingPostMeta.PostFolderPath}' to '{newPostFolderPath}' for slug '{originalSlug}'.");
                    return null;
                }
            }

            existingPostMeta.Title = request.Title;
            existingPostMeta.Description = request.Description;
            existingPostMeta.ModificationDate = DateTime.UtcNow;
            existingPostMeta.Tags = request.Tags ?? new List<string>();
            existingPostMeta.Categories = request.Categories ?? new List<string>();
            existingPostMeta.CustomUrl = request.CustomUrl;
            existingPostMeta.Slug = newBaseSlug;
            existingPostMeta.PostFolderPath = newPostFolderPath;

            try
            {
                var metaFilePath = Path.Combine(newPostFolderPath, "meta.json");
                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var updatedMetaJson = JsonSerializer.Serialize(existingPostMeta, jsonOptions);
                await File.WriteAllTextAsync(metaFilePath, updatedMetaJson);

                var contentFilePath = Path.Combine(newPostFolderPath, "content.md");
                await File.WriteAllTextAsync(contentFilePath, request.Content); // Save the updated content

                _logger.LogInformation($"Successfully updated blog post: {existingPostMeta.Title} (New Slug: {existingPostMeta.Slug})");
                return existingPostMeta;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error saving updated blog post with slug: {originalSlug}.");
                return null;
            }
        }

        // --- Write Method for Delete Post ---
        public async Task<bool> DeleteBlogPostAsync(string slug)
        {
            var postMeta = await GetBlogPostMetaBySlugAsync(slug);
            if (postMeta == null || string.IsNullOrEmpty(postMeta.PostFolderPath))
            {
                _logger.LogWarning($"Attempted to delete non-existent or pathless post with slug: {slug}");
                return false;
            }

            try
            {
                Directory.Delete(postMeta.PostFolderPath, recursive: true);
                _logger.LogInformation($"Successfully deleted blog post folder: {postMeta.PostFolderPath}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting blog post with slug: {slug} at path: {postMeta.PostFolderPath}");
                return false;
            }
        }

        // --- CRUD Methods for Categories ---

        public async Task<Category?> CreateCategoryAsync(CreateCategoryRequest request)
        {
            try
            {
                var categoryName = request.Name.Trim();
                var categorySlug = GenerateSlug(categoryName);

                var categoryFilePath = Path.Combine(_categoriesFolderPath, $"{categorySlug}.json");
                if (File.Exists(categoryFilePath))
                {
                    _logger.LogWarning($"Category '{categoryName}' (slug: {categorySlug}) already exists. Not creating.");
                    return null;
                }

                var newCategory = new Category
                {
                    Name = categoryName,
                    Slug = categorySlug,
                    Description = request.Description
                };

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(newCategory, jsonOptions);
                await File.WriteAllTextAsync(categoryFilePath, json);

                _logger.LogInformation($"Successfully created category: {categoryName} (Slug: {categorySlug}) at {categoryFilePath}");
                return newCategory;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating category '{request.Name}'.");
                return null;
            }
        }

        public async Task<Category?> UpdateCategoryAsync(string oldName, UpdateCategoryRequest request)
        {
            try
            {
                _logger.LogInformation($"Attempting to update category '{oldName}' to '{request.NewName}'.");

                var categories = await GetAllCategoriesAsync();
                var oldCategory = categories.FirstOrDefault(c => c.Name.Equals(oldName.Trim(), StringComparison.OrdinalIgnoreCase));

                if (oldCategory == null)
                {
                    _logger.LogWarning($"Category '{oldName}' not found for update (internal check).");
                    return null;
                }

                var originalSlugForFileMove = oldCategory.Slug;
                var oldCategoryFilePath = Path.Combine(_categoriesFolderPath, $"{originalSlugForFileMove}.json");
                _logger.LogInformation($"Original category file path: {oldCategoryFilePath}");

                var newName = request.NewName.Trim();
                var newSlug = GenerateSlug(newName);
                _logger.LogInformation($"Generated new slug: {newSlug}");


                if (!originalSlugForFileMove.Equals(newSlug, StringComparison.OrdinalIgnoreCase) &&
                    categories.Any(c => c.Slug.Equals(newSlug, StringComparison.OrdinalIgnoreCase) && !c.Slug.Equals(originalSlugForFileMove, StringComparison.OrdinalIgnoreCase)))
                {
                    _logger.LogWarning($"New category name '{newName}' (slug: {newSlug}) conflicts with an existing category.");
                    return null;
                }

                oldCategory.Name = newName;
                oldCategory.Slug = newSlug;
                oldCategory.Description = request.Description;

                string newCategoryFilePath = oldCategoryFilePath;

                if (!originalSlugForFileMove.Equals(newSlug, StringComparison.OrdinalIgnoreCase))
                {
                    newCategoryFilePath = Path.Combine(_categoriesFolderPath, $"{newSlug}.json");
                    _logger.LogInformation($"Slug changed from '{originalSlugForFileMove}' to '{newSlug}'. Attempting to rename file from '{oldCategoryFilePath}' to '{newCategoryFilePath}'.");

                    try
                    {
                        if (File.Exists(newCategoryFilePath))
                        {
                            _logger.LogError($"Target category file '{newCategoryFilePath}' already exists. Cannot rename category '{oldName}'.");
                            return null;
                        }
                        File.Move(oldCategoryFilePath, newCategoryFilePath);
                        _logger.LogInformation($"Successfully renamed category file from '{oldCategoryFilePath}' to '{newCategoryFilePath}'.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"ERROR DURING FILE RENAME! Error renaming category file from '{oldCategoryFilePath}' to '{newCategoryFilePath}'.");
                        return null;
                    }
                }
                else
                {
                    _logger.LogInformation($"Category slug did not change ('{newSlug}'). No file rename needed.");
                }

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(oldCategory, jsonOptions);
                await File.WriteAllTextAsync(newCategoryFilePath, json); // Write to the correct (new or old) path

                _logger.LogInformation($"Successfully updated category data for '{newName}' (Slug: {newSlug}). Saved to: {newCategoryFilePath}");
                return oldCategory;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Catch-all error updating category from '{oldName}' to '{request.NewName}'.");
                return null;
            }
        }

        public async Task<bool> DeleteCategoryAsync(string name)
        {
            try
            {
                var categories = await GetAllCategoriesAsync();
                var categoryToDelete = categories.FirstOrDefault(c => c.Name.Equals(name.Trim(), StringComparison.OrdinalIgnoreCase));

                if (categoryToDelete == null)
                {
                    _logger.LogWarning($"Category '{name}' not found for deletion.");
                    return false;
                }

                var categoryFilePath = Path.Combine(_categoriesFolderPath, $"{categoryToDelete.Slug}.json");

                if (File.Exists(categoryFilePath))
                {
                    File.Delete(categoryFilePath);
                    _logger.LogInformation($"Successfully deleted category file: {categoryFilePath}");
                    return true;
                }
                else
                {
                    _logger.LogWarning($"Category file for '{name}' (slug: {categoryToDelete.Slug}) not found at expected path: {categoryFilePath}.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting category '{name}'.");
                return false;
            }
        }

        // --- CRUD Methods for Tags ---
        public async Task<Tag?> CreateTagAsync(CreateTagRequest request)
        {
            try
            {
                var tagName = request.Name.Trim();
                var tagSlug = GenerateSlug(tagName); // Generate slug from name

                var tagFilePath = Path.Combine(_tagsFolderPath, $"{tagSlug}.json");
                if (File.Exists(tagFilePath))
                {
                    _logger.LogWarning($"Tag '{tagName}' (slug: {tagSlug}) already exists. Not creating.");
                    return null;
                }

                var newTag = new Tag
                {
                    Name = tagName,
                    Slug = tagSlug
                };

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(newTag, jsonOptions);
                await File.WriteAllTextAsync(tagFilePath, json);

                _logger.LogInformation($"Successfully created tag: {tagName} (Slug: {tagSlug}) at {tagFilePath}");
                return newTag;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating tag '{request.Name}'.");
                return null;
            }
        }

        public async Task<Tag?> UpdateTagAsync(string oldName, UpdateTagRequest request)
        {
            try
            {
                _logger.LogInformation($"Attempting to update tag '{oldName}' to '{request.NewName}'.");

                var tags = await GetAllTagsAsync();
                var oldTag = tags.FirstOrDefault(t => t.Name.Equals(oldName.Trim(), StringComparison.OrdinalIgnoreCase));

                if (oldTag == null)
                {
                    _logger.LogWarning($"Tag '{oldName}' not found for update.");
                    return null;
                }

                var originalSlugForFileMove = oldTag.Slug;
                var oldTagFilePath = Path.Combine(_tagsFolderPath, $"{originalSlugForFileMove}.json");
                _logger.LogInformation($"Original tag file path: {oldTagFilePath}");

                var newName = request.NewName.Trim();
                var newSlug = GenerateSlug(newName);
                _logger.LogInformation($"Generated new slug: {newSlug}");

                if (!originalSlugForFileMove.Equals(newSlug, StringComparison.OrdinalIgnoreCase) &&
                    tags.Any(t => t.Slug.Equals(newSlug, StringComparison.OrdinalIgnoreCase) && !t.Slug.Equals(originalSlugForFileMove, StringComparison.OrdinalIgnoreCase)))
                {
                    _logger.LogWarning($"New tag name '{newName}' (slug: {newSlug}) conflicts with an existing tag.");
                    return null;
                }

                oldTag.Name = newName;
                oldTag.Slug = newSlug;

                string newTagFilePath = oldTagFilePath;

                if (!originalSlugForFileMove.Equals(newSlug, StringComparison.OrdinalIgnoreCase))
                {
                    newTagFilePath = Path.Combine(_tagsFolderPath, $"{newSlug}.json");
                    _logger.LogInformation($"Slug changed from '{originalSlugForFileMove}' to '{newSlug}'. Attempting to rename file from '{oldTagFilePath}' to '{newTagFilePath}'.");

                    try
                    {
                        if (File.Exists(newTagFilePath))
                        {
                            _logger.LogError($"Target tag file '{newTagFilePath}' already exists. Cannot rename tag '{oldName}'.");
                            return null;
                        }
                        File.Move(oldTagFilePath, newTagFilePath);
                        _logger.LogInformation($"Successfully renamed tag file from '{oldTagFilePath}' to '{newTagFilePath}'.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"ERROR DURING FILE RENAME! Error renaming tag file from '{oldTagFilePath}' to '{newTagFilePath}'.");
                        return null;
                    }
                }
                else
                {
                    _logger.LogInformation($"Tag slug did not change ('{newSlug}'). No file rename needed.");
                }

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(oldTag, jsonOptions);
                await File.WriteAllTextAsync(newTagFilePath, json);

                _logger.LogInformation($"Successfully updated tag from '{oldName}' to '{newName}' (Slug: {newSlug}).");
                return oldTag;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating tag from '{oldName}' to '{request.NewName}'.");
                return null;
            }
        }

        public async Task<bool> DeleteTagAsync(string name)
        {
            try
            {
                var tags = await GetAllTagsAsync();
                var tagToDelete = tags.FirstOrDefault(t => t.Name.Equals(name.Trim(), StringComparison.OrdinalIgnoreCase));

                if (tagToDelete == null)
                {
                    _logger.LogWarning($"Tag '{name}' not found for deletion.");
                    return false;
                }

                var tagFilePath = Path.Combine(_tagsFolderPath, $"{tagToDelete.Slug}.json");

                if (File.Exists(tagFilePath))
                {
                    File.Delete(tagFilePath);
                    _logger.LogInformation($"Successfully deleted tag file: {tagFilePath}");
                    return true;
                }
                else
                {
                    _logger.LogWarning($"Tag file for '{name}' (slug: {tagToDelete.Slug}) not found at expected path: {tagFilePath}.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting tag '{name}'.");
                return false;
            }
        }

        // ---User Profile Methods ---
        public async Task<List<User>> GetAllUsersAsync()
        {
            var users = new List<User>();
            try
            {
                if (!Directory.Exists(_usersFolderPath))
                {
                    Directory.CreateDirectory(_usersFolderPath);
                    return users;
                }

                var userDirs = Directory.EnumerateDirectories(_usersFolderPath, "*", SearchOption.TopDirectoryOnly);

                foreach (var userDirPath in userDirs)
                {
                    var profileFilePath = Path.Combine(userDirPath, "profile.json");
                    if (File.Exists(profileFilePath))
                    {
                        var user = await ReadJsonFileAsync<User>(profileFilePath);
                        if (user != null)
                        {
                            users.Add(user);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error reading users from {_usersFolderPath}.");
            }
            return users.OrderBy(u => u.Username).ToList(); 
        }

        public async Task<User?> CreateUserAsync(CreateUserRequest request)
        {
            try
            {
                var username = request.Username.Trim().ToLowerInvariant(); 
                var userDir = Path.Combine(_usersFolderPath, username);
                var profileFilePath = Path.Combine(userDir, "profile.json");

                if (Directory.Exists(userDir) || File.Exists(profileFilePath))
                {
                    _logger.LogWarning($"User '{username}' already exists. Not creating.");
                    return null;
                }

                Directory.CreateDirectory(userDir);

                var newUser = new User
                {
                    Username = username,
                    Email = request.Email.Trim(),
                    HashedPassword = request.HashedPassword.Trim(),
                    Roles = request.Roles ?? new List<string>()
                };

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(newUser, jsonOptions);
                await File.WriteAllTextAsync(profileFilePath, json);

                _logger.LogInformation($"Successfully created user profile for: {username} at {profileFilePath}");
                return newUser;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating user '{request.Username}'.");
                return null;
            }
        }

        public async Task<User?> UpdateUserAsync(string username, UpdateUserRequest request)
        {
            try
            {
                var userToUpdateUsername = username.Trim().ToLowerInvariant();
                _logger.LogInformation($"Attempting to update user '{userToUpdateUsername}'.");

                var userDir = Path.Combine(_usersFolderPath, userToUpdateUsername);
                var profileFilePath = Path.Combine(userDir, "profile.json");

                if (!File.Exists(profileFilePath))
                {
                    _logger.LogWarning($"User '{userToUpdateUsername}' not found for update.");
                    return null;
                }

                var existingUser = await ReadJsonFileAsync<User>(profileFilePath);
                if (existingUser == null)
                {
                    _logger.LogError($"Could not deserialize existing user profile for '{userToUpdateUsername}'.");
                    return null;
                }

                existingUser.Email = request.Email.Trim();
                if (!string.IsNullOrEmpty(request.HashedPassword))
                {
                    existingUser.HashedPassword = request.HashedPassword.Trim();
                }
                existingUser.Roles = request.Roles ?? new List<string>(); 

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(existingUser, jsonOptions);
                await File.WriteAllTextAsync(profileFilePath, json); 

                _logger.LogInformation($"Successfully updated user profile for: {userToUpdateUsername}");
                return existingUser;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating user '{username}'.");
                return null;
            }
        }
        
       public async Task<bool> DeleteUserAsync(string username)
        {
            try
            {
                var userToDeleteUsername = username.Trim().ToLowerInvariant();
                var userDir = Path.Combine(_usersFolderPath, userToDeleteUsername);

                if (Directory.Exists(userDir))
                {
                    await Task.Run(() => Directory.Delete(userDir, recursive: true));

                    _logger.LogInformation($"Successfully deleted user directory: {userDir}");
                    return true;
                }
                else
                {
                    _logger.LogWarning($"User directory for '{userToDeleteUsername}' not found at expected path: {userDir}.");
                    return false; 
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting user '{username}'.");
                return false;
            }
        }
    }
}
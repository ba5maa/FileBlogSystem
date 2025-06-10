using FileBlogSystem.Models; 
using Microsoft.Extensions.Logging;
using System.Text.Json; 
using System.Text.RegularExpressions;

namespace FileBlogSystem.Services
{
    public class FileContentService : IContentService
    {
        private readonly string _contentRootPath;
        private readonly ILogger<FileContentService> _logger;

        public FileContentService(IWebHostEnvironment env, ILogger<FileContentService> logger)
        {
            // env.ContentRootPath points to where .csproj is
            _contentRootPath = Path.Combine(env.ContentRootPath, "content");
            _logger = logger;
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
            var categoriesDirectory = Path.Combine(_contentRootPath, "categories");

            if (!Directory.Exists(categoriesDirectory))
            {
                _logger.LogWarning($"Categories directory not found: {categoriesDirectory}");
                return categories;
            }

            foreach (var categoryFile in Directory.EnumerateFiles(categoriesDirectory, "*.json"))
            {
                var category = await ReadJsonFileAsync<Category>(categoryFile);
                if (category != null)
                {
                    categories.Add(category);
                }
            }
            return categories.OrderBy(c => c.Name).ToList();
        }

        // --- Tag Methods ---
        public async Task<List<Tag>> GetAllTagsAsync()
        {
            var tags = new List<Tag>();
            var tagsDirectory = Path.Combine(_contentRootPath, "tags");

            if (!Directory.Exists(tagsDirectory))
            {
                _logger.LogWarning($"Tags directory not found: {tagsDirectory}");
                return tags;
            }

            foreach (var tagFile in Directory.EnumerateFiles(tagsDirectory, "*.json"))
            {
                var tag = await ReadJsonFileAsync<Tag>(tagFile);
                if (tag != null)
                {
                    tags.Add(tag);
                }
            }
            return tags.OrderBy(t => t.Name).ToList();
        }

        // --- User Methods ---
        public async Task<User?> GetUserByUsernameAsync(string username)
        {
            var userProfilePath = Path.Combine(_contentRootPath, "users", username, "profile.json");
            return await ReadJsonFileAsync<User>(userProfilePath);
        }

        // --- New Write Method for Blog Posts ---
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
            } else {
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

        // --- New Write Method for Delete ---
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
    }
}
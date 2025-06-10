using FileBlogSystem.Models; 
using Microsoft.Extensions.Logging; 
using System.Text.Json; 

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
    }
}
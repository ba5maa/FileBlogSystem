using FileBlogSystem.Models; 
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.IO;
using System.Linq;
using FileBlogSystem.Security;
using Microsoft.AspNetCore.Hosting;
using System.Runtime.InteropServices;

namespace FileBlogSystem.Services
{
    public class FileContentService : IFileContentService
    {
        private readonly string _contentRootPath;
        private readonly ILogger<FileContentService> _logger;
        private readonly string _postsFolderPath;
        private readonly string _categoriesFolderPath;
        private readonly string _tagsFolderPath;
        private readonly string _usersFolderPath;

        public FileContentService(IWebHostEnvironment env, ILogger<FileContentService> logger)
        {
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

        private string? GetProfilePictureUrl(string username)
        {
            var userDir = Path.Combine(_usersFolderPath, username.ToLowerInvariant());
            var profilePictureDir = Path.Combine(userDir, "profilepicture");

            if (Directory.Exists(profilePictureDir))
            {
                var imageFiles = Directory.GetFiles(profilePictureDir)
                                        .Where(f => Regex.IsMatch(Path.GetExtension(f), @"\.(jpg|jpeg|png|gif|bmp|webp)$", RegexOptions.IgnoreCase))
                                        .ToList();

                if (imageFiles.Any())
                {
                    var fileName = Path.GetFileName(imageFiles.First());
                    return $"/content/users/{username.ToLowerInvariant()}/profilepicture/{fileName}";
                }
            }
            return null;
        }

        private string GetCategoryPath(Guid id)
        {
            return Path.Combine(_categoriesFolderPath, $"{id}.json");
        }

        private string GetTagPath(Guid id)
        {
            return Path.Combine(_tagsFolderPath, $"{id}.json");
        }
        public async Task<List<BlogPostMetaResponse>> GetAllBlogPostsMetaAsync()
        {
            var postsMeta = new List<BlogPostMetaResponse>();
            var postsDirectory = Path.Combine(_contentRootPath, "posts");
            var now = DateTime.UtcNow;
            var jsonOptions = new JsonSerializerOptions { WriteIndented = true };


            if (!Directory.Exists(postsDirectory))
            {
                _logger.LogWarning($"Posts directory not found: {postsDirectory}");
                return postsMeta;
            }

            foreach (var postFolder in Directory.EnumerateDirectories(postsDirectory))
            {
                var metaFilePath = Path.Combine(postFolder, "meta.json");
                var meta = await ReadJsonFileAsync<BlogPostMetaResponse>(metaFilePath);

                if (meta != null)
                {
                    var folderName = Path.GetFileName(postFolder);
                    meta.Slug = folderName.Length > 11 && folderName[4] == '-' && folderName[7] == '-' && folderName[10] == '-'
                                ? folderName.Substring(11)
                                : folderName;

                    meta.PostFolderPath = postFolder;

                    if (meta.IsDraft && meta.ScheduledFor.HasValue && meta.ScheduledFor.Value <= DateTime.UtcNow)
                    {
                        _logger.LogInformation($"Auto publishing post '{meta.Title}' (slug: {meta.Slug}). Scheduled date has passed.");
                        meta.IsDraft = false;
                        meta.ScheduledFor = null;
                        meta.PublishedDate = DateTime.UtcNow;
                        meta.ModificationDate = now;

                        try
                        {
                            var updatedMetaJson = JsonSerializer.Serialize(meta, jsonOptions);
                            await File.WriteAllTextAsync(metaFilePath, updatedMetaJson);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"Error auto publishing and saving meta for post '{meta.Title}'.");
                        }
                    }

                    postsMeta.Add(meta);
                }
            }

            return postsMeta.OrderByDescending(p => p.PublishedDate.HasValue ? p.PublishedDate.Value : DateTime.MinValue).ToList();
        }

        public async Task<BlogPostMetaResponse?> GetBlogPostMetaBySlugAsync(string slug)
        {
            var allPosts = await GetAllBlogPostsMetaAsync();
            return allPosts.FirstOrDefault(p => p.Slug?.Equals(slug, StringComparison.OrdinalIgnoreCase) == true);
        }

        public async Task<BlogPostMetaResponse?> GetBlogPostMetaByIdAsync(Guid id)
        {
            var allPosts = await GetAllBlogPostsMetaAsync();
            return allPosts.FirstOrDefault(p => p.Id == id);
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
        public async Task<List<CategoryResponse>> GetAllCategoriesAsync()
        {
            var categories = new List<CategoryResponse>();
            try
            {
                if (!Directory.Exists(_categoriesFolderPath))
                {
                    Directory.CreateDirectory(_categoriesFolderPath);
                    return categories;
                }

                var categoryFiles = Directory.GetFiles(_categoriesFolderPath, "*.json");

                foreach (var filePath in categoryFiles)
                {
                    var category = await ReadJsonFileAsync<CategoryResponse>(filePath);
                    if (category != null)
                    {
                        if (category.Id == Guid.Empty)
                        {
                            var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(filePath);
                            if (Guid.TryParse(fileNameWithoutExtension, out Guid fileId))
                            {
                                category.Id = fileId;
                            }
                        }
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

        public async Task<List<TagResponse>> GetAllTagsAsync()
        {
            var tags = new List<TagResponse>();
            try
            {
                if (!Directory.Exists(_tagsFolderPath))
                {
                    Directory.CreateDirectory(_tagsFolderPath);
                    return tags;
                }

                var tagFiles = Directory.GetFiles(_tagsFolderPath, "*.json");

                foreach (var filePath in tagFiles)
                {
                    var tag = await ReadJsonFileAsync<TagResponse>(filePath);
                    if (tag != null)
                    {
                        if (tag.Id == Guid.Empty) 
                        {
                            var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(filePath);
                            if (Guid.TryParse(fileNameWithoutExtension, out Guid fileId))
                            {
                                tag.Id = fileId;
                            }
                        }
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

        public async Task<UserResponse?> GetUserByUsernameAsync(string username)
        {
            try
            {
                var userDir = Path.Combine(_usersFolderPath, username.Trim().ToLowerInvariant());
                var profileFilePath = Path.Combine(userDir, "profile.json");

                if (File.Exists(profileFilePath))
                {
                    var user = await ReadJsonFileAsync<UserResponse>(profileFilePath);
                    if (user != null)
                    {
                        user.ProfilePictureUrl = GetProfilePictureUrl(username);
                    }
                    return user;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user '{username}'.");
            }
            return null;
        }

        public async Task<BlogPostMetaResponse?> CreateBlogPostAsync(CreateBlogPostRequest request)
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
                    postFolderName = $"{datePrefix}-{baseSlug}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                    postFolderPath = Path.Combine(_contentRootPath, "posts", postFolderName);
                }

                Directory.CreateDirectory(postFolderPath);

                var now = DateTime.UtcNow;
                var newPostMeta = new BlogPostMetaResponse
                {
                    Id = Guid.NewGuid(),
                    Title = request.Title,
                    Description = request.Description,
                    PublishedDate = request.IsDraft ? null : request.PublishedDate,
                    ModificationDate = now,
                    Tags = request.Tags ?? new List<Guid>(),
                    Categories = request.Categories ?? new List<Guid>(),
                    CustomUrl = request.CustomUrl,
                    Slug = baseSlug,
                    PostFolderPath = postFolderPath,
                    AuthorUsername = request.AuthorUsername ?? string.Empty,
                    IsDraft = request.IsDraft,
                    ScheduledFor = request.ScheduledFor
                };

                if (!string.IsNullOrEmpty(request.Base64Image))
                {
                    var imageFileName = await SaveBase64ImageAsync(postFolderPath, request.Base64Image);
                    if (imageFileName != null)
                    {
                        newPostMeta.ImageUrl = $"/content/posts/{postFolderName}/assets/{imageFileName}";
                    }
                }


                var metaFilePath = Path.Combine(postFolderPath, "meta.json");
                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var metaJson = JsonSerializer.Serialize(newPostMeta, jsonOptions);
                await File.WriteAllTextAsync(metaFilePath, metaJson);


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

        private async Task<string?> SaveBase64ImageAsync(string postFolderPath, string base64Image)
        {
            try
            {
                var base64Data = Regex.Replace(base64Image, @"^data:image\/(png|jpeg|jpg|gif);base64,", "", RegexOptions.IgnoreCase);
                byte[] imageBytes = Convert.FromBase64String(base64Data);

                string fileExtension = ".png";
                if (base64Image.Contains("image/jpeg")) fileExtension = ".jpeg";
                else if (base64Image.Contains("image/jpg")) fileExtension = ".jpg";
                else if (base64Image.Contains("image/gif")) fileExtension = ".gif";
                else if (base64Image.Contains("image/webp")) fileExtension = ".webp";

                var assetsFolderPath = Path.Combine(postFolderPath, "assets");
                Directory.CreateDirectory(assetsFolderPath);

                var fileName = $"{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(assetsFolderPath, fileName);

                await File.WriteAllBytesAsync(filePath, imageBytes);
                _logger.LogInformation($"Saved image: {filePath}");
                return fileName;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving base64 image.");
                return null;
            }
        }

        private string GenerateSlug(string title)
        {
            var slug = title.ToLowerInvariant();
            slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");
            slug = Regex.Replace(slug, @"\s+", "-").Trim();
            slug = Regex.Replace(slug, @"-+", "-");
            return slug;
        }

        public async Task<BlogPostMetaResponse?> UpdateBlogPostAsync(string originalSlug, UpdateBlogPostRequest request)
        {
            var existingPostMeta = await GetBlogPostMetaBySlugAsync(originalSlug);
            
            if (existingPostMeta == null || string.IsNullOrEmpty(existingPostMeta.PostFolderPath))
            {
                _logger.LogWarning($"Attempted to update non existent or pathless post with slug: {originalSlug}");
                return null;
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
            existingPostMeta.Tags = request.Tags ?? new List<Guid>();
            existingPostMeta.Categories = request.Categories ?? new List<Guid>();
            existingPostMeta.CustomUrl = request.CustomUrl;
            existingPostMeta.Slug = newBaseSlug;
            existingPostMeta.PostFolderPath = newPostFolderPath;
            existingPostMeta.IsDraft = request.IsDraft;
            existingPostMeta.PublishedDate = request.PublishedDate;
            existingPostMeta.ScheduledFor = request.ScheduledFor;

            if (existingPostMeta.ImageUrl == null && request.Base64Image == null)
            {
                existingPostMeta.ImageUrl = existingPostMeta.ImageUrl;
            }

            if (!string.IsNullOrEmpty(request.Base64Image))
            {

                if (!string.IsNullOrEmpty(existingPostMeta.ImageUrl))
                {
                    try
                    {

                        var oldImageRelativePath = existingPostMeta.ImageUrl.Replace("/content/", "").Replace('/', Path.DirectorySeparatorChar);
                        var oldImageFilePath = Path.Combine(_contentRootPath, oldImageRelativePath);

                        if (File.Exists(oldImageFilePath))
                        {
                            File.Delete(oldImageFilePath);
                            _logger.LogInformation($"Deleted old image: {oldImageFilePath}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error deleting old image for post {originalSlug}.");
                    }
                }

                var imageFileName = await SaveBase64ImageAsync(newPostFolderPath, request.Base64Image);
                if (imageFileName != null)
                {
                    existingPostMeta.ImageUrl = $"/content/posts/{newPostFolderName}/assets/{imageFileName}";
                }
            }
            else if (request.ExplicitlyRemoveImage && existingPostMeta.ImageUrl != null)
             {
                 try
                 {
                     var oldImageRelativePath = existingPostMeta.ImageUrl.Replace("/content/", "").Replace('/', Path.DirectorySeparatorChar);
                     var oldImageFilePath = Path.Combine(_contentRootPath, oldImageRelativePath);
                     if (File.Exists(oldImageFilePath))
                     {
                         File.Delete(oldImageFilePath);
                         _logger.LogInformation($"Deleted old image (explicitly removed by user): {oldImageFilePath}");
                     }
                 }
                 catch (Exception ex)
                 {
                     _logger.LogError(ex, $"Error deleting old image explicitly removed by user for post {originalSlug}.");
                 }
                 existingPostMeta.ImageUrl = null;
             }
             


            try
            {
                var metaFilePath = Path.Combine(newPostFolderPath, "meta.json");
                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var updatedMetaJson = JsonSerializer.Serialize(existingPostMeta, jsonOptions);
                await File.WriteAllTextAsync(metaFilePath, updatedMetaJson);

                var contentFilePath = Path.Combine(newPostFolderPath, "content.md");
                await File.WriteAllTextAsync(contentFilePath, request.Content);

                _logger.LogInformation($"Successfully updated blog post: {existingPostMeta.Title} (New Slug: {existingPostMeta.Slug})");
                return existingPostMeta;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error saving updated blog post with slug: {originalSlug}.");
                return null;
            }
        }

        public async Task<bool> DeleteBlogPostAsync(string slug)
        {
            var postMeta = await GetBlogPostMetaBySlugAsync(slug);
            if (postMeta == null || string.IsNullOrEmpty(postMeta.PostFolderPath))
            {
                _logger.LogWarning($"Attempted to delete non existent or pathless post with slug: {slug}");
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

        public async Task<CategoryResponse?> CreateCategoryAsync(CreateCategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                _logger.LogWarning("Attempted to create category with empty name.");
                return null;
            }

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

                var newCategory = new CategoryResponse
                {
                    Id = Guid.NewGuid(),
                    Name = categoryName,
                    Slug = categorySlug,
                    Description = request.Description
                };

                var filePath = Path.Combine(_categoriesFolderPath, $"{newCategory.Slug}.json"); // Use Slug for filename
                var jsonOptions = new JsonSerializerOptions { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
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

        public async Task<CategoryResponse?> UpdateCategoryAsync(Guid id, UpdateCategoryRequest request)
        {
            var allCategories = await GetAllCategoriesAsync();
            var existingCategory = allCategories.FirstOrDefault(c => c.Id == id);

            if (existingCategory == null)
            {
                _logger.LogWarning($"Category with ID '{id}' not found for update.");
                return null;
            }

            var oldFilePath = Path.Combine(_categoriesFolderPath, $"{existingCategory.Slug}.json");

            existingCategory.Name = request.NewName.Trim();
            string newSlug = GenerateSlug(existingCategory.Name);
            existingCategory.Slug = newSlug;
            existingCategory.Description = request.Description;

            var jsonOptions = new JsonSerializerOptions { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
            var json = JsonSerializer.Serialize(existingCategory, jsonOptions);

            var newFilePath = Path.Combine(_categoriesFolderPath, $"{newSlug}.json");

            if (oldFilePath != newFilePath && File.Exists(oldFilePath))
            {
                await Task.Run(() => File.Delete(oldFilePath));
                _logger.LogInformation($"Deleted old category file: {oldFilePath}");
            }

            await File.WriteAllTextAsync(newFilePath, json);

            _logger.LogInformation($"Category '{existingCategory.Name}' (ID: '{id}') updated successfully. File: {newFilePath}");
            return existingCategory;
        }

        public async Task<bool> DeleteCategoryAsync(Guid id)
        {
            try
            {
                var allCategories = await GetAllCategoriesAsync();
                var categoryToDelete = allCategories.FirstOrDefault(c => c.Id == id);

                if (categoryToDelete == null)
                {
                    _logger.LogWarning($"Category with ID '{id}' not found for deletion.");
                    return false;
                }
                var filePath = Path.Combine(_categoriesFolderPath, $"{categoryToDelete.Slug}.json"); // <-- CRITICAL CHANGE

                if (File.Exists(filePath))
                {
                    await Task.Run(() => File.Delete(filePath));
                    _logger.LogInformation($"Category file '{filePath}' for ID '{id}' deleted.");
                    return true;
                }
                else
                {
                    _logger.LogWarning($"Category file for ID '{id}' (expected at '{filePath}') not found for deletion. File might already be gone or path incorrect.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting category with ID '{id}'.");
                return false;
            }
        }

        public async Task<TagResponse?> CreateTagAsync(CreateTagRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                _logger.LogWarning("Attempted to create tag with empty name.");
                return null;
            }

            var tagName = request.Name.Trim();
            var tagSlug = GenerateSlug(tagName);

            var existingTags = await GetAllTagsAsync();
            if (existingTags.Any(t => t.Name.Equals(tagName, StringComparison.OrdinalIgnoreCase) ||
                                      t.Slug.Equals(tagSlug, StringComparison.OrdinalIgnoreCase)))
            {
                _logger.LogWarning($"Tag with name '{tagName}' or slug '{tagSlug}' already exists.");
                return null;
            }

            var newTag = new TagResponse
            {
                Id = Guid.NewGuid(),
                Name = tagName,
                Slug = tagSlug
            };

            var filePath = Path.Combine(_tagsFolderPath, $"{newTag.Slug}.json");
            var jsonOptions = new JsonSerializerOptions { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
            var json = JsonSerializer.Serialize(newTag, jsonOptions);
            await File.WriteAllTextAsync(filePath, json);

            _logger.LogInformation($"Tag '{newTag.Name}' created with ID '{newTag.Id}'.");
            return newTag;
        }

        public async Task<TagResponse?> UpdateTagAsync(Guid id, UpdateTagRequest request)
        {
            var allTags = await GetAllTagsAsync();
            var existingTag = allTags.FirstOrDefault(t => t.Id == id);

            if (existingTag == null)
            {
                _logger.LogWarning($"Tag with ID '{id}' not found for update.");
                return null;
            }

            var oldFilePath = Path.Combine(_tagsFolderPath, $"{existingTag.Slug}.json");

            existingTag.Name = request.NewName.Trim();
            string newSlug = GenerateSlug(existingTag.Name);
            existingTag.Slug = newSlug;

            var jsonOptions = new JsonSerializerOptions { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
            var json = JsonSerializer.Serialize(existingTag, jsonOptions);

            var newFilePath = Path.Combine(_tagsFolderPath, $"{newSlug}.json");

            if (oldFilePath != newFilePath && File.Exists(oldFilePath))
            {
                await Task.Run(() => File.Delete(oldFilePath));
                _logger.LogInformation($"Deleted old tag file: {oldFilePath}");
            }

            await File.WriteAllTextAsync(newFilePath, json);

            _logger.LogInformation($"Tag '{existingTag.Name}' (ID: '{id}') updated successfully. File: {newFilePath}");
            return existingTag;
        }

        public async Task<bool> DeleteTagAsync(Guid id)
        {
            try
            {
                var allTags = await GetAllTagsAsync();
                var tagToDelete = allTags.FirstOrDefault(t => t.Id == id);

                if (tagToDelete == null)
                {
                    _logger.LogWarning($"Tag with ID '{id}' not found for deletion.");
                    return false;
                }
                var filePath = Path.Combine(_tagsFolderPath, $"{tagToDelete.Slug}.json"); // <-- CRITICAL CHANGE

                if (File.Exists(filePath))
                {
                    await Task.Run(() => File.Delete(filePath));
                    _logger.LogInformation($"Tag file '{filePath}' for ID '{id}' deleted.");
                    return true;
                }
                else
                {
                    _logger.LogWarning($"Tag file for ID '{id}' (expected at '{filePath}') not found for deletion. File might already be gone or path incorrect.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting tag with ID '{id}'.");
                return false;
            }
        }

        public async Task<List<UserResponse>> GetAllUsersAsync()
        {
            var users = new List<UserResponse>();

            if (!Directory.Exists(_usersFolderPath)) return users;

            foreach (var userDir in Directory.GetDirectories(_usersFolderPath))
            {
                var profileFilePath = Path.Combine(userDir, "profile.json");
                if (File.Exists(profileFilePath))
                {
                    var user = await ReadJsonFileAsync<UserResponse>(profileFilePath);
                    if (user != null)
                    {
                        user.ProfilePictureUrl = GetProfilePictureUrl(user.Username);
                        users.Add(user);
                    }
                }
            }

            return users.OrderBy(u => u.Username).ToList();
        }

        public async Task<UserResponse?> CreateUserAsync(CreateUserRequest request)
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
                string hashedPassword = PasswordHasher.HashPassword(request.Password);
                var newUser = new UserResponse
                {
                    Username = username,
                    Email = request.Email.Trim(),
                    HashedPassword = hashedPassword,
                    Roles = request.Roles ?? ["Author"],
                    ProfilePictureUrl = null
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

        public async Task<UserResponse?> UpdateUserAsync(string username, UpdateUserRequest request)
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

                var existingUser = await ReadJsonFileAsync<UserResponse>(profileFilePath);
                if (existingUser == null)
                {
                    _logger.LogError($"Could not deserialize existing user profile for '{userToUpdateUsername}'.");
                    return null;
                }

                existingUser.Email = request.Email.Trim();
                existingUser.Roles = request.Roles ?? new List<string>();

                if (!string.IsNullOrEmpty(request.HashedPassword))
                {
                    existingUser.HashedPassword = request.HashedPassword.Trim();
                }

                if (!string.IsNullOrEmpty(request.ProfilePictureBase64) && !string.IsNullOrEmpty(request.ProfilePictureFileName))
                {
                    var profilePictureDir = Path.Combine(userDir, "profilepicture");
                    Directory.CreateDirectory(profilePictureDir);

                    foreach (var file in Directory.GetFiles(profilePictureDir))
                    {
                        File.Delete(file);
                    }

                    var fileExtension = Path.GetExtension(request.ProfilePictureFileName);
                    if (string.IsNullOrEmpty(fileExtension) || !Regex.IsMatch(fileExtension, @"\.(jpg|jpeg|png|gif|bmp|webp)$", RegexOptions.IgnoreCase))
                    {
                        _logger.LogWarning($"Invalid or missing file extension for profile picture: {request.ProfilePictureFileName}");
                        fileExtension = ".png";
                    }

                    var profilePicturePath = Path.Combine(profilePictureDir, $"profile{fileExtension}"); // Standardize filename

                    try
                    {
                        string base64Data = request.ProfilePictureBase64;
                        if (base64Data.Contains(","))
                        {
                            base64Data = base64Data.Substring(base64Data.IndexOf(',') + 1);
                        }

                        var imageBytes = Convert.FromBase64String(base64Data);
                        await File.WriteAllBytesAsync(profilePicturePath, imageBytes);
                        _logger.LogInformation($"Profile picture saved for user: {username}");

                        existingUser.ProfilePictureUrl = GetProfilePictureUrl(username);
                    }
                    catch (FormatException ex)
                    {
                        _logger.LogError(ex, "Invalid Base64 string for profile picture.");
                        existingUser.ProfilePictureUrl = GetProfilePictureUrl(username);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error saving profile picture for user: {username}");
                        existingUser.ProfilePictureUrl = GetProfilePictureUrl(username);
                        existingUser.ProfilePictureUrl = GetProfilePictureUrl(username);
                    }
                }
                else if (request.ProfilePictureBase64 == null && request.ProfilePictureFileName == null && existingUser.ProfilePictureUrl != null)
                {
                    var profilePictureDir = Path.Combine(userDir, "profilepicture");
                    if (Directory.Exists(profilePictureDir))
                    {
                        Directory.Delete(profilePictureDir, recursive: true);
                        _logger.LogInformation($"Profile picture directory deleted for user: {username}");
                    }
                    existingUser.ProfilePictureUrl = null;
                }

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
                var userProfilePath = Path.Combine(userDir, "profile.json");

                if (File.Exists(userProfilePath))
                {
                    var jsonContent = await File.ReadAllTextAsync(userProfilePath);
                    var user = JsonSerializer.Deserialize<UserResponse>(jsonContent);

                    if (user == null)
                    {
                        _logger.LogWarning($"User profile for '{userToDeleteUsername}' could not be deserialized.");
                        return false;
                    }

                    user.IsActive = false;

                    var updatedJsonContent = JsonSerializer.Serialize(user, new JsonSerializerOptions { WriteIndented = true });
                    await File.WriteAllTextAsync(userProfilePath, updatedJsonContent);

                    _logger.LogInformation($"Successfully soft deleted user: {userToDeleteUsername}");
                    return true;
                }
                else
                {
                    _logger.LogWarning($"User profile file for '{userToDeleteUsername}' not found at expected path: {userProfilePath}.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error soft deleting user '{username}'.");
                return false;
            }
        }

        public async Task<bool> SaveUpdatedMetaAsync(BlogPostMetaResponse post)
        {
            try
            {
                if (string.IsNullOrEmpty(post.PostFolderPath)) return false;
                var metaFilePath = Path.Combine(post.PostFolderPath, "meta.json");
                var options = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(post, options);
                await File.WriteAllTextAsync(metaFilePath, json);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error saving updated meta for post ID {post.Id}");
                return false;
            }
        }

        public async Task<bool> AddCommentAsync(string slug, CommentModel comment)
        {
            var postMeta = await GetBlogPostMetaBySlugAsync(slug);
            if (postMeta == null || string.IsNullOrEmpty(postMeta.PostFolderPath)) return false;

            var commentsDir = Path.Combine(postMeta.PostFolderPath, "comments");
            Directory.CreateDirectory(commentsDir);

            comment.Id = Guid.NewGuid();
            comment.CreatedAt = DateTime.UtcNow;

            var commentPath = Path.Combine(commentsDir, $"{comment.Id}.json");
            var json = JsonSerializer.Serialize(comment, new JsonSerializerOptions { WriteIndented = true });

            await File.WriteAllTextAsync(commentPath, json);
            return true;
        }

        public async Task<List<CommentModel>> GetCommentsAsync(string slug)
        {
            var postMeta = await GetBlogPostMetaBySlugAsync(slug);
            var comments = new List<CommentModel>();

            if (postMeta == null || string.IsNullOrEmpty(postMeta.PostFolderPath)) return comments;

            var commentsDir = Path.Combine(postMeta.PostFolderPath, "comments");
            if (!Directory.Exists(commentsDir)) return comments;

            foreach (var file in Directory.GetFiles(commentsDir, "*.json"))
            {
                var comment = await ReadJsonFileAsync<CommentModel>(file);
                if (comment != null) comments.Add(comment);
            }

            return comments.OrderByDescending(c => c.CreatedAt).ToList();
        }

        public async Task<CategoryResponse?> GetCategoryByIdAsync(Guid id)
        {
            if (!Directory.Exists(_categoriesFolderPath))
                return null;

            foreach (var file in Directory.GetFiles(_categoriesFolderPath, "*.json"))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file);
                    var category = JsonSerializer.Deserialize<CategoryResponse>(json);
                    if (category?.Id == id)
                        return category;
                }
                catch
                {
                    continue;
                }
            }

            return null;
        }
    
        public async Task<TagResponse?> GetTagByIdAsync(Guid id)
        {
            if (!Directory.Exists(_tagsFolderPath))
                return null;

            foreach (var file in Directory.GetFiles(_tagsFolderPath, "*.json"))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file);
                    var tag = JsonSerializer.Deserialize<TagResponse>(json);
                    if (tag?.Id == id)
                        return tag;
                }
                catch
                {
                    continue;
                }
            }

            return null;
        }
        
    }

}
using FileBlogSystem.Models; // Use the correct namespace

namespace FileBlogSystem.Services
{
    public interface IContentService
    {
        Task<List<BlogPostMeta>> GetAllBlogPostsMetaAsync();
        Task<BlogPostMeta?> GetBlogPostMetaBySlugAsync(string slug);
        Task<string?> GetBlogPostContentAsync(string postFolderPath); // Path to the content.md
        Task<List<Category>> GetAllCategoriesAsync();
        Task<List<Tag>> GetAllTagsAsync();
        Task<User?> GetUserByUsernameAsync(string username);
    }
}
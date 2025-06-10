using FileBlogSystem.Models; 
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
        Task<BlogPostMeta?> CreateBlogPostAsync(CreateBlogPostRequest request);
         Task<BlogPostMeta?> UpdateBlogPostAsync(string originalSlug, UpdateBlogPostRequest request);
        Task<bool> DeleteBlogPostAsync(string slug);
    }
}
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
        Task<Category?> CreateCategoryAsync(CreateCategoryRequest request);
        Task<Category?> UpdateCategoryAsync(string oldName, UpdateCategoryRequest request);
        Task<bool> DeleteCategoryAsync(string name);
        Task<Tag?> CreateTagAsync(CreateTagRequest request);
        Task<Tag?> UpdateTagAsync(string oldName, UpdateTagRequest request);
        Task<bool> DeleteTagAsync(string name);
        Task<List<User>> GetAllUsersAsync();
        Task<User?> CreateUserAsync(CreateUserRequest request);
        Task<User?> UpdateUserAsync(string username, UpdateUserRequest request);
        Task<bool> DeleteUserAsync(string username);

    }
}
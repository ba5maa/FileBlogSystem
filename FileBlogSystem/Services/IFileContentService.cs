using FileBlogSystem.Models; 
namespace FileBlogSystem.Services
{
    public interface IFileContentService
    {
        Task<List<BlogPostMetaResponse>> GetAllBlogPostsMetaAsync();
        Task<BlogPostMetaResponse?> GetBlogPostMetaBySlugAsync(string slug);
        Task<string?> GetBlogPostContentAsync(string postFolderPath);
        Task<List<CategoryResponse>> GetAllCategoriesAsync();
        Task<List<TagResponse>> GetAllTagsAsync();
        Task<UserResponse?> GetUserByUsernameAsync(string username);
        Task<BlogPostMetaResponse?> CreateBlogPostAsync(CreateBlogPostRequest request);
        Task<BlogPostMetaResponse?> UpdateBlogPostAsync(string originalSlug, UpdateBlogPostRequest request);
        Task<bool> DeleteBlogPostAsync(string slug);
        Task<CategoryResponse?> CreateCategoryAsync(CreateCategoryRequest request);
        Task<CategoryResponse?> UpdateCategoryAsync(string oldName, UpdateCategoryRequest request);
        Task<bool> DeleteCategoryAsync(string name);
        Task<TagResponse?> CreateTagAsync(CreateTagRequest request);
        Task<TagResponse?> UpdateTagAsync(string oldName, UpdateTagRequest request);
        Task<bool> DeleteTagAsync(string name);
        Task<List<UserResponse>> GetAllUsersAsync();
        Task<UserResponse?> CreateUserAsync(CreateUserRequest request);
        Task<UserResponse?> UpdateUserAsync(string username, UpdateUserRequest request);
        Task<bool> DeleteUserAsync(string username);

    }
}
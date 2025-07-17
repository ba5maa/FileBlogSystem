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
        Task<CategoryResponse?> UpdateCategoryAsync(Guid id, UpdateCategoryRequest request);
        Task<bool> DeleteCategoryAsync(Guid id);
        Task<TagResponse?> CreateTagAsync(CreateTagRequest request);
        Task<TagResponse?> UpdateTagAsync(Guid id, UpdateTagRequest request);
        Task<bool> DeleteTagAsync(Guid id);
        Task<List<UserResponse>> GetAllUsersAsync();
        Task<UserResponse?> CreateUserAsync(CreateUserRequest request);
        Task<UserResponse?> UpdateUserAsync(string username, UpdateUserRequest request);
        Task<bool> DeleteUserAsync(string username);
        Task<BlogPostMetaResponse?> GetBlogPostMetaByIdAsync(Guid id);
        Task<bool> SaveUpdatedMetaAsync(BlogPostMetaResponse post);
        Task<bool> AddCommentAsync(string slug, CommentModel comment);
        Task<List<CommentModel>> GetCommentsAsync(string slug);
        Task<CategoryResponse?> GetCategoryByIdAsync(Guid id);
        Task<TagResponse?> GetTagByIdAsync(Guid id);

    }
}
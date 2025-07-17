namespace FileBlogSystem.Constants
{
    public static class EndpointConstants
    {
        public const string Admin = "Admin";
        public const string Author = "Author";
        public const string Scheduled = "scheduled";
        public const string GetAllPosts = "GetAllPosts";
        public const string GetPostBySlug = "GetPostBySlug";
        public const string GetAllCategories = "GetAllCategories";
        public const string GetCategoryById = "GetCategoryById";
        public const string GetAllTags = "GetAllTags";
        public const string GetTagById = "GetTagById";
        public const string GetUserByUsername = "GetUserByUsername";
        public const string Login = "Login";
        public const string GetProtectedData = "GetProtectedData";
        public const string GetAdminInfo = "GetAdminInfo";
        public const string CreateBlogPost = "CreateBlogPost";
        public const string UpdateBlogPost = "UpdateBlogPost";
        public const string DeleteBlogPost = "DeleteBlogPost";
        public const string CreateCategory = "CreateCategory";
        public const string UpdateCategory = "UpdateCategory";
        public const string DeleteCategory = "DeleteCategory";
        public const string CreateTag = "CreateTag";
        public const string UpdateTag = "UpdateTag";
        public const string DeleteTag = "DeleteTag";
        public const string GetAllUsers = "GetAllUsers";
        public const string CreateUser = "CreateUser";
        public const string UpdateUser = "UpdateUser";
        public const string DeleteUser = "DeleteUser";
        public const string LikePost = "LikePost";
        public const string UnlikePost = "UnlikePost";
        public const string GetCommentsForPost = "GetCommentsForPost";
        public const string AddComment = "AddComment";

        public const string InvalidUsernameOrPassword = "Invalid username or password";
        public const string PostNotFound = "Post not found";
        public const string PostNotFoundWithSlug = "post-with-slug-'{0}'-not-found";
        public const string CategoryNotFound = "category-with-id-'{0}'-not-found";
        public const string TagNotFound = "tag-with-id-'{0}'-not-found";
        public const string UserNotFound = "user-with-username-'{0}'-not-found";
        public const string TitleContentRequired = "title-and-content-are-required";
        public const string TitleContentUpdateRequired = "title-and-content-are-required-for-update";
        public const string NewCategoryNameEmpty = "new-category-name-cannot-be-empty";
        public const string CategoryNameEmpty = "category-name-cannot-be-empty";
        public const string CategoryAlreadyExists = "category-'{0}'-already-exists-or-could-not-be-created";
        public const string CategoryAlreadyExistsByName = "category-with-new-name-'{0}'-already-exists";
        public const string CategoryUpdateFailed = "category-'{0}'-not-found-or-could-not-be-updated";
        public const string CategoryDeleteFailed = "category-'{0}'-not-found-or-could-not-be-deleted";
        public const string TagUpdateFailed = "tag-'{0}'-not-found-or-could-not-be-updated";
        public const string TagDeleteFailed = "tag-'{0}'-not-found-or-could-not-be-deleted";
        public const string UserUpdateFailed = "user-'{0}'-not-found-or-could-not-be-updated";
        public const string UserDeleteFailed = "user-'{0}'-not-found-or-could-not-be-deleted";
        public const string TagExistsOrCreateFailed = "a-tag-with-this-name-already-exists-or-could-not-be-created";
        public const string UserExistsOrCreateFailed = "a-user-with-this-username-already-exists-or-could-not-be-created";
        public const string AnonymousUser = "anonymous";
        public const string PostNotFoundForComment = "post-not-found";
    }
}

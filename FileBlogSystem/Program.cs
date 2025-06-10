using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.Extensions.Options;


var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("config/site.json", optional: false, reloadOnChange: true);
builder.Services.Configure<SiteConfiguration>(builder.Configuration); 
builder.Services.AddSingleton<IContentService, FileContentService>();
builder.Services.AddEndpointsApiExplorer(); // Enables API explorer for Swagger
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseStaticFiles(new StaticFileOptions { /* ... */ });

// Configure the HTTP request pipeline for Swagger

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger(); // Enables Swagger middleware
    app.UseSwaggerUI(); // Enables Swagger UI (interactive documentation)
 
}
// No else block needed; if not dev, it won't use it.
app.UseHttpsRedirection(); // Recommended for API security

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "content")),
    RequestPath = "/content"
});

// --- Define API Endpoints ---

// Get all blog posts metadata (e.g., /api/posts)
app.MapGet("/api/posts", async (IContentService contentService) =>
{
    var posts = await contentService.GetAllBlogPostsMetaAsync();
    return Results.Ok(posts); // Returns 200 OK with JSON array of posts
})
.WithName("GetAllPosts")
.Produces<List<BlogPostMeta>>(StatusCodes.Status200OK); // Swagger/OpenAPI documentation

// Get a single blog post by slug (e.g., /api/posts/my-first-post)
app.MapGet("/api/posts/{slug}", async (string slug, IContentService contentService) =>
{
    var postMeta = await contentService.GetBlogPostMetaBySlugAsync(slug);
    if (postMeta == null)
    {
        return Results.NotFound($"Post with slug '{slug}' not found."); // Returns 404 Not Found
    }

    // Get content separately (since it's a different file)
    var content = await contentService.GetBlogPostContentAsync(postMeta.PostFolderPath!);
    if (content == null)
    {
        // This case ideally shouldn't happen if meta was found and path is valid,
        // but good for robustness.
        return Results.StatusCode(StatusCodes.Status500InternalServerError);
    }

    // Combine meta and content into a single anonymous object for the API response
    return Results.Ok(new
    {
        postMeta.Title,
        postMeta.Description,
        postMeta.PublishedDate,
        postMeta.ModificationDate,
        postMeta.Tags,
        postMeta.Categories,
        postMeta.CustomUrl,
        postMeta.Slug,
        Content = content // Add the actual Markdown content
    });
})
.WithName("GetPostBySlug")
.Produces<object>(StatusCodes.Status200OK) // Response for success
.Produces(StatusCodes.Status404NotFound)     // Response for not found
.Produces(StatusCodes.Status500InternalServerError); // Response for server error


// Get all categories (e.g., /api/categories)
app.MapGet("/api/categories", async (IContentService contentService) =>
{
    var categories = await contentService.GetAllCategoriesAsync();
    return Results.Ok(categories); // Returns 200 OK with JSON array of categories
})
.WithName("GetAllCategories")
.Produces<List<Category>>(StatusCodes.Status200OK); // Swagger/OpenAPI documentation

// Get all tags (e.g., /api/tags)
app.MapGet("/api/tags", async (IContentService contentService) =>
{
    var tags = await contentService.GetAllTagsAsync();
    return Results.Ok(tags); // Returns 200 OK with JSON array of tags
})
.WithName("GetAllTags")
.Produces<List<Tag>>(StatusCodes.Status200OK); // Swagger/OpenAPI documentation

// Get a user profile by username (e.g., /api/users/admin)
app.MapGet("/api/users/{username}", async (string username, IContentService contentService) =>
{
    var user = await contentService.GetUserByUsernameAsync(username);
    if (user == null)
    {
        return Results.NotFound($"User with username '{username}' not found."); // Returns 404 Not Found
    }
    return Results.Ok(user); // Returns 200 OK with JSON user object
})
.WithName("GetUserByUsername")
.Produces<User>(StatusCodes.Status200OK) // Response for success
.Produces(StatusCodes.Status404NotFound); // Response for not found
// --- End API Endpoints ---

app.Run();

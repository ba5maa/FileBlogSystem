using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt; 
using System.Text;
using System.Security.Claims; 
using FileBlogSystem.Security;
using Microsoft.AspNetCore.Mvc;

namespace FileBlogSystem.Endpoints
{
    public static class EndpointExtensions
    {
        public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
        {

            app.MapGet("/api/posts", async (IFileContentService contentService, [FromQuery] string? searchTerm, [FromQuery] string? tag, [FromQuery] string? category, [FromQuery] string? authorUsername, [FromQuery] bool? isDraft) =>
            {
                var postMetas = await contentService.GetAllBlogPostsMetaAsync();
                var posts = new List<object>();
                var filteredPosts = postMetas.AsEnumerable();

                if (isDraft == true && searchTerm == "scheduled")
                {
                    filteredPosts = filteredPosts.Where(p => p.ScheduledFor.HasValue && p.ScheduledFor.Value > DateTime.UtcNow);
                }

                if (isDraft.HasValue)
                {
                    filteredPosts = filteredPosts.Where(p => p.IsDraft == isDraft.Value);
                }
                else
                {
                    filteredPosts = filteredPosts.Where(p => !p.IsDraft);
                }

                if (!string.IsNullOrEmpty(authorUsername))
                {
                    filteredPosts = filteredPosts.Where(p => p.AuthorUsername.Equals(authorUsername, StringComparison.OrdinalIgnoreCase));
                }


                if (!string.IsNullOrEmpty(searchTerm))
                {
                    var lowerSearchTerm = searchTerm.ToLowerInvariant();
                    filteredPosts = filteredPosts.Where(p =>
                        p.Title.ToLowerInvariant().Contains(lowerSearchTerm) ||
                        p.Description.ToLowerInvariant().Contains(lowerSearchTerm) ||
                        p.Content?.ToLowerInvariant().Contains(lowerSearchTerm) == true ||
                        p.AuthorUsername.ToLowerInvariant().Contains(lowerSearchTerm));
                }

                if (!string.IsNullOrEmpty(tag) && Guid.TryParse(tag, out Guid tagId))
                {
                    filteredPosts = filteredPosts.Where(p => p.Tags != null && p.Tags.Contains(tagId));
                }

                // if (!string.IsNullOrEmpty(category))
                // {
                //     var lowerCategory = category.ToLowerInvariant();
                //     filteredPosts = filteredPosts.Where(p => p.Categories != null && p.Categories.Any(c => c.ToLowerInvariant() == lowerCategory));
                // }

                foreach (var meta in filteredPosts)
                {
                    var content = await contentService.GetBlogPostContentAsync(meta.PostFolderPath!);
                    posts.Add(new
                    {
                        meta.Id,
                        meta.Title,
                        meta.Description,
                        meta.CreationDate,
                        meta.PublishedDate,
                        meta.ModificationDate,
                        meta.Tags,
                        meta.Categories,
                        meta.CustomUrl,
                        meta.Slug,
                        meta.AuthorUsername,
                        meta.IsDraft,
                        meta.ImageUrl,
                        Content = content ?? ""
                    });
                }
                return Results.Ok(posts);
            })
            .RequireAuthorization()
            .WithName("GetAllPosts")
            .Produces<List<BlogPostMetaResponse>>(StatusCodes.Status200OK);

            app.MapGet("/api/posts/{slug}", async (string slug, IFileContentService contentService) =>
            {
                var postMeta = await contentService.GetBlogPostMetaBySlugAsync(slug);
                if (postMeta == null)
                {
                    return Results.NotFound($"post-with-slug-'{slug}'-not-found");
                }

                var content = await contentService.GetBlogPostContentAsync(postMeta.PostFolderPath!);
                if (content == null)
                {
                    return Results.StatusCode(StatusCodes.Status500InternalServerError);
                }

                return Results.Ok(new
                {
                    postMeta.Title,
                    postMeta.Description,
                    postMeta.PublishedDate,
                    postMeta.CreationDate,
                    postMeta.AuthorUsername,
                    postMeta.ModificationDate,
                    postMeta.Tags,
                    postMeta.Categories,
                    postMeta.CustomUrl,
                    postMeta.ImageUrl,
                    postMeta.Slug,
                    Content = content
                });
            })
            .RequireAuthorization()
            .WithName("GetPostBySlug")
            .Produces<object>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);


            app.MapGet("/api/categories", async (IFileContentService contentService) =>
            {
                var categories = await contentService.GetAllCategoriesAsync();
                return Results.Ok(categories);
            })
            .WithName("GetAllCategories")
            .Produces<List<CategoryResponse>>(StatusCodes.Status200OK);

            app.MapGet("/api/categories/{id:guid}", async (Guid id, IFileContentService contentService) =>
            {
                var categories = await contentService.GetAllCategoriesAsync();
                var category = categories.FirstOrDefault(c => c.Id == id);
                if (category == null)
                {
                    return Results.NotFound($"category-with-id-'{id}'-not-found");
                }
                return Results.Ok(category);
            })
            .WithName("GetCategoryById")
            .WithOpenApi();

            app.MapGet("/api/tags", async (IFileContentService contentService) =>
            {
                var tags = await contentService.GetAllTagsAsync();
                return Results.Ok(tags);
            })
            .WithName("GetAllTags")
            .Produces<List<TagResponse>>(StatusCodes.Status200OK);

            app.MapGet("/api/tags/{id:guid}", async (Guid id, IFileContentService contentService) => // Change to Guid id
            {
                var tags = await contentService.GetAllTagsAsync();
                var tag = tags.FirstOrDefault(t => t.Id == id);
                if (tag == null)
                {
                    return Results.NotFound($"tag-with-id-'{id}'-not-found");
                }
                return Results.Ok(tag);
            })
            .WithName("GetTagById")
            .WithOpenApi();

            app.MapGet("/api/users/{username}", async (string username, IFileContentService contentService) =>
            {
                var user = await contentService.GetUserByUsernameAsync(username);
                if (user == null)
                {
                    return Results.NotFound($"user-with-username-'{username}'-not-found");
                }
                return Results.Ok(user);
            })
            .RequireAuthorization()
            .WithName("GetUserByUsername")
            .Produces<UserResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);


            app.MapPost("/api/auth/login", async (LoginRequest request, IFileContentService contentService, IConfiguration config) =>
            {
                Console.WriteLine($"Login attempt for username: {request.Username}");
                Console.WriteLine($"Received password (plaintext, for debug only): {request.Password}");

                var user = await contentService.GetUserByUsernameAsync(request.Username);
                if (user == null)
                {
                    return Results.Unauthorized();
                }

                Console.WriteLine($"User found: {user.Username}. Stored hash: {user.HashedPassword}");

                if (!PasswordHasher.VerifyPassword(request.Password, user.HashedPassword))
                {
                    return Results.Unauthorized();
                }

                Console.WriteLine($"Login successful for user: {user.Username}. Generating token...");

                var jwtSecret = config["Jwt:Key"];
                var issuer = config["Jwt:Issuer"];
                var audience = config["Jwt:Audience"];

                if (string.IsNullOrEmpty(jwtSecret) || string.IsNullOrEmpty(issuer) || string.IsNullOrEmpty(audience))
                {
                    return Results.StatusCode(StatusCodes.Status500InternalServerError);
                }

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Username),
                    new Claim(ClaimTypes.Name, user.Username)

                };
                foreach (var role in user.Roles)
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }

                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
                var expires = DateTime.UtcNow.AddHours(1);

                var token = new JwtSecurityToken(
                    issuer: issuer,
                    audience: audience,
                    claims: claims,
                    expires: expires,
                    signingCredentials: creds
                );

                return Results.Ok(new
                {
                    Token = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token),
                    Expires = expires,
                    User = new { user.Username, user.Email, user.Roles }
                });
            })
            .WithName("Login")
            .Produces<object>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .Accepts<LoginRequest>("application/json");


            app.MapGet("/api/protected", (ClaimsPrincipal user) =>
            {
                return Results.Ok($"hello,-{user.Identity?.Name}-!-you-are-authenticated");
            })
            .RequireAuthorization()
            .WithName("GetProtectedData")
            .Produces<string>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);


            app.MapGet("/api/admin/info", (ClaimsPrincipal user) =>
            {
                return Results.Ok($"welcome-admin-{user.Identity?.Name}-!-You-have-access-to-admin-info");
            })
            .RequireAuthorization(policyBuilder => policyBuilder.RequireRole("Admin"))
            .WithName("GetAdminInfo")
            .Produces<string>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);

            app.MapPost("/api/posts", async (CreateBlogPostRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole("Admin") && !user.IsInRole("Author"))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Content))
                {
                    return Results.BadRequest("title-and-content-are-required");
                }

                var newPostMeta = await contentService.CreateBlogPostAsync(request);

                if (newPostMeta == null)
                {
                    return Results.StatusCode(StatusCodes.Status500InternalServerError);
                }

                return Results.CreatedAtRoute("GetPostBySlug", new { slug = newPostMeta.Slug }, newPostMeta);
            })
            .RequireAuthorization()
            .WithName("CreateBlogPost")
            .Produces<BlogPostMetaResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<CreateBlogPostRequest>("application/json");

            app.MapPut("/api/posts/{slug}", async (string slug, UpdateBlogPostRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole("Admin") && !user.IsInRole("Author"))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Content))
                {
                    return Results.BadRequest("title-and-content-are-required-for-update");
                }

                var updatedPostMeta = await contentService.UpdateBlogPostAsync(slug, request);

                if (updatedPostMeta == null)
                {

                    return Results.NotFound($"blog-post-with-slug-'{slug}'-not-found-or-could-not-be-updated.");
                }

                return Results.Ok(updatedPostMeta);
            })
            .RequireAuthorization()
            .WithName("UpdateBlogPost")
            .Produces<BlogPostMetaResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<UpdateBlogPostRequest>("application/json");

            app.MapDelete("/api/posts/{slug}", async (string slug, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole("Admin"))
                {
                    return Results.Forbid();
                }

                var deleted = await contentService.DeleteBlogPostAsync(slug);

                if (!deleted)
                {
                    return Results.NotFound($"blog-post-with-slug-'{slug}'-not-found-or-could-not-be-deleted");
                }

                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName("DeleteBlogPost")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);

            app.MapPost("/api/categories", async (CreateCategoryRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole("Admin") && !user.IsInRole("Author"))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return Results.BadRequest("category-name-cannot-be-empty");
                }

                var newCategory = await contentService.CreateCategoryAsync(request);

                if (newCategory == null)
                {
                    return Results.Conflict($"category-'{request.Name}'-already-exists-or-could-not-be-created");
                }

                return Results.CreatedAtRoute("GetAllCategories", new { }, newCategory);
            })
            .RequireAuthorization()
            .WithName("CreateCategory")
            .Produces<CategoryResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<CreateCategoryRequest>("application/json");

            app.MapPut("/api/categories", async ( UpdateCategoryRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole("Admin") && !user.IsInRole("Author"))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrWhiteSpace(request.NewName))
                {
                    return Results.BadRequest("new-category-name-cannot-be-empty");
                }

                var updatedCategory = await contentService.UpdateCategoryAsync(request.Id, request);

                if (updatedCategory == null)
                {
                    var categories = await contentService.GetAllCategoriesAsync();
                    if (categories.Any(c => c.Name.Equals(request.NewName, StringComparison.OrdinalIgnoreCase)))
                    {
                        return Results.Conflict($"category-with-new-name-'{request.NewName}'-already-exists");
                    }
                    return Results.NotFound($"category-'{request.Id}'-not-found-or-could-not-be-updated");
                }

                return Results.Ok(updatedCategory);
            })
            .RequireAuthorization()
            .WithName("UpdateCategory")
            .Produces<CategoryResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<UpdateCategoryRequest>("application/json");

            app.MapDelete("/api/categories/{id:guid}", async (Guid id, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole("Admin"))
                {
                    return Results.Forbid();
                }

                var deleted = await contentService.DeleteCategoryAsync(id);

                if (!deleted)
                {
                    return Results.NotFound($"category-'{id}'-not-found-or-could-not-be-deleted");
                }

                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName("DeleteCategory")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);



            app.MapPost("/api/tags", async (CreateTagRequest request, IFileContentService contentService) =>
            {
                var tag = await contentService.CreateTagAsync(request);
                if (tag == null)
                {
                    return Results.Conflict("a-tag-with-this-name-already-exists-or-could-not-be-created");
                }
                return Results.CreatedAtRoute("GetAllTags", new { }, tag);
            })
            .WithName("CreateTag")
            .WithOpenApi();

            app.MapPut("/api/tags", async ( UpdateTagRequest request, IFileContentService contentService) =>
            {
                var updatedTag = await contentService.UpdateTagAsync(request.Id, request);
                if (updatedTag == null)
                {
                    return Results.NotFound($"tag-'{request.Id}'-not-found-or-could-not-be-updated");
                }
                return Results.Ok(updatedTag);
            })
            .RequireAuthorization()
            .WithName("UpdateTag")
            .WithOpenApi();

            app.MapDelete("/api/tags/{id:guid}", async (Guid id, IFileContentService contentService) =>
            {
                var success = await contentService.DeleteTagAsync(id);
                if (!success)
                {
                    return Results.NotFound($"tag-'{id}'-not-found-or-could-not-be-deleted");
                }
                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName("DeleteTag")
            .WithOpenApi();

            app.MapGet("/api/users", async (IFileContentService contentService) =>
            {
                var users = await contentService.GetAllUsersAsync();
                return Results.Ok(users);
            })
            .RequireAuthorization()
            .WithName("GetAllUsers")
            .WithOpenApi();


            app.MapPost("/api/users", async (CreateUserRequest request, IFileContentService contentService) =>
            {
                var user = await contentService.CreateUserAsync(request);
                if (user == null)
                {
                    return Results.Conflict("a-user-with-this-username-already-exists-or-could-not-be-created");
                }
                return Results.CreatedAtRoute("GetUserByUsername", new { username = user.Username }, user);
            })
            .RequireAuthorization()
            .WithName("CreateUser")
            .WithOpenApi();

            app.MapPut("/api/users/{username}", async (string username, UpdateUserRequest request, IFileContentService contentService) =>
            {
                var updatedUser = await contentService.UpdateUserAsync(username, request);
                if (updatedUser == null)
                {
                    return Results.NotFound($"user-'{username}'-not-found-or-could-not-be-updated");
                }
                return Results.Ok(updatedUser);
            })
            .RequireAuthorization()
            .WithName("UpdateUser")
            .WithOpenApi();

            app.MapDelete("/api/users/{username}", async (string username, IFileContentService contentService) =>
            {
                var success = await contentService.DeleteUserAsync(username);
                if (!success)
                {
                    return Results.NotFound($"user-'{username}'-not-found-or-could-not-be-deleted");
                }
                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName("DeleteUser")
            .WithOpenApi();


            return app;
        }
    }
}
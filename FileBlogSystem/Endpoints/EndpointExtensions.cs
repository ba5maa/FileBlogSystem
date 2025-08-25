using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt; 
using System.Text;
using System.Security.Claims; 
using FileBlogSystem.Security;
using Microsoft.AspNetCore.Mvc;
using FileBlogSystem.Constants;
using static System.Net.Mime.MediaTypeNames;
using ImgSharpImage = SixLabors.ImageSharp.Image;
using SixLabors.ImageSharp;             
using SixLabors.ImageSharp.Processing; 

namespace FileBlogSystem.Endpoints
{
    public static class EndpointExtensions
    {
        public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
        {

            app.MapGet("/api/posts", async (IFileContentService contentService, ILuceneSearchService search, [FromQuery] string? searchTerm, [FromQuery] string? tag, [FromQuery] string? category, [FromQuery] string? authorUsername, [FromQuery] bool? isDraft) =>
            {
                var postMetas = await contentService.GetAllBlogPostsMetaAsync();
                var posts = new List<object>();
                var filteredPosts = postMetas.AsQueryable();

                if (isDraft == true && searchTerm == EndpointConstants.Scheduled)
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
                    filteredPosts = filteredPosts.Where(p => p.AuthorUsername.ToLower() == authorUsername.ToLower());
                }

                //  if (!string.IsNullOrEmpty(searchTerm))
                //  {
                //      var lowerSearchTerm = searchTerm.ToLowerInvariant();
                //      filteredPosts = filteredPosts.ToList().Where(p =>
                //      (p.Title?.ToLowerInvariant().Contains(lowerSearchTerm) ?? false) ||
                //      (p.Description?.ToLowerInvariant().Contains(lowerSearchTerm) ?? false) ||
                //      (p.Content?.ToLowerInvariant().Contains(lowerSearchTerm) ?? false) ||
                //      (p.AuthorUsername?.ToLowerInvariant().Contains(lowerSearchTerm) ?? false))
                //      .AsQueryable();
                //  }

                if (!string.IsNullOrEmpty(tag) && Guid.TryParse(tag, out Guid tagId))
                {
                    filteredPosts = filteredPosts.Where(p => p.Tags != null && p.Tags.Contains(tagId));
                }
                
                 if (!string.IsNullOrWhiteSpace(searchTerm))
                  {
                    Console.WriteLine($"before search.searchSlugsAsync: {searchTerm}");
                      var slugs = await search.SearchSlugsAsync(searchTerm, limit: 100);
                      Console.WriteLine($"after search.searchSlugsAsync: {searchTerm}");
                      var slugSet = new HashSet<string>(slugs, StringComparer.OrdinalIgnoreCase);
                      filteredPosts = filteredPosts.Where(p => p.Slug != null && slugSet.Contains(p.Slug));
                      var bySlugOrder = slugs.Select((s, i) => (s, i)).ToDictionary(x => x.s, x => x.i, StringComparer.OrdinalIgnoreCase);
                      filteredPosts = filteredPosts.OrderBy(p =>
                        p.Slug != null && bySlugOrder.ContainsKey(p.Slug)
                            ? bySlugOrder[p.Slug]
                            : int.MaxValue);
                  }
             

                foreach (var meta in filteredPosts)
                {
                    if (string.IsNullOrEmpty(meta.PostFolderPath))
                    {
                        continue;
                    }

                    var author = await contentService.GetUserByUsernameAsync(meta.AuthorUsername);
                    if (author == null || author.IsActive == false)
                    {
                        continue;
                    }

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
                        Content = content ?? "",
                        meta.ScheduledFor,
                        meta.LikedByUsers,
                        LikeCount = meta.LikedByUsers?.Count ?? 0
                    });
                }
                return Results.Ok(posts);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetAllPosts)
            .Produces<List<BlogPostMetaResponse>>(StatusCodes.Status200OK);

            app.MapGet("/api/post/{slug}", async (string slug, IFileContentService contentService) =>
            {
                var postMeta = await contentService.GetBlogPostMetaBySlugAsync(slug);
                if (postMeta == null)
                {
                    return Results.NotFound(string.Format(EndpointConstants.PostNotFoundWithSlug, slug));
                }

                var content = await contentService.GetBlogPostContentAsync(postMeta.PostFolderPath!);
                if (content == null)
                {
                    return Results.StatusCode(StatusCodes.Status500InternalServerError);
                }

                return Results.Ok(new
                {
                    postMeta.Id,
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
                    postMeta.ScheduledFor,
                    postMeta.Slug,
                    Content = content,
                    postMeta.LikedByUsers,
                    LikeCount = postMeta.LikedByUsers?.Count ?? 0
                });
            })
            //.RequireAuthorization()
            .AllowAnonymous()
            .WithName(EndpointConstants.GetPostBySlug)
            .Produces<object>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);

            app.MapGet("/api/categories", async (IFileContentService contentService) =>
            {
                var categories = await contentService.GetAllCategoriesAsync();
                return Results.Ok(categories);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetAllCategories)
            .Produces<List<CategoryResponse>>(StatusCodes.Status200OK);

            app.MapGet("/api/category/{id:guid}", async (Guid id, IFileContentService contentService) =>
            {
                var category = await contentService.GetCategoryByIdAsync(id);
                if (category == null)
                {
                    return Results.NotFound(string.Format(EndpointConstants.CategoryNotFound, id));
                }
                return Results.Ok(category);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetCategoryById)
            .WithOpenApi();

            app.MapGet("/api/tags", async (IFileContentService contentService) =>
            {
                var tags = await contentService.GetAllTagsAsync();
                return Results.Ok(tags);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetAllTags)
            .Produces<List<TagResponse>>(StatusCodes.Status200OK);

            app.MapGet("/api/tag/{id:guid}", async (Guid id, IFileContentService contentService) =>
            {
                var tag = await contentService.GetTagByIdAsync(id);
                if (tag == null)
                {
                    return Results.NotFound(string.Format(EndpointConstants.TagNotFound, id));
                }
                return Results.Ok(tag);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetTagById)
            .WithOpenApi();

            app.MapGet("/api/user/{username}", async (string username, IFileContentService contentService) =>
            {
                var user = await contentService.GetUserByUsernameAsync(username);
                if (user == null)
                {
                    return Results.NotFound(string.Format(EndpointConstants.UserNotFound, username));
                }
                return Results.Ok(user);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetUserByUsername)
            .Produces<UserResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

            app.MapPost("/api/auth/login", async (LoginRequest request, IFileContentService contentService, IConfiguration config) =>
            {
                Console.WriteLine($"Login attempt for username: {request.Username}");
                Console.WriteLine($"Received password (plaintext, for debug only): {request.Password}");

                var user = await contentService.GetUserByUsernameAsync(request.Username);
                if (user == null)
                {
                    return Results.Json(new { message = string.Format(EndpointConstants.InvalidUsernameOrPassword) }, statusCode: 401);
                }

                Console.WriteLine($"User found: {user.Username}. Stored hash: {user.HashedPassword}");

                if (!PasswordHasher.VerifyPassword(request.Password, user.HashedPassword))
                {
                    return Results.Json(new { message = string.Format(EndpointConstants.InvalidUsernameOrPassword) }, statusCode: 401);
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

                if (user.Roles != null)
                {
                    foreach (var role in user.Roles)
                    {
                        claims.Add(new Claim(ClaimTypes.Role, role));
                    }
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
            .WithName(EndpointConstants.Login)
            .Produces<object>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .Accepts<LoginRequest>("application/json");


            app.MapGet("/api/protected", (ClaimsPrincipal user) =>
            {
                return Results.Ok($"hello,-{user.Identity?.Name}-!-you-are-authenticated");
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.GetProtectedData)
            .Produces<string>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);


            app.MapGet("/api/admin/info", (ClaimsPrincipal user) =>
            {
                return Results.Ok($"welcome-admin-{user.Identity?.Name}-!-You-have-access-to-admin-info");
            })
            .RequireAuthorization(policyBuilder => policyBuilder.RequireRole(EndpointConstants.Admin))
            .WithName(EndpointConstants.GetAdminInfo)
            .Produces<string>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);

            app.MapPost("/api/post", async (CreateBlogPostRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole(EndpointConstants.Admin) && !user.IsInRole(EndpointConstants.Author))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Content))
                {
                    return Results.BadRequest(string.Format(EndpointConstants.TitleContentRequired));
                }

                var newPostMeta = await contentService.CreateBlogPostAsync(request);

                if (newPostMeta == null)
                {
                    return Results.StatusCode(StatusCodes.Status500InternalServerError);
                }

                return Results.CreatedAtRoute(EndpointConstants.GetPostBySlug, new { slug = newPostMeta.Slug }, newPostMeta);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.CreateBlogPost)
            .Produces<BlogPostMetaResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<CreateBlogPostRequest>("application/json");

            app.MapPut("/api/update-post/{slug}", async (string slug, UpdateBlogPostRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole(EndpointConstants.Admin) && !user.IsInRole(EndpointConstants.Author))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Content))
                {
                    return Results.BadRequest(string.Format(EndpointConstants.TitleContentUpdateRequired));
                }

                var updatedPostMeta = await contentService.UpdateBlogPostAsync(slug, request);

                if (updatedPostMeta == null)
                {

                    return Results.NotFound(string.Format(EndpointConstants.PostNotFound, slug));
                }

                return Results.Ok(updatedPostMeta);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.UpdateBlogPost)
            .Produces<BlogPostMetaResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<UpdateBlogPostRequest>("application/json");

            app.MapDelete("/api/delete-post/{slug}", async (string slug, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole(EndpointConstants.Admin))
                {
                    return Results.Forbid();
                }

                var deleted = await contentService.DeleteBlogPostAsync(slug);

                if (!deleted)
                {
                    return Results.NotFound(string.Format(EndpointConstants.PostNotFound, slug));
                }

                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.DeleteBlogPost)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);

            app.MapPost("/api/category", async (CreateCategoryRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole(EndpointConstants.Admin) && !user.IsInRole(EndpointConstants.Author))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return Results.BadRequest(string.Format(EndpointConstants.CategoryNameEmpty));
                }

                var newCategory = await contentService.CreateCategoryAsync(request);

                if (newCategory == null)
                {
                    return Results.Conflict(string.Format(EndpointConstants.CategoryAlreadyExists, request.Name));
                }

                return Results.CreatedAtRoute(EndpointConstants.GetAllCategories, new { }, newCategory);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.CreateCategory)
            .Produces<CategoryResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<CreateCategoryRequest>("application/json");

            app.MapPut("/api/update-category", async ( UpdateCategoryRequest request, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole(EndpointConstants.Admin) && !user.IsInRole(EndpointConstants.Author))
                {
                    return Results.Forbid();
                }

                if (string.IsNullOrWhiteSpace(request.NewName))
                {
                    return Results.BadRequest(string.Format(EndpointConstants.NewCategoryNameEmpty));
                }

                var updatedCategory = await contentService.UpdateCategoryAsync(request.Id, request);

                if (updatedCategory == null)
                {
                    var categories = await contentService.GetAllCategoriesAsync();
                    if (categories.Any(c => c.Name.Equals(request.NewName, StringComparison.OrdinalIgnoreCase)))
                    {
                        return Results.Conflict(string.Format(EndpointConstants.CategoryAlreadyExistsByName, request.NewName));
                    }
                    return Results.NotFound(string.Format(EndpointConstants.CategoryUpdateFailed, request.Id));
                }

                return Results.Ok(updatedCategory);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.UpdateCategory)
            .Produces<CategoryResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status500InternalServerError)
            .Accepts<UpdateCategoryRequest>("application/json");

            app.MapDelete("/api/delete-category/{id:guid}", async (Guid id, IFileContentService contentService, ClaimsPrincipal user) =>
            {
                if (!user.IsInRole(EndpointConstants.Admin))
                {
                    return Results.Forbid();
                }

                var deleted = await contentService.DeleteCategoryAsync(id);

                if (!deleted)
                {
                    return Results.NotFound(string.Format(EndpointConstants.CategoryDeleteFailed, id));
                }

                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.DeleteCategory)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);

            app.MapPost("/api/tag", async (CreateTagRequest request, IFileContentService contentService) =>
            {
                var tag = await contentService.CreateTagAsync(request);
                if (tag == null)
                {
                    return Results.Conflict(string.Format(EndpointConstants.TagExistsOrCreateFailed));
                }
                return Results.CreatedAtRoute(EndpointConstants.GetAllTags, new { }, tag);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.CreateTag)
            .WithOpenApi();

            app.MapPut("/api/update-tag", async ( UpdateTagRequest request, IFileContentService contentService) =>
            {
                var updatedTag = await contentService.UpdateTagAsync(request.Id, request);
                if (updatedTag == null)
                {
                    return Results.NotFound(string.Format(EndpointConstants.TagUpdateFailed, request.Id));
                }
                return Results.Ok(updatedTag);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.UpdateTag)
            .WithOpenApi();

            app.MapDelete("/api/delete-tag/{id:guid}", async (Guid id, IFileContentService contentService) =>
            {
                var success = await contentService.DeleteTagAsync(id);
                if (!success)
                {
                    return Results.NotFound(string.Format(EndpointConstants.TagDeleteFailed, id));
                }
                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.DeleteTag)
            .WithOpenApi();

            app.MapGet("/api/users", async (IFileContentService contentService) =>
            {
                var users = await contentService.GetAllUsersAsync();
                return Results.Ok(users);
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.GetAllUsers)
            .WithOpenApi();

            app.MapPost("/api/user", async (CreateUserRequest request, IFileContentService contentService) =>
            {
                var user = await contentService.CreateUserAsync(request);
                if (user == null)
                {
                    return Results.Conflict(string.Format(EndpointConstants.UserExistsOrCreateFailed));
                }
                return Results.CreatedAtRoute(EndpointConstants.GetUserByUsername, new { username = user.Username }, user);
            })
            .WithName(EndpointConstants.CreateUser)
            .WithOpenApi();

            app.MapPut("/api/update-user/{username}", async (string username, UpdateUserRequest request, IFileContentService contentService) =>
            {
                 if (!string.IsNullOrEmpty(request.HashedPassword))
                {
                    request.HashedPassword = PasswordHasher.HashPassword(request.HashedPassword);
                }

                var updatedUser = await contentService.UpdateUserAsync(username, request);
                if (updatedUser == null)
                {
                    return Results.NotFound(string.Format(EndpointConstants.UserUpdateFailed, username));
                }

                return Results.Ok(updatedUser);
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.UpdateUser)
            .WithOpenApi();

            app.MapDelete("/api/delete-user/{username}", async (string username, IFileContentService contentService) =>
            {
                var success = await contentService.DeleteUserAsync(username);
                if (!success)
                {
                    return Results.NotFound(string.Format(EndpointConstants.UserDeleteFailed, username));
                }
                return Results.NoContent();
            })
            .RequireAuthorization()
            .WithName(EndpointConstants.DeleteUser)
            .WithOpenApi();

          app.MapPost("/api/post/{postId}/like", async (Guid postId, ClaimsPrincipal user, IFileContentService contentService) =>
          {
              var username = user.Identity?.Name;
              if (string.IsNullOrEmpty(username)) return Results.Unauthorized();
          
              var post = await contentService.GetBlogPostMetaByIdAsync(postId);
              if (post == null) return Results.NotFound(string.Format(EndpointConstants.PostNotFound, postId));

              if (post.LikedByUsers == null)
              {
                  post.LikedByUsers = new List<string>();
              }

              if (!post.LikedByUsers.Contains(username))
              {
                  post.LikedByUsers.Add(username);
              }
          
              var updated = await contentService.SaveUpdatedMetaAsync(post);
              return updated ? Results.Ok(new { likedBy = post.LikedByUsers }) : Results.StatusCode(500);
          })
          .RequireAuthorization()
          .WithName(EndpointConstants.LikePost);

          app.MapPost("/api/post/{postId}/unlike", async (Guid postId, ClaimsPrincipal user, IFileContentService contentService) =>
          {
              var username = user.Identity?.Name;
              if (string.IsNullOrEmpty(username)) return Results.Unauthorized();
          
              var post = await contentService.GetBlogPostMetaByIdAsync(postId);
              if (post == null) return Results.NotFound(string.Format(EndpointConstants.PostNotFound, postId));

              if (post.LikedByUsers.Contains(username))
              {
                  post.LikedByUsers.Remove(username);
              }
          
              var updated = await contentService.SaveUpdatedMetaAsync(post);
              return updated ? Results.Ok(new { likedBy = post.LikedByUsers }) : Results.StatusCode(500);
          })
          .RequireAuthorization()
          .WithName(EndpointConstants.UnlikePost);

          app.MapGet("/api/post/{slug}/comments", async (string slug, IFileContentService contentService) =>
           {
               
               var comments = await contentService.GetCommentsAsync(slug);
               return Results.Ok(comments);
           })
           //.RequireAuthorization()
           .WithName(EndpointConstants.GetCommentsForPost)
           .Produces<List<CommentModel>>(StatusCodes.Status200OK);
                       
            app.MapPost("/api/post/{slug}/comment", async (string slug, CommentModel input, ClaimsPrincipal user, IFileContentService contentService) =>
            {
                input.Username = user.Identity?.Name ?? EndpointConstants.AnonymousUser;
                input.CreatedAt = DateTime.UtcNow;
            
                var success = await contentService.AddCommentAsync(slug, input);
                return success ? Results.Ok(input) : Results.NotFound(string.Format(EndpointConstants.PostNotFound, slug));
            })
            //.RequireAuthorization()
            .WithName(EndpointConstants.AddComment)
            .Produces<CommentModel>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

            _ = app.MapGet("/api/image", async (HttpContext context, string path, int width, int height) =>
            {
                var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
                
                // Normalize path by removing leading slash and any content prefix
                var normalizedPath = path.TrimStart('/');
                if (normalizedPath.StartsWith("Content/", StringComparison.OrdinalIgnoreCase))
                {
                    normalizedPath = normalizedPath.Substring(8);
                }

                // Always look under the Content directory
                var fullPath = Path.Combine(env.ContentRootPath, "Content", normalizedPath);
                
                if (!File.Exists(fullPath))
                {
                    return Results.NotFound($"Image not found at {fullPath}");
                }

                try
                {
                    using ImgSharpImage image = await ImgSharpImage.LoadAsync(fullPath);

                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Size = new Size(width, height),
                        Mode = ResizeMode.Crop
                    }));

                    var ms = new MemoryStream();
                    await image.SaveAsJpegAsync(ms);
                    ms.Seek(0, SeekOrigin.Begin);

                    return Results.File(ms, "image/jpeg");
                }
                catch (Exception ex)
                {
                    return Results.Problem($"Failed to process image: {ex.Message}");
                }
            });

            app.MapPost("/api/post/{slug}/upload-image", async (string slug, HttpRequest request, IFileContentService contentService) =>
             {
                 var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
                 var postFolderName = $"{today}-{slug}";
                 var postFolderPath = Path.Combine("Content", "Posts", postFolderName);
             
                 var assetsPath = Path.Combine(postFolderPath, "assets");
                 Directory.CreateDirectory(assetsPath); 
             
                 var file = request.Form.Files["image"];
                 if (file == null || file.Length == 0)
                     return Results.BadRequest("No image uploaded.");
             
                 var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                 var fullPath = Path.Combine(assetsPath, fileName);
             
                 using var stream = new FileStream(fullPath, FileMode.Create);
                 await file.CopyToAsync(stream);
             
                 var relativeUrl = $"/Content/Posts/{postFolderName}/assets/{fileName}";
                 return Results.Ok(new { imageUrl = relativeUrl });
             });
             
            

            return app;
        }
    }
}
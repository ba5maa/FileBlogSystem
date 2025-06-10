using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt; 
using System.Text;
using System.Security.Claims; 
using FileBlogSystem.Security; // for PasswordHasher
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;


var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("config/site.json", optional: false, reloadOnChange: true);
builder.Services.Configure<SiteConfiguration>(builder.Configuration); 
builder.Services.AddSingleton<IContentService, FileContentService>();
builder.Services.AddEndpointsApiExplorer(); //for Swagger
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] { }
        }
    });
});

// --- JWT Authentication Configuration ---
var jwtSecret = builder.Configuration["Jwt:Key"] ?? Guid.NewGuid().ToString();
var issuer = builder.Configuration["Jwt:Issuer"] ?? "FileBlogSystem";
var audience = builder.Configuration["Jwt:Audience"] ?? "FileBlogSystemUsers";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };
});

builder.Services.AddAuthorization(); 

// --- End JWT Authentication Configuration ---

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger(); // Enables Swagger 
    app.UseSwaggerUI(); // Enables Swagger UI 
 
}

app.UseHttpsRedirection(); 

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "content")),
    RequestPath = "/content"
});

// --- Define API Endpoints ---

// Get all blog posts metadata
app.MapGet("/api/posts", async (IContentService contentService) =>
{
    var posts = await contentService.GetAllBlogPostsMetaAsync();
    return Results.Ok(posts); // Returns 200 OK with JSON array of posts
})
.WithName("GetAllPosts")
.Produces<List<BlogPostMeta>>(StatusCodes.Status200OK);

// Get a single blog post by slug
app.MapGet("/api/posts/{slug}", async (string slug, IContentService contentService) =>
{
    var postMeta = await contentService.GetBlogPostMetaBySlugAsync(slug);
    if (postMeta == null)
    {
        return Results.NotFound($"Post with slug '{slug}' not found."); // Returns 404 Not Found
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
        postMeta.ModificationDate,
        postMeta.Tags,
        postMeta.Categories,
        postMeta.CustomUrl,
        postMeta.Slug,
        Content = content 
    });
})
.WithName("GetPostBySlug")
.Produces<object>(StatusCodes.Status200OK) // success
.Produces(StatusCodes.Status404NotFound)     //not found
.Produces(StatusCodes.Status500InternalServerError); //server error


// Get all categories
app.MapGet("/api/categories", async (IContentService contentService) =>
{
    var categories = await contentService.GetAllCategoriesAsync();
    return Results.Ok(categories); 
})
.WithName("GetAllCategories")
.Produces<List<Category>>(StatusCodes.Status200OK);

// Get all tags
app.MapGet("/api/tags", async (IContentService contentService) =>
{
    var tags = await contentService.GetAllTagsAsync();
    return Results.Ok(tags); 
})
.WithName("GetAllTags")
.Produces<List<Tag>>(StatusCodes.Status200OK); 

// Get a user profile by username 
app.MapGet("/api/users/{username}", async (string username, IContentService contentService) =>
{
    var user = await contentService.GetUserByUsernameAsync(username);
    if (user == null)
    {
        return Results.NotFound($"User with username '{username}' not found."); 
    }
    return Results.Ok(user); 
})
.WithName("GetUserByUsername")
.Produces<User>(StatusCodes.Status200OK) 
.Produces(StatusCodes.Status404NotFound); 

// --- Authentication Endpoints ---

app.MapPost("/api/auth/login", async (LoginRequest request, IContentService contentService, IConfiguration config) =>
{
    var user = await contentService.GetUserByUsernameAsync(request.Username);
    if (user == null)
    {
        return Results.Unauthorized(); 
    }

    // verify password
    if (!PasswordHasher.VerifyPassword(request.Password, user.HashedPassword))
    {
        return Results.Unauthorized();
    }

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
    var expires = DateTime.UtcNow.AddHours(1); // Token valid for 1 hour

    var token = new JwtSecurityToken(
        issuer: issuer,
        audience: audience,
        claims: claims,
        expires: expires,
        signingCredentials: creds
    );

    return Results.Ok(new { Token = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token), Expires = expires });
})
.WithName("Login")
.Produces<object>(StatusCodes.Status200OK) 
.Produces(StatusCodes.Status401Unauthorized) 
.Accepts<LoginRequest>("application/json"); 


// --- Protected Endpoints ---

// Endpoint requiring authentication (any valid token)
app.MapGet("/api/protected", (ClaimsPrincipal user) =>
{
    return Results.Ok($"Hello, {user.Identity?.Name}! You are authenticated.");
})
.RequireAuthorization() //Requires authentication
.WithName("GetProtectedData")
.Produces<string>(StatusCodes.Status200OK)
.Produces(StatusCodes.Status401Unauthorized); 

// Endpoint requiring a specific role
app.MapGet("/api/admin/info", (ClaimsPrincipal user) =>
{
    return Results.Ok($"Welcome, Admin {user.Identity?.Name}! You have access to admin info.");
})
.RequireAuthorization(policyBuilder => policyBuilder.RequireRole("Admin")) // Requires 'Admin' role
.WithName("GetAdminInfo")
.Produces<string>(StatusCodes.Status200OK)
.Produces(StatusCodes.Status401Unauthorized) // Not authenticated
.Produces(StatusCodes.Status403Forbidden); // Authenticated but not authorized (wrong role)


// --- End API Endpoints ---

app.Run();

using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using FileBlogSystem.Endpoints;
using System.Text;
using Microsoft.OpenApi.Models;
using SixLabors.ImageSharp.Web.DependencyInjection;

// Create builder with explicit web root
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    ContentRootPath = AppContext.BaseDirectory, // /app in Docker
    WebRootPath = "Content"
});

// Load configuration
builder.Configuration.AddJsonFile("Config/site.json", optional: true);
builder.Services.Configure<SiteConfiguration>(builder.Configuration); 

// Register services
builder.Services.AddSingleton<IFileContentService, FileContentService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddImageSharp();
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// Swagger
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

// Lucene search service
builder.Services.AddSingleton<ILuceneSearchService>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var files = sp.GetRequiredService<IFileContentService>();
    return new LuceneSearchService(env, files, useArabic: false);
});

// JWT authentication
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

var app = builder.Build();

// Development tools
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serve static content from /Content
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/Content"), subApp =>
{
    subApp.UseImageSharp();

    subApp.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
            Path.Combine(builder.Environment.ContentRootPath, "Content")),
        RequestPath = "/Content",
        ServeUnknownFileTypes = true
    });
});

// Rebuild Lucene index
using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<ILuceneSearchService>()
         .RebuildIndexAsync();
}

// Default static files
app.UseStaticFiles();

// Authentication & authorization
app.UseAuthentication();
app.UseAuthorization();

// API endpoints
app.MapApiEndpoints();

// Fallback for frontend routing
app.MapFallbackToFile("{*path:nonfile}", "index.html");

app.Run();

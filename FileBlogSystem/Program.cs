using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using FileBlogSystem.Endpoints;
using System.Text;
using Microsoft.OpenApi.Models;
using SixLabors.ImageSharp.Web.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("config/site.json", optional: true);
builder.Services.Configure<SiteConfiguration>(builder.Configuration); 
builder.Services.AddSingleton<IFileContentService, FileContentService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddImageSharp();
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
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

builder.Services.AddSingleton<ILuceneSearchService>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var files = sp.GetRequiredService<IFileContentService>();
    // set useArabic: true to switch to ArabicAnalyzer
    return new LuceneSearchService(env, files, useArabic: false);
});


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

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/content"), subApp =>
{
    subApp.UseImageSharp();

    subApp.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
            Path.Combine(builder.Environment.ContentRootPath, "Content")),
        RequestPath = "/content",
        ServeUnknownFileTypes = true
    });
});

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<ILuceneSearchService>()
         .RebuildIndexAsync();
}

//app.UseDefaultFiles();
app.UseStaticFiles();
// app.UseStaticFiles(new StaticFileOptions
// {
//     FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
//         Path.Combine(builder.Environment.ContentRootPath, "content")),
//     RequestPath = "/content"
// });


app.UseAuthentication();
app.UseAuthorization();

app.MapApiEndpoints();

app.MapFallbackToFile("{*path:nonfile}", "index.html");

app.Run();

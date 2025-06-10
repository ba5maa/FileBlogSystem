using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("config/site.json", optional: false, reloadOnChange: true);
builder.Services.Configure<SiteConfiguration>(builder.Configuration); 
builder.Services.AddSingleton<IContentService, FileContentService>();

var app = builder.Build();

// just testing
var siteConfig = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<SiteConfiguration>>().Value;
Console.WriteLine($"Site Name from strongly-typed config: {siteConfig.SiteName}");

var siteName = app.Configuration["SiteName"];
Console.WriteLine($"Site Name from config: {siteName}");

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "content")),
    RequestPath = "/content" // Files from /content will be accessible via /content/{path}
});

app.MapGet("/", () => "Hello World!");

app.Run();

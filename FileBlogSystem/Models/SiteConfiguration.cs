namespace FileBlogSystem.Models
{
    public class SiteConfiguration
    {
        public string SiteName { get; set; } = "My File Blog";
        public string Description { get; set; } = "A lightweight, file-based blog system.";
        public int PostsPerPage { get; set; } = 5;
    }
}
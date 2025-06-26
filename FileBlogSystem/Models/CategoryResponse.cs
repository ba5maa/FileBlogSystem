namespace FileBlogSystem.Models
{
    public class CategoryResponse
    {
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; } 
    }
}
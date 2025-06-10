namespace FileBlogSystem.Models
{
    public class Category
    {
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty; // this will be the file name 
        public string? Description { get; set; } // optional description
    }
}
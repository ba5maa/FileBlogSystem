using System.ComponentModel.DataAnnotations; 
using System.Collections.Generic;

namespace FileBlogSystem.Models
{
    public class CreateBlogPostRequest
    {
        [Required]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        public List<string>? Tags { get; set; } = new List<string>();
        public List<string>? Categories { get; set; } = new List<string>();

        public string? CustomUrl { get; set; }
        public bool IsDraft { get; set; } = true;
        public string? ImageUrl { get; set; }
        public string? Base64Image { get; set; }
        public string? AuthorUsername { get; set; }
        public DateTime? PublishedDate { get; set; }
        public DateTime? ScheduledFor { get; set; }

    }
}
using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models
{
    public class CreateCategoryRequest
    {
        [Required]
        [MinLength(1)]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}
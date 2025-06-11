using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models
{
    public class UpdateCategoryRequest
    {
        [Required]
        [MinLength(1)]
        [MaxLength(100)]
        public string NewName { get; set; } = string.Empty;
         public string? Description { get; set; }
    }
}
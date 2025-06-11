using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models
{
    public class CreateTagRequest
    {
        [Required]
        [MinLength(1)]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
    }
}
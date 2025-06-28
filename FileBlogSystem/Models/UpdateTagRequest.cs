using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models
{
    public class UpdateTagRequest
    {
        public Guid Id { get; set; }

        [Required]
        [MinLength(1)]
        [MaxLength(100)]
        public string NewName { get; set; } = string.Empty;
    }
}
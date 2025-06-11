using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models
{
    public class UpdateUserRequest
    {
        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [MinLength(8)]
        [MaxLength(255)] 
        public string? HashedPassword { get; set; }

        public List<string> Roles { get; set; } = new List<string>();
    }
}